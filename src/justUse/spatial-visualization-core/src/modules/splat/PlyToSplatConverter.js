/**
 * PLY 到 SPLAT 格式转换器
 * @module modules/splat/PlyToSplatConverter
 * @description 将 PLY 格式的高斯泼溅文件转换为 SPLAT 格式
 * 
 * 格式说明:
 * - PLY: 包含高斯点的 position(x,y,z), scale, rotation(quaternion), color(SH coefficients)
 * - SPLAT: 每个高斯点 32 字节: position(12) + scale(12) + color(4) + rotation(4)
 */

import EventEmitter from '../../core/EventEmitter.js';
import EnvConfig from '../../core/EnvConfig.js';

const CHUNK_SIZE = 50000;

class PlyToSplatConverter extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logLevel: options.logLevel || 'info',
      validateInput: options.validateInput !== false,
      chunkSize: options.chunkSize || CHUNK_SIZE,
      yieldInterval: options.yieldInterval || 10,
      ...options
    };
    
    this.stats = {
      inputSize: 0,
      outputSize: 0,
      vertexCount: 0,
      conversionTime: 0,
      warnings: [],
      errors: []
    };
    
    this._cancelled = false;
  }

  cancel() {
    this._cancelled = true;
  }

  async convert(input, onProgress) {
    const startTime = performance.now();
    this._resetStats();
    this._cancelled = false;
    
    try {
      let arrayBuffer;
      let filename = 'unknown.ply';
      
      if (input instanceof File) {
        this.stats.inputSize = input.size;
        filename = input.name;
        arrayBuffer = await input.arrayBuffer();
      } else if (input instanceof ArrayBuffer) {
        this.stats.inputSize = input.byteLength;
        arrayBuffer = input;
      } else if (typeof input === 'string') {
        if (input.startsWith('blob:') || input.startsWith('http')) {
          const response = await fetch(input);
          arrayBuffer = await response.arrayBuffer();
          this.stats.inputSize = arrayBuffer.byteLength;
          filename = input.split('/').pop() || 'remote.ply';
        } else {
          throw new Error('Invalid input: string must be a URL');
        }
      } else {
        throw new Error('Invalid input type: expected File, ArrayBuffer, or URL string');
      }
      
      if (this.stats.inputSize > EnvConfig.maxFileSize) {
        throw new Error(`文件大小超过限制: ${this._formatBytes(this.stats.inputSize)} > ${this._formatBytes(EnvConfig.maxFileSize)}`);
      }
      
      this._log('info', `开始转换: ${filename} (${this._formatBytes(this.stats.inputSize)})`);
      
      const plyData = await this._parsePlyChunked(arrayBuffer, onProgress);
      
      const splatBuffer = await this._buildSplatBufferChunked(plyData, onProgress);
      
      this.stats.outputSize = splatBuffer.byteLength;
      this.stats.conversionTime = performance.now() - startTime;
      
      this._log('info', `转换完成: ${plyData.vertexCount} 个高斯点, 耗时 ${this.stats.conversionTime.toFixed(2)}ms`);
      this._log('info', `输出大小: ${this._formatBytes(this.stats.outputSize)} (压缩率: ${((1 - this.stats.outputSize / this.stats.inputSize) * 100).toFixed(1)}%)`);
      
      this.emit('converted', {
        stats: { ...this.stats },
        filename
      });
      
      return splatBuffer;
      
    } catch (error) {
      this.stats.errors.push(error.message);
      this._log('error', `转换失败: ${error.message}`);
      this.emit('error', { error, stats: { ...this.stats } });
      throw error;
    }
  }

  _resetStats() {
    this.stats = {
      inputSize: 0,
      outputSize: 0,
      vertexCount: 0,
      conversionTime: 0,
      warnings: [],
      errors: []
    };
  }

  async _parsePlyChunked(arrayBuffer, onProgress) {
    const decoder = new TextDecoder('ascii');
    const headerEnd = this._findHeaderEnd(arrayBuffer);
    
    if (headerEnd === -1) {
      throw new Error('无效的 PLY 文件: 未找到头部结束标记');
    }
    
    const headerText = decoder.decode(new Uint8Array(arrayBuffer, 0, headerEnd));
    const header = this._parseHeader(headerText);
    
    const dataOffset = headerEnd + 1;
    const dataBuffer = arrayBuffer.slice(dataOffset);
    
    let vertices;
    if (header.format === 'binary_little_endian') {
      vertices = await this._parseBinaryDataChunked(dataBuffer, header, onProgress);
    } else if (header.format === 'ascii') {
      const dataText = decoder.decode(new Uint8Array(dataBuffer));
      vertices = this._parseAsciiData(dataText, header);
    } else {
      throw new Error(`不支持的 PLY 格式: ${header.format}`);
    }
    
    return {
      header,
      vertices,
      vertexCount: vertices.length
    };
  }

  async _parseBinaryDataChunked(buffer, header, onProgress) {
    const vertices = [];
    const view = new DataView(buffer);
    const propMap = this._buildPropertyMap(header.properties);
    const chunkSize = this.options.chunkSize;
    const totalVertices = header.vertexCount;
    
    let offset = 0;
    for (let i = 0; i < totalVertices; i++) {
      if (this._cancelled) {
        throw new Error('转换已取消');
      }
      
      const vertex = {};
      
      for (const prop of header.properties) {
        const value = this._readValue(view, offset, prop.type);
        vertex[prop.name] = value;
        offset += prop.size;
      }
      
      vertices.push(this._normalizeVertex(vertex, propMap));
      
      if (i > 0 && i % chunkSize === 0) {
        if (onProgress) {
          onProgress({
            stage: 'parsing',
            current: i,
            total: totalVertices,
            percent: (i / totalVertices * 50).toFixed(1)
          });
        }
        await this._yield();
      }
    }
    
    return vertices;
  }

  async _buildSplatBufferChunked(plyData, onProgress) {
    const { vertices, vertexCount } = plyData;
    this.stats.vertexCount = vertexCount;
    
    const bufferSize = vertexCount * 32;
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    const chunkSize = this.options.chunkSize;
    
    for (let i = 0; i < vertexCount; i++) {
      if (this._cancelled) {
        throw new Error('转换已取消');
      }
      
      const v = vertices[i];
      const offset = i * 32;
      
      view.setFloat32(offset + 0, v.x, true);
      view.setFloat32(offset + 4, v.y, true);
      view.setFloat32(offset + 8, v.z, true);
      
      view.setFloat32(offset + 12, v.scale_0, true);
      view.setFloat32(offset + 16, v.scale_1, true);
      view.setFloat32(offset + 20, v.scale_2, true);
      
      const r = Math.max(0, Math.min(255, Math.round(v.f_dc_0 * 255)));
      const g = Math.max(0, Math.min(255, Math.round(v.f_dc_1 * 255)));
      const b = Math.max(0, Math.min(255, Math.round(v.f_dc_2 * 255)));
      const a = Math.max(0, Math.min(255, Math.round(v.opacity * 255)));
      
      view.setUint8(offset + 24, r);
      view.setUint8(offset + 25, g);
      view.setUint8(offset + 26, b);
      view.setUint8(offset + 27, a);
      
      view.setUint8(offset + 28, Math.round((v.rot_0 * 0.5 + 0.5) * 255));
      view.setUint8(offset + 29, Math.round((v.rot_1 * 0.5 + 0.5) * 255));
      view.setUint8(offset + 30, Math.round((v.rot_2 * 0.5 + 0.5) * 255));
      view.setUint8(offset + 31, Math.round((v.rot_3 * 0.5 + 0.5) * 255));
      
      if (i > 0 && i % chunkSize === 0) {
        if (onProgress) {
          onProgress({
            stage: 'building',
            current: i,
            total: vertexCount,
            percent: (50 + i / vertexCount * 50).toFixed(1)
          });
        }
        await this._yield();
      }
    }
    
    return buffer;
  }

  _yield() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  _findHeaderEnd(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const endHeader = [101, 110, 100, 95, 104, 101, 97, 100, 101, 114];
    
    for (let i = 0; i < bytes.length - endHeader.length; i++) {
      let match = true;
      for (let j = 0; j < endHeader.length; j++) {
        if (bytes[i + j] !== endHeader[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        return i + endHeader.length;
      }
    }
    return -1;
  }

  _parseHeader(headerText) {
    const lines = headerText.split('\n').map(l => l.trim()).filter(l => l);
    const header = {
      format: 'binary_little_endian',
      vertexCount: 0,
      properties: [],
      elementSize: 0
    };
    
    let inVertexElement = false;
    
    for (const line of lines) {
      const parts = line.split(/\s+/);
      
      if (parts[0] === 'format') {
        header.format = parts[1];
      } else if (parts[0] === 'element') {
        inVertexElement = parts[1] === 'vertex';
        if (inVertexElement) {
          header.vertexCount = parseInt(parts[2], 10);
        }
      } else if (parts[0] === 'property' && inVertexElement) {
        const type = parts[1];
        const name = parts[2];
        
        const typeSize = {
          'float': 4, 'float32': 4,
          'double': 8, 'float64': 8,
          'uchar': 1, 'uint8': 1,
          'char': 1, 'int8': 1,
          'ushort': 2, 'uint16': 2,
          'short': 2, 'int16': 2,
          'uint': 4, 'int32': 4,
          'int': 4
        };
        
        header.properties.push({ type, name, size: typeSize[type] || 4 });
        header.elementSize += typeSize[type] || 4;
      }
    }
    
    if (header.vertexCount === 0) {
      throw new Error('PLY 文件不包含顶点数据');
    }
    
    return header;
  }

  _parseAsciiData(dataText, header) {
    const vertices = [];
    const lines = dataText.split('\n').filter(l => l.trim());
    const propMap = this._buildPropertyMap(header.properties);
    
    for (let i = 0; i < Math.min(lines.length, header.vertexCount); i++) {
      const values = lines[i].trim().split(/\s+/).map(parseFloat);
      const vertex = {};
      
      for (let j = 0; j < header.properties.length && j < values.length; j++) {
        vertex[header.properties[j].name] = values[j];
      }
      
      vertices.push(this._normalizeVertex(vertex, propMap));
    }
    
    return vertices;
  }

  _buildPropertyMap(properties) {
    const map = {
      x: 'x', y: 'y', z: 'z',
      scale: [],
      rot: [],
      f_dc: [],
      f_rest: []
    };
    
    for (const prop of properties) {
      const name = prop.name.toLowerCase();
      
      if (name === 'x' || name === 'pos_x') map.x = prop.name;
      else if (name === 'y' || name === 'pos_y') map.y = prop.name;
      else if (name === 'z' || name === 'pos_z') map.z = prop.name;
      else if (name.startsWith('scale_')) map.scale.push(prop.name);
      else if (name.startsWith('rot_')) map.rot.push(prop.name);
      else if (name.startsWith('f_dc_')) map.f_dc.push(prop.name);
      else if (name.startsWith('f_rest_')) map.f_rest.push(prop.name);
      else if (name === 'opacity') map.opacity = prop.name;
      else if (name === 'red' || name === 'r') map.r = prop.name;
      else if (name === 'green' || name === 'g') map.g = prop.name;
      else if (name === 'blue' || name === 'b') map.b = prop.name;
    }
    
    return map;
  }

  _normalizeVertex(vertex, propMap) {
    const normalized = {
      x: vertex[propMap.x] || 0,
      y: vertex[propMap.y] || 0,
      z: vertex[propMap.z] || 0,
      scale_0: 1, scale_1: 1, scale_2: 1,
      rot_0: 1, rot_1: 0, rot_2: 0, rot_3: 0,
      f_dc_0: 0.5, f_dc_1: 0.5, f_dc_2: 0.5,
      opacity: 1
    };
    
    if (propMap.scale.length >= 3) {
      normalized.scale_0 = Math.exp(vertex[propMap.scale[0]] || 0);
      normalized.scale_1 = Math.exp(vertex[propMap.scale[1]] || 0);
      normalized.scale_2 = Math.exp(vertex[propMap.scale[2]] || 0);
    }
    
    if (propMap.rot.length >= 4) {
      normalized.rot_0 = vertex[propMap.rot[0]] || 1;
      normalized.rot_1 = vertex[propMap.rot[1]] || 0;
      normalized.rot_2 = vertex[propMap.rot[2]] || 0;
      normalized.rot_3 = vertex[propMap.rot[3]] || 0;
    }
    
    if (propMap.f_dc.length >= 3) {
      normalized.f_dc_0 = this._shToColor(vertex[propMap.f_dc[0]]);
      normalized.f_dc_1 = this._shToColor(vertex[propMap.f_dc[1]]);
      normalized.f_dc_2 = this._shToColor(vertex[propMap.f_dc[2]]);
    }
    
    if (propMap.r !== undefined) {
      normalized.f_dc_0 = (vertex[propMap.r] || 128) / 255;
      normalized.f_dc_1 = (vertex[propMap.g] || 128) / 255;
      normalized.f_dc_2 = (vertex[propMap.b] || 128) / 255;
    }
    
    if (propMap.opacity) {
      normalized.opacity = 1 / (1 + Math.exp(-vertex[propMap.opacity]));
    }
    
    return normalized;
  }

  _shToColor(sh) {
    return (sh * 0.28209479177387814 + 0.5);
  }

  _readValue(view, offset, type) {
    switch (type.toLowerCase()) {
      case 'float':
      case 'float32':
        return view.getFloat32(offset, true);
      case 'double':
      case 'float64':
        return view.getFloat64(offset, true);
      case 'uchar':
      case 'uint8':
        return view.getUint8(offset);
      case 'char':
      case 'int8':
        return view.getInt8(offset);
      case 'ushort':
      case 'uint16':
        return view.getUint16(offset, true);
      case 'short':
      case 'int16':
        return view.getInt16(offset, true);
      case 'uint':
      case 'uint32':
        return view.getUint32(offset, true);
      case 'int':
      case 'int32':
        return view.getInt32(offset, true);
      default:
        return view.getFloat32(offset, true);
    }
  }

  _log(level, message) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel = levels[this.options.logLevel] || 2;
    
    if (levels[level] <= currentLevel) {
      const prefix = `[PlyToSplatConverter]`;
      switch (level) {
        case 'error':
          console.error(prefix, message);
          break;
        case 'warn':
          console.warn(prefix, message);
          this.stats.warnings.push(message);
          break;
        case 'info':
          console.log(prefix, message);
          break;
        case 'debug':
          console.debug(prefix, message);
          break;
      }
    }
  }

  _formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  getStats() {
    return { ...this.stats };
  }

  generateReport() {
    return {
      timestamp: new Date().toISOString(),
      inputSize: this._formatBytes(this.stats.inputSize),
      outputSize: this._formatBytes(this.stats.outputSize),
      vertexCount: this.stats.vertexCount,
      conversionTime: `${this.stats.conversionTime.toFixed(2)}ms`,
      compressionRatio: this.stats.inputSize > 0 
        ? `${((1 - this.stats.outputSize / this.stats.inputSize) * 100).toFixed(1)}%`
        : 'N/A',
      warnings: this.stats.warnings.length,
      errors: this.stats.errors.length,
      warningDetails: this.stats.warnings,
      errorDetails: this.stats.errors
    };
  }
}

PlyToSplatConverter.convertFile = async function(input) {
  const converter = new PlyToSplatConverter();
  return converter.convert(input);
};

export default PlyToSplatConverter;

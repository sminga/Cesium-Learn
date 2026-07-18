/**
 * 高斯泼溅层
 * @module modules/splat/GaussianSplatLayer
 */

import EventEmitter from '../../core/EventEmitter.js';
import * as THREE from 'three';
import PlyToSplatConverter from './PlyToSplatConverter.js';

class GaussianSplatLayer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      modelUrl: null,
      modelData: null,
      position: { lon: 0, lat: 0, height: 0 },
      rotation: { heading: 0, pitch: 0, roll: 0 },
      scale: 1,
      opacity: 1,
      autoConvertPly: true,
      sortSplats: true,
      ...options
    };
    
    this.points = null;
    this.geometry = null;
    this.material = null;
    this._visible = true;
    this._loaded = false;
    this._converted = false;
    this._vertexCount = 0;
    this._converter = null;
  }

  async init() {
    if (!this.options.modelUrl && !this.options.modelData) {
      throw new Error('Model URL or data is required');
    }
    
    let url = this.options.modelUrl;
    
    if (url && (url.startsWith('blob:') || url.startsWith('data:'))) {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return this._loadFromArrayBuffer(arrayBuffer, url);
    }
    
    if (this.options.modelData) {
      return this._loadFromArrayBuffer(this.options.modelData, 'model.ply');
    }
    
    return this._loadFromUrl(url);
  }

  async _loadFromArrayBuffer(arrayBuffer, filename) {
    const isPly = this._isPlyFile(filename, arrayBuffer);
    
    if (isPly && this.options.autoConvertPly) {
      this.emit('converting', { filename });
      
      try {
        this._converter = new PlyToSplatConverter({ logLevel: 'info' });
        
        this.emit('convertProgress', { stage: 'converting', size: arrayBuffer.byteLength });
        
        const splatBuffer = await this._converter.convert(arrayBuffer);
        const stats = this._converter.getStats();
        
        this._vertexCount = stats.vertexCount;
        this._converted = true;
        
        this.emit('convertProgress', { stage: 'building', vertexCount: this._vertexCount });
        
        const splatData = new Uint8Array(splatBuffer);
        this._createPointCloudFromSplat(splatData);
        
        this.emit('loaded', { 
          filename, 
          converted: true,
          vertexCount: this._vertexCount
        });
        
        return this;
      } catch (convertError) {
        console.warn('[GaussianSplatLayer] PLY 转换失败:', convertError.message);
        this.emit('conversionFailed', { error: convertError });
        throw convertError;
      }
    }
    
    throw new Error('仅支持 PLY 格式文件');
  }

  async _loadFromUrl(url) {
    const isPly = url.toLowerCase().endsWith('.ply');
    
    if (isPly && this.options.autoConvertPly) {
      try {
        this.emit('converting', { filename: url });
        
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        
        this._converter = new PlyToSplatConverter({ logLevel: 'info' });
        
        this.emit('convertProgress', { stage: 'converting', size: arrayBuffer.byteLength });
        
        const splatBuffer = await this._converter.convert(arrayBuffer);
        const stats = this._converter.getStats();
        
        this._vertexCount = stats.vertexCount;
        this._converted = true;
        
        this.emit('convertProgress', { stage: 'building', vertexCount: this._vertexCount });
        
        const splatData = new Uint8Array(splatBuffer);
        this._createPointCloudFromSplat(splatData);
        
        this.emit('loaded', { 
          filename: url, 
          converted: true,
          vertexCount: this._vertexCount
        });
        
        return this;
      } catch (convertError) {
        console.warn('[GaussianSplatLayer] URL 转换失败:', convertError.message);
        throw convertError;
      }
    }
    
    throw new Error('仅支持 PLY 格式文件');
  }

  _isPlyFile(filename, arrayBuffer) {
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.endsWith('.ply')) return true;
    if (lowerFilename.includes('.ply')) return true;
    
    const header = new Uint8Array(arrayBuffer, 0, Math.min(3, arrayBuffer.byteLength));
    const headerStr = String.fromCharCode(...header);
    if (headerStr === 'ply') return true;
    
    return false;
  }

  _createPointCloudFromSplat(splatData) {
    const positions = new Float32Array(this._vertexCount * 3);
    const colors = new Float32Array(this._vertexCount * 3);
    const sizes = new Float32Array(this._vertexCount);
    
    const dataView = new DataView(splatData.buffer, splatData.byteOffset, splatData.byteLength);
    
    for (let i = 0; i < this._vertexCount; i++) {
      const offset = i * 32;
      
      positions[i * 3] = dataView.getFloat32(offset, true);
      positions[i * 3 + 1] = dataView.getFloat32(offset + 4, true);
      positions[i * 3 + 2] = dataView.getFloat32(offset + 8, true);
      
      const scaleX = dataView.getFloat32(offset + 12, true);
      const scaleY = dataView.getFloat32(offset + 16, true);
      const scaleZ = dataView.getFloat32(offset + 20, true);
      
      const r = splatData[offset + 24] / 255;
      const g = splatData[offset + 25] / 255;
      const b = splatData[offset + 26] / 255;
      
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
      
      const avgScale = (Math.abs(scaleX) + Math.abs(scaleY) + Math.abs(scaleZ)) / 3;
      sizes[i] = Math.max(0.01, Math.min(2, avgScale * 100));
    }
    
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    this.geometry.computeBoundingBox();
    this.geometry.center();
    
    this.material = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: this.options.opacity
    });
    
    this.points = new THREE.Points(this.geometry, this.material);
    this._loaded = true;
    
    this._updateTransform();
  }

  setPosition(lon, lat, height) {
    this.options.position = { lon, lat, height };
    this._updateTransform();
    this.emit('positionChanged', this.options.position);
  }

  setRotation(heading, pitch, roll) {
    this.options.rotation = { heading, pitch, roll };
    this._updateTransform();
    this.emit('rotationChanged', this.options.rotation);
  }

  setScale(scale) {
    this.options.scale = scale;
    this._updateTransform();
    this.emit('scaleChanged', scale);
  }

  setOpacity(opacity) {
    this.options.opacity = opacity;
    if (this.material) {
      this.material.opacity = opacity;
    }
    this.emit('opacityChanged', opacity);
  }

  _updateTransform() {
    if (!this.points) return;
    
    const { rotation, scale } = this.options;
    
    this.points.rotation.set(
      rotation.pitch * Math.PI / 180,
      rotation.heading * Math.PI / 180,
      rotation.roll * Math.PI / 180
    );
    
    this.points.scale.setScalar(scale);
  }

  show() {
    if (this.points) {
      this.points.visible = true;
      this._visible = true;
      this.emit('visibilityChanged', true);
    }
  }

  hide() {
    if (this.points) {
      this.points.visible = false;
      this._visible = false;
      this.emit('visibilityChanged', false);
    }
  }

  getMesh() {
    return this.points;
  }

  isLoaded() {
    return this._loaded;
  }

  getVertexCount() {
    return this._vertexCount;
  }

  destroy() {
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    if (this.points) {
      this.points = null;
    }
    
    this._loaded = false;
    this._converted = false;
    this._vertexCount = 0;
    this.removeAllListeners();
  }
}

export default GaussianSplatLayer;

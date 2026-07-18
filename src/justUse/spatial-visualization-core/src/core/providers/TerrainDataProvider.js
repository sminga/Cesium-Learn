/**
 * 地形数据提供者
 * @module core/providers/TerrainDataProvider
 * @description 提供地形高程数据，支持 DEM 文件加载和查询
 */

import EventEmitter from '../EventEmitter.js';
import IDataProvider from '../interfaces/IDataProvider.js';

class TerrainDataProvider extends IDataProvider {
  constructor(options = {}) {
    super();
    EventEmitter.call(this);
    
    this.options = {
      cacheSize: 1000,
      interpolationMethod: 'bilinear',
      ...options
    };
    
    this.demData = null;
    this._loading = false;
    this._ready = false;
    this._cache = new Map();
    this._spatialIndex = null;
  }

  async loadFromURL(url) {
    this._loading = true;
    this.emit('loading', { url });
    
    try {
      const response = await fetch(url);
      const text = await response.text();
      this.demData = this._parseDEM(text);
      
      this._buildSpatialIndex();
      this._ready = true;
      this._loading = false;
      
      this.emit('loaded', this.demData);
      return this.demData;
    } catch (error) {
      this._loading = false;
      this.emit('error', { error });
      throw error;
    }
  }

  async loadFromFile(file) {
    this._loading = true;
    this.emit('loading', { file: file.name });
    
    try {
      const text = await file.text();
      this.demData = this._parseDEM(text);
      
      this._buildSpatialIndex();
      this._ready = true;
      this._loading = false;
      
      this.emit('loaded', this.demData);
      return this.demData;
    } catch (error) {
      this._loading = false;
      this.emit('error', { error });
      throw error;
    }
  }

  loadFromData(demData) {
    this.demData = demData;
    this._buildSpatialIndex();
    this._ready = true;
    this.emit('loaded', demData);
    return this.demData;
  }

  _parseDEM(text) {
    const lines = text.trim().split('\n');
    const header = {};
    let dataStartIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('ncols')) {
        header.ncols = parseInt(line.split(/\s+/)[1]);
      } else if (line.startsWith('nrows')) {
        header.nrows = parseInt(line.split(/\s+/)[1]);
      } else if (line.startsWith('xllcorner')) {
        header.xllcorner = parseFloat(line.split(/\s+/)[1]);
      } else if (line.startsWith('yllcorner')) {
        header.yllcorner = parseFloat(line.split(/\s+/)[1]);
      } else if (line.startsWith('cellsize')) {
        header.cellsize = parseFloat(line.split(/\s+/)[1]);
      } else if (line.startsWith('NODATA_value')) {
        header.nodata = parseFloat(line.split(/\s+/)[1]);
        dataStartIndex = i + 1;
        break;
      }
    }
    
    const data = new Float32Array(header.ncols * header.nrows);
    let dataIndex = 0;
    
    for (let i = dataStartIndex; i < lines.length && dataIndex < data.length; i++) {
      const values = lines[i].trim().split(/\s+/);
      for (const val of values) {
        if (dataIndex < data.length) {
          data[dataIndex++] = parseFloat(val);
        }
      }
    }
    
    return {
      ...header,
      data,
      width: header.ncols,
      height: header.nrows
    };
  }

  _buildSpatialIndex() {
    // 简单的网格索引
    this._spatialIndex = {
      minLon: this.demData.xllcorner,
      maxLon: this.demData.xllcorner + this.demData.ncols * this.demData.cellsize,
      minLat: this.demData.yllcorner,
      maxLat: this.demData.yllcorner + this.demData.nrows * this.demData.cellsize,
      cellsize: this.demData.cellsize,
      ncols: this.demData.ncols,
      nrows: this.demData.nrows
    };
  }

  async getDataAt(lon, lat, height = 0) {
    if (!this._ready) {
      throw new Error('TerrainDataProvider not ready');
    }
    
    const cacheKey = `${lon.toFixed(6)}_${lat.toFixed(6)}`;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey);
    }
    
    const elevation = this._getElevationAt(lon, lat);
    const result = {
      lon,
      lat,
      elevation,
      slope: this._calculateSlope(lon, lat),
      aspect: this._calculateAspect(lon, lat)
    };
    
    if (this._cache.size >= this.options.cacheSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(cacheKey, result);
    
    return result;
  }

  _getElevationAt(lon, lat) {
    if (!this._spatialIndex) return null;
    
    const { minLon, minLat, cellsize, ncols, nrows } = this._spatialIndex;
    
    const x = (lon - minLon) / cellsize;
    const y = (nrows - 1) - (lat - minLat) / cellsize;
    
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, ncols - 1);
    const y1 = Math.min(y0 + 1, nrows - 1);
    
    if (x0 < 0 || y0 < 0 || x0 >= ncols || y0 >= nrows) {
      return null;
    }
    
    const fx = x - x0;
    const fy = y - y0;
    
    const idx00 = y0 * ncols + x0;
    const idx10 = y0 * ncols + x1;
    const idx01 = y1 * ncols + x0;
    const idx11 = y1 * ncols + x1;
    
    const e00 = this.demData.data[idx00];
    const e10 = this.demData.data[idx10];
    const e01 = this.demData.data[idx01];
    const e11 = this.demData.data[idx11];
    
    if (e00 === this.demData.nodata || e10 === this.demData.nodata ||
        e01 === this.demData.nodata || e11 === this.demData.nodata) {
      return null;
    }
    
    return e00 * (1 - fx) * (1 - fy) + e10 * fx * (1 - fy) +
           e01 * (1 - fx) * fy + e11 * fx * fy;
  }

  _calculateSlope(lon, lat) {
    const cellsize = this.demData.cellsize;
    const e = this._getElevationAt(lon, lat);
    const eN = this._getElevationAt(lon, lat + cellsize);
    const eS = this._getElevationAt(lon, lat - cellsize);
    const eE = this._getElevationAt(lon + cellsize, lat);
    const eW = this._getElevationAt(lon - cellsize, lat);
    
    if (e === null || eN === null || eS === null || eE === null || eW === null) {
      return 0;
    }
    
    const dzdx = (eE - eW) / (2 * cellsize);
    const dzdy = (eN - eS) / (2 * cellsize);
    
    return Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180 / Math.PI;
  }

  _calculateAspect(lon, lat) {
    const cellsize = this.demData.cellsize;
    const eN = this._getElevationAt(lon, lat + cellsize);
    const eS = this._getElevationAt(lon, lat - cellsize);
    const eE = this._getElevationAt(lon + cellsize, lat);
    const eW = this._getElevationAt(lon - cellsize, lat);
    
    if (eN === null || eS === null || eE === null || eW === null) {
      return 0;
    }
    
    const dzdx = (eE - eW) / (2 * cellsize);
    const dzdy = (eN - eS) / (2 * cellsize);
    
    return Math.atan2(dzdy, -dzdx) * 180 / Math.PI;
  }

  getExtent() {
    if (!this._spatialIndex) return null;
    
    return {
      minLon: this._spatialIndex.minLon,
      maxLon: this._spatialIndex.maxLon,
      minLat: this._spatialIndex.minLat,
      maxLat: this._spatialIndex.maxLat
    };
  }

  isLoading() {
    return this._loading;
  }

  isReady() {
    return this._ready;
  }

  getDEMData() {
    return this.demData;
  }

  clearCache() {
    this._cache.clear();
  }

  destroy() {
    this.demData = null;
    this._spatialIndex = null;
    this._cache.clear();
    this._ready = false;
    this.removeAllListeners();
  }
}

Object.assign(TerrainDataProvider.prototype, EventEmitter.prototype);

export default TerrainDataProvider;

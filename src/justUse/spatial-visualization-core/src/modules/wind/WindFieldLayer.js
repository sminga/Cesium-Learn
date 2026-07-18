/**
 * 风场可视化层
 * @module modules/wind/WindFieldLayer
 */

import Particle3D from '../../particle3D.js';
import EventEmitter from '../../core/EventEmitter.js';

class WindFieldLayer extends EventEmitter {
  constructor(viewer, options = {}) {
    super();
    
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.options = {
      particlesTextureSize: 64,
      maxParticles: 64 * 64,
      particleHeight: 1000,
      fadeOpacity: 0.996,
      dropRate: 0.003,
      dropRateBump: 0.01,
      speedFactor: 1.0,
      lineWidth: 2.0,
      color: [1.0, 0.8, 0.0, 1.0],
      ...options
    };
    
    this.particleSystem = null;
    this.windData = null;
    this._visible = true;
  }

  async loadWindData(source, fieldNames = {}) {
    const defaultFields = {
      U: 'U',
      V: 'V',
      lon: 'lon',
      lat: 'lat',
      lev: 'lev'
    };
    
    const fields = { ...defaultFields, ...fieldNames };
    
    if (typeof source === 'string') {
      const response = await fetch(source);
      const arrayBuffer = await response.arrayBuffer();
      this.windData = await this._parseNetCDF(arrayBuffer, fields);
    } else if (source instanceof ArrayBuffer) {
      this.windData = await this._parseNetCDF(source, fields);
    } else if (source instanceof File) {
      const arrayBuffer = await source.arrayBuffer();
      this.windData = await this._parseNetCDF(arrayBuffer, fields);
    }
    
    this.emit('dataLoaded', this.windData);
    return this.windData;
  }

  async _parseNetCDF(arrayBuffer, fields) {
    const netcdfjs = await import('netcdfjs');
    const reader = new netcdfjs.default(arrayBuffer);
    
    const dimensions = {};
    reader.dimensions.forEach(dim => {
      dimensions[dim.name] = dim.size;
    });
    
    const variables = {};
    reader.variables.forEach(variable => {
      variables[variable.name] = {
        dimensions: variable.dimensions,
        data: reader.getDataVariable(variable.name)
      };
    });
    
    const uData = variables[fields.U]?.data;
    const vData = variables[fields.V]?.data;
    const lonData = variables[fields.lon]?.data;
    const latData = variables[fields.lat]?.data;
    const levData = variables[fields.lev]?.data;
    
    if (!uData || !vData) {
      throw new Error('Wind data not found in NetCDF file');
    }
    
    return {
      dimensions,
      u: uData,
      v: vData,
      lon: lonData,
      lat: latData,
      lev: levData,
      extent: {
        minLon: lonData ? Math.min(...lonData) : 0,
        maxLon: lonData ? Math.max(...lonData) : 360,
        minLat: latData ? Math.min(...latData) : -90,
        maxLat: latData ? Math.max(...latData) : 90
      }
    };
  }

  async init() {
    if (!this.windData) {
      throw new Error('Wind data not loaded. Call loadWindData() first.');
    }
    
    this.particleSystem = new Particle3D(
      this.scene.context,
      this.windData,
      this.options
    );
    
    this.scene.primitives.add(this.particleSystem.primitives);
    
    this.emit('initialized');
    return this;
  }

  show() {
    if (this.particleSystem) {
      this.particleSystem.show();
      this._visible = true;
      this.emit('visibilityChanged', true);
    }
  }

  hide() {
    if (this.particleSystem) {
      this.particleSystem.hide();
      this._visible = false;
      this.emit('visibilityChanged', false);
    }
  }

  toggle() {
    if (this._visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  setOptions(options) {
    Object.assign(this.options, options);
    if (this.particleSystem) {
      this.particleSystem.setOptions(options);
    }
  }

  getVisibleWindData(lon, lat) {
    if (!this.windData) return null;
    
    const { u, v, lon: lons, lat: lats } = this.windData;
    
    const lonIndex = Math.floor((lon - lons[0]) / (lons[1] - lons[0]));
    const latIndex = Math.floor((lat - lats[0]) / (lats[1] - lats[0]));
    
    if (lonIndex < 0 || latIndex < 0 || 
        lonIndex >= lons.length || latIndex >= lats.length) {
      return null;
    }
    
    const index = latIndex * lons.length + lonIndex;
    
    return {
      u: u[index],
      v: v[index],
      speed: Math.sqrt(u[index] * u[index] + v[index] * v[index]),
      direction: Math.atan2(u[index], v[index]) * 180 / Math.PI
    };
  }

  destroy() {
    if (this.particleSystem) {
      this.scene.primitives.remove(this.particleSystem.primitives);
      this.particleSystem.destroy();
      this.particleSystem = null;
    }
    
    this.windData = null;
    this.removeAllListeners();
  }
}

export default WindFieldLayer;

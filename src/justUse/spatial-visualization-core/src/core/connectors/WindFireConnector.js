/**
 * 风场驱动火蔓延连接器
 * @module core/connectors/WindFireConnector
 * @description 实现风场数据驱动火蔓延模拟
 */

import EventEmitter from '../EventEmitter.js';

class WindFireConnector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      updateInterval: 1000,
      interpolationMethod: 'bilinear',
      ...options
    };
    
    this.windLayer = null;
    this.fireController = null;
    this._enabled = false;
    this._updateTimer = null;
  }

  connect(windLayer, fireController) {
    this.windLayer = windLayer;
    this.fireController = fireController;
    
    this.windLayer.on('dataUpdated', () => {
      if (this._enabled) {
        this._updateFireWind();
      }
    });
    
    this.fireController.on('beforePropagate', () => {
      if (this._enabled) {
        this._updateLocalWind();
      }
    });
    
    this.emit('connected', { windLayer, fireController });
    return this;
  }

  enable() {
    if (!this.windLayer || !this.fireController) {
      throw new Error('WindFireConnector not connected');
    }
    
    this._enabled = true;
    
    if (this.options.updateInterval > 0) {
      this._updateTimer = setInterval(() => {
        this._updateFireWind();
      }, this.options.updateInterval);
    }
    
    this.emit('enabled');
  }

  disable() {
    this._enabled = false;
    
    if (this._updateTimer) {
      clearInterval(this._updateTimer);
      this._updateTimer = null;
    }
    
    this.emit('disabled');
  }

  isEnabled() {
    return this._enabled;
  }

  _updateFireWind() {
    if (!this.windLayer || !this.fireController) return;
    
    const center = this._getFireCenter();
    if (!center) return;
    
    const windData = this._getInterpolatedWind(center.lon, center.lat);
    if (windData) {
      this.fireController.engine.setWind(windData.speed, windData.direction);
      this.emit('windUpdated', windData);
    }
  }

  _updateLocalWind() {
    if (!this.windLayer || !this.fireController) return;
    
    const boundary = this.fireController.getBoundary();
    if (!boundary || boundary.length === 0) return;
    
    const localWinds = boundary.map(point => {
      const wind = this._getInterpolatedWind(point.lon, point.lat);
      return {
        ...point,
        localWindSpeed: wind ? wind.speed : 0,
        localWindDirection: wind ? wind.direction : 0
      };
    });
    
    this.emit('localWindsUpdated', localWinds);
    return localWinds;
  }

  _getFireCenter() {
    if (!this.fireController || !this.fireController.engine) return null;
    
    const boundary = this.fireController.getBoundary();
    if (!boundary || boundary.length === 0) return null;
    
    let sumLon = 0, sumLat = 0;
    boundary.forEach(p => {
      sumLon += p.lon;
      sumLat += p.lat;
    });
    
    return {
      lon: sumLon / boundary.length,
      lat: sumLat / boundary.length
    };
  }

  _getInterpolatedWind(lon, lat) {
    if (!this.windLayer || !this.windLayer.windData) return null;
    
    const windData = this.windLayer.windData;
    const { u, v, lon: lons, lat: lats } = windData;
    
    if (!lons || !lats || !u || !v) return null;
    
    const lonMin = Math.min(...lons);
    const lonMax = Math.max(...lons);
    const latMin = Math.min(...lats);
    const latMax = Math.max(...lats);
    
    if (lon < lonMin || lon > lonMax || lat < latMin || lat > latMax) {
      return null;
    }
    
    const lonStep = lons.length > 1 ? lons[1] - lons[0] : 1;
    const latStep = lats.length > 1 ? lats[1] - lats[0] : 1;
    
    const lonIndex = (lon - lons[0]) / lonStep;
    const latIndex = (lat - lats[0]) / latStep;
    
    const i0 = Math.floor(lonIndex);
    const j0 = Math.floor(latIndex);
    const i1 = Math.min(i0 + 1, lons.length - 1);
    const j1 = Math.min(j0 + 1, lats.length - 1);
    
    const fx = lonIndex - i0;
    const fy = latIndex - j0;
    
    const idx00 = j0 * lons.length + i0;
    const idx10 = j0 * lons.length + i1;
    const idx01 = j1 * lons.length + i0;
    const idx11 = j1 * lons.length + i1;
    
    const u00 = u[idx00] || 0;
    const u10 = u[idx10] || 0;
    const u01 = u[idx01] || 0;
    const u11 = u[idx11] || 0;
    
    const v00 = v[idx00] || 0;
    const v10 = v[idx10] || 0;
    const v01 = v[idx01] || 0;
    const v11 = v[idx11] || 0;
    
    const uInterp = u00 * (1 - fx) * (1 - fy) + u10 * fx * (1 - fy) + 
                    u01 * (1 - fx) * fy + u11 * fx * fy;
    const vInterp = v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + 
                    v01 * (1 - fx) * fy + v11 * fx * fy;
    
    const speed = Math.sqrt(uInterp * uInterp + vInterp * vInterp);
    const direction = Math.atan2(vInterp, uInterp) * 180 / Math.PI;
    
    return {
      u: uInterp,
      v: vInterp,
      speed,
      direction
    };
  }

  getWindAt(lon, lat) {
    return this._getInterpolatedWind(lon, lat);
  }

  destroy() {
    this.disable();
    this.windLayer = null;
    this.fireController = null;
    this.removeAllListeners();
  }
}

export default WindFireConnector;

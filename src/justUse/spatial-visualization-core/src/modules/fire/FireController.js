/**
 * 林火蔓延控制器
 * @module modules/fire/FireController
 */

import EventEmitter from '../../core/EventEmitter.js';
import FireSpreadEngine from './FireSpreadEngine.js';
import FireBoundaryLayer from './FireBoundaryLayer.js';

class FireController extends EventEmitter {
  constructor(viewer, options = {}) {
    super();
    
    this.viewer = viewer;
    this.options = {
      autoUpdate: true,
      updateInterval: 1000,
      windDriven: false,
      ...options
    };
    
    this.engine = null;
    this.boundaryLayer = null;
    this.windFieldLayer = null;
    this._updateTimer = null;
    this._isRunning = false;
  }

  init(demData) {
    this.engine = new FireSpreadEngine(demData, this.options);
    this.boundaryLayer = new FireBoundaryLayer(this.viewer, this.options);
    
    this.engine.on('propagated', (data) => {
      const geojson = this.engine.getGeoJSON();
      if (geojson) {
        this.boundaryLayer.updateFromGeoJSON(geojson);
      }
      this.emit('propagated', data);
    });
    
    this.emit('initialized');
    return this;
  }

  setWindField(windFieldLayer) {
    this.windFieldLayer = windFieldLayer;
    this.options.windDriven = true;
    
    if (this.engine) {
      this._updateWindFromField();
    }
  }

  _updateWindFromField() {
    if (!this.windFieldLayer || !this.engine) return;
    
    const center = this._getFireCenter();
    if (!center) return;
    
    const windData = this.windFieldLayer.getVisibleWindData(center.lon, center.lat);
    if (windData) {
      this.engine.setWind(windData.speed, windData.direction);
    }
  }

  _getFireCenter() {
    if (!this.engine || this.engine.boundary.length === 0) return null;
    
    const boundary = this.engine.getBoundary();
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

  ignite(lon, lat) {
    if (!this.engine) {
      throw new Error('FireController not initialized');
    }
    
    const result = this.engine.ignite(lon, lat);
    this.emit('ignited', { lon, lat, ...result });
    
    return result;
  }

  start() {
    if (this._isRunning) return;
    
    this._isRunning = true;
    
    if (this.options.autoUpdate) {
      this._updateTimer = setInterval(() => {
        this.step();
      }, this.options.updateInterval);
    }
    
    this.emit('started');
  }

  stop() {
    if (!this._isRunning) return;
    
    this._isRunning = false;
    
    if (this._updateTimer) {
      clearInterval(this._updateTimer);
      this._updateTimer = null;
    }
    
    this.emit('stopped');
  }

  step(timeStep = 1) {
    if (!this.engine) return null;
    
    if (this.options.windDriven && this.windFieldLayer) {
      this._updateWindFromField();
    }
    
    return this.engine.propagate(timeStep);
  }

  reset() {
    this.stop();
    
    if (this.engine) {
      this.engine.reset();
    }
    
    if (this.boundaryLayer) {
      this.boundaryLayer.clear();
    }
    
    this.emit('reset');
  }

  getStatistics() {
    return this.engine ? this.engine.statistics : null;
  }

  getBoundary() {
    return this.engine ? this.engine.getBoundary() : [];
  }

  destroy() {
    this.stop();
    
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    
    if (this.boundaryLayer) {
      this.boundaryLayer.destroy();
      this.boundaryLayer = null;
    }
    
    this.windFieldLayer = null;
    this.removeAllListeners();
  }
}

export default FireController;

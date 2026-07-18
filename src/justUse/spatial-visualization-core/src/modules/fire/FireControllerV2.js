/**
 * 增强版火场控制器
 * @module modules/fire/FireControllerV2
 * @description 整合火蔓延引擎、可视化层、风场连接的综合控制器
 */

import EventEmitter from '../../core/EventEmitter.js';
import FireSpreadEngineV2 from './FireSpreadEngineV2.js';
import FireVisualizationLayer from './FireVisualizationLayer.js';
import { listFuelModels, getFuelModel } from './FuelModels.js';

class FireControllerV2 extends EventEmitter {
  constructor(viewer, options = {}) {
    super();
    
    this.viewer = viewer;
    
    this.options = {
      autoUpdate: options.autoUpdate !== false,
      updateInterval: options.updateInterval || 500,
      useWebWorker: options.useWebWorker || false,
      timeStep: options.timeStep || 1,
      ...options
    };
    
    this.engine = null;
    this.visualization = null;
    this.windConnector = null;
    
    this._updateTimer = null;
    this._isRunning = false;
    this._initialized = false;
    this._demData = null;
  }

  async init(demData) {
    this._demData = demData;
    
    this.engine = new FireSpreadEngineV2(demData, {
      ...this.options,
      useWebWorker: this.options.useWebWorker
    });
    
    this.visualization = new FireVisualizationLayer(this.viewer, {
      showBoundary: true,
      showFlames: true,
      showSmoke: true,
      ...this.options.visualizationOptions
    });
    
    this.engine.on('propagated', (data) => {
      this.visualization.updateFromEngine(this.engine);
      this.emit('propagated', data);
    });
    
    this.engine.on('ignited', (data) => {
      this.emit('ignited', data);
    });
    
    this.engine.on('windChanged', (data) => {
      this.visualization.setWindData(data.speed, data.direction);
      this.emit('windChanged', data);
    });
    
    this._initialized = true;
    this.emit('initialized');
    
    return this;
  }

  setWindConnector(windConnector) {
    this.windConnector = windConnector;
    
    if (this.engine && windConnector) {
      windConnector.on('windUpdated', (data) => {
        this.engine.setWind(data.speed, data.direction);
      });
    }
  }

  ignite(lon, lat) {
    if (!this._initialized || !this.engine) {
      throw new Error('FireControllerV2 not initialized');
    }
    
    const result = this.engine.ignite(lon, lat);
    
    this.visualization.updateFromEngine(this.engine);
    
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

  step(timeStep = null) {
    if (!this.engine) return null;
    
    const ts = timeStep !== null ? timeStep : this.options.timeStep;
    
    if (this.windConnector) {
      const center = this.getCenter();
      if (center) {
        const windData = this.windConnector.getWindAt(center.lon, center.lat);
        if (windData) {
          this.engine.setWind(windData.speed, windData.direction);
        }
      }
    }
    
    return this.engine.propagate(ts);
  }

  setWind(speed, direction) {
    if (this.engine) {
      this.engine.setWind(speed, direction);
    }
  }

  setFuelModel(modelId, customParams = null) {
    if (this.engine) {
      this.engine.setFuelModel(modelId, customParams);
      this.emit('fuelModelChanged', { modelId, customParams });
    }
  }

  setMoisture(moisture) {
    if (this.engine) {
      this.engine.setMoisture(moisture);
    }
  }

  setFuelAt(lon, lat, fuelModelId) {
    if (this.engine && this._demData) {
      const x = Math.round((lon - this._demData.xllcorner) / this._demData.cellsize);
      const y = Math.round((this._demData.yllcorner + this._demData.nrows * this._demData.cellsize - lat) / this._demData.cellsize);
      this.engine.setFuelAt(x, y, fuelModelId);
    }
  }

  setVisualizationOptions(options) {
    if (this.visualization) {
      this.visualization.setOptions(options);
    }
  }

  showBoundary(show) {
    if (this.visualization) {
      this.visualization.showBoundary(show);
    }
  }

  showFlames(show) {
    if (this.visualization) {
      this.visualization.showFlames(show);
    }
  }

  showSmoke(show) {
    if (this.visualization) {
      this.visualization.showSmoke(show);
    }
  }

  getStatistics() {
    return this.engine ? { ...this.engine.statistics } : null;
  }

  getBoundary() {
    return this.engine ? this.engine.getBoundary() : [];
  }

  getCenter() {
    const boundary = this.getBoundary();
    if (boundary.length === 0) return null;
    
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

  getHistory() {
    return this.engine ? this.engine.getHistory() : [];
  }

  getGeoJSON() {
    return this.engine ? this.engine.getGeoJSON() : null;
  }

  getFuelModels() {
    return listFuelModels();
  }

  getFuelModel(modelId) {
    return getFuelModel(modelId);
  }

  isRunning() {
    return this._isRunning;
  }

  isInitialized() {
    return this._initialized;
  }

  reset() {
    this.stop();
    
    if (this.engine) {
      this.engine.reset();
    }
    
    if (this.visualization) {
      this.visualization.clear();
    }
    
    this.emit('reset');
  }

  destroy() {
    this.stop();
    
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    
    if (this.visualization) {
      this.visualization.destroy();
      this.visualization = null;
    }
    
    this.windConnector = null;
    this._demData = null;
    this._initialized = false;
    
    this.removeAllListeners();
  }
}

export default FireControllerV2;

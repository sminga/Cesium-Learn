/**
 * 燃烧概率估计器
 * @module modules/fire/BurnProbabilityEstimator
 * @description 年度燃烧概率估计
 * 参考: ELMFIRE 年度燃烧概率估计功能
 */

import EventEmitter from '../../core/EventEmitter.js';

class BurnProbabilityEstimator extends EventEmitter {
  constructor(engine, options = {}) {
    super();
    
    this.engine = engine;
    
    this.options = {
      simulationYears: options.simulationYears || 1000,
      ignitionProbability: options.ignitionProbability || null,
      weatherSampler: options.weatherSampler || null,
      seed: options.seed || null,
      ...options
    };
    
    this.probabilityGrid = null;
    this.flameLengthGrid = null;
    this.intensityGrid = null;
    
    this._running = false;
    this._progress = 0;
  }

  async estimate(region, options = {}) {
    const {
      simulationYears = this.options.simulationYears,
      onProgress = null
    } = options;
    
    this._running = true;
    this._progress = 0;
    
    const { width, height } = this._getGridDimensions(region);
    const gridSize = width * height;
    
    this.probabilityGrid = new Float32Array(gridSize);
    this.flameLengthGrid = new Float32Array(gridSize);
    this.intensityGrid = new Float32Array(gridSize);
    
    this.emit('estimationStarted', { simulationYears, region });
    
    for (let year = 0; year < simulationYears; year++) {
      if (!this._running) break;
      
      const ignition = this._sampleIgnition(region);
      const weather = this._sampleWeather();
      
      this.engine.reset();
      this.engine.setWind(weather.windSpeed, weather.windDirection);
      this.engine.setMoisture(weather.moisture);
      
      this.engine.ignite(ignition.lon, ignition.lat);
      
      const maxSteps = 100;
      for (let step = 0; step < maxSteps; step++) {
        const result = this.engine.propagate(1);
        if (!result.boundary || result.boundary.length === 0) {
          break;
        }
      }
      
      this._accumulateResults();
      
      this._progress = (year + 1) / simulationYears;
      
      if (onProgress) {
        onProgress(this._progress);
      }
      
      if (year % 100 === 0) {
        this.emit('progress', { year, total: simulationYears, progress: this._progress });
      }
    }
    
    this._finalizeResults(simulationYears);
    
    this._running = false;
    
    const result = {
      probabilityGrid: this.probabilityGrid,
      flameLengthGrid: this.flameLengthGrid,
      intensityGrid: this.intensityGrid,
      dimensions: { width, height },
      simulationYears
    };
    
    this.emit('estimationComplete', result);
    
    return result;
  }

  _getGridDimensions(region) {
    if (this.engine && this.engine.dem) {
      return {
        width: this.engine.dem.ncols,
        height: this.engine.dem.nrows
      };
    }
    
    return {
      width: region.width || 100,
      height: region.height || 100
    };
  }

  _sampleIgnition(region) {
    if (this.options.ignitionProbability) {
      return this._weightedSample(region);
    }
    
    const minLon = region.minLon || 0;
    const maxLon = region.maxLon || 1;
    const minLat = region.minLat || 0;
    const maxLat = region.maxLat || 1;
    
    return {
      lon: minLon + Math.random() * (maxLon - minLon),
      lat: minLat + Math.random() * (maxLat - minLat)
    };
  }

  _weightedSample(region) {
    const probGrid = this.options.ignitionProbability;
    const total = probGrid.reduce((sum, val) => sum + val, 0);
    
    let r = Math.random() * total;
    let index = 0;
    
    for (let i = 0; i < probGrid.length; i++) {
      r -= probGrid[i];
      if (r <= 0) {
        index = i;
        break;
      }
    }
    
    const { width, height } = this._getGridDimensions(region);
    const x = index % width;
    const y = Math.floor(index / width);
    
    const cellSize = region.cellSize || 30;
    const minLon = region.minLon || 0;
    const minLat = region.minLat || 0;
    
    return {
      lon: minLon + x * cellSize,
      lat: minLat + (height - y) * cellSize
    };
  }

  _sampleWeather() {
    if (this.options.weatherSampler) {
      return this.options.weatherSampler();
    }
    
    return {
      windSpeed: 2 + Math.random() * 8,
      windDirection: Math.random() * 360,
      moisture: 0.05 + Math.random() * 0.2,
      temperature: 20 + Math.random() * 15,
      humidity: 30 + Math.random() * 40
    };
  }

  _accumulateResults() {
    if (!this.engine.fireGrid) return;
    
    const fireGrid = this.engine.fireGrid;
    const intensityGrid = this.engine.intensityGrid;
    
    for (let i = 0; i < fireGrid.length; i++) {
      if (fireGrid[i] >= 0 && fireGrid[i] < 1000) {
        this.probabilityGrid[i]++;
        
        if (intensityGrid) {
          this.intensityGrid[i] += intensityGrid[i];
        }
      }
    }
    
    if (this.engine.statistics && this.engine.statistics.maxFlameLength) {
      for (let i = 0; i < this.flameLengthGrid.length; i++) {
        if (fireGrid[i] >= 0 && fireGrid[i] < 1000) {
          this.flameLengthGrid[i] = Math.max(
            this.flameLengthGrid[i],
            this.engine.statistics.maxFlameLength
          );
        }
      }
    }
  }

  _finalizeResults(simulationYears) {
    for (let i = 0; i < this.probabilityGrid.length; i++) {
      this.probabilityGrid[i] /= simulationYears;
      
      if (this.probabilityGrid[i] > 0) {
        this.intensityGrid[i] /= this.probabilityGrid[i] * simulationYears;
      }
    }
  }

  getProbabilityAt(lon, lat) {
    if (!this.probabilityGrid) return null;
    
    const { width, height } = this._getGridDimensions({});
    const x = Math.floor(lon);
    const y = Math.floor(lat);
    
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return null;
    }
    
    return this.probabilityGrid[y * width + x];
  }

  getHighRiskAreas(threshold = 0.1) {
    if (!this.probabilityGrid) return [];
    
    const areas = [];
    const { width, height } = this._getGridDimensions({});
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (this.probabilityGrid[index] >= threshold) {
          areas.push({
            x,
            y,
            probability: this.probabilityGrid[index],
            intensity: this.intensityGrid[index]
          });
        }
      }
    }
    
    return areas.sort((a, b) => b.probability - a.probability);
  }

  exportProbabilityGeoJSON(region, threshold = 0.01) {
    if (!this.probabilityGrid) return null;
    
    const { width, height } = this._getGridDimensions(region);
    const cellSize = region.cellSize || 30;
    const minLon = region.minLon || 0;
    const minLat = region.minLat || 0;
    
    const features = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const prob = this.probabilityGrid[index];
        
        if (prob >= threshold) {
          const lon = minLon + x * cellSize;
          const lat = minLat + (height - y) * cellSize;
          
          features.push({
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [lon, lat],
                [lon + cellSize, lat],
                [lon + cellSize, lat + cellSize],
                [lon, lat + cellSize],
                [lon, lat]
              ]]
            },
            properties: {
              probability: prob,
              intensity: this.intensityGrid[index],
              flameLength: this.flameLengthGrid[index]
            }
          });
        }
      }
    }
    
    return {
      type: 'FeatureCollection',
      features,
      metadata: {
        type: 'burn_probability',
        simulationYears: this.options.simulationYears,
        threshold
      }
    };
  }

  getProgress() {
    return this._progress;
  }

  isRunning() {
    return this._running;
  }

  stop() {
    this._running = false;
    this.emit('stopped');
  }

  reset() {
    this.probabilityGrid = null;
    this.flameLengthGrid = null;
    this.intensityGrid = null;
    this._progress = 0;
    this.emit('reset');
  }

  destroy() {
    this.stop();
    this.probabilityGrid = null;
    this.flameLengthGrid = null;
    this.intensityGrid = null;
    this.engine = null;
    this.removeAllListeners();
  }
}

export default BurnProbabilityEstimator;

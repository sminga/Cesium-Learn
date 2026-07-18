/**
 * 增强版林火蔓延引擎
 * @module modules/fire/FireSpreadEngineV2
 * @description 支持WebWorker并行计算、动态燃料模型、精确地形影响
 */

import EventEmitter from '../../core/EventEmitter.js';
import { getFuelModel, createCustomFuelModel } from './FuelModels.js';

class FireSpreadEngineV2 extends EventEmitter {
  constructor(demData, options = {}) {
    super();
    
    this.dem = demData;
    this.options = {
      cellSize: 30,
      fuelModel: 1,
      windSpeed: 0,
      windDirection: 0,
      moistureContent: 0.1,
      temperature: 25,
      humidity: 50,
      useWebWorker: false,
      maxIterations: 1000,
      ...options
    };
    
    this.fireGrid = null;
    this.intensityGrid = null;
    this.boundary = [];
    this.fuelGrid = null;
    
    this.statistics = {
      burnedArea: 0,
      perimeter: 0,
      maxSpreadRate: 0,
      avgSpreadRate: 0,
      maxIntensity: 0,
      burnedCells: 0
    };
    
    this.history = [];
    this._worker = null;
    this._iteration = 0;
    
    this._initGrids();
    this._initFuelGrid();
    
    if (this.options.useWebWorker && typeof Worker !== 'undefined') {
      this._initWorker();
    }
  }

  _initGrids() {
    const { ncols, nrows } = this.dem;
    const size = ncols * nrows;
    
    this.fireGrid = new Float32Array(size);
    this.fireGrid.fill(-1);
    
    this.intensityGrid = new Float32Array(size);
    this.intensityGrid.fill(0);
  }

  _initFuelGrid() {
    const { ncols, nrows } = this.dem;
    this.fuelGrid = new Uint8Array(ncols * nrows);
    this.fuelGrid.fill(this.options.fuelModel);
  }

  _initWorker() {
    const workerCode = `
      self.onmessage = function(e) {
        const { type, data } = e.data;
        
        if (type === 'propagate') {
          const result = computePropagation(data);
          self.postMessage({ type: 'propagateResult', result });
        }
      };
      
      function computePropagation(data) {
        const { boundary, fireGrid, dem, options, fuelGrid } = data;
        const newBoundary = [];
        const updates = [];
        
        const baseRate = getBaseRate(options.fuelModel);
        
        for (const point of boundary) {
          const neighbors = getNeighbors(point.x, point.y, dem.ncols, dem.nrows);
          
          for (const neighbor of neighbors) {
            const index = neighbor.y * dem.ncols + neighbor.x;
            
            if (fireGrid[index] < 0) {
              const localRate = getLocalSpreadRate(
                point, neighbor, dem, options, fuelGrid[index], baseRate
              );
              
              const distance = options.cellSize;
              const timeToSpread = distance / localRate;
              
              if (timeToSpread <= data.timeStep) {
                updates.push({
                  index,
                  time: fireGrid[point.y * dem.ncols + point.x] + timeToSpread,
                  x: neighbor.x,
                  y: neighbor.y,
                  intensity: calculateIntensity(localRate, fuelGrid[index])
                });
              }
            }
          }
        }
        
        return { updates, newBoundary };
      }
      
      function getNeighbors(x, y, ncols, nrows) {
        const neighbors = [];
        const directions = [
          [-1, -1], [0, -1], [1, -1],
          [-1, 0],          [1, 0],
          [-1, 1],  [0, 1],  [1, 1]
        ];
        
        for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < ncols && ny >= 0 && ny < nrows) {
            neighbors.push({ x: nx, y: ny });
          }
        }
        return neighbors;
      }
      
      function getBaseRate(fuelModel) {
        const rates = {
          1: 0.4, 2: 0.3, 3: 0.5, 4: 0.6, 5: 0.2,
          6: 0.3, 7: 0.2, 8: 0.1, 9: 0.1, 10: 0.2,
          11: 0.1, 12: 0.2, 13: 0.3
        };
        return rates[fuelModel] || 0.3;
      }
      
      function getLocalSpreadRate(from, to, dem, options, fuelModelId, baseRate) {
        const fuelModel = { baseRate, moistureFactor: 0.5, windFactor: 0.8, slopeFactor: 0.5 };
        
        const elevation1 = dem.data[from.y * dem.ncols + from.x];
        const elevation2 = dem.data[to.y * dem.ncols + to.x];
        
        const slope = (elevation2 - elevation1) / options.cellSize;
        const slopeAngle = Math.atan(slope);
        const slopeFactor = 1 + fuelModel.slopeFactor * Math.sin(2 * slopeAngle);
        
        const direction = Math.atan2(to.y - from.y, to.x - from.x);
        const windAngle = options.windDirection * Math.PI / 180;
        const angleDiff = Math.abs(direction - windAngle);
        
        const windFactor = 1 + 0.5 * Math.cos(angleDiff) * options.windSpeed / 10;
        
        const moistureFactor = 1 - 0.5 * options.moistureContent;
        
        return baseRate * slopeFactor * windFactor * moistureFactor;
      }
      
      function calculateIntensity(spreadRate, fuelModelId) {
        return Math.min(1.0, spreadRate / 2.0);
      }
    `;
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    this._worker = new Worker(URL.createObjectURL(blob));
    
    this._worker.onmessage = (e) => {
      if (e.data.type === 'propagateResult') {
        this._applyWorkerResult(e.data.result);
      }
    };
  }

  ignite(lon, lat) {
    const { x, y } = this._geoToGrid(lon, lat);
    
    if (x < 0 || x >= this.dem.ncols || y < 0 || y >= this.dem.nrows) {
      throw new Error('Ignition point is outside DEM bounds');
    }
    
    const index = y * this.dem.ncols + x;
    this.fireGrid[index] = 0;
    this.intensityGrid[index] = 1.0;
    this.boundary = [{ x, y, time: 0, intensity: 1.0 }];
    
    this._iteration = 0;
    this.history = [{
      iteration: 0,
      burnedArea: 0,
      perimeter: this.options.cellSize,
      boundarySize: 1
    }];
    
    this.emit('ignited', { lon, lat, x, y });
    return { x, y };
  }

  propagate(timeStep = 1) {
    if (this.boundary.length === 0) {
      return { boundary: [], statistics: this.statistics };
    }
    
    if (this._worker && this.options.useWebWorker) {
      return this._propagateWithWorker(timeStep);
    }
    
    return this._propagateSync(timeStep);
  }

  _propagateSync(timeStep) {
    const newBoundary = [];
    const spreadRates = [];
    
    const fuelModel = getFuelModel(this.options.fuelModel);
    const baseRate = this._calculateBaseRate(fuelModel);
    
    for (const point of this.boundary) {
      const neighbors = this._getNeighbors(point.x, point.y);
      
      for (const neighbor of neighbors) {
        const index = neighbor.y * this.dem.ncols + neighbor.x;
        
        if (this.fireGrid[index] < 0) {
          const localFuelModel = getFuelModel(this.fuelGrid[index]);
          const localSpreadRate = this._calculateLocalSpreadRate(
            point, neighbor, localFuelModel, baseRate
          );
          
          const distance = this.options.cellSize;
          const timeToSpread = distance / localSpreadRate;
          
          if (timeToSpread <= timeStep) {
            const newTime = this.fireGrid[point.y * this.dem.ncols + point.x] + timeToSpread;
            this.fireGrid[index] = newTime;
            
            const intensity = this._calculateIntensity(localSpreadRate, localFuelModel);
            this.intensityGrid[index] = intensity;
            
            newBoundary.push({
              x: neighbor.x,
              y: neighbor.y,
              time: newTime,
              intensity
            });
            
            spreadRates.push(localSpreadRate);
          }
        }
      }
    }
    
    this.boundary = newBoundary;
    this._iteration++;
    this._updateStatistics(spreadRates);
    this._recordHistory();
    
    const result = {
      boundary: this.boundary,
      statistics: this.statistics,
      iteration: this._iteration
    };
    
    this.emit('propagated', result);
    return result;
  }

  _propagateWithWorker(timeStep) {
    return new Promise((resolve) => {
      const handler = (e) => {
        if (e.data.type === 'propagateResult') {
          this._worker.removeEventListener('message', handler);
          const result = this._applyWorkerResult(e.data.result);
          resolve(result);
        }
      };
      
      this._worker.addEventListener('message', handler);
      
      this._worker.postMessage({
        type: 'propagate',
        data: {
          boundary: this.boundary,
          fireGrid: this.fireGrid,
          dem: this.dem,
          options: this.options,
          fuelGrid: this.fuelGrid,
          timeStep
        }
      });
    });
  }

  _applyWorkerResult(result) {
    const { updates, newBoundary } = result;
    const spreadRates = [];
    
    for (const update of updates) {
      this.fireGrid[update.index] = update.time;
      this.intensityGrid[update.index] = update.intensity;
      spreadRates.push(update.intensity * 2);
    }
    
    this.boundary = newBoundary;
    this._iteration++;
    this._updateStatistics(spreadRates);
    this._recordHistory();
    
    const finalResult = {
      boundary: this.boundary,
      statistics: this.statistics,
      iteration: this._iteration
    };
    
    this.emit('propagated', finalResult);
    return finalResult;
  }

  _calculateBaseRate(fuelModel) {
    const { windSpeed, moistureContent, temperature, humidity } = this.options;
    
    let rate = fuelModel.baseRate;
    
    rate *= (1 + fuelModel.windFactor * windSpeed / 10);
    
    rate *= (1 - fuelModel.moistureFactor * moistureContent);
    
    const tempFactor = 1 + 0.01 * (temperature - 25);
    rate *= Math.max(0.5, Math.min(1.5, tempFactor));
    
    const humidityFactor = 1 - 0.005 * (humidity - 50);
    rate *= Math.max(0.7, Math.min(1.3, humidityFactor));
    
    return Math.max(0.01, rate);
  }

  _calculateLocalSpreadRate(from, to, fuelModel, baseRate) {
    const elevation1 = this._getElevation(from.x, from.y);
    const elevation2 = this._getElevation(to.x, to.y);
    
    if (elevation1 === null || elevation2 === null) {
      return baseRate * 0.1;
    }
    
    const slope = (elevation2 - elevation1) / this.options.cellSize;
    const slopeAngle = Math.atan(slope);
    
    const slopeFactor = 1 + fuelModel.slopeFactor * Math.sin(2 * slopeAngle);
    
    const direction = Math.atan2(to.y - from.y, to.x - from.x);
    const windAngle = this.options.windDirection * Math.PI / 180;
    let angleDiff = Math.abs(direction - windAngle);
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
    
    const windFactor = 1 + 0.5 * Math.cos(angleDiff) * this.options.windSpeed / 10;
    
    return baseRate * slopeFactor * windFactor;
  }

  _calculateIntensity(spreadRate, fuelModel) {
    const baseIntensity = spreadRate / fuelModel.baseRate;
    const heatFactor = fuelModel.heatPerUnitArea / 2000;
    return Math.min(1.0, baseIntensity * heatFactor);
  }

  _getElevation(x, y) {
    const index = y * this.dem.ncols + x;
    const value = this.dem.data[index];
    return value === this.dem.nodata ? null : value;
  }

  _getNeighbors(x, y) {
    const neighbors = [];
    const directions = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0],          [1, 0],
      [-1, 1],  [0, 1],  [1, 1]
    ];
    
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx >= 0 && nx < this.dem.ncols && ny >= 0 && ny < this.dem.nrows) {
        neighbors.push({ x: nx, y: ny });
      }
    }
    
    return neighbors;
  }

  _updateStatistics(spreadRates = []) {
    let burnedCount = 0;
    let maxIntensity = 0;
    
    for (let i = 0; i < this.fireGrid.length; i++) {
      if (this.fireGrid[i] >= 0) {
        burnedCount++;
        if (this.intensityGrid[i] > maxIntensity) {
          maxIntensity = this.intensityGrid[i];
        }
      }
    }
    
    this.statistics.burnedCells = burnedCount;
    this.statistics.burnedArea = burnedCount * this.options.cellSize * this.options.cellSize;
    this.statistics.perimeter = this.boundary.length * this.options.cellSize;
    
    if (spreadRates.length > 0) {
      this.statistics.maxSpreadRate = Math.max(...spreadRates);
      this.statistics.avgSpreadRate = spreadRates.reduce((a, b) => a + b, 0) / spreadRates.length;
    }
    
    this.statistics.maxIntensity = maxIntensity;
  }

  _recordHistory() {
    this.history.push({
      iteration: this._iteration,
      burnedArea: this.statistics.burnedArea,
      perimeter: this.statistics.perimeter,
      boundarySize: this.boundary.length,
      maxSpreadRate: this.statistics.maxSpreadRate
    });
  }

  setWind(speed, direction) {
    this.options.windSpeed = speed;
    this.options.windDirection = direction;
    this.emit('windChanged', { speed, direction });
  }

  setFuelModel(modelId, customParams = null) {
    if (customParams) {
      this.options.fuelModel = 99;
      this._customFuelModel = createCustomFuelModel(customParams);
    } else {
      this.options.fuelModel = modelId;
      this._customFuelModel = null;
    }
    this.emit('fuelModelChanged', { modelId });
  }

  setFuelAt(x, y, fuelModelId) {
    const index = y * this.dem.ncols + x;
    if (index >= 0 && index < this.fuelGrid.length) {
      this.fuelGrid[index] = fuelModelId;
    }
  }

  setMoisture(moisture) {
    this.options.moistureContent = Math.max(0, Math.min(1, moisture));
    this.emit('moistureChanged', { moisture: this.options.moistureContent });
  }

  getBoundary() {
    return this.boundary.map(point => {
      const geo = this._gridToGeo(point.x, point.y);
      return { ...point, ...geo };
    });
  }

  getIntensityAt(x, y) {
    const index = y * this.dem.ncols + x;
    return this.intensityGrid[index];
  }

  getGeoJSON() {
    const boundary = this.getBoundary();
    
    if (boundary.length < 3) {
      return null;
    }
    
    const coordinates = boundary.map(p => [p.lon, p.lat]);
    coordinates.push(coordinates[0]);
    
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        },
        properties: {
          burnedArea: this.statistics.burnedArea,
          perimeter: this.statistics.perimeter,
          maxIntensity: this.statistics.maxIntensity,
          iteration: this._iteration
        }
      }]
    };
  }

  getHistory() {
    return [...this.history];
  }

  _geoToGrid(lon, lat) {
    const x = Math.round((lon - this.dem.xllcorner) / this.dem.cellsize);
    const y = Math.round((this.dem.yllcorner + this.dem.nrows * this.dem.cellsize - lat) / this.dem.cellsize);
    return { x, y };
  }

  _gridToGeo(x, y) {
    const lon = this.dem.xllcorner + x * this.dem.cellsize;
    const lat = this.dem.yllcorner + (this.dem.nrows - y) * this.dem.cellsize;
    return { lon, lat };
  }

  reset() {
    this._initGrids();
    this.boundary = [];
    this._iteration = 0;
    this.history = [];
    this.statistics = {
      burnedArea: 0,
      perimeter: 0,
      maxSpreadRate: 0,
      avgSpreadRate: 0,
      maxIntensity: 0,
      burnedCells: 0
    };
    this.emit('reset');
  }

  destroy() {
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    this.fireGrid = null;
    this.intensityGrid = null;
    this.fuelGrid = null;
    this.boundary = null;
    this.history = null;
    this.removeAllListeners();
  }
}

export default FireSpreadEngineV2;

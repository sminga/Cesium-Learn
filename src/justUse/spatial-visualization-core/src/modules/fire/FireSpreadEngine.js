/**
 * 林火蔓延引擎
 * @module modules/fire/FireSpreadEngine
 * @description 基于 Rothermel 模型的林火蔓延计算
 */

import EventEmitter from '../../core/EventEmitter.js';

class FireSpreadEngine extends EventEmitter {
  constructor(demData, options = {}) {
    super();
    
    this.dem = demData;
    this.options = {
      cellSize: 30,
      fuelModel: 1,
      windSpeed: 0,
      windDirection: 0,
      slopeFactor: 0.5,
      moistureContent: 0.1,
      ...options
    };
    
    this.fireGrid = null;
    this.boundary = [];
    this.statistics = {
      burnedArea: 0,
      perimeter: 0,
      maxSpreadRate: 0
    };
    
    this._initGrid();
  }

  _initGrid() {
    const { ncols, nrows } = this.dem;
    this.fireGrid = new Float32Array(ncols * nrows);
    this.fireGrid.fill(-1);
  }

  ignite(lon, lat) {
    const { x, y } = this._geoToGrid(lon, lat);
    
    if (x < 0 || x >= this.dem.ncols || y < 0 || y >= this.dem.nrows) {
      throw new Error('Ignition point is outside DEM bounds');
    }
    
    const index = y * this.dem.ncols + x;
    this.fireGrid[index] = 0;
    this.boundary = [{ x, y, time: 0 }];
    
    this.emit('ignited', { lon, lat, x, y });
    return { x, y };
  }

  propagate(timeStep = 1) {
    const newBoundary = [];
    const spreadRate = this._calculateSpreadRate();
    
    for (const point of this.boundary) {
      const neighbors = this._getNeighbors(point.x, point.y);
      
      for (const neighbor of neighbors) {
        const index = neighbor.y * this.dem.ncols + neighbor.x;
        
        if (this.fireGrid[index] < 0) {
          const localSpreadRate = this._getLocalSpreadRate(
            point.x, point.y,
            neighbor.x, neighbor.y,
            spreadRate
          );
          
          const distance = this.options.cellSize;
          const timeToSpread = distance / localSpreadRate;
          
          if (timeToSpread <= timeStep) {
            this.fireGrid[index] = this.fireGrid[point.y * this.dem.ncols + point.x] + timeToSpread;
            newBoundary.push({
              x: neighbor.x,
              y: neighbor.y,
              time: this.fireGrid[index]
            });
          }
        }
      }
    }
    
    this.boundary = newBoundary;
    this._updateStatistics();
    
    this.emit('propagated', {
      boundary: this.boundary,
      statistics: this.statistics
    });
    
    return {
      boundary: this.boundary,
      statistics: this.statistics
    };
  }

  _calculateSpreadRate() {
    const { fuelModel, windSpeed, moistureContent } = this.options;
    
    const baseRate = this._getBaseRate(fuelModel);
    const windFactor = 1 + 0.1 * windSpeed;
    const moistureFactor = 1 - 0.5 * moistureContent;
    
    return baseRate * windFactor * moistureFactor;
  }

  _getBaseRate(fuelModel) {
    const rates = {
      1: 0.4,
      2: 0.3,
      3: 0.5,
      4: 0.6,
      5: 0.2,
      6: 0.3,
      7: 0.2,
      8: 0.1,
      9: 0.1,
      10: 0.2,
      11: 0.1,
      12: 0.2,
      13: 0.3
    };
    return rates[fuelModel] || 0.3;
  }

  _getLocalSpreadRate(x1, y1, x2, y2, baseRate) {
    const elevation1 = this._getElevation(x1, y1);
    const elevation2 = this._getElevation(x2, y2);
    
    const slope = (elevation2 - elevation1) / this.options.cellSize;
    const slopeAngle = Math.atan(slope);
    
    const slopeFactor = 1 + this.options.slopeFactor * Math.sin(2 * slopeAngle);
    
    const direction = Math.atan2(y2 - y1, x2 - x1);
    const windAngle = this.options.windDirection * Math.PI / 180;
    const angleDiff = Math.abs(direction - windAngle);
    
    const windFactor = 1 + 0.5 * Math.cos(angleDiff) * this.options.windSpeed / 10;
    
    return baseRate * slopeFactor * windFactor;
  }

  _getElevation(x, y) {
    const index = y * this.dem.ncols + x;
    return this.dem.data[index];
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

  _geoToGrid(lon, lat) {
    const x = Math.round((lon - this.dem.xllcorner) / this.dem.cellsize);
    const y = Math.round((lat - this.dem.yllcorner) / this.dem.cellsize);
    return { x, y };
  }

  _gridToGeo(x, y) {
    const lon = this.dem.xllcorner + x * this.dem.cellsize;
    const lat = this.dem.yllcorner + y * this.dem.cellsize;
    return { lon, lat };
  }

  _updateStatistics() {
    let burnedCount = 0;
    for (let i = 0; i < this.fireGrid.length; i++) {
      if (this.fireGrid[i] >= 0) {
        burnedCount++;
      }
    }
    
    this.statistics.burnedArea = burnedCount * this.options.cellSize * this.options.cellSize;
    this.statistics.perimeter = this.boundary.length * this.options.cellSize;
  }

  setWind(speed, direction) {
    this.options.windSpeed = speed;
    this.options.windDirection = direction;
    this.emit('windChanged', { speed, direction });
  }

  getBoundary() {
    return this.boundary.map(point => {
      const geo = this._gridToGeo(point.x, point.y);
      return { ...point, ...geo };
    });
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
          perimeter: this.statistics.perimeter
        }
      }]
    };
  }

  reset() {
    this._initGrid();
    this.boundary = [];
    this.statistics = {
      burnedArea: 0,
      perimeter: 0,
      maxSpreadRate: 0
    };
    this.emit('reset');
  }

  destroy() {
    this.fireGrid = null;
    this.boundary = null;
    this.removeAllListeners();
  }
}

export default FireSpreadEngine;

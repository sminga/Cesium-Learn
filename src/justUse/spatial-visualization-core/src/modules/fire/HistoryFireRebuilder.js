/**
 * 历史火灾重建器
 * @module modules/fire/HistoryFireRebuilder
 * @description 基于历史数据重建火灾过程
 * 参考: ELMFIRE 历史火灾重建功能
 */

import EventEmitter from '../../core/EventEmitter.js';
import ParameterCalibrator from './ParameterCalibrator.js';

class HistoryFireRebuilder extends EventEmitter {
  constructor(engine, options = {}) {
    super();
    
    this.engine = engine;
    
    this.options = {
      maxIterations: options.maxIterations || 100,
      convergenceThreshold: options.convergenceThreshold || 0.05,
      timeStep: options.timeStep || 1,
      ...options
    };
    
    this.calibrator = new ParameterCalibrator(engine, {
      maxIterations: 50,
      tolerance: 0.02
    });
    
    this.rebuildResult = null;
  }

  async rebuild(historicalData) {
    const {
      ignitionPoint,
      ignitionTime,
      perimeterHistory,
      weatherHistory,
      fuelMap,
      terrainData,
      metadata
    } = historicalData;
    
    this.emit('rebuildStarted', { historicalData });
    
    const processedData = await this._preprocessData(historicalData);
    
    const optimizedParams = await this._optimizeParameters(processedData);
    
    const simulation = await this._runSimulation(optimizedParams, processedData);
    
    const accuracy = this._evaluateAccuracy(simulation, processedData);
    
    this.rebuildResult = {
      simulation,
      optimizedParams,
      accuracy,
      metadata: {
        source: metadata?.source || 'Unknown',
        eventDate: metadata?.eventDate || ignitionTime,
        rebuildDate: new Date().toISOString()
      }
    };
    
    this.emit('rebuildComplete', this.rebuildResult);
    
    return this.rebuildResult;
  }

  async _preprocessData(historicalData) {
    const {
      ignitionPoint,
      perimeterHistory,
      weatherHistory,
      fuelMap,
      terrainData
    } = historicalData;
    
    const processed = {
      ignition: ignitionPoint,
      perimeters: [],
      weather: [],
      fuel: null,
      terrain: null
    };
    
    if (perimeterHistory) {
      processed.perimeters = perimeterHistory.map((p, index) => {
        if (Array.isArray(p)) {
          return {
            time: index,
            boundary: p.map(coord => ({
              lon: coord[0] || coord.lon,
              lat: coord[1] || coord.lat
            }))
          };
        }
        return p;
      });
    }
    
    if (weatherHistory) {
      processed.weather = weatherHistory.map((w, index) => ({
        time: index,
        windSpeed: w.windSpeed || w.speed || 0,
        windDirection: w.windDirection || w.direction || 0,
        temperature: w.temperature || 25,
        humidity: w.humidity || 50,
        moisture: w.moisture || 0.1
      }));
    }
    
    if (fuelMap) {
      processed.fuel = this._processFuelMap(fuelMap);
    }
    
    if (terrainData) {
      processed.terrain = terrainData;
    }
    
    return processed;
  }

  _processFuelMap(fuelMap) {
    if (fuelMap.type === 'GeoJSON' || fuelMap.type === 'FeatureCollection') {
      return this._convertFuelGeoJSON(fuelMap);
    }
    
    if (fuelMap.grid) {
      return fuelMap.grid;
    }
    
    return fuelMap;
  }

  _convertFuelGeoJSON(geojson) {
    const fuelGrid = new Map();
    
    if (geojson.features) {
      geojson.features.forEach(feature => {
        if (feature.geometry && feature.properties) {
          const fuelType = feature.properties.fuelType || feature.properties.fuel || 1;
          
          if (feature.geometry.type === 'Polygon') {
            const coords = feature.geometry.coordinates[0];
            coords.forEach(coord => {
              const key = `${coord[0].toFixed(4)}_${coord[1].toFixed(4)}`;
              fuelGrid.set(key, fuelType);
            });
          }
        }
      });
    }
    
    return fuelGrid;
  }

  async _optimizeParameters(processedData) {
    const observations = {
      ignition: processedData.ignition,
      boundaries: processedData.perimeters.map(p => p.boundary),
      weather: processedData.weather,
      duration: processedData.perimeters.length
    };
    
    const result = await this.calibrator.calibrate(observations, {
      maxIterations: this.options.maxIterations,
      tolerance: this.options.convergenceThreshold
    });
    
    return result.parameters;
  }

  async _runSimulation(params, processedData) {
    this.engine.reset();
    
    this.engine.setOptions(params);
    
    if (processedData.fuel) {
      this._applyFuelMap(processedData.fuel);
    }
    
    this.engine.ignite(processedData.ignition.lon, processedData.ignition.lat);
    
    const simulationResults = [];
    const steps = processedData.perimeters.length;
    
    for (let i = 0; i < steps; i++) {
      if (processedData.weather && processedData.weather[i]) {
        const w = processedData.weather[i];
        this.engine.setWind(w.windSpeed, w.windDirection);
        this.engine.setMoisture(w.moisture);
      }
      
      const result = this.engine.propagate(this.options.timeStep);
      
      simulationResults.push({
        step: i,
        boundary: this.engine.getBoundary(),
        statistics: this.engine.getStatistics(),
        time: i * this.options.timeStep
      });
    }
    
    return simulationResults;
  }

  _applyFuelMap(fuelMap) {
    if (fuelMap instanceof Map) {
      fuelMap.forEach((fuelType, key) => {
        const [lon, lat] = key.split('_').map(parseFloat);
        this.engine.setFuelAt(lon, lat, fuelType);
      });
    }
  }

  _evaluateAccuracy(simulation, processedData) {
    const metrics = {
      areaAccuracy: [],
      shapeAccuracy: [],
      centroidAccuracy: [],
      overall: 0
    };
    
    const observedPerimeters = processedData.perimeters;
    
    for (let i = 0; i < Math.min(simulation.length, observedPerimeters.length); i++) {
      const simBoundary = simulation[i].boundary;
      const obsBoundary = observedPerimeters[i].boundary;
      
      if (simBoundary && obsBoundary && simBoundary.length > 0 && obsBoundary.length > 0) {
        const areaAcc = this._calculateAreaAccuracy(simBoundary, obsBoundary);
        const shapeAcc = this._calculateShapeAccuracy(simBoundary, obsBoundary);
        const centroidAcc = this._calculateCentroidAccuracy(simBoundary, obsBoundary);
        
        metrics.areaAccuracy.push(areaAcc);
        metrics.shapeAccuracy.push(shapeAcc);
        metrics.centroidAccuracy.push(centroidAcc);
      }
    }
    
    if (metrics.areaAccuracy.length > 0) {
      const avgArea = metrics.areaAccuracy.reduce((a, b) => a + b, 0) / metrics.areaAccuracy.length;
      const avgShape = metrics.shapeAccuracy.reduce((a, b) => a + b, 0) / metrics.shapeAccuracy.length;
      const avgCentroid = metrics.centroidAccuracy.reduce((a, b) => a + b, 0) / metrics.centroidAccuracy.length;
      
      metrics.overall = 0.4 * avgArea + 0.3 * avgShape + 0.3 * avgCentroid;
    }
    
    return metrics;
  }

  _calculateAreaAccuracy(simBoundary, obsBoundary) {
    const simArea = this._calculateArea(simBoundary);
    const obsArea = this._calculateArea(obsBoundary);
    
    if (obsArea === 0) return 0;
    
    const ratio = Math.min(simArea, obsArea) / Math.max(simArea, obsArea);
    return ratio;
  }

  _calculateShapeAccuracy(simBoundary, obsBoundary) {
    const simPerimeter = this._calculatePerimeter(simBoundary);
    const obsPerimeter = this._calculatePerimeter(obsBoundary);
    
    const simArea = this._calculateArea(simBoundary);
    const obsArea = this._calculateArea(obsBoundary);
    
    if (simArea === 0 || obsArea === 0) return 0;
    
    const simCircularity = (4 * Math.PI * simArea) / (simPerimeter * simPerimeter);
    const obsCircularity = (4 * Math.PI * obsArea) / (obsPerimeter * obsPerimeter);
    
    return Math.min(simCircularity, obsCircularity) / Math.max(simCircularity, obsCircularity);
  }

  _calculateCentroidAccuracy(simBoundary, obsBoundary) {
    const simCentroid = this._calculateCentroid(simBoundary);
    const obsCentroid = this._calculateCentroid(obsBoundary);
    
    const distance = Math.sqrt(
      Math.pow(simCentroid.lon - obsCentroid.lon, 2) +
      Math.pow(simCentroid.lat - obsCentroid.lat, 2)
    );
    
    const maxDistance = 0.01;
    
    return Math.max(0, 1 - distance / maxDistance);
  }

  _calculateArea(boundary) {
    if (!boundary || boundary.length < 3) return 0;
    
    let area = 0;
    const n = boundary.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += boundary[i].lon * boundary[j].lat;
      area -= boundary[j].lon * boundary[i].lat;
    }
    
    return Math.abs(area) / 2;
  }

  _calculatePerimeter(boundary) {
    if (!boundary || boundary.length < 2) return 0;
    
    let perimeter = 0;
    const n = boundary.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      perimeter += Math.sqrt(
        Math.pow(boundary[j].lon - boundary[i].lon, 2) +
        Math.pow(boundary[j].lat - boundary[i].lat, 2)
      );
    }
    
    return perimeter;
  }

  _calculateCentroid(boundary) {
    if (!boundary || boundary.length === 0) {
      return { lon: 0, lat: 0 };
    }
    
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

  getResult() {
    return this.rebuildResult;
  }

  getComparisonReport() {
    if (!this.rebuildResult) {
      return null;
    }
    
    const { simulation, accuracy, optimizedParams, metadata } = this.rebuildResult;
    
    return {
      summary: {
        overallAccuracy: (accuracy.overall * 100).toFixed(1) + '%',
        areaAccuracy: (accuracy.areaAccuracy.reduce((a, b) => a + b, 0) / accuracy.areaAccuracy.length * 100).toFixed(1) + '%',
        shapeAccuracy: (accuracy.shapeAccuracy.reduce((a, b) => a + b, 0) / accuracy.shapeAccuracy.length * 100).toFixed(1) + '%',
        centroidAccuracy: (accuracy.centroidAccuracy.reduce((a, b) => a + b, 0) / accuracy.centroidAccuracy.length * 100).toFixed(1) + '%'
      },
      optimizedParameters: optimizedParams,
      simulationSteps: simulation.length,
      metadata
    };
  }

  exportComparisonGeoJSON() {
    if (!this.rebuildResult) {
      return null;
    }
    
    const { simulation, accuracy } = this.rebuildResult;
    
    const features = simulation.map((step, index) => {
      const coordinates = step.boundary.map(p => [p.lon, p.lat]);
      if (coordinates.length > 0) {
        coordinates.push(coordinates[0]);
      }
      
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        },
        properties: {
          step: index,
          time: step.time,
          burnedArea: step.statistics.burnedArea,
          areaAccuracy: accuracy.areaAccuracy[index] || 0,
          shapeAccuracy: accuracy.shapeAccuracy[index] || 0
        }
      };
    });
    
    return {
      type: 'FeatureCollection',
      features,
      metadata: {
        type: 'reconstruction_comparison',
        generated: new Date().toISOString()
      }
    };
  }

  destroy() {
    if (this.calibrator) {
      this.calibrator.destroy();
    }
    this.engine = null;
    this.rebuildResult = null;
    this.removeAllListeners();
  }
}

export default HistoryFireRebuilder;

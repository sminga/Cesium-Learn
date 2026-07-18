/**
 * 参数校准器
 * @module modules/fire/ParameterCalibrator
 * @description 基于观测数据的实时参数校准
 * 参考: PyTorchFire 可微分模拟
 */

import EventEmitter from '../../core/EventEmitter.js';

class ParameterCalibrator extends EventEmitter {
  constructor(engine, options = {}) {
    super();
    
    this.engine = engine;
    
    this.options = {
      learningRate: options.learningRate || 0.01,
      maxIterations: options.maxIterations || 100,
      tolerance: options.tolerance || 0.01,
      method: options.method || 'gradient-descent',
      ...options
    };
    
    this.parameters = {
      baseRate: 0.3,
      windFactor: 0.5,
      slopeFactor: 0.5,
      moistureFactor: 0.5
    };
    
    this.bounds = {
      baseRate: { min: 0.1, max: 1.0 },
      windFactor: { min: 0.1, max: 1.0 },
      slopeFactor: { min: 0.1, max: 1.0 },
      moistureFactor: { min: 0.1, max: 1.0 }
    };
    
    this.history = [];
    this._calibrating = false;
  }

  setParameters(params) {
    Object.assign(this.parameters, params);
    this._applyParameters();
  }

  getParameters() {
    return { ...this.parameters };
  }

  _applyParameters() {
    if (this.engine && this.engine.setOptions) {
      this.engine.setOptions({
        baseRate: this.parameters.baseRate,
        windFactor: this.parameters.windFactor,
        slopeFactor: this.parameters.slopeFactor,
        moistureFactor: this.parameters.moistureFactor
      });
    }
  }

  async calibrate(observations, options = {}) {
    if (this._calibrating) {
      throw new Error('Calibration already in progress');
    }
    
    this._calibrating = true;
    this.history = [];
    
    const {
      maxIterations = this.options.maxIterations,
      tolerance = this.options.tolerance,
      learningRate = this.options.learningRate
    } = options;
    
    let bestLoss = Infinity;
    let bestParams = { ...this.parameters };
    
    this.emit('calibrationStarted', { observations, parameters: this.parameters });
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const simulation = await this._runSimulation(observations);
      
      const loss = this._calculateLoss(simulation, observations);
      
      this.history.push({
        iteration,
        loss,
        parameters: { ...this.parameters }
      });
      
      if (loss < bestLoss) {
        bestLoss = loss;
        bestParams = { ...this.parameters };
      }
      
      this.emit('iteration', { iteration, loss, parameters: this.parameters });
      
      if (loss < tolerance) {
        this.emit('converged', { iteration, loss, parameters: this.parameters });
        break;
      }
      
      const gradients = this._computeGradients(simulation, observations);
      
      this._updateParameters(gradients, learningRate);
    }
    
    this.parameters = bestParams;
    this._applyParameters();
    
    this._calibrating = false;
    
    const result = {
      parameters: bestParams,
      finalLoss: bestLoss,
      iterations: this.history.length,
      history: this.history
    };
    
    this.emit('calibrationComplete', result);
    
    return result;
  }

  async _runSimulation(observations) {
    if (!this.engine) {
      throw new Error('Engine not set');
    }
    
    this.engine.reset();
    
    const ignition = observations.ignition || observations.ignitionPoint;
    this.engine.ignite(ignition.lon, ignition.lat);
    
    const steps = observations.duration || 100;
    const results = [];
    
    for (let i = 0; i < steps; i++) {
      const result = this.engine.propagate(1);
      results.push({
        step: i,
        boundary: this.engine.getBoundary(),
        statistics: this.engine.getStatistics()
      });
    }
    
    return results;
  }

  _calculateLoss(simulation, observations) {
    const observedBoundaries = observations.boundaries || observations.perimeterHistory;
    
    if (!observedBoundaries || observedBoundaries.length === 0) {
      return Infinity;
    }
    
    let totalLoss = 0;
    let count = 0;
    
    for (let i = 0; i < Math.min(simulation.length, observedBoundaries.length); i++) {
      const simBoundary = simulation[i].boundary;
      const obsBoundary = observedBoundaries[i];
      
      if (simBoundary && obsBoundary) {
        const areaLoss = this._areaLoss(simBoundary, obsBoundary);
        const shapeLoss = this._shapeLoss(simBoundary, obsBoundary);
        
        totalLoss += 0.5 * areaLoss + 0.5 * shapeLoss;
        count++;
      }
    }
    
    return count > 0 ? totalLoss / count : Infinity;
  }

  _areaLoss(simBoundary, obsBoundary) {
    const simArea = this._calculatePolygonArea(simBoundary);
    const obsArea = this._calculatePolygonArea(obsBoundary);
    
    if (obsArea === 0) return 0;
    
    return Math.abs(simArea - obsArea) / obsArea;
  }

  _shapeLoss(simBoundary, obsBoundary) {
    const simCentroid = this._calculateCentroid(simBoundary);
    const obsCentroid = this._calculateCentroid(obsBoundary);
    
    const distance = Math.sqrt(
      Math.pow(simCentroid.lon - obsCentroid.lon, 2) +
      Math.pow(simCentroid.lat - obsCentroid.lat, 2)
    );
    
    const maxDistance = 0.01;
    
    return Math.min(1, distance / maxDistance);
  }

  _calculatePolygonArea(boundary) {
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

  _computeGradients(simulation, observations) {
    const gradients = {};
    const epsilon = 0.001;
    
    for (const key of Object.keys(this.parameters)) {
      const originalValue = this.parameters[key];
      
      this.parameters[key] = originalValue + epsilon;
      this._applyParameters();
      const lossPlus = this._calculateLoss(simulation, observations);
      
      this.parameters[key] = originalValue - epsilon;
      this._applyParameters();
      const lossMinus = this._calculateLoss(simulation, observations);
      
      gradients[key] = (lossPlus - lossMinus) / (2 * epsilon);
      
      this.parameters[key] = originalValue;
    }
    
    this._applyParameters();
    
    return gradients;
  }

  _updateParameters(gradients, learningRate) {
    for (const key of Object.keys(this.parameters)) {
      const gradient = gradients[key];
      const bound = this.bounds[key];
      
      this.parameters[key] -= learningRate * gradient;
      
      this.parameters[key] = Math.max(bound.min, Math.min(bound.max, this.parameters[key]));
    }
    
    this._applyParameters();
  }

  async optimizeWithGeneticAlgorithm(observations, options = {}) {
    const {
      populationSize = 20,
      generations = 50,
      mutationRate = 0.1,
      eliteCount = 2
    } = options;
    
    let population = this._initializePopulation(populationSize);
    
    for (let gen = 0; gen < generations; gen++) {
      const fitnesses = await Promise.all(
        population.map(async (individual) => {
          this.setParameters(individual);
          const simulation = await this._runSimulation(observations);
          const loss = this._calculateLoss(simulation, observations);
          return { individual, fitness: 1 / (1 + loss) };
        })
      );
      
      fitnesses.sort((a, b) => b.fitness - a.fitness);
      
      if (fitnesses[0].fitness > 0.99) {
        this.setParameters(fitnesses[0].individual);
        return fitnesses[0].individual;
      }
      
      population = this._evolvePopulation(fitnesses, populationSize, mutationRate, eliteCount);
      
      this.emit('generation', { generation: gen, bestFitness: fitnesses[0].fitness });
    }
    
    return this.parameters;
  }

  _initializePopulation(size) {
    const population = [];
    
    for (let i = 0; i < size; i++) {
      const individual = {};
      
      for (const key of Object.keys(this.parameters)) {
        const bound = this.bounds[key];
        individual[key] = bound.min + Math.random() * (bound.max - bound.min);
      }
      
      population.push(individual);
    }
    
    return population;
  }

  _evolvePopulation(fitnesses, size, mutationRate, eliteCount) {
    const newPopulation = [];
    
    for (let i = 0; i < eliteCount; i++) {
      newPopulation.push(fitnesses[i].individual);
    }
    
    const totalFitness = fitnesses.reduce((sum, f) => sum + f.fitness, 0);
    const probabilities = fitnesses.map(f => f.fitness / totalFitness);
    
    while (newPopulation.length < size) {
      const parent1 = this._selectParent(fitnesses, probabilities);
      const parent2 = this._selectParent(fitnesses, probabilities);
      
      const child = this._crossover(parent1, parent2);
      this._mutate(child, mutationRate);
      
      newPopulation.push(child);
    }
    
    return newPopulation;
  }

  _selectParent(fitnesses, probabilities) {
    const r = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < fitnesses.length; i++) {
      cumulative += probabilities[i];
      if (r <= cumulative) {
        return fitnesses[i].individual;
      }
    }
    
    return fitnesses[fitnesses.length - 1].individual;
  }

  _crossover(parent1, parent2) {
    const child = {};
    
    for (const key of Object.keys(this.parameters)) {
      child[key] = Math.random() < 0.5 ? parent1[key] : parent2[key];
    }
    
    return child;
  }

  _mutate(individual, rate) {
    for (const key of Object.keys(individual)) {
      if (Math.random() < rate) {
        const bound = this.bounds[key];
        const range = bound.max - bound.min;
        individual[key] += (Math.random() - 0.5) * range * 0.2;
        individual[key] = Math.max(bound.min, Math.min(bound.max, individual[key]));
      }
    }
  }

  getHistory() {
    return [...this.history];
  }

  isCalibrating() {
    return this._calibrating;
  }

  reset() {
    this.parameters = {
      baseRate: 0.3,
      windFactor: 0.5,
      slopeFactor: 0.5,
      moistureFactor: 0.5
    };
    this.history = [];
    this._applyParameters();
    this.emit('reset');
  }

  destroy() {
    this.engine = null;
    this.history = null;
    this.removeAllListeners();
  }
}

export default ParameterCalibrator;

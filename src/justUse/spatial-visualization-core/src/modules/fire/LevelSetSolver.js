/**
 * 欧拉水平集求解器
 * @module modules/fire/LevelSetSolver
 * @description 实现欧拉水平集方法追踪火场边界
 * 参考: ELMFIRE, Sethian (1999)
 */

import EventEmitter from '../../core/EventEmitter.js';

class LevelSetSolver extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      width: options.width || 100,
      height: options.height || 100,
      cellSize: options.cellSize || 30,
      reinitInterval: options.reinitInterval || 5,
      narrowBandWidth: options.narrowBandWidth || 10,
      ...options
    };
    
    const size = this.options.width * this.options.height;
    
    this.phi = new Float32Array(size);
    this.phi.fill(Number.MAX_VALUE);
    
    this.velocity = new Float32Array(size);
    this.velocity.fill(0);
    
    this.velocityX = new Float32Array(size);
    this.velocityY = new Float32Array(size);
    
    this._iteration = 0;
    this._narrowBand = null;
  }

  initialize(ignitionPoints) {
    this.phi.fill(Number.MAX_VALUE);
    
    const points = Array.isArray(ignitionPoints) ? ignitionPoints : [ignitionPoints];
    
    for (const point of points) {
      const { x, y } = point;
      const index = this._getIndex(x, y);
      
      if (index >= 0 && index < this.phi.length) {
        this.phi[index] = 0;
      }
    }
    
    this._computeSignedDistance();
    this._updateNarrowBand();
    
    this.emit('initialized', { ignitionPoints: points });
  }

  setVelocityField(velocityField) {
    if (velocityField.speed && velocityField.direction) {
      for (let i = 0; i < this.velocity.length; i++) {
        const speed = velocityField.speed[i] || 0;
        const direction = velocityField.direction[i] || 0;
        
        this.velocity[i] = speed;
        this.velocityX[i] = speed * Math.cos(direction * Math.PI / 180);
        this.velocityY[i] = speed * Math.sin(direction * Math.PI / 180);
      }
    } else if (velocityField.u && velocityField.v) {
      for (let i = 0; i < this.velocity.length; i++) {
        this.velocityX[i] = velocityField.u[i] || 0;
        this.velocityY[i] = velocityField.v[i] || 0;
        this.velocity[i] = Math.sqrt(
          this.velocityX[i] * this.velocityX[i] + 
          this.velocityY[i] * this.velocityY[i]
        );
      }
    }
  }

  setVelocityAt(x, y, speed, direction) {
    const index = this._getIndex(x, y);
    if (index >= 0 && index < this.velocity.length) {
      this.velocity[index] = speed;
      this.velocityX[index] = speed * Math.cos(direction * Math.PI / 180);
      this.velocityY[index] = speed * Math.sin(direction * Math.PI / 180);
    }
  }

  evolve(dt) {
    const newPhi = new Float32Array(this.phi.length);
    
    for (let y = 0; y < this.options.height; y++) {
      for (let x = 0; x < this.options.width; x++) {
        const index = this._getIndex(x, y);
        
        if (this._narrowBand && !this._narrowBand.has(index)) {
          newPhi[index] = this.phi[index];
          continue;
        }
        
        const grad = this._computeGradient(x, y);
        
        const v = this.velocity[index];
        const vx = this.velocityX[index];
        const vy = this.velocityY[index];
        
        const dPhi = this._upwindDifference(x, y, vx, vy);
        
        newPhi[index] = this.phi[index] - v * dPhi * dt;
      }
    }
    
    this.phi = newPhi;
    this._iteration++;
    
    if (this._iteration % this.options.reinitInterval === 0) {
      this._reinitialize();
    }
    
    this._updateNarrowBand();
    
    const boundary = this.extractBoundary();
    this.emit('evolved', { iteration: this._iteration, boundary });
    
    return boundary;
  }

  _computeGradient(x, y) {
    const phiXPlus = this._getPhi(x + 1, y) - this._getPhi(x, y);
    const phiXMinus = this._getPhi(x, y) - this._getPhi(x - 1, y);
    const phiYPlus = this._getPhi(x, y + 1) - this._getPhi(x, y);
    const phiYMinus = this._getPhi(x, y) - this._getPhi(x, y - 1);
    
    const gradX = Math.max(Math.abs(phiXPlus), Math.abs(phiXMinus));
    const gradY = Math.max(Math.abs(phiYPlus), Math.abs(phiYMinus));
    
    return {
      x: gradX,
      y: gradY,
      magnitude: Math.sqrt(gradX * gradX + gradY * gradY)
    };
  }

  _upwindDifference(x, y, vx, vy) {
    const phiXPlus = this._getPhi(x + 1, y) - this._getPhi(x, y);
    const phiXMinus = this._getPhi(x, y) - this._getPhi(x - 1, y);
    const phiYPlus = this._getPhi(x, y + 1) - this._getPhi(x, y);
    const phiYMinus = this._getPhi(x, y) - this._getPhi(x, y - 1);
    
    let gradX, gradY;
    
    if (vx > 0) {
      gradX = phiXMinus;
    } else if (vx < 0) {
      gradX = phiXPlus;
    } else {
      gradX = Math.max(Math.abs(phiXPlus), Math.abs(phiXMinus)) * Math.sign(phiXPlus + phiXMinus);
    }
    
    if (vy > 0) {
      gradY = phiYMinus;
    } else if (vy < 0) {
      gradY = phiYPlus;
    } else {
      gradY = Math.max(Math.abs(phiYPlus), Math.abs(phiYMinus)) * Math.sign(phiYPlus + phiYMinus);
    }
    
    return Math.sqrt(gradX * gradX + gradY * gradY);
  }

  _computeSignedDistance() {
    const phiNew = new Float32Array(this.phi.length);
    const visited = new Set();
    const queue = [];
    
    for (let i = 0; i < this.phi.length; i++) {
      if (Math.abs(this.phi[i]) < 0.001) {
        phiNew[i] = 0;
        visited.add(i);
        queue.push({ index: i, distance: 0 });
      }
    }
    
    const dx = [1, -1, 0, 0, 1, 1, -1, -1];
    const dy = [0, 0, 1, -1, 1, -1, 1, -1];
    const dist = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
    
    while (queue.length > 0) {
      queue.sort((a, b) => a.distance - b.distance);
      const current = queue.shift();
      
      const x = current.index % this.options.width;
      const y = Math.floor(current.index / this.options.width);
      
      for (let d = 0; d < 8; d++) {
        const nx = x + dx[d];
        const ny = y + dy[d];
        
        if (nx >= 0 && nx < this.options.width && 
            ny >= 0 && ny < this.options.height) {
          const nIndex = this._getIndex(nx, ny);
          
          if (!visited.has(nIndex)) {
            const newDist = current.distance + dist[d] * this.options.cellSize;
            phiNew[nIndex] = newDist;
            visited.add(nIndex);
            queue.push({ index: nIndex, distance: newDist });
          }
        }
      }
    }
    
    for (let i = 0; i < this.phi.length; i++) {
      if (this.phi[i] < 0) {
        phiNew[i] = -phiNew[i];
      }
    }
    
    this.phi = phiNew;
  }

  _reinitialize() {
    const iterations = 5;
    
    for (let iter = 0; iter < iterations; iter++) {
      const newPhi = new Float32Array(this.phi.length);
      
      for (let y = 0; y < this.options.height; y++) {
        for (let x = 0; x < this.options.width; x++) {
          const index = this._getIndex(x, y);
          const phi = this.phi[index];
          
          if (Math.abs(phi) < 0.001) {
            newPhi[index] = 0;
            continue;
          }
          
          const sign = phi > 0 ? 1 : -1;
          
          const grad = this._computeGradient(x, y);
          
          const dPhi = sign * (grad.magnitude - 1);
          
          newPhi[index] = phi - 0.5 * dPhi;
        }
      }
      
      this.phi = newPhi;
    }
  }

  _updateNarrowBand() {
    this._narrowBand = new Set();
    const bandwidth = this.options.narrowBandWidth * this.options.cellSize;
    
    for (let i = 0; i < this.phi.length; i++) {
      if (Math.abs(this.phi[i]) <= bandwidth) {
        this._narrowBand.add(i);
      }
    }
  }

  extractBoundary() {
    const boundary = [];
    const threshold = 0;
    
    for (let y = 0; y < this.options.height - 1; y++) {
      for (let x = 0; x < this.options.width - 1; x++) {
        const phi00 = this._getPhi(x, y);
        const phi10 = this._getPhi(x + 1, y);
        const phi01 = this._getPhi(x, y + 1);
        const phi11 = this._getPhi(x + 1, y + 1);
        
        if (this._crossesZero(phi00, phi10, threshold)) {
          const t = this._interpolate(phi00, phi10, threshold);
          boundary.push({ x: x + t, y: y });
        }
        
        if (this._crossesZero(phi00, phi01, threshold)) {
          const t = this._interpolate(phi00, phi01, threshold);
          boundary.push({ x: x, y: y + t });
        }
      }
    }
    
    return this._orderBoundary(boundary);
  }

  _crossesZero(phi1, phi2, threshold) {
    return (phi1 <= threshold && phi2 > threshold) || 
           (phi1 > threshold && phi2 <= threshold);
  }

  _interpolate(phi1, phi2, threshold) {
    return (threshold - phi1) / (phi2 - phi1);
  }

  _orderBoundary(points) {
    if (points.length < 3) return points;
    
    const ordered = [points[0]];
    const remaining = new Set(points.slice(1));
    
    while (remaining.size > 0) {
      const last = ordered[ordered.length - 1];
      let nearest = null;
      let minDist = Infinity;
      
      for (const point of remaining) {
        const dist = Math.sqrt(
          Math.pow(point.x - last.x, 2) + 
          Math.pow(point.y - last.y, 2)
        );
        
        if (dist < minDist) {
          minDist = dist;
          nearest = point;
        }
      }
      
      if (nearest && minDist < 2) {
        ordered.push(nearest);
        remaining.delete(nearest);
      } else {
        break;
      }
    }
    
    return ordered;
  }

  getPhiAt(x, y) {
    return this._getPhi(x, y);
  }

  getPhiGrid() {
    return this.phi;
  }

  getVelocityGrid() {
    return {
      speed: this.velocity,
      u: this.velocityX,
      v: this.velocityY
    };
  }

  isInside(x, y) {
    return this._getPhi(x, y) <= 0;
  }

  getDistanceToBoundary(x, y) {
    return Math.abs(this._getPhi(x, y));
  }

  _getIndex(x, y) {
    return y * this.options.width + x;
  }

  _getPhi(x, y) {
    if (x < 0 || x >= this.options.width || y < 0 || y >= this.options.height) {
      return Number.MAX_VALUE;
    }
    return this.phi[this._getIndex(x, y)];
  }

  reset() {
    this.phi.fill(Number.MAX_VALUE);
    this.velocity.fill(0);
    this.velocityX.fill(0);
    this.velocityY.fill(0);
    this._iteration = 0;
    this._narrowBand = null;
    this.emit('reset');
  }

  destroy() {
    this.phi = null;
    this.velocity = null;
    this.velocityX = null;
    this.velocityY = null;
    this._narrowBand = null;
    this.removeAllListeners();
  }
}

export default LevelSetSolver;

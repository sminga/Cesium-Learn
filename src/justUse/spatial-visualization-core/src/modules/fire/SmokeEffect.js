/**
 * 烟雾效果
 * @module modules/fire/SmokeEffect
 * @description 火场烟雾扩散效果
 */

import * as Cesium from 'cesium';
import EventEmitter from '../../core/EventEmitter.js';

class SmokeEffect extends EventEmitter {
  constructor(viewer, options = {}) {
    super();
    
    this.viewer = viewer;
    this.scene = viewer.scene;
    
    this.options = {
      particleCount: options.particleCount || 300,
      emissionRate: options.emissionRate || 20,
      particleSize: options.particleSize || 15,
      lifetime: options.lifetime || 10.0,
      riseSpeed: options.riseSpeed || 2.0,
      spreadSpeed: options.spreadSpeed || 1.0,
      heightOffset: options.heightOffset || 50,
      color: options.color || [0.5, 0.5, 0.5, 0.3],
      windInfluence: options.windInfluence !== false,
      ...options
    };
    
    this.particles = [];
    this.emitters = [];
    this._primitiveCollection = null;
    this._visible = true;
    this._lastUpdate = 0;
    this._windData = { speed: 0, direction: 0 };
    
    this._init();
  }

  _init() {
    this._primitiveCollection = new Cesium.PrimitiveCollection();
    this.scene.primitives.add(this._primitiveCollection);
  }

  setWindData(speed, direction) {
    this._windData = { speed, direction };
  }

  updateFromBoundary(boundary, intensityMap = new Map()) {
    this.clearEmitters();
    
    if (!boundary || boundary.length === 0) return;
    
    const emitterCount = Math.min(boundary.length, 50);
    const step = Math.max(1, Math.floor(boundary.length / emitterCount));
    
    for (let i = 0; i < boundary.length; i += step) {
      const point = boundary[i];
      const intensity = intensityMap.get(`${point.x}_${point.y}`) || point.intensity || 0.5;
      
      if (intensity > 0.3) {
        this._createEmitter(point.lon, point.lat, intensity);
      }
    }
    
    this.emit('emittersUpdated', { count: this.emitters.length });
  }

  _createEmitter(lon, lat, intensity) {
    const height = this._getTerrainHeight(lon, lat) || 0;
    
    const emitter = {
      position: Cesium.Cartesian3.fromDegrees(lon, lat, height + this.options.heightOffset),
      lon,
      lat,
      intensity,
      particles: [],
      lastEmit: 0
    };
    
    this.emitters.push(emitter);
    
    const initialCount = Math.floor(this.options.particleCount * intensity * 0.3);
    this._emitParticles(emitter, initialCount);
  }

  _emitParticles(emitter, count) {
    for (let i = 0; i < count; i++) {
      const particle = this._createParticle(emitter);
      this.particles.push(particle);
    }
  }

  _createParticle(emitter) {
    const spread = 5.0;
    const offsetX = (Math.random() - 0.5) * spread;
    const offsetY = (Math.random() - 0.5) * spread;
    
    const baseHeight = this._getTerrainHeight(emitter.lon, emitter.lat) || 0;
    
    const position = Cesium.Cartesian3.fromDegrees(
      emitter.lon + offsetX * 0.0001,
      emitter.lat + offsetY * 0.0001,
      baseHeight + this.options.heightOffset + Math.random() * 20
    );
    
    const lifetime = this.options.lifetime * (0.7 + Math.random() * 0.3);
    
    let velocityX = (Math.random() - 0.5) * this.options.spreadSpeed;
    let velocityY = (Math.random() - 0.5) * this.options.spreadSpeed;
    let velocityZ = this.options.riseSpeed * (0.5 + Math.random() * 0.5);
    
    if (this.options.windInfluence && this._windData.speed > 0) {
      const windRad = this._windData.direction * Math.PI / 180;
      const windFactor = this._windData.speed * 0.1;
      velocityX += Math.cos(windRad) * windFactor;
      velocityY += Math.sin(windRad) * windFactor;
    }
    
    return {
      position,
      velocity: new Cesium.Cartesian3(velocityX, velocityY, velocityZ),
      lifetime,
      age: Math.random() * lifetime * 0.3,
      size: this.options.particleSize * (0.8 + Math.random() * 0.4),
      intensity: emitter.intensity,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.5
    };
  }

  _getTerrainHeight(lon, lat) {
    const positions = [Cesium.Cartesian3.fromDegrees(lon, lat)];
    const cartographic = Cesium.Cartographic.fromCartesian(positions[0]);
    return cartographic ? cartographic.height : 0;
  }

  update(frameState) {
    const now = performance.now();
    const deltaTime = (now - this._lastUpdate) / 1000;
    this._lastUpdate = now;
    
    if (!this._visible) return;
    
    this._primitiveCollection.removeAll();
    
    const instances = [];
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      particle.age += deltaTime;
      
      if (particle.age >= particle.lifetime) {
        this.particles.splice(i, 1);
        continue;
      }
      
      particle.position.x += particle.velocity.x * deltaTime;
      particle.position.y += particle.velocity.y * deltaTime;
      particle.position.z += particle.velocity.z * deltaTime;
      
      particle.velocity.z -= 0.1 * deltaTime;
      
      if (this.options.windInfluence && this._windData.speed > 0) {
        const windRad = this._windData.direction * Math.PI / 180;
        const windFactor = this._windData.speed * 0.05 * deltaTime;
        particle.velocity.x += Math.cos(windRad) * windFactor;
        particle.velocity.y += Math.sin(windRad) * windFactor;
      }
      
      particle.rotation += particle.rotationSpeed * deltaTime;
      
      const lifeRatio = particle.age / particle.lifetime;
      const alpha = Math.sin(lifeRatio * Math.PI) * particle.intensity * this.options.color[3];
      
      const color = [
        this.options.color[0],
        this.options.color[1],
        this.options.color[2],
        alpha
      ];
      
      const size = particle.size * (1 + lifeRatio * 2);
      
      instances.push({
        position: particle.position,
        color: new Cesium.Color(color[0], color[1], color[2], color[3]),
        size
      });
    }
    
    if (instances.length > 0) {
      this._createPointPrimitives(instances);
    }
    
    for (const emitter of this.emitters) {
      if (now - emitter.lastEmit > 1000 / this.options.emissionRate) {
        this._emitParticles(emitter, Math.ceil(this.options.emissionRate * 0.1));
        emitter.lastEmit = now;
      }
    }
  }

  _createPointPrimitives(instances) {
    const positions = [];
    const colors = [];
    
    for (const instance of instances) {
      positions.push(instance.position);
      colors.push(instance.color);
    }
    
    const primitive = new Cesium.PointPrimitive({
      positions: positions,
      colors: colors,
      pixelSize: this.options.particleSize
    });
    
    this._primitiveCollection.add(primitive);
  }

  clearEmitters() {
    this.emitters = [];
    this.particles = [];
    this._primitiveCollection.removeAll();
  }

  show() {
    this._visible = true;
    this.emit('visibilityChanged', true);
  }

  hide() {
    this._visible = false;
    this._primitiveCollection.removeAll();
    this.emit('visibilityChanged', false);
  }

  setVisible(visible) {
    if (visible) {
      this.show();
    } else {
      this.hide();
    }
  }

  isVisible() {
    return this._visible;
  }

  setOptions(options) {
    Object.assign(this.options, options);
    this.emit('optionsChanged', this.options);
  }

  destroy() {
    this.clearEmitters();
    
    if (this._primitiveCollection) {
      this.scene.primitives.remove(this._primitiveCollection);
      this._primitiveCollection = null;
    }
    
    this.removeAllListeners();
  }
}

export default SmokeEffect;

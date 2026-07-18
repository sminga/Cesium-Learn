/**
 * 火焰粒子系统
 * @module modules/fire/FireParticleSystem
 * @description 在火场边界生成动态火焰粒子效果
 */

import * as Cesium from 'cesium';
import EventEmitter from '../../core/EventEmitter.js';

class FireParticleSystem extends EventEmitter {
  constructor(viewer, options = {}) {
    super();
    
    this.viewer = viewer;
    this.scene = viewer.scene;
    
    this.options = {
      particleCount: options.particleCount || 500,
      emissionRate: options.emissionRate || 50,
      particleSize: options.particleSize || 8,
      lifetime: options.lifetime || 2.0,
      speed: options.speed || 5.0,
      heightOffset: options.heightOffset || 10,
      colorInner: options.colorInner || [1.0, 0.8, 0.0, 1.0],
      colorOuter: options.colorOuter || [1.0, 0.2, 0.0, 0.5],
      ...options
    };
    
    this.particles = [];
    this.emitters = [];
    this._primitiveCollection = null;
    this._visible = true;
    this._lastUpdate = 0;
    
    this._init();
  }

  _init() {
    this._primitiveCollection = new Cesium.PrimitiveCollection();
    this.scene.primitives.add(this._primitiveCollection);
  }

  updateFromBoundary(boundary, intensityMap = new Map()) {
    this.clearEmitters();
    
    if (!boundary || boundary.length === 0) return;
    
    const emitterCount = Math.min(boundary.length, 100);
    const step = Math.max(1, Math.floor(boundary.length / emitterCount));
    
    for (let i = 0; i < boundary.length; i += step) {
      const point = boundary[i];
      const intensity = intensityMap.get(`${point.x}_${point.y}`) || point.intensity || 0.5;
      
      this._createEmitter(point.lon, point.lat, intensity);
    }
    
    this.emit('emittersUpdated', { count: this.emitters.length });
  }

  _createEmitter(lon, lat, intensity) {
    const height = this._getTerrainHeight(lon, lat) || 0;
    
    const particleCount = Math.floor(this.options.particleCount * intensity);
    
    const emitter = {
      position: Cesium.Cartesian3.fromDegrees(lon, lat, height + this.options.heightOffset),
      lon,
      lat,
      intensity,
      particles: [],
      lastEmit: 0
    };
    
    this.emitters.push(emitter);
    this._emitParticles(emitter, particleCount);
  }

  _emitParticles(emitter, count) {
    for (let i = 0; i < count; i++) {
      const particle = this._createParticle(emitter);
      this.particles.push(particle);
    }
  }

  _createParticle(emitter) {
    const spread = 2.0;
    const offsetX = (Math.random() - 0.5) * spread;
    const offsetY = (Math.random() - 0.5) * spread;
    
    const position = Cesium.Cartesian3.fromDegrees(
      emitter.lon + offsetX * 0.0001,
      emitter.lat + offsetY * 0.0001,
      this._getTerrainHeight(emitter.lon, emitter.lat) + this.options.heightOffset
    );
    
    const lifetime = this.options.lifetime * (0.5 + Math.random() * 0.5);
    const speed = this.options.speed * (0.5 + Math.random() * 0.5) * emitter.intensity;
    
    return {
      position,
      startPosition: position.clone(),
      velocity: new Cesium.Cartesian3(
        (Math.random() - 0.5) * speed,
        (Math.random() - 0.5) * speed,
        speed * (1 + Math.random())
      ),
      lifetime,
      age: Math.random() * lifetime,
      size: this.options.particleSize * (0.5 + Math.random() * 0.5),
      intensity: emitter.intensity
    };
  }

  _getTerrainHeight(lon, lat) {
    const positions = [Cesium.Cartesian3.fromDegrees(lon, lat)];
    const promise = Cesium.sampleTerrainMostDetailed(
      this.viewer.terrainProvider,
      positions
    );
    
    if (positions[0]) {
      const cartographic = Cesium.Cartographic.fromCartesian(positions[0]);
      return cartographic.height;
    }
    return 0;
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
      
      particle.velocity.z -= 2.0 * deltaTime;
      
      const lifeRatio = particle.age / particle.lifetime;
      const alpha = Math.sin(lifeRatio * Math.PI) * particle.intensity;
      
      const color = this._interpolateColor(
        this.options.colorInner,
        this.options.colorOuter,
        lifeRatio
      );
      
      const size = particle.size * (1 - lifeRatio * 0.5);
      
      instances.push({
        position: particle.position,
        color: new Cesium.Color(color[0], color[1], color[2], alpha * color[3]),
        size
      });
    }
    
    if (instances.length > 0) {
      this._createPointPrimitives(instances);
    }
    
    for (const emitter of this.emitters) {
      if (now - emitter.lastEmit > 1000 / this.options.emissionRate) {
        this._emitParticles(emitter, 1);
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

  _interpolateColor(color1, color2, t) {
    return [
      color1[0] + (color2[0] - color1[0]) * t,
      color1[1] + (color2[1] - color1[1]) * t,
      color1[2] + (color2[2] - color1[2]) * t,
      color1[3] + (color2[3] - color1[3]) * t
    ];
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

export default FireParticleSystem;

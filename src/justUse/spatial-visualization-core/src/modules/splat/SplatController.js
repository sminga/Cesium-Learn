/**
 * 高斯泼溅控制器
 * @module modules/splat/SplatController
 */

import EventEmitter from '../../core/EventEmitter.js';
import GaussianSplatLayer from './GaussianSplatLayer.js';
import ThreeOverlay from './ThreeOverlay.js';

class SplatController extends EventEmitter {
  constructor(viewer, options = {}) {
    super();
    
    this.viewer = viewer;
    this.options = options;
    
    this.threeOverlay = null;
    this.layers = new Map();
    this._initialized = false;
  }

  async init() {
    this.threeOverlay = new ThreeOverlay(this.viewer.camera);
    
    this.viewer.scene.postRender.addEventListener(() => {
      this.threeOverlay.render();
    });
    
    this._initialized = true;
    this.emit('initialized');
    
    return this;
  }

  async loadModel(url, options = {}) {
    if (!this._initialized) {
      throw new Error('SplatController not initialized');
    }
    
    const id = options.id || `splat_${Date.now()}`;
    
    const layer = new GaussianSplatLayer({
      modelUrl: url,
      ...options
    });
    
    await layer.init();
    
    this.threeOverlay.addLayer(layer);
    this.layers.set(id, layer);
    
    this.emit('modelLoaded', { id, url });
    
    return { id, layer };
  }

  unloadModel(id) {
    const layer = this.layers.get(id);
    if (layer) {
      this.threeOverlay.removeLayer(layer);
      layer.destroy();
      this.layers.delete(id);
      this.emit('modelUnloaded', { id });
    }
  }

  setPosition(id, lon, lat, height) {
    const layer = this.layers.get(id);
    if (layer) {
      layer.setPosition(lon, lat, height);
    }
  }

  setRotation(id, heading, pitch, roll) {
    const layer = this.layers.get(id);
    if (layer) {
      layer.setRotation(heading, pitch, roll);
    }
  }

  setScale(id, scale) {
    const layer = this.layers.get(id);
    if (layer) {
      layer.setScale(scale);
    }
  }

  setVisible(id, visible) {
    const layer = this.layers.get(id);
    if (layer) {
      if (visible) {
        layer.show();
      } else {
        layer.hide();
      }
    }
  }

  clearAll() {
    this.layers.forEach((layer, id) => {
      this.unloadModel(id);
    });
    this.emit('cleared');
  }

  listModels() {
    return Array.from(this.layers.keys());
  }

  destroy() {
    this.clearAll();
    
    if (this.threeOverlay) {
      this.threeOverlay.destroy();
      this.threeOverlay = null;
    }
    
    this._initialized = false;
    this.removeAllListeners();
  }
}

export default SplatController;

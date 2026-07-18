/**
 * 增强版火场可视化层
 * @module modules/fire/FireVisualizationLayer
 * @description 整合火场边界、火焰粒子、烟雾效果的综合可视化层
 */

import * as Cesium from 'cesium';
import EventEmitter from '../../core/EventEmitter.js';
import FireParticleSystem from './FireParticleSystem.js';
import SmokeEffect from './SmokeEffect.js';

class FireVisualizationLayer extends EventEmitter {
  constructor(viewer, options = {}) {
    super();
    
    this.viewer = viewer;
    this.scene = viewer.scene;
    
    this.options = {
      showBoundary: options.showBoundary !== false,
      showFlames: options.showFlames !== false,
      showSmoke: options.showSmoke !== false,
      showHeatmap: options.showHeatmap || false,
      
      boundaryFill: options.boundaryFill || 'rgba(255, 100, 0, 0.4)',
      boundaryStroke: options.boundaryStroke || 'rgba(255, 50, 0, 1.0)',
      boundaryStrokeWidth: options.boundaryStrokeWidth || 2,
      
      flameOptions: options.flameOptions || {},
      smokeOptions: options.smokeOptions || {},
      
      ...options
    };
    
    this.boundaryEntity = null;
    this.fireParticles = null;
    this.smokeEffect = null;
    this.heatmapImageryLayer = null;
    
    this._visible = true;
    this._intensityMap = new Map();
    
    this._init();
  }

  _init() {
    this.fireParticles = new FireParticleSystem(this.viewer, this.options.flameOptions);
    this.smokeEffect = new SmokeEffect(this.viewer, this.options.smokeOptions);
    
    this.scene.postRender.addEventListener(this._onPostRender.bind(this));
    
    this.emit('initialized');
  }

  _onPostRender() {
    if (!this._visible) return;
    
    if (this.options.showFlames && this.fireParticles) {
      this.fireParticles.update();
    }
    
    if (this.options.showSmoke && this.smokeEffect) {
      this.smokeEffect.update();
    }
  }

  updateFromEngine(engine) {
    const boundary = engine.getBoundary();
    const geojson = engine.getGeoJSON();
    
    this._intensityMap.clear();
    
    for (const point of boundary) {
      const intensity = engine.getIntensityAt(point.x, point.y);
      this._intensityMap.set(`${point.x}_${point.y}`, intensity);
    }
    
    if (this.options.showBoundary && geojson) {
      this._updateBoundary(geojson);
    }
    
    if (this.options.showFlames && this.fireParticles) {
      this.fireParticles.updateFromBoundary(boundary, this._intensityMap);
    }
    
    if (this.options.showSmoke && this.smokeEffect) {
      this.smokeEffect.updateFromBoundary(boundary, this._intensityMap);
    }
    
    if (this.options.showHeatmap) {
      this._updateHeatmap(engine);
    }
    
    this.emit('updated', {
      boundary,
      statistics: engine.statistics
    });
  }

  _updateBoundary(geojson) {
    this.clearBoundary();
    
    if (!geojson || !geojson.features || geojson.features.length === 0) {
      return;
    }
    
    const feature = geojson.features[0];
    const coordinates = feature.geometry.coordinates[0];
    
    const positions = coordinates.map(coord =>
      Cesium.Cartesian3.fromDegrees(coord[0], coord[1])
    );
    
    this.boundaryEntity = this.viewer.entities.add({
      name: 'Fire Boundary',
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: Cesium.Color.fromCssColorString(this.options.boundaryFill),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(this.options.boundaryStroke),
        outlineWidth: this.options.boundaryStrokeWidth,
        height: 0,
        extrudedHeight: 50
      }
    });
    
    this.emit('boundaryUpdated', { entity: this.boundaryEntity });
  }

  _updateHeatmap(engine) {
    // 简化版热力图 - 使用颜色渐变表示强度
    // 完整实现需要额外的热力图库
  }

  clearBoundary() {
    if (this.boundaryEntity) {
      this.viewer.entities.remove(this.boundaryEntity);
      this.boundaryEntity = null;
    }
  }

  setWindData(speed, direction) {
    if (this.smokeEffect) {
      this.smokeEffect.setWindData(speed, direction);
    }
  }

  showBoundary(show) {
    this.options.showBoundary = show;
    if (!show) {
      this.clearBoundary();
    }
    this.emit('visibilityChanged', { component: 'boundary', visible: show });
  }

  showFlames(show) {
    this.options.showFlames = show;
    if (this.fireParticles) {
      this.fireParticles.setVisible(show);
    }
    this.emit('visibilityChanged', { component: 'flames', visible: show });
  }

  showSmoke(show) {
    this.options.showSmoke = show;
    if (this.smokeEffect) {
      this.smokeEffect.setVisible(show);
    }
    this.emit('visibilityChanged', { component: 'smoke', visible: show });
  }

  show() {
    this._visible = true;
    
    if (this.boundaryEntity) {
      this.boundaryEntity.show = true;
    }
    
    if (this.fireParticles) {
      this.fireParticles.show();
    }
    
    if (this.smokeEffect) {
      this.smokeEffect.show();
    }
    
    this.emit('visibilityChanged', true);
  }

  hide() {
    this._visible = false;
    
    if (this.boundaryEntity) {
      this.boundaryEntity.show = false;
    }
    
    if (this.fireParticles) {
      this.fireParticles.hide();
    }
    
    if (this.smokeEffect) {
      this.smokeEffect.hide();
    }
    
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
    
    if (options.flameOptions && this.fireParticles) {
      this.fireParticles.setOptions(options.flameOptions);
    }
    
    if (options.smokeOptions && this.smokeEffect) {
      this.smokeEffect.setOptions(options.smokeOptions);
    }
    
    this.emit('optionsChanged', this.options);
  }

  clear() {
    this.clearBoundary();
    
    if (this.fireParticles) {
      this.fireParticles.clearEmitters();
    }
    
    if (this.smokeEffect) {
      this.smokeEffect.clearEmitters();
    }
    
    this._intensityMap.clear();
    
    this.emit('cleared');
  }

  destroy() {
    this.scene.postRender.removeEventListener(this._onPostRender.bind(this));
    
    this.clearBoundary();
    
    if (this.fireParticles) {
      this.fireParticles.destroy();
      this.fireParticles = null;
    }
    
    if (this.smokeEffect) {
      this.smokeEffect.destroy();
      this.smokeEffect = null;
    }
    
    if (this.heatmapImageryLayer) {
      this.viewer.imageryLayers.remove(this.heatmapImageryLayer);
      this.heatmapImageryLayer = null;
    }
    
    this._intensityMap.clear();
    this.removeAllListeners();
  }
}

export default FireVisualizationLayer;

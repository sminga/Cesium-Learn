/**
 * 火场边界可视化层
 * @module modules/fire/FireBoundaryLayer
 */

import * as Cesium from 'cesium';
import EventEmitter from '../../core/EventEmitter.js';

class FireBoundaryLayer extends EventEmitter {
  constructor(viewer, options = {}) {
    super();
    
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.options = {
      fillColor: 'rgba(255, 100, 0, 0.5)',
      strokeColor: 'rgba(255, 50, 0, 1.0)',
      strokeWidth: 2,
      ...options
    };
    
    this.entity = null;
    this._visible = true;
  }

  updateFromGeoJSON(geojson) {
    if (!geojson || !geojson.features || geojson.features.length === 0) {
      return;
    }
    
    this.clear();
    
    const feature = geojson.features[0];
    const coordinates = feature.geometry.coordinates[0];
    
    const positions = coordinates.map(coord => 
      Cesium.Cartesian3.fromDegrees(coord[0], coord[1])
    );
    
    this.entity = this.viewer.entities.add({
      name: 'Fire Boundary',
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: Cesium.Color.fromCssColorString(this.options.fillColor),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(this.options.strokeColor),
        outlineWidth: this.options.strokeWidth,
        height: 0,
        extrudedHeight: 100
      }
    });
    
    this.emit('updated', { entity: this.entity });
  }

  clear() {
    if (this.entity) {
      this.viewer.entities.remove(this.entity);
      this.entity = null;
    }
  }

  show() {
    if (this.entity) {
      this.entity.show = true;
      this._visible = true;
      this.emit('visibilityChanged', true);
    }
  }

  hide() {
    if (this.entity) {
      this.entity.show = false;
      this._visible = false;
      this.emit('visibilityChanged', false);
    }
  }

  setFill(color) {
    this.options.fillColor = color;
    if (this.entity && this.entity.polygon) {
      this.entity.polygon.material = Cesium.Color.fromCssColorString(color);
    }
  }

  destroy() {
    this.clear();
    this.removeAllListeners();
  }
}

export default FireBoundaryLayer;

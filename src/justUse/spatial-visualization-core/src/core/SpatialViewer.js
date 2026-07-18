/**
 * 空间可视化核心类
 * @module core/SpatialViewer
 */

import * as Cesium from 'cesium';

class SpatialViewer {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' 
      ? document.getElementById(container) 
      : container;
    
    this.options = {
      baseLayer: options.baseLayer || 'naturalEarth',
      terrain: options.terrain || false,
      skyBox: options.skyBox !== false,
      animation: options.animation || false,
      timeline: options.timeline || false,
      ...options
    };
    
    this.viewer = null;
    this.modules = new Map();
    this._init();
  }

  async _init() {
    const viewerOptions = {
      baseLayerPicker: false,
      animation: this.options.animation,
      timeline: this.options.timeline,
      skyBox: this.options.skyBox,
      skyAtmosphere: this.options.skyBox,
      infoBox: false,
      selectionIndicator: false,
      shadows: false,
      shouldAnimate: true,
      contextOptions: {
        webgl2: true,
        preserveDrawingBuffer: true
      }
    };

    if (this.options.baseLayer === 'naturalEarth') {
      viewerOptions.baseLayer = await this._createNaturalEarthLayer();
    } else if (this.options.baseLayer === 'arcgis') {
      viewerOptions.baseLayer = await this._createArcGISLayer();
    } else if (this.options.baseLayer === 'tianditu') {
      viewerOptions.baseLayer = await this._createTiandituLayer();
    }

    if (this.options.terrain) {
      viewerOptions.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
    }

    this.viewer = new Cesium.Viewer(this.container, viewerOptions);
    this.scene = this.viewer.scene;
    this.camera = this.viewer.camera;
    this.entities = this.viewer.entities;

    this.scene.debugShowFramesPerSecond = true;
    this.scene.globe.enableLighting = true;

    this._emit('ready');
  }

  async _createNaturalEarthLayer() {
    return Cesium.ImageryLayer.fromProviderAsync(
      Cesium.TileMapServiceImageryProvider.fromUrl(
        Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
      )
    );
  }

  async _createArcGISLayer() {
    const provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
    );
    return new Cesium.ImageryLayer(provider);
  }

  async _createTiandituLayer() {
    const provider = await Cesium.UrlTemplateImageryProvider.fromUrl(
      'https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=your_token',
      { subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'] }
    );
    return new Cesium.ImageryLayer(provider);
  }

  registerModule(name, module) {
    this.modules.set(name, module);
    module.init(this);
  }

  getModule(name) {
    return this.modules.get(name);
  }

  unregisterModule(name) {
    const module = this.modules.get(name);
    if (module && module.destroy) {
      module.destroy();
    }
    this.modules.delete(name);
  }

  flyTo(lon, lat, height, options = {}) {
    return this.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      orientation: {
        heading: Cesium.Math.toRadians(options.heading || 0),
        pitch: Cesium.Math.toRadians(options.pitch || -45),
        roll: 0
      },
      duration: options.duration || 2
    });
  }

  zoomIn(amount = 2) {
    this.camera.zoomIn(this.camera.positionCartographic.height / amount);
  }

  zoomOut(amount = 2) {
    this.camera.zoomOut(this.camera.positionCartographic.height / amount);
  }

  on(event, callback) {
    this._listeners = this._listeners || new Map();
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this._listeners && this._listeners.has(event)) {
      const callbacks = this._listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  _emit(event, data) {
    if (this._listeners && this._listeners.has(event)) {
      this._listeners.get(event).forEach(cb => cb(data));
    }
  }

  destroy() {
    this.modules.forEach((module, name) => {
      this.unregisterModule(name);
    });
    
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
  }
}

export default SpatialViewer;

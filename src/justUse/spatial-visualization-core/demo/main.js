/**
 * Spatial Visualization Core Demo
 * 风场可视化演示应用 - 完整UI复刻版
 */

import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import * as dat from 'dat.gui';
import Particle3D from '../src/modules/wind/particle3D.js';
import { defaultColorTable } from '../src/modules/wind/options.js';
import { MapProviders, createMapProvider, createTerrainProvider, getProviderList, DEFAULT_PROVIDER } from '../src/utils/mapProviders.js';
import { FireControllerV2 } from '../src/modules/fire/index.js';
import { SplatController } from '../src/modules/splat/index.js';
import ModelLocatorService from '../src/services/ModelLocatorService.js';

Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4ZDE2NTBjZi1jNGIyLTRlYmQtOTE5NS1iMGEzMjZkYzY2ZDciLCJpZCI6MzcxODU1LCJpYXQiOjE3NzU2MzYwOTF9.-vafpENPNz2ukkC8Y9Y3iDJdCGnZiPpGJatyZ7mfqYU';

let viewer = null;
let particle3D = null;
let working = false;
let frameCount = 0;
let lastTime = performance.now();
let currentMapProvider = 'NATURAL_EARTH';

let fireController = null;
let splatController = null;
let fireInitialized = false;
let splatInitialized = false;
let currentSplatId = null;
let igniteMode = false;
let locatorService = null;

const loadingOverlay = document.getElementById('loadingOverlay');
const loadingStatus = document.getElementById('loadingStatus');

function updateLoadingStatus(message) {
  if (loadingStatus) {
    loadingStatus.textContent = message;
  }
  console.log('[Loading]', message);
}

async function initViewer() {
  updateLoadingStatus('初始化 Cesium Viewer...');
  
  try {
    console.log('[Viewer] 开始创建 Cesium Viewer...');
    
    const baseProvider = await createMapProvider(currentMapProvider);
    
    viewer = new Cesium.Viewer('cesiumContainer', {
      baseLayer: new Cesium.ImageryLayer(baseProvider),
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      contextOptions: {
        webgl2: true,
        preserveDrawingBuffer: true
      },
      animation: false,
      timeline: false,
      fullscreenButton: false,
      vrButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      navigationHelpButton: false,
      baseLayerPicker: false,
      requestRenderMode: false
    });

    console.log('[Viewer] Cesium Viewer 创建成功');
    
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.fog.enabled = false;
    viewer.scene.skyBox.show = true;
    viewer.scene.sun.show = true;
    viewer.scene.moon.show = true;
    viewer.scene.debugShowFramesPerSecond = true;
    
    if (Cesium.FeatureDetection.supportsImageRenderingPixelated()) {
      viewer.resolutionScale = window.devicePixelRatio;
    }
    viewer.scene.fxaa = true;
    viewer.scene.postProcessStages.fxaa.enabled = true;
    
    viewer._cesiumWidget._creditContainer.style.display = 'none';
    
    updateLoadingStatus('Cesium Viewer 初始化完成');
    console.log('[Viewer] 初始化完成');
    return viewer;
  } catch (error) {
    console.error('[Viewer] 初始化失败:', error);
    throw error;
  }
}

async function switchMapProvider(providerKey) {
  if (!viewer) return;
  
  try {
    const newProvider = await createMapProvider(providerKey);
    
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(newProvider);
    currentMapProvider = providerKey;
    
    console.log(`[Map] 切换到地图服务: ${MapProviders[providerKey]?.name || providerKey}`);
  } catch (error) {
    console.error('[Map] 切换地图服务失败:', error);
  }
}

const defaultFields = {
  U: 'U_wind',
  V: 'V_wind',
  W: '',
  H: '',
  lon: 'lon',
  lat: 'lat',
  lev: 'lev'
};

const defaultParticleSystemOptions = {
  maxParticles: 1024,
  particleHeight: 1000,
  fadeOpacity: 0.996,
  dropRate: 0.003,
  dropRateBump: 0.01,
  speedFactor: 1.0,
  lineWidth: 2.0,
  dynamic: true
};

class FieldsPanel {
  constructor(container, fields = { variables: ['U_wind', 'V_wind', 'lon', 'lat', 'lev'], dimensions: ['lon', 'lat', 'lev'] }) {
    this.options = { ...defaultFields };
    const that = this;

    const gui = new dat.GUI({ autoPlace: false, closed: true });
    gui.add(that.options, 'U', fields.variables).name('横向速度U');
    gui.add(that.options, 'V', fields.variables).name('纵向速度V');
    gui.add(that.options, 'W', fields.variables).name('垂向速度W');
    gui.add(that.options, 'H', fields.variables).name('高度值H');
    gui.add(that.options, 'lon', fields.dimensions).name('经度lon');
    gui.add(that.options, 'lat', fields.dimensions).name('纬度lat');
    gui.add(that.options, 'lev', fields.dimensions).name('高度lev');

    const containerEl = document.getElementById(container);
    gui.domElement.classList.add('fieldsPanel');
    containerEl.appendChild(gui.domElement);
  }

  getUserInput() {
    return this.options;
  }
}

class ValueRangePanel {
  constructor(container) {
    this.options = { max: 100, min: -100 };
    const that = this;

    const gui = new dat.GUI({ autoPlace: false, closed: true });
    gui.add(that.options, 'max', -10000, 10000, 0.1).name('最大值');
    gui.add(that.options, 'min', -10000, 10000, 0.1).name('最小值');

    const containerEl = document.getElementById(container);
    gui.domElement.classList.add('valueRangePanel');
    containerEl.appendChild(gui.domElement);
  }

  getUserInput() {
    return this.options;
  }
}

class OffsetPanel {
  constructor(container) {
    this.options = { lon: 0, lat: 0, lev: 0 };
    const that = this;

    const gui = new dat.GUI({ autoPlace: false, closed: true });
    gui.add(that.options, 'lon', -360, 360, 0.1).name('经度偏移值');
    gui.add(that.options, 'lat', -180, 180, 0.1).name('纬度偏移值');
    gui.add(that.options, 'lev', -10000, 10000, 0.1).name('高度偏移值');

    const containerEl = document.getElementById(container);
    gui.domElement.classList.add('offsetPanel');
    containerEl.appendChild(gui.domElement);
  }

  getUserInput() {
    return this.options;
  }
}

class ControlPanel {
  constructor(container, optionsChange) {
    this.options = { ...defaultParticleSystemOptions };
    const that = this;

    const onParticleSystemOptionsChange = function () {
      optionsChange(that.getUserInput());
    };

    const gui = new dat.GUI({ autoPlace: false });
    gui.add(that.options, 'maxParticles', 1, 100000, 1).name('最大粒子数').onFinishChange(onParticleSystemOptionsChange);
    gui.add(that.options, 'particleHeight', 1, 10000, 1).name('粒子高度').onFinishChange(onParticleSystemOptionsChange);
    gui.add(that.options, 'fadeOpacity', 0.50, 1.00, 0.001).name('拖尾透明度').onFinishChange(onParticleSystemOptionsChange);
    gui.add(that.options, 'dropRate', 0.0, 0.1).name('重置率').onFinishChange(onParticleSystemOptionsChange);
    gui.add(that.options, 'dropRateBump', 0, 0.2).name('重置&速度关联率').onFinishChange(onParticleSystemOptionsChange);
    gui.add(that.options, 'speedFactor', 0.01, 8).name('粒子速度').onFinishChange(onParticleSystemOptionsChange);
    gui.add(that.options, 'lineWidth', 0.01, 16.0).name('线宽').onFinishChange(onParticleSystemOptionsChange);
    gui.add(that.options, 'dynamic').name('动态运行').onFinishChange(onParticleSystemOptionsChange);

    const containerEl = document.getElementById(container);
    gui.domElement.classList.add('controlPanel');
    containerEl.appendChild(gui.domElement);
  }

  getUserInput() {
    return this.options;
  }
}

class MapProviderPanel {
  constructor(container, onProviderChange) {
    this.options = { provider: 'NATURAL_EARTH' };
    const that = this;
    
    const providerList = getProviderList();
    const providerNames = {};
    providerList.forEach(p => {
      providerNames[p.name] = p.key;
    });
    
    const gui = new dat.GUI({ autoPlace: false, closed: true });
    gui.add(that.options, 'provider', providerNames)
      .name('地图服务')
      .onChange((key) => {
        onProviderChange(key);
      });
    
    const containerEl = document.getElementById(container);
    gui.domElement.classList.add('mapProviderPanel');
    containerEl.appendChild(gui.domElement);
  }
}

let fieldsPanel = new FieldsPanel('fieldsPanelContainer');
const valueRangePanel = new ValueRangePanel('valueRangePanelContainer');
const offsetPanel = new OffsetPanel('offsetPanelContainer');
const mapProviderPanel = new MapProviderPanel('mapProviderPanelContainer', switchMapProvider);

async function loadDefaultWindData() {
  updateLoadingStatus('加载默认风场数据...');
  
  const dataPath = '/data/beijing_multilevel.nc';
  
  try {
    particle3D = new Particle3D(viewer, {
      input: dataPath,
      type: 'nc',
      fields: defaultFields,
      userInput: defaultParticleSystemOptions,
      colorTable: defaultColorTable
    });
    
    await particle3D.init();
    
    const data = particle3D.data;
    if (data && data.lon && data.lat) {
      viewer.camera.flyTo({
        destination: Cesium.Rectangle.fromDegrees(data.lon.min, data.lat.min, data.lon.max, data.lat.max),
        duration: 2
      });
    }
    
    particle3D.show();
    
    document.getElementById('windDataStatus').textContent = '已加载';
    document.getElementById('statechange').disabled = false;
    document.getElementById('remove').disabled = false;
    document.getElementById('statechange').textContent = '隐藏';
    working = true;
    
    updateLoadingStatus('风场数据加载完成');
    
    return particle3D;
  } catch (error) {
    console.error('加载风场数据失败:', error);
    document.getElementById('windDataStatus').textContent = '加载失败';
    throw error;
  }
}

const controlPanel = new ControlPanel('panelContainer', userInput => {
  if (particle3D) {
    particle3D.optionsChange(userInput);
  }
});

const fileInput = document.getElementById('fileInput');
const loadBtn = document.getElementById('load');
const statechangeBtn = document.getElementById('statechange');
const InitializeperspectiveBtn = document.getElementById('Initializeperspective');
const removeBtn = document.getElementById('remove');

fileInput.onchange = function () {
  const file = fileInput.files[0];
  if (file) {
    loadBtn.disabled = false;
  }
};

loadBtn.onclick = async function () {
  if (fileInput.files[0] && viewer && !particle3D) {
    const file = fileInput.files[0];
    const fields = fieldsPanel.getUserInput();
    const valueRange = valueRangePanel.getUserInput();
    const offset = offsetPanel.getUserInput();
    const userInput = controlPanel.getUserInput();
    
    particle3D = new Particle3D(viewer, {
      input: file,
      userInput,
      fields,
      valueRange,
      offset,
      colorTable: defaultColorTable
    });
    
    try {
      await particle3D.init();
      particle3D.show();
      statechangeBtn.disabled = false;
      removeBtn.disabled = false;
      loadBtn.disabled = true;
      statechangeBtn.textContent = '隐藏';
      working = true;
      document.getElementById('windDataStatus').textContent = file.name;
    } catch (e) {
      particle3D.remove();
      particle3D = null;
      window.alert('加载失败: ' + e.message);
    }
  }
};

statechangeBtn.onclick = function () {
  if (particle3D) {
    if (working) {
      particle3D.hide();
      statechangeBtn.textContent = '显示';
    } else {
      particle3D.show();
      statechangeBtn.textContent = '隐藏';
    }
    working = !working;
  }
};

InitializeperspectiveBtn.onclick = function () {
  if (particle3D && particle3D.data) {
    const data = particle3D.data;
    viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(data.lon.min, data.lat.min, data.lon.max, data.lat.max),
      duration: 1.5
    });
  } else {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(116.0, 40.0, 200000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: Cesium.Math.toRadians(0)
      },
      duration: 1.5
    });
  }
};

removeBtn.onclick = function () {
  if (particle3D) {
    particle3D.remove();
    working = false;
    statechangeBtn.textContent = '显示';
    particle3D = null;
    statechangeBtn.disabled = true;
    removeBtn.disabled = true;
    loadBtn.disabled = false;
    document.getElementById('windDataStatus').textContent = '未加载';
  }
};

function createMockDEMData() {
  const centerLon = 116.0;
  const centerLat = 40.0;
  const size = 0.5;
  const resolution = 50;
  
  const nrows = resolution;
  const ncols = resolution;
  const cellsize = size / resolution;
  const xllcorner = centerLon - size / 2;
  const yllcorner = centerLat - size / 2;
  
  const data = new Float32Array(nrows * ncols);
  
  for (let row = 0; row < nrows; row++) {
    for (let col = 0; col < ncols; col++) {
      const idx = row * ncols + col;
      const x = col / ncols;
      const y = row / nrows;
      data[idx] = 100 + 50 * Math.sin(x * Math.PI * 2) * Math.cos(y * Math.PI * 2);
    }
  }
  
  return {
    nrows,
    ncols,
    xllcorner,
    yllcorner,
    cellsize,
    nodata_value: -9999,
    data
  };
}

function initFireControls() {
  const fireInitBtn = document.getElementById('fireInit');
  const fireIgniteBtn = document.getElementById('fireIgnite');
  const fireStartBtn = document.getElementById('fireStart');
  const fireStopBtn = document.getElementById('fireStop');
  const fireResetBtn = document.getElementById('fireReset');
  const fireExportBtn = document.getElementById('fireExport');
  const fuelModelSelect = document.getElementById('fuelModelSelect');
  const fireWindSpeedInput = document.getElementById('fireWindSpeed');
  const fireWindDirInput = document.getElementById('fireWindDir');
  const fireMoistureInput = document.getElementById('fireMoisture');
  const fireStatusEl = document.getElementById('fireStatus');
  
  fireInitBtn.onclick = async function() {
    try {
      fireStatusEl.textContent = '初始化中...';
      
      const demData = createMockDEMData();
      
      fireController = new FireControllerV2(viewer, {
        autoUpdate: true,
        updateInterval: 500,
        timeStep: 1
      });
      
      await fireController.init(demData);
      
      fireController.on('propagated', (data) => {
        const stats = fireController.getStatistics();
        if (stats) {
          fireStatusEl.textContent = `蔓延中 - ${stats.burnedArea?.toFixed(2) || 0} 公顷`;
        }
      });
      
      fireInitialized = true;
      fireStatusEl.textContent = '已初始化';
      
      fireInitBtn.disabled = true;
      fireIgniteBtn.disabled = false;
      fireResetBtn.disabled = false;
      
      console.log('[Fire] 林火蔓延模块初始化完成');
      
    } catch (error) {
      console.error('[Fire] 初始化失败:', error);
      fireStatusEl.textContent = '初始化失败';
      alert('林火蔓延模块初始化失败: ' + error.message);
    }
  };
  
  fireIgniteBtn.onclick = function() {
    if (!fireInitialized || !fireController) {
      alert('请先初始化林火蔓延模块');
      return;
    }
    
    igniteMode = true;
    fireStatusEl.textContent = '点击地图选择点火位置';
    
    viewer.canvas.style.cursor = 'crosshair';
  };
  
  fireStartBtn.onclick = function() {
    if (!fireController) return;
    
    const windSpeed = parseFloat(fireWindSpeedInput.value) || 5;
    const windDir = parseFloat(fireWindDirInput.value) || 0;
    const moisture = parseFloat(fireMoistureInput.value) || 10;
    const fuelModel = parseInt(fuelModelSelect.value) || 1;
    
    fireController.setWind(windSpeed, windDir);
    fireController.setMoisture(moisture);
    fireController.setFuelModel(fuelModel);
    
    fireController.start();
    fireStatusEl.textContent = '蔓延中...';
    
    fireStartBtn.disabled = true;
    fireStopBtn.disabled = false;
  };
  
  fireStopBtn.onclick = function() {
    if (!fireController) return;
    
    fireController.stop();
    fireStatusEl.textContent = '已停止';
    
    fireStartBtn.disabled = false;
    fireStopBtn.disabled = true;
  };
  
  fireResetBtn.onclick = function() {
    if (!fireController) return;
    
    fireController.reset();
    fireStatusEl.textContent = '已重置';
    
    fireStartBtn.disabled = true;
    fireStopBtn.disabled = true;
    fireExportBtn.disabled = true;
    fireIgniteBtn.disabled = false;
  };
  
  fireExportBtn.onclick = function() {
    if (!fireController) return;
    
    const geojson = fireController.getGeoJSON();
    if (geojson) {
      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fire_spread_${Date.now()}.geojson`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  
  viewer.screenSpaceEventHandler.setInputAction(function(movement) {
    if (igniteMode && fireController) {
      const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        
        try {
          fireController.ignite(lon, lat);
          fireStatusEl.textContent = `已点火: (${lon.toFixed(4)}, ${lat.toFixed(4)})`;
          
          fireIgniteBtn.disabled = true;
          fireStartBtn.disabled = false;
          fireExportBtn.disabled = false;
          
          igniteMode = false;
          viewer.canvas.style.cursor = 'default';
          
          console.log(`[Fire] 点火位置: ${lon}, ${lat}`);
        } catch (error) {
          console.error('[Fire] 点火失败:', error);
          fireStatusEl.textContent = '点火失败';
        }
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

function initSplatControls() {
  const splatInitBtn = document.getElementById('splatInit');
  const splatLoadBtn = document.getElementById('splatLoad');
  const splatShowBtn = document.getElementById('splatShow');
  const splatHideBtn = document.getElementById('splatHide');
  const splatRemoveBtn = document.getElementById('splatRemove');
  const splatFileInput = document.getElementById('splatFileInput');
  const splatLonInput = document.getElementById('splatLon');
  const splatLatInput = document.getElementById('splatLat');
  const splatHeightInput = document.getElementById('splatHeight');
  const splatScaleInput = document.getElementById('splatScale');
  
  splatFileInput.onchange = function() {
    if (splatFileInput.files[0]) {
      splatLoadBtn.disabled = !splatInitialized;
    }
  };
  
  splatInitBtn.onclick = async function() {
    try {
      splatController = new SplatController(viewer);
      await splatController.init();
      
      splatInitialized = true;
      splatInitBtn.disabled = true;
      
      if (splatFileInput.files[0]) {
        splatLoadBtn.disabled = false;
      }
      
      console.log('[Splat] 高斯泼溅模块初始化完成');
      
    } catch (error) {
      console.error('[Splat] 初始化失败:', error);
      alert('高斯泼溅模块初始化失败: ' + error.message);
    }
  };
  
  splatLoadBtn.onclick = async function() {
    if (!splatInitialized || !splatController) {
      alert('请先初始化高斯泼溅模块');
      return;
    }
    
    const file = splatFileInput.files[0];
    if (!file) {
      alert('请选择模型文件');
      return;
    }
    
    try {
      const url = URL.createObjectURL(file);
      const lon = parseFloat(splatLonInput.value) || 116.0;
      const lat = parseFloat(splatLatInput.value) || 40.0;
      const height = parseFloat(splatHeightInput.value) || 0;
      const scale = parseFloat(splatScaleInput.value) || 1;
      
      const result = await splatController.loadModel(url, {
        id: `splat_${Date.now()}`
      });
      
      currentSplatId = result.id;
      
      splatController.setPosition(result.id, lon, lat, height);
      splatController.setScale(result.id, scale);
      
      splatShowBtn.disabled = false;
      splatHideBtn.disabled = false;
      splatRemoveBtn.disabled = false;
      splatLoadBtn.disabled = true;
      
      console.log(`[Splat] 模型加载成功: ${result.id}`);
      
    } catch (error) {
      console.error('[Splat] 模型加载失败:', error);
      alert('模型加载失败: ' + error.message);
    }
  };
  
  splatShowBtn.onclick = function() {
    if (currentSplatId && splatController) {
      splatController.setVisible(currentSplatId, true);
    }
  };
  
  splatHideBtn.onclick = function() {
    if (currentSplatId && splatController) {
      splatController.setVisible(currentSplatId, false);
    }
  };
  
  splatRemoveBtn.onclick = function() {
    if (currentSplatId && splatController) {
      splatController.unloadModel(currentSplatId);
      currentSplatId = null;
      
      splatShowBtn.disabled = true;
      splatHideBtn.disabled = true;
      splatRemoveBtn.disabled = true;
      splatLoadBtn.disabled = !splatFileInput.files[0];
    }
  };
  
  splatScaleInput.onchange = function() {
    if (currentSplatId && splatController) {
      const scale = parseFloat(splatScaleInput.value) || 1;
      splatController.setScale(currentSplatId, scale);
    }
  };
  
  splatLonInput.onchange = function() {
    updateSplatPosition();
  };
  
  splatLatInput.onchange = function() {
    updateSplatPosition();
  };
  
  splatHeightInput.onchange = function() {
    updateSplatPosition();
  };
  
  function updateSplatPosition() {
    if (currentSplatId && splatController) {
      const lon = parseFloat(splatLonInput.value) || 116.0;
      const lat = parseFloat(splatLatInput.value) || 40.0;
      const height = parseFloat(splatHeightInput.value) || 0;
      splatController.setPosition(currentSplatId, lon, lat, height);
    }
  }
  
  const splatLocateBtn = document.getElementById('splatLocate');
  const proxyHostInput = document.getElementById('proxyHost');
  const proxyPortInput = document.getElementById('proxyPort');
  const testProxyBtn = document.getElementById('testProxy');
  const locateStatusContainer = document.getElementById('locateStatusContainer');
  
  locatorService = new ModelLocatorService({
    proxyHost: proxyHostInput.value,
    proxyPort: parseInt(proxyPortInput.value)
  });
  
  function showLocateStatus(message, type = 'info') {
    locateStatusContainer.innerHTML = `
      <div style="font-size: 12px; padding: 8px; margin-top: 8px; border-radius: 4px; 
                  background: ${type === 'success' ? 'rgba(76, 175, 80, 0.2)' : type === 'error' ? 'rgba(244, 67, 54, 0.2)' : 'rgba(33, 150, 243, 0.2)'};
                  color: ${type === 'success' ? '#81c784' : type === 'error' ? '#e57373' : '#64b5f6'};">
        ${message}
      </div>
    `;
  }
  
  function clearLocateStatus() {
    locateStatusContainer.innerHTML = '';
  }
  
  splatLocateBtn.onclick = async function() {
    if (!currentSplatId) {
      showLocateStatus('请先加载模型', 'error');
      return;
    }
    
    const lon = parseFloat(splatLonInput.value) || 116.0;
    const lat = parseFloat(splatLatInput.value) || 40.0;
    const height = parseFloat(splatHeightInput.value) || 0;
    
    try {
      splatLocateBtn.disabled = true;
      splatLocateBtn.textContent = '定位中...';
      showLocateStatus('正在飞往模型位置...', 'info');
      
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, height + 500),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0
        },
        duration: 2
      });
      
      setTimeout(() => {
        showLocateStatus(`定位成功: (${lon.toFixed(6)}, ${lat.toFixed(6)})`, 'success');
        splatLocateBtn.disabled = false;
        splatLocateBtn.textContent = '定位模型';
      }, 2000);
      
    } catch (error) {
      console.error('[Locate] 定位失败:', error);
      showLocateStatus(`定位失败: ${error.message}`, 'error');
      splatLocateBtn.disabled = false;
      splatLocateBtn.textContent = '定位模型';
    }
  };
  
  testProxyBtn.onclick = async function() {
    const host = proxyHostInput.value;
    const port = parseInt(proxyPortInput.value);
    
    locatorService.setProxy(host, port);
    
    testProxyBtn.disabled = true;
    testProxyBtn.textContent = '测试中...';
    showLocateStatus(`正在连接代理服务器 ${host}:${port}...`, 'info');
    
    try {
      const isConnected = await locatorService.checkConnection();
      
      if (isConnected) {
        showLocateStatus(`代理服务器连接成功: ${host}:${port}`, 'success');
        testProxyBtn.textContent = '已连接';
      } else {
        showLocateStatus(`代理服务器无响应: ${host}:${port}`, 'error');
        testProxyBtn.textContent = '连接失败';
      }
    } catch (error) {
      showLocateStatus(`连接错误: ${error.message}`, 'error');
      testProxyBtn.textContent = '连接失败';
    }
    
    setTimeout(() => {
      testProxyBtn.disabled = false;
      testProxyBtn.textContent = '测试连接';
    }, 3000);
  };
  
  if (splatLoadBtn) {
    const originalLoadHandler = splatLoadBtn.onclick;
    splatLoadBtn.onclick = async function() {
      if (originalLoadHandler) {
        await originalLoadHandler.call(this);
      }
      if (currentSplatId) {
        splatLocateBtn.disabled = false;
      }
    };
  }
}

function startFPSCounter() {
  function updateFPS() {
    frameCount++;
    const now = performance.now();
    const delta = now - lastTime;
    
    if (delta >= 1000) {
      const fps = Math.round(frameCount * 1000 / delta);
      document.getElementById('fps').textContent = fps;
      document.getElementById('particleCount').textContent = 
        particle3D ? particle3D.userInput.maxParticles : 0;
      frameCount = 0;
      lastTime = now;
    }
    
    requestAnimationFrame(updateFPS);
  }
  updateFPS();
}

async function main() {
  try {
    console.log('[Main] 启动空间信息可视化核心库...');
    console.log('[Main] Cesium 版本:', Cesium.VERSION);
    
    await initViewer();
    await loadDefaultWindData();
    
    initFireControls();
    initSplatControls();
    
    startFPSCounter();
    
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
    
    console.log('[Main] 应用启动完成');
    
  } catch (error) {
    console.error('[Main] 启动失败:', error);
    const errorMsg = error?.message || error?.toString() || '未知错误';
    updateLoadingStatus('启动失败: ' + errorMsg);
    
    if (loadingOverlay) {
      loadingOverlay.innerHTML = `
        <div style="color: #ff6b6b; text-align: center;">
          <div style="font-size: 24px; margin-bottom: 10px;">启动失败</div>
          <div style="font-size: 14px;">${errorMsg}</div>
          <div style="font-size: 12px; margin-top: 10px; color: #aaa;">
            请检查控制台获取详细信息
          </div>
        </div>
      `;
    }
  }
}

main();

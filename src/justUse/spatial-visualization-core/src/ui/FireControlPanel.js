/**
 * 火场控制面板
 * @module ui/FireControlPanel
 * @description 提供火蔓延模拟的参数调整和交互控制
 */

import * as dat from 'dat.gui';
import { listFuelModels } from '../modules/fire/FuelModels.js';

class FireControlPanel {
  constructor(container, fireController, options = {}) {
    this.container = typeof container === 'string' 
      ? document.getElementById(container) 
      : container;
    this.fireController = fireController;
    
    this.options = {
      position: options.position || 'top-right',
      width: options.width || 300,
      ...options
    };
    
    this.gui = null;
    this._ignitionMode = false;
    this._clickHandler = null;
    
    this._init();
  }

  _init() {
    this.gui = new dat.GUI({ 
      autoPlace: false,
      width: this.options.width
    });
    
    this.gui.domElement.classList.add('fire-control-panel');
    this.container.appendChild(this.gui.domElement);
    
    this._createSimulationFolder();
    this._createEnvironmentFolder();
    this._createFuelFolder();
    this._createVisualizationFolder();
    this._createActionsFolder();
    
    this._setupEventListeners();
  }

  _createSimulationFolder() {
    const simulation = this.gui.addFolder('模拟控制');
    
    this._simulationParams = {
      running: false,
      timeStep: 1,
      updateInterval: 500,
      autoUpdate: true
    };
    
    simulation.add(this._simulationParams, 'running')
      .name('运行中')
      .listen()
      .onChange((value) => {
        if (value) {
          this.fireController.start();
        } else {
          this.fireController.stop();
        }
      });
    
    simulation.add(this._simulationParams, 'timeStep', 0.1, 5, 0.1)
      .name('时间步长');
    
    simulation.add(this._simulationParams, 'updateInterval', 100, 2000, 100)
      .name('更新间隔(ms)');
    
    simulation.open();
  }

  _createEnvironmentFolder() {
    const environment = this.gui.addFolder('环境参数');
    
    this._envParams = {
      windSpeed: 0,
      windDirection: 0,
      moisture: 0.1,
      temperature: 25,
      humidity: 50
    };
    
    environment.add(this._envParams, 'windSpeed', 0, 30, 0.5)
      .name('风速 (m/s)')
      .onChange((value) => {
        this.fireController.setWind(value, this._envParams.windDirection);
      });
    
    environment.add(this._envParams, 'windDirection', 0, 360, 1)
      .name('风向 (°)')
      .onChange((value) => {
        this.fireController.setWind(this._envParams.windSpeed, value);
      });
    
    environment.add(this._envParams, 'moisture', 0, 1, 0.01)
      .name('含水率')
      .onChange((value) => {
        this.fireController.setMoisture(value);
      });
    
    environment.add(this._envParams, 'temperature', -10, 45, 1)
      .name('温度 (°C)');
    
    environment.add(this._envParams, 'humidity', 0, 100, 1)
      .name('湿度 (%)');
    
    environment.open();
  }

  _createFuelFolder() {
    const fuel = this.gui.addFolder('燃料模型');
    
    const fuelModels = listFuelModels();
    const fuelOptions = {};
    fuelModels.forEach(m => {
      fuelOptions[m.name] = m.id;
    });
    
    this._fuelParams = {
      model: 1,
      modelName: '短草草地'
    };
    
    fuel.add(this._fuelParams, 'model', fuelOptions)
      .name('燃料类型')
      .onChange((value) => {
        this.fireController.setFuelModel(parseInt(value));
      });
    
    fuel.open();
  }

  _createVisualizationFolder() {
    const viz = this.gui.addFolder('可视化');
    
    this._vizParams = {
      showBoundary: true,
      showFlames: true,
      showSmoke: true,
      flameIntensity: 1.0,
      smokeOpacity: 0.3
    };
    
    viz.add(this._vizParams, 'showBoundary')
      .name('显示边界')
      .onChange((value) => {
        this.fireController.showBoundary(value);
      });
    
    viz.add(this._vizParams, 'showFlames')
      .name('显示火焰')
      .onChange((value) => {
        this.fireController.showFlames(value);
      });
    
    viz.add(this._vizParams, 'showSmoke')
      .name('显示烟雾')
      .onChange((value) => {
        this.fireController.showSmoke(value);
      });
    
    viz.add(this._vizParams, 'flameIntensity', 0.1, 2, 0.1)
      .name('火焰强度')
      .onChange((value) => {
        this.fireController.setVisualizationOptions({
          flameOptions: { particleCount: Math.floor(500 * value) }
        });
      });
    
    viz.add(this._vizParams, 'smokeOpacity', 0.1, 0.8, 0.05)
      .name('烟雾透明度')
      .onChange((value) => {
        this.fireController.setVisualizationOptions({
          smokeOptions: { color: [0.5, 0.5, 0.5, value] }
        });
      });
    
    viz.open();
  }

  _createActionsFolder() {
    const actions = this.gui.addFolder('操作');
    
    this._actionParams = {
      ignitionMode: false,
      stepOnce: () => this._stepOnce(),
      reset: () => this._reset(),
      exportGeoJSON: () => this._exportGeoJSON(),
      exportReport: () => this._exportReport()
    };
    
    actions.add(this._actionParams, 'ignitionMode')
      .name('点火模式')
      .onChange((value) => {
        this._toggleIgnitionMode(value);
      });
    
    actions.add(this._actionParams, 'stepOnce').name('单步执行');
    actions.add(this._actionParams, 'reset').name('重置');
    actions.add(this._actionParams, 'exportGeoJSON').name('导出 GeoJSON');
    actions.add(this._actionParams, 'exportReport').name('导出报告');
    
    actions.open();
  }

  _setupEventListeners() {
    this.fireController.on('propagated', (data) => {
      this._updateStatistics(data.statistics);
    });
    
    this.fireController.on('ignited', () => {
      this._actionParams.ignitionMode = false;
      this.gui.updateDisplay();
    });
  }

  _toggleIgnitionMode(enabled) {
    this._ignitionMode = enabled;
    
    if (enabled) {
      this._clickHandler = (event) => {
        const cartesian = this.fireController.viewer.camera.pickEllipsoid(
          event.position,
          this.fireController.viewer.scene.globe.ellipsoid
        );
        
        if (cartesian) {
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          const lon = Cesium.Math.toDegrees(cartographic.longitude);
          const lat = Cesium.Math.toDegrees(cartographic.latitude);
          
          try {
            this.fireController.ignite(lon, lat);
            this._toggleIgnitionMode(false);
          } catch (error) {
            console.error('点火失败:', error);
          }
        }
      };
      
      this.fireController.viewer.screenSpaceEventHandler.setInputAction(
        this._clickHandler,
        Cesium.ScreenSpaceEventType.LEFT_CLICK
      );
      
      this.fireController.viewer.canvas.style.cursor = 'crosshair';
    } else {
      if (this._clickHandler) {
        this.fireController.viewer.screenSpaceEventHandler.removeInputAction(
          Cesium.ScreenSpaceEventType.LEFT_CLICK
        );
        this._clickHandler = null;
      }
      
      this.fireController.viewer.canvas.style.cursor = 'default';
    }
  }

  _stepOnce() {
    this.fireController.stop();
    this._simulationParams.running = false;
    this.gui.updateDisplay();
    
    this.fireController.step(this._simulationParams.timeStep);
  }

  _reset() {
    this.fireController.reset();
    this._simulationParams.running = false;
    this.gui.updateDisplay();
  }

  _exportGeoJSON() {
    const geojson = this.fireController.getGeoJSON();
    if (geojson) {
      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fire_boundary_${Date.now()}.geojson`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  _exportReport() {
    const statistics = this.fireController.getStatistics();
    const history = this.fireController.getHistory();
    
    const report = {
      timestamp: new Date().toISOString(),
      statistics,
      history,
      environment: this._envParams,
      fuel: this._fuelParams
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fire_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  _updateStatistics(statistics) {
    if (this._statsDisplay) {
      this._statsDisplay.innerHTML = `
        <div>过火面积: ${(statistics.burnedArea / 1000000).toFixed(2)} km²</div>
        <div>火线周长: ${(statistics.perimeter / 1000).toFixed(2)} km</div>
        <div>最大蔓延速度: ${statistics.maxSpreadRate.toFixed(2)} m/s</div>
        <div>平均蔓延速度: ${statistics.avgSpreadRate.toFixed(2)} m/s</div>
      `;
    }
  }

  setWindSpeed(speed) {
    this._envParams.windSpeed = speed;
    this.fireController.setWind(speed, this._envParams.windDirection);
    this.gui.updateDisplay();
  }

  setWindDirection(direction) {
    this._envParams.windDirection = direction;
    this.fireController.setWind(this._envParams.windSpeed, direction);
    this.gui.updateDisplay();
  }

  show() {
    this.gui.domElement.style.display = 'block';
  }

  hide() {
    this.gui.domElement.style.display = 'none';
  }

  destroy() {
    this._toggleIgnitionMode(false);
    
    if (this.gui) {
      this.gui.destroy();
      this.gui = null;
    }
  }
}

export default FireControlPanel;

# 使用示例

## 1. 基础火蔓延模拟

```javascript
import * as Cesium from 'cesium';
import { 
  FireControllerV2, 
  TerrainDataProvider,
  FireControlPanel,
  AnalysisPanel 
} from 'spatial-visualization-core';

// 初始化 Cesium Viewer
const viewer = new Cesium.Viewer('cesiumContainer', {
  terrainProvider: await Cesium.CesiumTerrainProvider.fromIonAssetId(1)
});

// 加载 DEM 数据
const terrainProvider = new TerrainDataProvider();
await terrainProvider.loadFromURL('/data/dem.asc');
const demData = terrainProvider.getDEMData();

// 创建火蔓延控制器
const fireController = new FireControllerV2(viewer, {
  autoUpdate: true,
  updateInterval: 500,
  useWebWorker: true
});

await fireController.init(demData);

// 设置环境参数
fireController.setWind(5, 45);  // 风速 5 m/s，风向 45°
fireController.setMoisture(0.15);  // 含水率 15%
fireController.setFuelModel(1);  // 短草草地

// 点火
fireController.ignite(116.0, 40.0);

// 开始模拟
fireController.start();

// 添加控制面板
const controlPanel = new FireControlPanel('panelContainer', fireController);

// 添加分析面板
const analysisPanel = new AnalysisPanel('analysisContainer');
fireController.on('propagated', (data) => {
  analysisPanel.update(data.statistics);
});
```

## 2. 风场驱动的火蔓延

```javascript
import { 
  WindFieldLayer,
  FireControllerV2,
  WindFireConnector,
  TerrainDataProvider 
} from 'spatial-visualization-core';

// 加载风场数据
const windLayer = new WindFieldLayer(viewer);
await windLayer.loadWindData('/data/wind.nc', {
  U: 'U_wind',
  V: 'V_wind'
});
await windLayer.init();
windLayer.show();

// 创建火蔓延控制器
const fireController = new FireControllerV2(viewer);
await fireController.init(demData);

// 创建风场-火蔓延连接器
const windFireConnector = new WindFireConnector();
windFireConnector.connect(windLayer, fireController);
windFireConnector.enable();

// 点火并开始模拟
fireController.ignite(116.0, 40.0);
fireController.start();

// 风场数据会自动驱动火蔓延方向和速度
```

## 3. 自定义燃料模型

```javascript
import { FireControllerV2, FuelModels } from 'spatial-visualization-core';

// 查看所有燃料模型
const fuelModels = fireController.getFuelModels();
console.log(fuelModels);

// 使用预设燃料模型
fireController.setFuelModel(4);  // 灌木丛

// 创建自定义燃料模型
fireController.setFuelModel(99, {
  name: '自定义灌木',
  baseRate: 0.35,
  moistureFactor: 0.6,
  windFactor: 0.9,
  slopeFactor: 0.7,
  flameLength: 2.0,
  heatPerUnitArea: 2500
});

// 设置特定位置的燃料类型
fireController.setFuelAt(116.5, 40.5, 3);  // 高草草地
```

## 4. 可视化效果控制

```javascript
// 控制可视化组件
fireController.showBoundary(true);   // 显示火场边界
fireController.showFlames(true);     // 显示火焰粒子
fireController.showSmoke(true);      // 显示烟雾效果

// 调整火焰效果参数
fireController.setVisualizationOptions({
  flameOptions: {
    particleCount: 800,
    emissionRate: 60,
    particleSize: 10,
    lifetime: 2.5
  },
  smokeOptions: {
    particleCount: 400,
    emissionRate: 30,
    color: [0.4, 0.4, 0.4, 0.4]
  }
});
```

## 5. 结果导出

```javascript
// 导出 GeoJSON
const geojson = fireController.getGeoJSON();
console.log(geojson);

// 导出分析报告
const history = fireController.getHistory();
const statistics = fireController.getStatistics();

const report = {
  timestamp: new Date().toISOString(),
  statistics,
  history,
  geojson
};

// 下载 JSON 文件
const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'fire_report.json';
a.click();
```

## 6. 完整示例：集成风场和火蔓延

```javascript
import * as Cesium from 'cesium';
import { 
  Particle3D,
  FireControllerV2,
  TerrainDataProvider,
  WindFireConnector,
  FireControlPanel,
  AnalysisPanel
} from 'spatial-visualization-core';

async function main() {
  // 1. 初始化 Cesium
  const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: await Cesium.CesiumTerrainProvider.fromIonAssetId(1)
  });
  
  // 2. 加载风场
  const windLayer = new Particle3D(viewer, {
    input: '/data/wind.nc',
    type: 'nc',
    userInput: {
      maxParticles: 2048,
      particleHeight: 1000,
      fadeOpacity: 0.996,
      speedFactor: 1.0
    }
  });
  await windLayer.init();
  windLayer.show();
  
  // 3. 加载地形
  const terrainProvider = new TerrainDataProvider();
  await terrainProvider.loadFromURL('/data/dem.asc');
  
  // 4. 创建火蔓延控制器
  const fireController = new FireControllerV2(viewer, {
    updateInterval: 500,
    useWebWorker: true
  });
  await fireController.init(terrainProvider.getDEMData());
  
  // 5. 连接风场和火蔓延
  const windFireConnector = new WindFireConnector({
    updateInterval: 1000
  });
  windFireConnector.connect(windLayer, fireController);
  windFireConnector.enable();
  
  // 6. 添加 UI
  const controlPanel = new FireControlPanel('controls', fireController);
  const analysisPanel = new AnalysisPanel('analysis');
  
  fireController.on('propagated', (data) => {
    analysisPanel.update(data.statistics, fireController.getHistory());
  });
  
  // 7. 初始设置
  fireController.setFuelModel(1);
  fireController.setMoisture(0.1);
  
  console.log('系统初始化完成，点击"点火模式"开始模拟');
}

main().catch(console.error);
```

## 7. API 快速参考

### FireControllerV2

| 方法 | 说明 |
|------|------|
| `init(demData)` | 初始化控制器 |
| `ignite(lon, lat)` | 在指定位置点火 |
| `start()` | 开始自动模拟 |
| `stop()` | 停止模拟 |
| `step(timeStep)` | 单步执行 |
| `setWind(speed, direction)` | 设置风速和风向 |
| `setFuelModel(modelId, customParams)` | 设置燃料模型 |
| `setMoisture(moisture)` | 设置含水率 |
| `getStatistics()` | 获取统计数据 |
| `getBoundary()` | 获取火场边界 |
| `getGeoJSON()` | 导出 GeoJSON |
| `reset()` | 重置模拟 |

### WindFireConnector

| 方法 | 说明 |
|------|------|
| `connect(windLayer, fireController)` | 连接风场和火蔓延模块 |
| `enable()` | 启用风场驱动 |
| `disable()` | 禁用风场驱动 |
| `getWindAt(lon, lat)` | 获取指定位置的风场数据 |

### TerrainDataProvider

| 方法 | 说明 |
|------|------|
| `loadFromURL(url)` | 从 URL 加载 DEM |
| `loadFromFile(file)` | 从文件加载 DEM |
| `getDataAt(lon, lat)` | 获取指定位置的地形数据 |
| `getExtent()` | 获取数据范围 |

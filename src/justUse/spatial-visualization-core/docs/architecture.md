# 空间信息可视化核心库 - 架构文档 v2.0

## 项目概述

`spatial-visualization-core` 是一个基于 Cesium.js 的空间信息可视化核心库，提供风场可视化、林火蔓延模拟、高斯泼溅渲染等功能。v2.0 版本进行了系统性升级，深度整合了各功能模块。

## 目录结构

```
spatial-visualization-core/
├── src/
│   ├── core/                    # 核心模块
│   │   ├── SpatialViewer.js     # 空间可视化主类
│   │   ├── EventEmitter.js      # 事件发射器
│   │   ├── PluginManager.js     # 插件管理器
│   │   ├── ConfigManager.js     # 配置管理器
│   │   ├── interfaces/          # 接口定义
│   │   │   ├── IDataProvider.js
│   │   │   └── IVisualizationLayer.js
│   │   ├── connectors/          # 模块连接器
│   │   │   ├── ModuleConnector.js
│   │   │   └── WindFireConnector.js
│   │   ├── providers/           # 数据提供者
│   │   │   └── TerrainDataProvider.js
│   │   └── index.js
│   │
│   ├── modules/                 # 功能模块
│   │   ├── wind/                # 风场模块
│   │   │   ├── WindFieldLayer.js
│   │   │   ├── Particle3D.js
│   │   │   ├── DataProcessor.js
│   │   │   └── index.js
│   │   │
│   │   ├── fire/                # 林火蔓延模块
│   │   │   ├── FireSpreadEngine.js      # 基础引擎
│   │   │   ├── FireSpreadEngineV2.js    # 增强引擎
│   │   │   ├── FireBoundaryLayer.js     # 边界可视化
│   │   │   ├── FireVisualizationLayer.js # 综合可视化
│   │   │   ├── FireController.js        # 基础控制器
│   │   │   ├── FireControllerV2.js      # 增强控制器
│   │   │   ├── FireParticleSystem.js    # 火焰粒子
│   │   │   ├── SmokeEffect.js           # 烟雾效果
│   │   │   ├── FuelModels.js            # 燃料模型
│   │   │   └── index.js
│   │   │
│   │   └── splat/               # 高斯泼溅模块
│   │       ├── GaussianSplatLayer.js
│   │       ├── SplatController.js
│   │       ├── ThreeOverlay.js
│   │       └── index.js
│   │
│   ├── ui/                      # UI 组件
│   │   ├── FireControlPanel.js  # 火场控制面板
│   │   ├── AnalysisPanel.js     # 分析面板
│   │   └── index.js
│   │
│   ├── utils/                   # 工具函数
│   │   ├── mathUtils.js
│   │   ├── demParser.js
│   │   ├── netcdfParser.js
│   │   ├── geojsonConverter.js
│   │   └── index.js
│   │
│   ├── shaders/                 # 着色器
│   │   ├── glsl/
│   │   └── index.js
│   │
│   └── index.js                 # 主入口
│
├── public/
│   └── data/                    # 示例数据
│
├── docs/                        # 文档
│   ├── architecture.md          # 架构文档
│   ├── integration-design.md    # 整合设计
│   ├── examples.md              # 使用示例
│   ├── test-plan.md
│   └── test-report.md
│
├── tests/                       # 测试
├── demo/                        # 演示应用
│
├── package.json
├── vite.config.js
└── README.md
```

## 核心架构

### 1. 接口层

#### IDataProvider
统一数据提供者接口，所有数据源都需要实现此接口：

```javascript
interface IDataProvider {
  getDataAt(lon, lat, height?): Promise<any>;
  getExtent(): { minLon, maxLon, minLat, maxLat };
  isLoading(): boolean;
  isReady(): boolean;
  destroy(): void;
}
```

#### IVisualizationLayer
统一可视化层接口：

```javascript
interface IVisualizationLayer {
  init(viewer): Promise<void>;
  show(): void;
  hide(): void;
  setVisible(visible): void;
  isVisible(): boolean;
  setOptions(options): void;
  destroy(): void;
}
```

### 2. 连接器层

#### ModuleConnector
通用模块连接器，实现模块间的数据流转：

```javascript
const connector = new ModuleConnector();
connector.connect(sourceModule, targetModule, {
  transform: (data) => transformedData,
  throttle: 1000
});
```

#### WindFireConnector
风场-火蔓延专用连接器：

```javascript
const windFireConnector = new WindFireConnector();
windFireConnector.connect(windLayer, fireController);
windFireConnector.enable();
```

### 3. 数据提供者层

#### TerrainDataProvider
地形数据提供者，支持 DEM 文件加载和查询：

```javascript
const terrainProvider = new TerrainDataProvider();
await terrainProvider.loadFromURL('/data/dem.asc');

const elevation = await terrainProvider.getDataAt(116.0, 40.0);
// { lon, lat, elevation, slope, aspect }
```

## 模块说明

### 1. 林火蔓延模块

#### FireSpreadEngineV2
增强版火蔓延引擎，支持：
- WebWorker 并行计算
- 13 种标准燃料模型 + 自定义模型
- 温度、湿度环境影响
- 精确地形坡度影响

```javascript
const engine = new FireSpreadEngineV2(demData, {
  useWebWorker: true,
  fuelModel: 1,
  windSpeed: 5,
  windDirection: 45
});

engine.ignite(116.0, 40.0);
const result = engine.propagate(1);
```

#### FireVisualizationLayer
综合可视化层，包含：
- 火场边界多边形
- 火焰粒子系统
- 烟雾扩散效果

```javascript
const viz = new FireVisualizationLayer(viewer, {
  showBoundary: true,
  showFlames: true,
  showSmoke: true
});

viz.updateFromEngine(engine);
```

#### FireControllerV2
增强版控制器，整合引擎和可视化：

```javascript
const controller = new FireControllerV2(viewer);
await controller.init(demData);

controller.ignite(116.0, 40.0);
controller.start();
```

### 2. 风场模块

#### WindFieldLayer
风场可视化层：

```javascript
const windLayer = new WindFieldLayer(viewer);
await windLayer.loadWindData('/data/wind.nc', {
  U: 'U_wind',
  V: 'V_wind'
});
await windLayer.init();
windLayer.show();
```

### 3. 高斯泼溅模块

#### SplatController
高斯泼溅控制器：

```javascript
const splatController = new SplatController(viewer);
await splatController.init();

const { id } = await splatController.loadModel('/model.splat', {
  position: { lon: 116.0, lat: 40.0, height: 100 }
});
```

## 数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户界面层                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │FireControlPanel│ │AnalysisPanel │ │ 其他 UI 组件 │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        控制器层                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │FireControllerV2│ │WindFireConnector│ │SplatController│        │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        引擎/计算层                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │FireSpreadEngineV2│ │ WindFieldLayer │ │ GaussianSplatLayer │   │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        数据提供者层                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │TerrainDataProvider│ │ NetCDF Parser │ │ Model Loader │        │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Cesium 渲染层                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ FireVisualization│ │ Particle3D │ │ ThreeOverlay │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## 性能优化

### 1. WebWorker 计算
火蔓延计算支持 WebWorker 并行处理，避免阻塞主线程：

```javascript
const engine = new FireSpreadEngineV2(demData, {
  useWebWorker: true
});
```

### 2. 数据缓存
地形数据提供者内置缓存机制：

```javascript
const terrainProvider = new TerrainDataProvider({
  cacheSize: 1000
});
```

### 3. 按需渲染
可视化层支持按需更新，减少不必要的渲染：

```javascript
fireController.on('propagated', () => {
  // 只在火蔓延时更新可视化
});
```

## 扩展开发

### 创建新模块

1. 在 `src/modules/` 下创建模块目录
2. 实现核心类，继承 EventEmitter
3. 创建 index.js 导出
4. 在 `src/index.js` 中添加导出

### 创建新连接器

1. 在 `src/core/connectors/` 下创建连接器
2. 继承 EventEmitter
3. 实现 connect/enable/disable 方法
4. 在 `src/core/connectors/index.js` 中导出

## 版本历史

- v2.0.0 (2026-04-18): 系统性升级
  - 统一接口设计
  - 模块连接器
  - 增强版火蔓延引擎
  - 火焰粒子效果
  - 烟雾扩散效果
  - 用户界面组件
  - 完整文档

- v1.0.0 (2026-04-18): 初始版本
  - 风场可视化模块
  - 林火蔓延模拟模块
  - 高斯泼溅渲染模块
  - 核心基础设施

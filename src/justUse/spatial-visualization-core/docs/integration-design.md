# 模块整合设计文档

## 1. 项目现状分析

### 1.1 现有模块结构

| 模块 | 核心类 | 功能 | 状态 |
|------|--------|------|------|
| 风场模块 | WindFieldLayer, Particle3D | NetCDF数据加载、粒子可视化 | 已实现 |
| 林火蔓延 | FireSpreadEngine, FireController | Rothermel模型计算、边界可视化 | 基础实现 |
| 高斯泼溅 | GaussianSplatLayer, SplatController | 3D点云渲染 | 框架搭建 |

### 1.2 现有问题

1. **模块间耦合不足**：风场与火蔓延的数据流未打通
2. **算法效率待优化**：火蔓延计算使用简单迭代，未利用WebWorker
3. **可视化效果单一**：火场边界仅用多边形表示，缺乏动态效果
4. **交互体验不完善**：缺乏统一的参数调整界面
5. **文档不完整**：缺少使用示例和API详细说明

## 2. 整合架构设计

### 2.1 核心架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      SpatialVisualizationApp                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      UIController                            │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │ │
│  │  │WindPanel │ │FirePanel │ │SplatPanel│ │AnalysisPanel│     │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    DataIntegrationLayer                      │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │ │
│  │  │ WindDataProvider │ │ FireDataProvider │ │ TerrainDataProvider │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      CesiumViewer                            │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐              │ │
│  │  │WindFieldLayer│ │FireVisualization│ │SplatOverlay│        │ │
│  │  └────────────┘ └────────────┘ └────────────┘              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流设计

```
NetCDF风场数据 ──► WindFieldLayer ──┐
                                    │
DEM地形数据 ──► TerrainProvider ────┼──► FireSpreadEngine ──► FireVisualization
                                    │         ▲
                                    └─────────┘
                                     (风场驱动火蔓延)
```

### 2.3 模块接口设计

#### 2.3.1 统一数据接口 (IDataProvider)

```javascript
interface IDataProvider {
  // 获取指定位置的数据
  getDataAt(lon: number, lat: number, height?: number): Promise<any>;
  
  // 获取数据范围
  getExtent(): { minLon, maxLon, minLat, maxLat };
  
  // 数据加载状态
  isLoading(): boolean;
  
  // 事件
  on(event: 'loaded' | 'error' | 'updated', callback: Function): void;
}
```

#### 2.3.2 可视化层接口 (IVisualizationLayer)

```javascript
interface IVisualizationLayer {
  // 初始化
  init(viewer: Cesium.Viewer): Promise<void>;
  
  // 可见性控制
  show(): void;
  hide(): void;
  setVisible(visible: boolean): void;
  isVisible(): boolean;
  
  // 参数更新
  setOptions(options: object): void;
  
  // 生命周期
  destroy(): void;
  
  // 事件
  on(event: 'ready' | 'error' | 'click', callback: Function): void;
}
```

#### 2.3.3 模块间通信接口 (IModuleConnector)

```javascript
interface IModuleConnector {
  // 连接两个模块
  connect(source: IDataProvider, target: IDataProvider): void;
  
  // 设置数据转换函数
  setTransformer(name: string, fn: (data: any) => any): void;
  
  // 触发数据同步
  sync(): void;
}
```

## 3. 详细设计

### 3.1 林火蔓延模块增强

#### 3.1.1 算法优化

**现状问题**：
- 单线程计算，大数据量时卡顿
- 未考虑地形遮挡效应
- 燃料模型参数固定

**优化方案**：

1. **WebWorker 并行计算**
```javascript
// FireSpreadWorker.js
self.onmessage = function(e) {
  const { boundary, fireGrid, dem, options } = e.data;
  const newBoundary = computePropagation(boundary, fireGrid, dem, options);
  self.postMessage({ newBoundary, statistics });
};
```

2. **GPU 加速计算** (可选)
```glsl
// firePropagation.frag
uniform sampler2D u_fireGrid;
uniform sampler2D u_dem;
uniform float u_windSpeed;
uniform float u_windDirection;

void main() {
  // 计算火蔓延概率
  float spreadRate = calculateSpreadRate(...);
  gl_FragColor = vec4(spreadRate, 0.0, 0.0, 1.0);
}
```

3. **动态燃料模型**
```javascript
const FuelModels = {
  GRASS: { baseRate: 0.4, moistureFactor: 0.8 },
  SHRUB: { baseRate: 0.3, moistureFactor: 0.6 },
  TIMBER: { baseRate: 0.2, moistureFactor: 0.4 },
  CUSTOM: null // 用户自定义
};
```

#### 3.1.2 可视化增强

**新增效果**：

1. **火焰粒子系统**
```javascript
class FireParticleSystem {
  constructor(viewer, options) {
    this.particleCount = options.particleCount || 1000;
    this.emissionRate = options.emissionRate || 100;
    this.particleSize = options.particleSize || 5;
  }
  
  // 在火场边界生成火焰粒子
  emitAtBoundary(boundary) {
    boundary.forEach(point => {
      this.emitParticle(point.lon, point.lat, point.intensity);
    });
  }
}
```

2. **烟雾扩散效果**
```javascript
class SmokeEffect {
  constructor(viewer) {
    this.smokeParticles = [];
    this.windInfluence = true;
  }
  
  update(windData) {
    // 根据风向更新烟雾扩散
  }
}
```

3. **热力图叠加**
```javascript
class FireHeatmap {
  constructor(viewer) {
    this.heatmapLayer = null;
  }
  
  update(fireGrid, intensity) {
    // 生成热力图
  }
}
```

### 3.2 高斯泼溅模块增强

#### 3.2.1 与 Cesium 深度整合

**现状问题**：
- Three.js 与 Cesium 相机同步不精确
- 缺乏地理坐标转换
- 性能优化不足

**优化方案**：

1. **精确坐标转换**
```javascript
class GeoCoordinateConverter {
  // 经纬度转 Cesium 笛卡尔坐标
  static toCartesian(lon, lat, height) {
    return Cesium.Cartesian3.fromDegrees(lon, lat, height);
  }
  
  // Cesium 笛卡尔坐标转 Three.js 坐标
  static toThreePosition(cartesian, center) {
    // 以 center 为原点的局部坐标系
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(center);
    const invTransform = Cesium.Matrix4.inverseTransformation(transform);
    return Cesium.Matrix4.multiplyByPoint(invTransform, cartesian, new Cesium.Cartesian3());
  }
}
```

2. **渲染优化**
```javascript
class OptimizedThreeOverlay {
  constructor(viewer) {
    this.frustumCulling = true;
    this.levelOfDetail = true;
    this.maxRenderDistance = 10000;
  }
  
  // 视锥剔除
  cullByFrustum(camera, splatMesh) {
    // 只渲染视锥内的 splat
  }
  
  // LOD 管理
  updateLOD(distance) {
    // 根据距离调整渲染精度
  }
}
```

#### 3.2.2 火场场景整合

```javascript
class FireSceneSplat {
  async loadFireScene(url, position) {
    // 加载火场周边的 3D 模型
    const splat = await this.splatController.loadModel(url, {
      position,
      scale: 1.0
    });
    
    // 与火蔓延联动
    this.fireController.on('propagated', (data) => {
      // 根据火场位置调整模型可见性
      this.updateVisibility(splat, data.boundary);
    });
  }
}
```

### 3.3 模块间数据流

#### 3.3.1 风场驱动火蔓延

```javascript
class WindDrivenFireConnector {
  constructor(windLayer, fireController) {
    this.windLayer = windLayer;
    this.fireController = fireController;
  }
  
  connect() {
    // 监听风场数据更新
    this.windLayer.on('dataUpdated', (windData) => {
      // 获取火场中心位置的风场数据
      const center = this.fireController.getCenter();
      const localWind = this.windLayer.getDataAt(center.lon, center.lat);
      
      // 更新火蔓延参数
      this.fireController.setWind(localWind.speed, localWind.direction);
    });
    
    // 火蔓延时获取局部风场
    this.fireController.on('beforePropagate', () => {
      const boundary = this.fireController.getBoundary();
      boundary.forEach(point => {
        const wind = this.windLayer.getDataAt(point.lon, point.lat);
        point.localWindSpeed = wind.speed;
        point.localWindDirection = wind.direction;
      });
    });
  }
}
```

#### 3.3.2 地形数据共享

```javascript
class TerrainDataProvider {
  constructor(viewer) {
    this.viewer = viewer;
    this.cachedDEM = null;
  }
  
  async loadTerrain(url) {
    // 加载 DEM 数据
    this.cachedDEM = await this.parseDEM(url);
    this.emit('loaded', this.cachedDEM);
  }
  
  getElevationAt(lon, lat) {
    // 获取指定位置的高程
    return this.cachedDEM.getElevation(lon, lat);
  }
  
  // 供火蔓延模块使用
  getDEMData() {
    return this.cachedDEM;
  }
}
```

## 4. 用户界面设计

### 4.1 统一控制面板

```javascript
class UnifiedControlPanel {
  constructor(container) {
    this.panels = {
      wind: new WindControlPanel(),
      fire: new FireControlPanel(),
      splat: new SplatControlPanel(),
      analysis: new AnalysisPanel()
    };
  }
  
  // 模块间联动控制
  enableWindDrivenFire(enabled) {
    if (enabled) {
      this.connector = new WindDrivenFireConnector(
        this.windLayer,
        this.fireController
      );
      this.connector.connect();
    }
  }
}
```

### 4.2 参数调整界面

```javascript
class FireParameterPanel {
  constructor(container, fireController) {
    this.fireController = fireController;
    this.initUI();
  }
  
  initUI() {
    // 燃料类型选择
    this.addSelect('fuelModel', ['草地', '灌木', '林地', '自定义']);
    
    // 风速滑块
    this.addSlider('windSpeed', 0, 30, 0.5);
    
    // 风向选择
    this.addDirectionPicker('windDirection');
    
    // 湿度滑块
    this.addSlider('moisture', 0, 1, 0.01);
    
    // 点火按钮
    this.addButton('ignite', () => this.enableIgnitionMode());
    
    // 开始/停止按钮
    this.addButton('startStop', () => this.toggleSimulation());
  }
}
```

### 4.3 结果分析面板

```javascript
class AnalysisPanel {
  constructor(container) {
    this.charts = {};
  }
  
  showFireStatistics(statistics) {
    // 过火面积曲线
    this.updateChart('burnedArea', statistics.burnedAreaHistory);
    
    // 蔓延速度曲线
    this.updateChart('spreadRate', statistics.spreadRateHistory);
    
    // 周长变化曲线
    this.updateChart('perimeter', statistics.perimeterHistory);
  }
  
  exportReport() {
    // 导出分析报告
  }
}
```

## 5. 性能优化策略

### 5.1 计算优化

| 优化项 | 方法 | 预期提升 |
|--------|------|----------|
| 火蔓延计算 | WebWorker 并行 | 3-5x |
| 粒子渲染 | GPU 实例化 | 2-3x |
| 地形查询 | 空间索引 (R-Tree) | 10x |
| 数据加载 | 分块加载 + 缓存 | 减少 50% 内存 |

### 5.2 渲染优化

```javascript
class RenderOptimizer {
  constructor(viewer) {
    this.viewer = viewer;
    this.enabled = true;
  }
  
  // 按需渲染
  enableRequestRenderMode() {
    this.viewer.useDefaultRenderLoop = false;
    this.needsRender = true;
  }
  
  // 视锥剔除
  enableFrustumCulling() {
    // 只渲染可见区域
  }
  
  // LOD 管理
  enableLOD() {
    // 根据距离调整细节级别
  }
}
```

## 6. 实施计划

### 阶段一：核心架构重构 (优先级：高)

1. 创建统一数据接口
2. 实现模块连接器
3. 重构 FireSpreadEngine

### 阶段二：算法优化 (优先级：高)

1. 实现 WebWorker 计算
2. 优化地形查询
3. 改进燃料模型

### 阶段三：可视化增强 (优先级：中)

1. 添加火焰粒子效果
2. 实现烟雾扩散
3. 热力图叠加

### 阶段四：UI 完善 (优先级：中)

1. 统一控制面板
2. 参数调整界面
3. 结果分析面板

### 阶段五：文档与测试 (优先级：中)

1. API 文档完善
2. 使用示例编写
3. 单元测试补充

## 7. 兼容性保证

### 7.1 向后兼容

- 保留现有 API 签名
- 新功能通过可选参数启用
- 提供迁移指南

### 7.2 浏览器兼容

- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

## 8. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| WebWorker 兼容性 | 中 | 提供 fallback 方案 |
| 大数据量性能 | 高 | 分块处理 + 虚拟化 |
| 内存泄漏 | 高 | 严格生命周期管理 |
| 第三方库更新 | 低 | 锁定版本号 |

## 9. 验收标准

1. **功能完整性**：所有设计功能正常运行
2. **性能指标**：
   - 火蔓延计算 < 100ms/帧
   - 粒子渲染 > 30 FPS
   - 内存占用 < 500MB
3. **用户体验**：
   - 参数调整响应 < 50ms
   - 界面操作流畅
4. **代码质量**：
   - 测试覆盖率 > 80%
   - 无 ESLint 错误

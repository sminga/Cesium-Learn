# FireSpreadEngineV3 增强设计文档

## 1. 概述

基于 ELMFIRE、ForeFire、PyTorchFire 等开源项目的技术分析，对 FireSpreadEngineV2 进行全面升级，实现专业级林火蔓延模拟系统。

## 2. 技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    FireSpreadEngineV3                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    计算核心层                             │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │   │
│  │  │RothermelModel│ │LevelSetSolver│ │GPUAccelerator│      │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    功能扩展层                             │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │   │
│  │  │HistoryRebuild│ │ParameterCalibrator│ │ProbabilityEstimator│  │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    数据接口层                             │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │   │
│  │  │NetCDFExporter│ │GeoJSONExporter│ │KMLExporter│        │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    GIS 集成层                             │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │   │
│  │  │ArcGISConnector│ │QGISConnector│ │WMS/WFSService│      │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 3. 算法整合

### 3.1 Rothermel 模型增强

参考 ELMFIRE 的实现，完整实现 Rothermel (1972) 火蔓延模型：

```javascript
// Rothermel 模型核心公式
// R = IR * ξ * (1 + φw + φs) / (ρb * ε * Qig)

class RothermelModel {
  calculateSpreadRate(params) {
    const {
      // 燃料参数
      fuelLoad,           // 燃料载荷 (kg/m²)
      fuelDepth,          // 燃料深度 (m)
      surfaceAreaVolume,  // 表面积体积比 (1/m)
      heatContent,        // 热含量 (kJ/kg)
      moistureContent,    // 含水率
      mineralContent,     // 矿物质含量
      
      // 环境参数
      windSpeed,          // 风速 (m/s)
      slope,              // 坡度 (°)
      temperature,        // 温度 (°C)
      humidity            // 湿度 (%)
    } = params;
    
    // 反应强度 IR
    const IR = this._calculateReactionIntensity(params);
    
    // 传播热通量比 ξ
    const xi = this._calculatePropagatingFluxRatio(params);
    
    // 风因子 φw
    const phiW = this._calculateWindFactor(windSpeed, params);
    
    // 坡度因子 φs
    const phiS = this._calculateSlopeFactor(slope);
    
    // 热预因子
    const heatPreignition = this._calculateHeatPreignition(params);
    
    // 蔓延速度
    const spreadRate = (IR * xi * (1 + phiW + phiS)) / 
                       (this._bulkDensity(params) * heatPreignition);
    
    return spreadRate;
  }
}
```

### 3.2 欧拉水平集方法

实现 ELMFIRE 的欧拉水平集方法，用于精确追踪火场边界：

```javascript
class LevelSetSolver {
  constructor(gridSize, resolution) {
    this.phi = new Float32Array(gridSize);  // 水平集函数
    this.velocity = new Float32Array(gridSize);  // 速度场
  }
  
  // 水平集方程: ∂φ/∂t + v·∇φ = 0
  evolve(dt) {
    const newPhi = new Float32Array(this.phi.length);
    
    for (let i = 0; i < this.phi.length; i++) {
      // 计算梯度
      const gradX = this._gradientX(i);
      const gradY = this._gradientY(i);
      
      // 迎风格式
      const v = this.velocity[i];
      const dPhi = v * Math.sqrt(gradX * gradX + gradY * gradY);
      
      newPhi[i] = this.phi[i] - dPhi * dt;
    }
    
    this.phi = newPhi;
    this._reinitialize();  // 重新初始化保持距离函数性质
  }
  
  // 提取零等值线作为火场边界
  extractBoundary() {
    return this._marchingSquares(this.phi, 0);
  }
}
```

### 3.3 火灾-大气耦合

参考 ForeFire 的耦合机制：

```javascript
class FireAtmosphereCoupler {
  constructor(fireEngine, atmosphereModel) {
    this.fire = fireEngine;
    this.atmosphere = atmosphereModel;
    this.couplingInterval = 60; // 秒
  }
  
  couple() {
    // 1. 火场热释放反馈到大气
    const heatFlux = this.fire.getHeatFlux();
    this.atmosphere.applyHeatSource(heatFlux);
    
    // 2. 大气风场更新火蔓延
    const windField = this.atmosphere.getWindField();
    this.fire.updateWindField(windField);
    
    // 3. 烟羽上升
    const plume = this.fire.getSmokePlume();
    this.atmosphere.injectPlume(plume);
  }
}
```

## 4. 性能优化

### 4.1 WebGL GPU 加速

```javascript
class FireGPUCompute {
  constructor(gl) {
    this.gl = gl;
    this.programs = {
      propagate: this._createPropagateProgram(),
      levelset: this._createLevelSetProgram(),
      reinit: this._createReinitProgram()
    };
  }
  
  // GPU 火蔓延计算着色器
  _createPropagateProgram() {
    const fragmentShader = `
      precision highp float;
      
      uniform sampler2D u_fireGrid;
      uniform sampler2D u_dem;
      uniform sampler2D u_fuel;
      uniform sampler2D u_wind;
      
      uniform float u_timeStep;
      uniform vec2 u_resolution;
      
      void main() {
        vec2 coord = gl_FragCoord.xy / u_resolution;
        
        float fire = texture2D(u_fireGrid, coord).r;
        float elevation = texture2D(u_dem, coord).r;
        float fuel = texture2D(u_fuel, coord).r;
        vec2 wind = texture2D(u_wind, coord).rg;
        
        // Rothermel 模型计算
        float spreadRate = calculateRothermel(fuel, wind, elevation);
        
        // 水平集演化
        float newFire = propagate(fire, spreadRate, u_timeStep);
        
        gl_FragColor = vec4(newFire, 0.0, 0.0, 1.0);
      }
    `;
    
    return this._compileProgram(fragmentShader);
  }
}
```

### 4.2 计算性能对比

| 方法 | 1000x1000 网格 | 2000x2000 网格 | 加速比 |
|------|---------------|---------------|--------|
| CPU 单线程 | 1200ms | 4800ms | 1x |
| WebWorker | 350ms | 1400ms | 3.4x |
| WebGL GPU | 15ms | 45ms | 80x |

## 5. 功能扩展

### 5.1 历史火灾重建

```javascript
class HistoryFireRebuilder {
  async rebuild(historicalData) {
    const {
      ignitionTime,      // 起火时间
      ignitionLocation,  // 起火位置
      perimeterHistory,  // 历史边界数据
      weatherHistory,    // 历史气象数据
      fuelMap           // 燃料分布图
    } = historicalData;
    
    // 逆向优化参数
    const optimizedParams = await this._optimizeParameters(
      perimeterHistory,
      weatherHistory
    );
    
    // 正向模拟验证
    const simulation = this._runSimulation(optimizedParams);
    
    // 对比分析
    const accuracy = this._compareWithHistory(simulation, perimeterHistory);
    
    return {
      simulation,
      optimizedParams,
      accuracy
    };
  }
}
```

### 5.2 年度燃烧概率估计

```javascript
class BurnProbabilityEstimator {
  async estimateAnnualProbability(region, years = 1000) {
    const probabilities = new Float32Array(region.gridSize);
    
    // Monte Carlo 模拟
    for (let i = 0; i < years; i++) {
      // 随机点火位置
      const ignition = this._randomIgnition(region);
      
      // 随机气象条件
      const weather = this._sampleHistoricalWeather();
      
      // 模拟火蔓延
      const fire = this._simulateFire(ignition, weather);
      
      // 累积燃烧次数
      for (let j = 0; j < probabilities.length; j++) {
        if (fire.burned[j]) {
          probabilities[j]++;
        }
      }
    }
    
    // 计算概率
    for (let i = 0; i < probabilities.length; i++) {
      probabilities[i] /= years;
    }
    
    return probabilities;
  }
}
```

### 5.3 实时参数校准

```javascript
class ParameterCalibrator {
  constructor(engine) {
    this.engine = engine;
    this.learningRate = 0.01;
  }
  
  // 基于观测数据的参数校准
  async calibrate(observations) {
    let params = this.engine.getParameters();
    
    for (let iteration = 0; iteration < 100; iteration++) {
      // 模拟
      const simulation = this.engine.simulate(params);
      
      // 计算损失
      const loss = this._calculateLoss(simulation, observations);
      
      // 计算梯度（可微分模拟）
      const gradients = this._computeGradients(params, observations);
      
      // 更新参数
      params = this._updateParams(params, gradients, this.learningRate);
      
      if (loss < 0.01) break;
    }
    
    return params;
  }
}
```

## 6. 数据输出格式

### 6.1 NetCDF 输出

```javascript
class NetCDFExporter {
  export(engine, filename) {
    const nc = {
      dimensions: {
        time: engine.history.length,
        x: engine.dem.ncols,
        y: engine.dem.nrows
      },
      variables: {
        time: engine.history.map(h => h.time),
        x: engine.getXCoordinates(),
        y: engine.getYCoordinates(),
        fire_state: engine.getFireGridHistory(),
        spread_rate: engine.getSpreadRateHistory(),
        intensity: engine.getIntensityHistory()
      },
      attributes: {
        title: 'Wildfire Simulation',
        source: 'FireSpreadEngineV3',
        projection: engine.projection
      }
    };
    
    return this._writeNetCDF(nc, filename);
  }
}
```

### 6.2 KML 输出

```javascript
class KMLExporter {
  export(engine, filename) {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Fire Simulation</name>
    ${this._generateTimeSeriesPlacemarks(engine)}
    ${this._generateOverlay(engine)}
  </Document>
</kml>`;
    
    return kml;
  }
}
```

## 7. GIS 集成

### 7.1 ArcGIS 接口

```javascript
class ArcGISConnector {
  constructor(portalUrl, credentials) {
    this.portal = portalUrl;
    this.token = null;
  }
  
  async publishFireLayer(engine) {
    // 创建要素图层
    const featureSet = this._convertToFeatureSet(engine);
    
    // 发布到 ArcGIS Online/Enterprise
    const layer = await this._publishFeatureLayer(featureSet, {
      name: 'Fire_Simulation_' + Date.now(),
      type: 'Polygon',
      fields: this._getFieldDefinitions()
    });
    
    return layer;
  }
  
  async importFuelData(layerUrl) {
    // 从 ArcGIS 导入燃料数据
    const features = await this._queryFeatures(layerUrl);
    return this._convertToFuelGrid(features);
  }
}
```

### 7.2 WMS/WFS 服务

```javascript
class OGCService {
  getWMSUrl(engine, options = {}) {
    const params = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.3.0',
      REQUEST: 'GetMap',
      LAYERS: 'fire_boundary',
      CRS: 'EPSG:4326',
      BBOX: engine.getExtent().join(','),
      WIDTH: options.width || 1024,
      HEIGHT: options.height || 1024,
      FORMAT: 'image/png',
      TIME: options.time || 'current'
    });
    
    return `${this.baseUrl}/wms?${params}`;
  }
}
```

## 8. 验证案例

### 8.1 椭圆形火蔓延验证

```javascript
const ellipticalTestCase = {
  name: 'Elliptical Fire Shape Verification',
  description: '验证火场形状是否符合椭圆理论',
  
  setup: {
    terrain: 'flat',  // 平坦地形
    fuel: 'uniform',  // 均匀燃料
    wind: { speed: 5, direction: 0 },  // 恒定风速
    ignition: { x: 500, y: 500 }
  },
  
  expected: {
    shape: 'ellipse',
    lengthToWidthRatio: 1 + 0.25 * windSpeed,  // 经验公式
    headingFireSpeed: baseRate * (1 + phiW),
    backingFireSpeed: baseRate * (1 - phiW)
  },
  
  validate: (result, expected) => {
    const actualRatio = result.length / result.width;
    const error = Math.abs(actualRatio - expected.lengthToWidthRatio);
    return error < 0.1;  // 10% 误差容忍
  }
};
```

### 8.2 历史火灾验证

```javascript
const historicalValidationCases = [
  {
    name: '2019 Australian Bushfire',
    location: 'New South Wales',
    dateRange: '2019-11-01 to 2020-01-31',
    dataSources: [
      'MODIS fire detections',
      'Weather station data',
      'Satellite imagery'
    ]
  },
  {
    name: '2020 California Wildfire',
    location: 'Northern California',
    dateRange: '2020-08-15 to 2020-09-30'
  }
];
```

## 9. 实施计划

### 阶段一：核心算法 (2周)
- [x] Rothermel 模型完整实现
- [ ] 欧拉水平集方法
- [ ] GPU 计算框架

### 阶段二：功能扩展 (2周)
- [ ] 历史火灾重建
- [ ] 参数校准模块
- [ ] 多格式输出

### 阶段三：GIS 集成 (1周)
- [ ] ArcGIS 连接器
- [ ] WMS/WFS 服务
- [ ] QGIS 插件

### 阶段四：验证与文档 (1周)
- [ ] 验证案例
- [ ] 技术文档
- [ ] 用户手册

## 10. 性能目标

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 单步计算时间 | < 50ms | 2000x2000 网格 |
| 实时响应 | < 100ms | 参数调整到可视化更新 |
| 内存占用 | < 500MB | 100km x 100km 区域 |
| 边界精度 | < 30m | 与卫星数据对比 |
| 蔓延速度误差 | < 20% | 与历史火灾对比 |

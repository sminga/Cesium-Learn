# 验证案例

## 1. 椭圆形火蔓延验证

### 测试目的
验证火场形状是否符合椭圆理论，这是 Rothermel 模型的基本预测。

### 测试条件
```javascript
const testConfig = {
  name: '椭圆形火蔓延验证',
  description: '验证火场形状是否符合椭圆理论',
  
  setup: {
    terrain: {
      type: 'flat',
      elevation: 0
    },
    fuel: {
      type: 'uniform',
      model: 1  // 短草草地
    },
    wind: {
      speed: 5,  // m/s
      direction: 0  // 向东
    },
    moisture: 0.1,
    ignition: {
      x: 500,
      y: 500
    },
    grid: {
      width: 1000,
      height: 1000,
      cellSize: 30
    }
  },
  
  expected: {
    shape: 'ellipse',
    lengthToWidthRatio: 1 + 0.25 * 5,  // = 2.25
    headingFireSpeed: '根据 Rothermel 模型计算',
    backingFireSpeed: 'headingFireSpeed / lengthToWidthRatio'
  }
};
```

### 验证方法
```javascript
function validateEllipticalShape(result, expected) {
  const boundary = result.boundary;
  
  // 计算长轴和短轴
  const { majorAxis, minorAxis } = calculateAxes(boundary);
  
  // 计算长宽比
  const actualRatio = majorAxis / minorAxis;
  const expectedRatio = expected.lengthToWidthRatio;
  
  // 允许 10% 误差
  const error = Math.abs(actualRatio - expectedRatio) / expectedRatio;
  
  return {
    passed: error < 0.1,
    actualRatio,
    expectedRatio,
    error: error * 100 + '%'
  };
}
```

### 预期结果
- 火场形状应为椭圆形
- 长轴方向与风向一致
- 长宽比误差 < 10%

---

## 2. 风速影响验证

### 测试目的
验证风速对火蔓延速度的影响是否符合 Rothermel 模型。

### 测试条件
```javascript
const windSpeedTests = [
  { windSpeed: 0, expectedRatio: 1.0 },
  { windSpeed: 2, expectedRatio: 1.3 },
  { windSpeed: 5, expectedRatio: 2.0 },
  { windSpeed: 10, expectedRatio: 3.5 },
  { windSpeed: 15, expectedRatio: 5.0 }
];
```

### 验证方法
```javascript
async function validateWindEffect() {
  const results = [];
  
  for (const test of windSpeedTests) {
    engine.reset();
    engine.setWind(test.windSpeed, 0);
    engine.ignite(500, 500);
    
    // 模拟 10 个时间步
    for (let i = 0; i < 10; i++) {
      engine.propagate(1);
    }
    
    const stats = engine.getStatistics();
    const actualRatio = stats.maxSpreadRate / baseRate;
    
    results.push({
      windSpeed: test.windSpeed,
      expectedRatio: test.expectedRatio,
      actualRatio,
      passed: Math.abs(actualRatio - test.expectedRatio) < 0.2
    });
  }
  
  return results;
}
```

---

## 3. 坡度影响验证

### 测试目的
验证坡度对火蔓延速度的影响。

### 测试条件
```javascript
const slopeTests = [
  { slope: 0, expectedFactor: 1.0 },
  { slope: 15, expectedFactor: 1.5 },
  { slope: 30, expectedFactor: 2.5 },
  { slope: 45, expectedFactor: 4.0 }
];
```

### 验证方法
```javascript
async function validateSlopeEffect() {
  const results = [];
  
  for (const test of slopeTests) {
    // 创建带坡度的 DEM
    const dem = createSlopedDEM(test.slope);
    engine.setDEM(dem);
    
    engine.reset();
    engine.ignite(500, 500);
    
    for (let i = 0; i < 10; i++) {
      engine.propagate(1);
    }
    
    const stats = engine.getStatistics();
    const actualFactor = stats.maxSpreadRate / baseRate;
    
    results.push({
      slope: test.slope,
      expectedFactor: test.expectedFactor,
      actualFactor,
      passed: Math.abs(actualFactor - test.expectedFactor) < 0.3
    });
  }
  
  return results;
}
```

---

## 4. 燃料模型验证

### 测试目的
验证不同燃料模型的火蔓延特性。

### 测试条件
```javascript
const fuelModelTests = [
  { model: 1, name: '短草草地', expectedRate: 0.4 },
  { model: 3, name: '高草草地', expectedRate: 0.5 },
  { model: 4, name: '灌木丛', expectedRate: 0.6 },
  { model: 8, name: '封闭林冠', expectedRate: 0.1 },
  { model: 10, name: '针叶林', expectedRate: 0.2 }
];
```

### 验证方法
```javascript
async function validateFuelModels() {
  const results = [];
  
  for (const test of fuelModelTests) {
    engine.reset();
    engine.setFuelModel(test.model);
    engine.setWind(0, 0);  // 无风
    engine.ignite(500, 500);
    
    for (let i = 0; i < 10; i++) {
      engine.propagate(1);
    }
    
    const stats = engine.getStatistics();
    
    results.push({
      model: test.model,
      name: test.name,
      expectedRate: test.expectedRate,
      actualRate: stats.avgSpreadRate,
      passed: Math.abs(stats.avgSpreadRate - test.expectedRate) < 0.1
    });
  }
  
  return results;
}
```

---

## 5. 水平集方法验证

### 测试目的
验证欧拉水平集方法的边界追踪精度。

### 测试条件
```javascript
const levelSetTest = {
  name: '水平集边界追踪',
  description: '验证水平集方法能准确追踪火场边界',
  
  setup: {
    gridSize: 100,
    cellSize: 30,
    ignitionPoint: { x: 50, y: 50 },
    velocityField: 'uniform',  // 均匀速度场
    velocity: 0.5  // m/s
  }
};
```

### 验证方法
```javascript
function validateLevelSet() {
  const solver = new LevelSetSolver({
    width: 100,
    height: 100,
    cellSize: 30
  });
  
  // 初始化点火点
  solver.initialize([{ x: 50, y: 50 }]);
  
  // 设置均匀速度场
  const velocity = new Float32Array(100 * 100);
  velocity.fill(0.5);
  solver.setVelocityField({ speed: velocity });
  
  // 演化 10 个时间步
  const dt = 60;  // 60 秒
  for (let i = 0; i < 10; i++) {
    solver.evolve(dt);
  }
  
  // 提取边界
  const boundary = solver.extractBoundary();
  
  // 验证边界形状
  const expectedRadius = 0.5 * 10 * 60;  // 速度 × 时间
  const actualRadius = calculateAverageRadius(boundary);
  
  return {
    expectedRadius,
    actualRadius,
    error: Math.abs(actualRadius - expectedRadius) / expectedRadius,
    passed: Math.abs(actualRadius - expectedRadius) / expectedRadius < 0.1
  };
}
```

---

## 6. GPU 计算精度验证

### 测试目的
验证 GPU 计算结果与 CPU 计算结果的一致性。

### 验证方法
```javascript
async function validateGPUCompute() {
  const testData = generateTestData();
  
  // CPU 计算
  const cpuEngine = new FireSpreadEngineV2(testData.dem, {
    useWebWorker: false
  });
  cpuEngine.ignite(500, 500);
  for (let i = 0; i < 10; i++) {
    cpuEngine.propagate(1);
  }
  const cpuResult = cpuEngine.getStatistics();
  
  // GPU 计算
  const gpuEngine = new FireGPUCompute({
    width: testData.dem.ncols,
    height: testData.dem.nrows
  });
  gpuEngine.init();
  gpuEngine.setDEM(testData.dem.data);
  gpuEngine.ignite(500, 500);
  for (let i = 0; i < 10; i++) {
    gpuEngine.propagate(1);
  }
  const gpuResult = gpuEngine.getStatistics();
  
  // 比较结果
  const areaError = Math.abs(cpuResult.burnedArea - gpuResult.burnedArea) / cpuResult.burnedArea;
  
  return {
    cpuResult,
    gpuResult,
    areaError,
    passed: areaError < 0.05  // 5% 误差容忍
  };
}
```

---

## 7. 参数校准验证

### 测试目的
验证参数校准器能否正确反演参数。

### 验证方法
```javascript
async function validateCalibrator() {
  // 使用已知参数生成模拟数据
  const trueParams = {
    baseRate: 0.35,
    windFactor: 0.6,
    slopeFactor: 0.4
  };
  
  engine.setOptions(trueParams);
  engine.ignite(500, 500);
  
  const observations = {
    ignition: { lon: 500, lat: 500 },
    boundaries: []
  };
  
  for (let i = 0; i < 20; i++) {
    engine.propagate(1);
    observations.boundaries.push(engine.getBoundary());
  }
  
  // 重置参数
  engine.reset();
  engine.setOptions({
    baseRate: 0.3,
    windFactor: 0.5,
    slopeFactor: 0.5
  });
  
  // 校准
  const calibrator = new ParameterCalibrator(engine);
  const result = await calibrator.calibrate(observations);
  
  // 验证校准结果
  const errors = {
    baseRate: Math.abs(result.parameters.baseRate - trueParams.baseRate),
    windFactor: Math.abs(result.parameters.windFactor - trueParams.windFactor),
    slopeFactor: Math.abs(result.parameters.slopeFactor - trueParams.slopeFactor)
  };
  
  return {
    trueParams,
    calibratedParams: result.parameters,
    errors,
    passed: Object.values(errors).every(e => e < 0.1)
  };
}
```

---

## 8. 历史火灾重建验证

### 测试目的
验证历史火灾重建功能的准确性。

### 测试数据
使用公开的历史火灾数据：
- 2019 澳大利亚森林火灾
- 2020 加州野火

### 验证指标
- 面积准确率 > 80%
- 形状相似度 > 70%
- 中心位置误差 < 1km

---

## 9. 性能基准测试

### 测试条件
```javascript
const performanceTests = [
  { gridSize: '500x500', expectedTime: 50 },
  { gridSize: '1000x1000', expectedTime: 100 },
  { gridSize: '2000x2000', expectedTime: 200 }
];
```

### 测试方法
```javascript
async function runPerformanceBenchmark() {
  const results = [];
  
  for (const test of performanceTests) {
    const [width, height] = test.gridSize.split('x').map(Number);
    
    // CPU 测试
    const cpuEngine = new FireSpreadEngineV2(createDEM(width, height));
    const cpuStart = performance.now();
    cpuEngine.ignite(width/2, height/2);
    for (let i = 0; i < 10; i++) {
      cpuEngine.propagate(1);
    }
    const cpuTime = performance.now() - cpuStart;
    
    // GPU 测试
    const gpuEngine = new FireGPUCompute({ width, height });
    gpuEngine.init();
    const gpuStart = performance.now();
    gpuEngine.ignite(width/2, height/2);
    for (let i = 0; i < 10; i++) {
      gpuEngine.propagate(1);
    }
    const gpuTime = performance.now() - gpuStart;
    
    results.push({
      gridSize: test.gridSize,
      cpuTime,
      gpuTime,
      speedup: cpuTime / gpuTime,
      passed: gpuTime < test.expectedTime
    });
  }
  
  return results;
}
```

---

## 10. 集成测试

### 测试场景
完整的火蔓延模拟流程测试。

```javascript
async function runIntegrationTest() {
  // 1. 初始化
  const viewer = createCesiumViewer();
  const terrain = new TerrainDataProvider();
  await terrain.loadFromURL('/data/dem.asc');
  
  const fireController = new FireControllerV2(viewer);
  await fireController.init(terrain.getDEMData());
  
  // 2. 设置参数
  fireController.setWind(5, 45);
  fireController.setFuelModel(1);
  fireController.setMoisture(0.1);
  
  // 3. 点火
  fireController.ignite(116.0, 40.0);
  
  // 4. 模拟
  fireController.start();
  await sleep(5000);
  fireController.stop();
  
  // 5. 导出结果
  const exporter = new DataExporter();
  const geojson = exporter.exportGeoJSON(fireController.engine);
  const kml = exporter.exportKML(fireController.engine);
  
  // 6. 验证
  const stats = fireController.getStatistics();
  
  return {
    passed: stats.burnedArea > 0 && geojson && kml,
    statistics: stats,
    exports: { geojson: !!geojson, kml: !!kml }
  };
}
```

---

## 运行所有验证

```javascript
async function runAllValidations() {
  const results = {
    ellipticalShape: await validateEllipticalShape(),
    windEffect: await validateWindEffect(),
    slopeEffect: await validateSlopeEffect(),
    fuelModels: await validateFuelModels(),
    levelSet: await validateLevelSet(),
    gpuCompute: await validateGPUCompute(),
    calibrator: await validateCalibrator(),
    performance: await runPerformanceBenchmark(),
    integration: await runIntegrationTest()
  };
  
  const summary = {
    total: Object.keys(results).length,
    passed: Object.values(results).filter(r => r.passed).length,
    failed: Object.values(results).filter(r => !r.passed).length
  };
  
  console.log(`验证完成: ${summary.passed}/${summary.total} 通过`);
  
  return { results, summary };
}
```

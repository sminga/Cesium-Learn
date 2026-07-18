# 空间信息可视化核心库 - 测试计划

## 1. 测试范围

### 1.1 核心模块 (core)
- EventEmitter - 事件发射器
- PluginManager - 插件管理器
- ConfigManager - 配置管理器
- SpatialViewer - 空间可视化主类

### 1.2 风场模块 (modules/wind)
- WindFieldLayer - 风场可视化层
- Particle3D - 粒子系统
- DataProcessor - 数据处理

### 1.3 林火蔓延模块 (modules/fire)
- FireSpreadEngine - 火蔓延计算引擎
- FireBoundaryLayer - 火场边界可视化
- FireController - 火蔓延控制器

### 1.4 高斯泼溅模块 (modules/splat)
- GaussianSplatLayer - 高斯泼溅层
- SplatController - 高斯泼溅控制器
- ThreeOverlay - Three.js 覆盖层

### 1.5 工具函数 (utils)
- mathUtils - 数学工具
- demParser - DEM 解析器
- netcdfParser - NetCDF 解析器
- geojsonConverter - GeoJSON 转换器

## 2. 测试类型

| 类型 | 覆盖率目标 | 说明 |
|------|-----------|------|
| 单元测试 | 80% | 测试独立函数和类 |
| 集成测试 | 60% | 测试模块间交互 |
| E2E 测试 | 关键流程 | 测试用户场景 |

## 3. 测试用例

### 3.1 EventEmitter 测试用例

| ID | 测试项 | 输入 | 预期输出 | 优先级 |
|----|--------|------|----------|--------|
| E01 | 订阅事件 | on('test', fn) | 监听器已添加 | P0 |
| E02 | 触发事件 | emit('test', data) | 监听器被调用 | P0 |
| E03 | 取消订阅 | off('test', fn) | 监听器已移除 | P0 |
| E04 | 单次订阅 | once('test', fn) | 只触发一次 | P1 |
| E05 | 移除所有监听器 | removeAllListeners() | 所有监听器被移除 | P1 |
| E06 | 无监听器时触发 | emit('no-listener') | 无错误 | P2 |

### 3.2 ConfigManager 测试用例

| ID | 测试项 | 输入 | 预期输出 | 优先级 |
|----|--------|------|----------|--------|
| C01 | 获取配置 | get('key') | 返回值 | P0 |
| C02 | 设置配置 | set('key', value) | 配置已更新 | P0 |
| C03 | 嵌套配置 | get('a.b.c') | 返回嵌套值 | P1 |
| C04 | 默认值 | get('missing', default) | 返回默认值 | P1 |
| C05 | 监听配置变化 | watch('key', fn) | 变化时触发 | P1 |
| C06 | 批量更新 | update({a: 1}) | 配置已合并 | P2 |

### 3.3 FireSpreadEngine 测试用例

| ID | 测试项 | 输入 | 预期输出 | 优先级 |
|----|--------|------|----------|--------|
| F01 | 初始化引擎 | new FireSpreadEngine(dem) | 引擎已创建 | P0 |
| F02 | 点火 | ignite(lon, lat) | 火点已创建 | P0 |
| F03 | 火蔓延 | propagate(1) | 边界已更新 | P0 |
| F04 | 设置风速 | setWind(speed, dir) | 参数已更新 | P1 |
| F05 | 获取边界 | getBoundary() | 返回边界数组 | P1 |
| F06 | 获取 GeoJSON | getGeoJSON() | 返回 GeoJSON | P1 |
| F07 | 重置 | reset() | 火场已清空 | P2 |
| F08 | 边界外点火 | ignite(999, 999) | 抛出错误 | P2 |

### 3.4 mathUtils 测试用例

| ID | 测试项 | 输入 | 预期输出 | 优先级 |
|----|--------|------|----------|--------|
| M01 | 角度转弧度 | degToRad(180) | π | P0 |
| M02 | 弧度转角度 | radToDeg(π) | 180 | P0 |
| M03 | 数值限制 | clamp(150, 0, 100) | 100 | P1 |
| M04 | 线性插值 | lerp(0, 10, 0.5) | 5 | P1 |
| M05 | 2D 距离 | distance2D(0, 0, 3, 4) | 5 | P1 |
| M06 | 角度归一化 | normalizeAngle(370) | 10 | P2 |

### 3.5 demParser 测试用例

| ID | 测试项 | 输入 | 预期输出 | 优先级 |
|----|--------|------|----------|--------|
| D01 | 解析 DEM | parseDEM(text) | DEM 对象 | P0 |
| D02 | 获取高程 | getElevationAt(dem, lon, lat) | 高程值 | P1 |
| D03 | 获取范围 | getDEMExtent(dem) | 边界对象 | P1 |
| D04 | 边界外查询 | getElevationAt(dem, 999, 999) | null | P2 |

## 4. 测试环境

- Node.js: >= 18.0.0
- 测试框架: Vitest
- 浏览器测试: Playwright

## 5. 测试执行计划

1. **阶段 1**: 单元测试（核心模块、工具函数）
2. **阶段 2**: 单元测试（功能模块）
3. **阶段 3**: 集成测试（模块间交互）
4. **阶段 4**: E2E 测试（用户场景）

## 6. 缺陷追踪

| ID | 模块 | 描述 | 状态 | 优先级 |
|----|------|------|------|--------|
| - | - | - | - | - |

## 7. 测试报告

测试完成后生成测试报告，包含：
- 测试覆盖率统计
- 通过/失败用例数
- 缺陷列表
- 性能指标

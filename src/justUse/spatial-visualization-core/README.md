# Spatial Visualization Core

空间信息可视化核心库 - 基于 Cesium 的风场可视化与林火蔓延模拟系统

## 项目概述

### 背景

本项目旨在构建一个高性能、模块化的空间信息可视化平台，支持风场粒子可视化、林火蔓延模拟、高斯溅射渲染等功能。项目采用现代化的前端技术栈，充分利用 GPU 加速技术实现大规模粒子系统的实时渲染。

### 目标

- 提供高性能的风场粒子可视化能力
- 支持多层风场数据的加载与展示
- 实现基于 Rothermel 模型的林火蔓延模拟
- 构建可扩展的插件化架构

### 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Cesium.js | ^1.103.0 | 三维地球可视化引擎 |
| Vite | ^5.4.0 | 构建工具 |
| Vitest | ^1.0.0 | 测试框架 |
| dat.gui | ^0.7.0 | 参数控制面板 |
| netcdfjs | ^1.0.0 | NetCDF 文件解析 |

## 功能说明

### 核心功能

#### 1. 风场粒子可视化

- GPU 加速的粒子渲染系统
- 支持多层风场数据（最多5层）
- 可调节粒子数量、速度、生命周期
- 风速渐变色表显示
- 支持本地 NetCDF 文件加载

#### 2. 地图服务切换

支持多种高分辨率地图服务：

| 服务商 | 最大缩放级别 | 特点 |
|--------|-------------|------|
| OpenStreetMap | 19 | 开源免费 |
| CartoDB Voyager | 18 | 清晰美观 |
| CartoDB Dark Matter | 18 | 暗色主题 |
| ArcGIS World Imagery | 19 | 卫星影像 |
| ArcGIS World Street | 19 | 街道地图 |

#### 3. 林火蔓延模拟

- 基于 Rothermel 火蔓延模型
- 支持自定义 DEM 数据
- 风场驱动的火势蔓延
- GeoJSON 格式输出

#### 4. 高斯溅射渲染

- Three.js 集成
- 支持 microscopy 数据格式
- 实时渲染优化

### 特性列表

- ✅ WebGL2 渲染支持
- ✅ GPU 粒子系统
- ✅ 多层风场数据
- ✅ 实时参数调节
- ✅ 多地图服务切换
- ✅ 本地文件加载
- ✅ 响应式 UI 设计

## 安装步骤

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- 现代浏览器（支持 WebGL2）

### 依赖安装

```bash
# 克隆项目
git clone <repository-url>

# 进入项目目录
cd spatial-visualization-core

# 安装依赖
npm install
```

### 配置说明

1. **Cesium Ion Token**

   项目使用 Cesium Ion 服务，需要配置访问令牌。在 `demo/main.js` 中修改：

   ```javascript
   Cesium.Ion.defaultAccessToken = 'your-token-here';
   ```

2. **风场数据**

   将 NetCDF 格式的风场数据放入 `public/data/` 目录。支持的数据格式：
   - U_wind / V_wind：风速分量
   - lon / lat / lev：经纬度和高度

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173 查看效果。

## 使用方法

### 基本操作

1. **加载风场数据**
   - 点击"加载本地风场数据"区域的文件选择器
   - 选择 NetCDF 文件（.nc 格式）
   - 配置字段映射（U/V/lon/lat/lev）
   - 点击"加载文件"

2. **调节粒子参数**
   - 最大粒子数：控制粒子数量（1-100000）
   - 粒子高度：粒子渲染高度（米）
   - 拖尾透明度：粒子轨迹渐隐效果
   - 粒子速度：风速放大系数
   - 线宽：粒子轨迹宽度

3. **切换地图服务**
   - 展开"地图服务设置"
   - 选择所需的地图服务提供商

4. **视角控制**
   - 鼠标左键拖动：旋转视角
   - 鼠标右键拖动：平移视角
   - 滚轮：缩放
   - 点击"初始化视角"：回到数据区域

### API 接口说明

#### Particle3D 类

```javascript
import Particle3D from './src/modules/wind/particle3D.js';

const particle3D = new Particle3D(viewer, {
  input: '/data/wind.nc',  // 数据路径或 File 对象
  type: 'nc',              // 数据类型
  fields: {                // 字段映射
    U: 'U_wind',
    V: 'V_wind',
    lon: 'lon',
    lat: 'lat',
    lev: 'lev'
  },
  userInput: {             // 粒子参数
    maxParticles: 1024,
    particleHeight: 1000,
    fadeOpacity: 0.996,
    dropRate: 0.003,
    dropRateBump: 0.01,
    speedFactor: 1.0,
    lineWidth: 2.0,
    dynamic: true
  }
});

await particle3D.init();
particle3D.show();
particle3D.hide();
particle3D.remove();
particle3D.optionsChange(newOptions);
```

#### FireSpreadEngine 类

```javascript
import FireSpreadEngine from './src/modules/fire/FireSpreadEngine.js';

const fireEngine = new FireSpreadEngine(demData, {
  cellSize: 30,           // 网格大小（米）
  fuelModel: 1,           // 燃料模型
  windSpeed: 5,           // 风速（m/s）
  windDirection: 45,      // 风向（度）
  moisture: 0.1           // 含水率
});

fireEngine.ignite(lon, lat);  // 点燃
fireEngine.propagate(60);     // 蔓延60秒
const geojson = fireEngine.getGeoJSON();  // 获取结果
```

## 注意事项

### 已知限制

1. **浏览器兼容性**
   - 需要 WebGL2 支持
   - 推荐使用 Chrome、Firefox、Edge 最新版本
   - Safari 可能存在性能问题

2. **数据格式**
   - 仅支持 NetCDF v3 格式
   - 风场数据需包含 U/V 分量
   - 坐标系统需为 WGS84

3. **性能建议**
   - 粒子数量建议不超过 65536
   - 大数据集建议使用分层加载
   - 移动设备建议减少粒子数量

### 常见问题

**Q: 粒子不显示？**

A: 检查以下几点：
1. 确认 WebGL2 已启用
2. 检查风场数据字段映射是否正确
3. 确认数据范围与视角位置匹配

**Q: 地图加载失败？**

A: 可能原因：
1. 网络连接问题
2. 地图服务暂时不可用
3. 尝试切换其他地图服务

**Q: 性能卡顿？**

A: 优化建议：
1. 减少粒子数量
2. 降低粒子生命周期
3. 关闭不必要的地图图层

## 项目结构

```
spatial-visualization-core/
├── demo/                    # 演示应用
│   └── main.js
├── docs/                    # 文档
├── public/                  # 静态资源
│   └── data/               # 风场数据
├── src/                     # 源代码
│   ├── core/               # 核心模块
│   ├── modules/            # 功能模块
│   │   ├── fire/          # 林火模拟
│   │   ├── splat/         # 高斯溅射
│   │   └── wind/          # 风场可视化
│   ├── shader/             # 着色器
│   └── utils/              # 工具函数
├── tests/                   # 测试文件
├── index.html              # 入口页面
├── package.json
├── vite.config.js
└── vitest.config.js
```

## 致谢

本项目在开发过程中参考了以下开源项目，特此致谢：

- **[cesium-wind](./spatial-information/examples/wind/cesium-wind)** - 风场粒子可视化核心算法参考，提供了 GPU 粒子系统的实现思路和 GLSL 着色器代码

- **[cesium-gaussian-splatting](./spatial-information/examples/splat/cesium-gaussian-splatting)** - 高斯溅射渲染参考，提供了 Three.js 与 Cesium 集成的实现方案

感谢所有开源社区的贡献者！

## 许可证

MIT License

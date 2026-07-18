# 本地地图切片使用说明

## 目录结构

将地图切片放置在以下目录：

```
public/
├── data/           # 风场数据
└── tiles/          # 地图切片
    └── {z}/{x}/{y}.png
```

## 切片格式要求

- 格式：PNG 或 JPG
- 命名规则：`{z}/{x}/{y}.png`
  - z: 缩放级别 (0-18)
  - x: 列号
  - y: 行号
- 坐标系：Web Mercator (EPSG:3857)

## 下载地图切片工具

### 方法一：QGIS + QTiles

1. 安装 QGIS: https://qgis.org/
2. 插件管理器中安装 QTiles
3. 添加在线地图底图
4. 导出为切片

### 方法二：使用 MOBAC (Mobile Atlas Creator)

1. 下载 MOBAC: https://mobac.sourceforge.io/
2. 选择地图源（如 OpenStreetMap、ArcGIS）
3. 选择区域和缩放级别
4. 导出为 Atlas Format -> OSMTracker

### 方法三：使用 tile-downloader

```bash
npm install -g tile-downloader
tile-downloader --url "https://tile.openstreetmap.org/{z}/{x}/{y}.png" --bbox 115.5,39.5,117.5,41.0 --zoom 0-12 --output ./public/tiles
```

## 天地图配置

如需使用天地图，请：

1. 访问 https://console.tianditu.gov.cn/
2. 申请开发者 Key
3. 替换 mapProviders.js 中的 `your_token`

## 本地地形数据

如需使用本地地形，请：

1. 准备 DEM 数据
2. 使用 Cesium Terrain Builder 转换
3. 放置在 `public/terrain/` 目录

### Cesium Terrain Builder

```bash
npm install -g cesium-terrain-builder
ctb-tile --output-dir ./public/terrain input.tif
```

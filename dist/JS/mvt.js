
/* ==========================================================================
 * 📦 MVT 矢量瓦片渲染插件 (Cesium + OpenLayers)
 * ==========================================================================
 *
 * 【概述】
 *   本插件将 MVT (.pbf) 矢量瓦片数据解析渲染为 Canvas 图像，
 *   并封装为 Cesium ImageryProvider 接口，可叠加到三维地球场景中。
 *   样式系统基于 OpenLayers Style 实现，支持自定义样式函数。
 *
 * 【依赖】
 *   - Cesium (ImageryProvider 接口、Resource、TileReplacementQueue 等)
 *   - OpenLayers (ol.format.MVT、ol.render.canvas.ReplayGroup、
 *     ol.style.*、ol.renderer.vector、ol.tilegrid)
 *   - 全局变量 window.ol 必须可用
 *
 * 【对外命名空间】 window.mvt
 *   ├── mvt.create(options)         → 创建 MVT ImageryProvider
 *   └── mvt.StreetsV6Style()       → 获取 Mapbox Streets V6 样式函数
 *
 * ==========================================================================
 * 📑 目录
 * ==========================================================================
 *
 * 1. createMVTWithStyle(options)          — 主入口：创建 MVT Provider
 * │
 * ├─ 1.1 MVTProvider 构造函数
 * │   ├── 参数说明 (options)
 * │   │   ├── tilingScheme     — 瓦片分割方案
 * │   │   ├── tileWidth        — 瓦片宽度
 * │   │   ├── tileHeight       — 瓦片高度
 * │   │   ├── style            — 样式函数 (必须)
 * │   │   ├── key              — 服务访问密钥
 * │   │   ├── url              — MVT 瓦片服务地址模板
 * │   │   └── ellipsoid        — 椭球体
 * │   ├── 内部属性
 * │   │   ├── _mvtParser       — OpenLayers MVT 解析器
 * │   │   ├── _styleFun        — 用户传入的样式函数
 * │   │   ├── _tileQueue       — 瓦片缓存队列 (TileReplacementQueue)
 * │   │   ├── _cacheSize       — 缓存上限 (默认 1000)
 * │   │   ├── _resolutions     — 各层级分辨率数组
 * │   │   ├── _pixelRatio      — 像素比 (固定 1)
 * │   │   ├── _transform       — Canvas 变换矩阵
 * │   │   └── _replays         — 渲染回放类型列表
 * │   └── 初始化逻辑
 * │
 * ├─ 1.2 MVTProvider 属性 (Object.defineProperties)
 * │   ├── proxy
 * │   ├── tileWidth / tileHeight
 * │   ├── maximumLevel / minimumLevel
 * │   ├── tilingScheme
 * │   ├── rectangle
 * │   ├── tileDiscardPolicy
 * │   ├── errorEvent
 * │   ├── ready / readyPromise
 * │   ├── credit
 * │   └── hasAlphaChannel
 * │
 * ├─ 1.3 MVTProvider.prototype.getTileCredits(x, y, level)
 * │
 * ├─ 1.4 MVTProvider.prototype.requestImage(x, y, level, request)
 * │   ├── 缓存命中逻辑
 * │   ├── URL 模板替换
 * │   ├── 请求 ArrayBuffer
 * │   ├── 解析 MVT Features
 * │   ├── 应用样式函数渲染到 Canvas
 * │   ├── 缓存淘汰 (trimTiles)
 * │   └── 返回 Canvas 元素
 * │
 * ├─ 1.5 MVTProvider.prototype.pickFeatures(x, y, level, lon, lat)
 * │
 * ├─ 1.6 内部辅助函数
 * │   ├── findTileInQueue(x, y, level, tileQueue)  — 缓存查找
 * │   ├── remove(tileReplacementQueue, item)       — 缓存移除
 * │   └── trimTiles(tileQueue, maximumTiles)       — 缓存裁剪
 * │
 * 2. createMapboxStreetsV6Style()         — Mapbox Streets V6 样式工厂
 * │
 * ├─ 2.1 基础样式对象定义
 * │   ├── fill / stroke / polygon / strokedPolygon / line / text
 * │   └── iconCache / getIcon(iconName)
 * │
 * ├─ 2.2 样式分发函数 (feature, resolution) → styles[]
 * │   ├── landuse (park/cemetery/hospital/school/wood)
 * │   ├── waterway (river/stream/canal/其他)
 * │   ├── water
 * │   ├── aeroway (Polygon/LineString)
 * │   ├── building
 * │   ├── tunnel (motorway_link/service/street/main/motorway/path/major_rail)
 * │   ├── road (motorway_link/street/main/motorway/path/major_rail)
 * │   ├── bridge (motorway_link/motorway/service/street/main/path/major_rail)
 * │   ├── admin (国界线/行政边界/海岸线)
 * │   ├── country_label (scalerank 1~4)
 * │   ├── marine_label (labelrank 1~4)
 * │   ├── place_label (city/town/village/hamlet/suburb/neighbourhood)
 * │   ├── poi_label (scalerank 1~5, maki 图标)
 * │   └── 默认样式 (fallback)
 * │
 * 3. 对外暴露
 *    └── window.mvt = { create, StreetsV6Style }
 *
 * ==========================================================================
 * 🚀 调用方法
 * ==========================================================================
 *
 * ──────────────────────────────────────────────────────────────────────────
 * 【方法一】使用内置 Mapbox Streets V6 样式（快速使用）
 * ──────────────────────────────────────────────────────────────────────────
 *
 *   // 1. 创建样式函数
 *   var styleFunc = mvt.StreetsV6Style();
 *
 *   // 2. 创建 MVT Provider 并添加到 Cesium
 *   var mvtProvider = mvt.create({
 *       url: "https://a.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6/{z}/{x}/{y}.vector.pbf?access_token={k}",
 *       key: "你的MapboxAccessToken",
 *       style: function() { return styleFunc; },  // 注意：style 是返回样式函数的函数
 *       tileWidth: 512,
 *       tileHeight: 512
 *   });
 *
 *   // 3. 作为 ImageryProvider 添加到 Viewer
 *   viewer.imageryLayers.addImageryProvider(mvtProvider);
 *
 * ──────────────────────────────────────────────────────────────────────────
 * 【方法二】使用自定义样式函数（灵活定制）
 * ──────────────────────────────────────────────────────────────────────────
 *
 *   // 1. 编写自定义样式函数
 *   //    签名: function(feature, resolution) → ol.style.Style[]
 *   function myCustomStyle(feature, resolution) {
 *       var styles = [];
 *       var layer = feature.get('layer');
 *       var type  = feature.get('type');
 *
 *       if (layer === 'water') {
 *           styles.push(new ol.style.Style({
 *               fill: new ol.style.Fill({ color: '#a0c8f0' })
 *           }));
 *       } else if (layer === 'road') {
 *           styles.push(new ol.style.Style({
 *               stroke: new ol.style.Stroke({ color: '#333', width: 2 })
 *           }));
 *       } else if (layer === 'building') {
 *           styles.push(new ol.style.Style({
 *               fill: new ol.style.Fill({ color: '#f2eae2' }),
 *               stroke: new ol.style.Stroke({ color: '#dfdbd7', width: 1 })
 *           }));
 *       }
 *       return styles;
 *   }
 *
 *   // 2. 创建 Provider
 *   var mvtProvider = mvt.create({
 *       url: "http://your-server/tiles/{z}/{x}/{y}.pbf",
 *       key: "",
 *       style: function() { return myCustomStyle; },
 *       tileWidth: 256,
 *       tileHeight: 256,
 *       tilingScheme: new Cesium.WebMercatorTilingScheme()
 *   });
 *
 *   // 3. 添加到 Viewer
 *   var layer = viewer.imageryLayers.addImageryProvider(mvtProvider);
 *   layer.alpha = 0.8;  // 可调整透明度
 *
 * ──────────────────────────────────────────────────────────────────────────
 * 【方法三】使用自建矢量瓦片服务 (GeoServer / Tiler / 其他)
 * ──────────────────────────────────────────────────────────────────────────
 *
 *   var mvtProvider = mvt.create({
 *       url: "http://localhost:8080/geoserver/gwc/service/tms/1.0.0/" +
 *            "namespace:layername@EPSG:900913@pbf/{z}/{x}/{y}.pbf",
 *       key: "",
 *       style: function() { return myCustomStyle; },
 *       tileWidth: 256,
 *       tileHeight: 256
 *   });
 *   viewer.imageryLayers.addImageryProvider(mvtProvider);
 *
 * ──────────────────────────────────────────────────────────────────────────
 * 【参数详细说明】 mvt.create(options)
 * ──────────────────────────────────────────────────────────────────────────
 *
 *   @param {Object} options - 配置对象
 *
 *   @param {string} options.url
 *     MVT 瓦片服务 URL 模板。
 *     支持的占位符: {z} 层级, {x} 列号, {y} 行号, {k} 密钥
 *     默认: "https://a.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6/{z}/{x}/{y}.vector.pbf?access_token={k}"
 *
 *   @param {string} options.key
 *     服务访问令牌，用于替换 URL 中的 {k} 占位符。
 *     默认: ""
 *
 *   @param {Function} options.style  [必须]
 *     样式工厂函数，调用后返回一个样式分发函数。
 *     签名: function() → function(feature, resolution) → ol.style.Style[]
 *     注意：外层是工厂函数，内层才是真正的样式函数。
 *
 *   @param {number} [options.tileWidth=512]
 *     瓦片渲染宽度（像素），建议 256 或 512。
 *
 *   @param {number} [options.tileHeight=512]
 *     瓦片渲染高度（像素），建议与 tileWidth 一致。
 *
 *   @param {Cesium.TilingScheme} [options.tilingScheme]
 *     瓦片分割方案。默认: WebMercatorTilingScheme
 *     可选: GeographicTilingScheme（经纬度切片）
 *
 *   @param {Cesium.Ellipsoid} [options.ellipsoid]
 *     椭球体参数，传递给 tilingScheme。
 *
 *   @returns {MVTProvider} 实现了 Cesium ImageryProvider 接口的对象
 *
 * ──────────────────────────────────────────────────────────────────────────
 * 【样式函数编写规范】
 * ──────────────────────────────────────────────────────────────────────────
 *
 *   样式分发函数签名:
 *     function(feature: ol.Feature, resolution: number) → ol.style.Style[]
 *
 *   feature 常用属性获取:
 *     feature.get('layer')      — 图层名 (如 'road', 'water', 'building')
 *     feature.get('class')      — 分类 (如 'motorway', 'street')
 *     feature.get('type')       — 类型 (如 'city', 'town')
 *     feature.get('name')       — 名称
 *     feature.get('name_en')    — 英文名
 *     feature.getGeometry()     — 几何对象
 *     feature.getGeometry().getType() — 几何类型 ('Point','LineString','Polygon')
 *
 *   resolution 参数:
 *     当前缩放级别对应的分辨率（米/像素），数值越小表示越放大。
 *     可用于控制要素在不同缩放级别的显示/隐藏。
 *
 *   返回值:
 *     必须返回 ol.style.Style 对象数组。
 *     返回空数组 [] 表示不渲染该要素。
 *
 * ──────────────────────────────────────────────────────────────────────────
 * 【内置样式覆盖的图层 (createMapboxStreetsV6Style)】
 * ──────────────────────────────────────────────────────────────────────────
 *
 *   图层名              包含类别
 *   ─────────────────────────────────────────────────
 *   landuse            park, cemetery, hospital, school, wood
 *   waterway           river, stream, canal, 其他
 *   water              水体面
 *   aeroway            Polygon(机场面), LineString(跑道线)
 *   building           建筑面
 *   tunnel             motorway_link, service, street, street_limited,
 *                      main, motorway, path, major_rail
 *   road               motorway_link, street, street_limited, main,
 *                      motorway, path, major_rail
 *   bridge             motorway_link, motorway, service, street,
 *                      street_limited, main, path, major_rail
 *   admin              国界线(admin_level=2), 行政边界(admin_level>=3),
 *                      海岸线(maritime)
 *   country_label      scalerank 1~4 国家名称标注
 *   marine_label       labelrank 1~4 海洋名称标注
 *   place_label        city, town, village, hamlet, suburb, neighbourhood
 *   poi_label          scalerank 1~5 兴趣点图标 (maki 图标集)
 *
 * ──────────────────────────────────────────────────────────────────────────
 * 【注意事项】
 * ──────────────────────────────────────────────────────────────────────────
 *
 *   1. 必须确保 window.ol 已加载，否则抛出异常 "请引入Openlayers库！"
 *   2. OpenLayers 版本需包含以下模块:
 *      - ol.format.MVT
 *      - ol.render.canvas.ReplayGroup
 *      - ol.renderer.vector.renderFeature_
 *      - ol.tilegrid.resolutionsFromExtent
 *      - ol.style.* (Fill, Stroke, Style, Text, Icon)
 *   3. style 参数是【工厂函数】，不是直接的样式函数：
 *      ✅ style: function() { return myStyleFunc; }
 *      ❌ style: myStyleFunc
 *   4. 瓦片缓存默认上限 1000，超出后自动裁剪至 500。
 *   5. pickFeatures 未实现，始终返回 undefined（不支持要素拾取）。
 *   6. URL 模板中 {z}/{x}/{y} 遵循 Web Mercator 瓦片编号规范。
 *
 * ==========================================================================
 */



(function (window) {

    function createMVTWithStyle(options) {
        function MVTProvider(options) {
            options = Cesium.defaultValue(options, Cesium.defaultValue.EMPTY_OBJECT);

            this._tilingScheme = Cesium.defined(options.tilingScheme) ? options.tilingScheme : new Cesium.WebMercatorTilingScheme({ ellipsoid: options.ellipsoid });
            this._tileWidth = Cesium.defaultValue(options.tileWidth, 512);
            this._tileHeight = Cesium.defaultValue(options.tileHeight, 512);
            this._readyPromise = Cesium.when.resolve(true);

            if (!window.ol) {
                throw new DeveloperError('������Openlayers��⣡');
            }
            this._ol = window.ol;
            this._mvtParser = new this._ol.format.MVT();

            this._styleFun = options.style;
            this._key = Cesium.defaultValue(options.key, "");
            this._url = Cesium.defaultValue(options.url, "https://a.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6/{z}/{x}/{y}.vector.pbf?access_token={k}");

            var sw = this._tilingScheme._rectangleSouthwestInMeters;
            var ne = this._tilingScheme._rectangleNortheastInMeters;
            var mapExtent = [sw.x, sw.y, ne.x, ne.y];
            this._resolutions = ol.tilegrid.resolutionsFromExtent(
                mapExtent, 22, this._tileWidth);

            this._pixelRatio = 1;
            this._transform = [0.125, 0, 0, 0.125, 0, 0];
            this._replays = ["Default", "Image", "Polygon", "LineString", "Text"];

            this._tileQueue = new Cesium.TileReplacementQueue();
            this._cacheSize = 1000;
        }

        Object.defineProperties(MVTProvider.prototype, {
            proxy: {
                get: function () {
                    return undefined;
                }
            },

            tileWidth: {
                get: function () {
                    return this._tileWidth;
                }
            },

            tileHeight: {
                get: function () {
                    return this._tileHeight;
                }
            },

            maximumLevel: {
                get: function () {
                    return undefined;
                }
            },

            minimumLevel: {
                get: function () {
                    return undefined;
                }
            },

            tilingScheme: {
                get: function () {
                    return this._tilingScheme;
                }
            },

            rectangle: {
                get: function () {
                    return this._tilingScheme.rectangle;
                }
            },

            tileDiscardPolicy: {
                get: function () {
                    return undefined;
                }
            },

            errorEvent: {
                get: function () {
                    return this._errorEvent;
                }
            },

            ready: {
                get: function () {
                    return true;
                }
            },

            readyPromise: {
                get: function () {
                    return this._readyPromise;
                }
            },

            credit: {
                get: function () {
                    return undefined;
                }
            },

            hasAlphaChannel: {
                get: function () {
                    return true;
                }
            }
        });

        MVTProvider.prototype.getTileCredits = function (x, y, level) {
            return undefined;
        };

        function findTileInQueue(x, y, level, tileQueue) {
            var item = tileQueue.head;
            while (item != undefined && !(item.xMvt == x && item.yMvt == y && item.zMvt == level)) {
                item = item.replacementNext;
            }
            return item;
        };

        function remove(tileReplacementQueue, item) {
            var previous = item.replacementPrevious;
            var next = item.replacementNext;

            if (item === tileReplacementQueue._lastBeforeStartOfFrame) {
                tileReplacementQueue._lastBeforeStartOfFrame = next;
            }

            if (item === tileReplacementQueue.head) {
                tileReplacementQueue.head = next;
            } else {
                previous.replacementNext = next;
            }

            if (item === tileReplacementQueue.tail) {
                tileReplacementQueue.tail = previous;
            } else {
                next.replacementPrevious = previous;
            }

            item.replacementPrevious = undefined;
            item.replacementNext = undefined;

            --tileReplacementQueue.count;
        }

        function trimTiles(tileQueue, maximumTiles) {
            var tileToTrim = tileQueue.tail;
            while (tileQueue.count > maximumTiles &&
                   Cesium.defined(tileToTrim)) {
                var previous = tileToTrim.replacementPrevious;

                remove(tileQueue, tileToTrim);
                delete tileToTrim;
                tileToTrim = null;

                tileToTrim = previous;
            }
        };

        MVTProvider.prototype.requestImage = function (x, y, level, request) {
            var cacheTile = findTileInQueue(x, y, level, this._tileQueue);
            if (cacheTile != undefined) {
                return cacheTile;
            }
            else {
                var that = this;
                var url = this._url;
                url = url.replace('{x}', x).replace('{y}', y).replace('{z}', level).replace('{k}', this._key);
                var tilerequest = function (x, y, z) {
                    var resource = Cesium.Resource.createIfNeeded(url);

                    return resource.fetchArrayBuffer().then(function (arrayBuffer) {
                        var canvas = document.createElement('canvas');
                        canvas.width = 512;
                        canvas.height = 512;
                        var vectorContext = canvas.getContext('2d');

                        var features = that._mvtParser.readFeatures(arrayBuffer);

                        var styleFun = that._styleFun();

                        var extent = [0, 0, 4096, 4096];
                        var _replayGroup = new ol.render.canvas.ReplayGroup(0, extent,
                            8, true, 100);

                        for (var i = 0; i < features.length; i++) {
                            var feature = features[i];
                            var styles = styleFun(features[i], that._resolutions[level]);
                            for (var j = 0; j < styles.length; j++) {
                                ol.renderer.vector.renderFeature_(_replayGroup, feature, styles[j], 16);
                            }
                        }
                        _replayGroup.finish();

                        _replayGroup.replay(vectorContext, that._pixelRatio, that._transform, 0, {}, that._replays, true);
                        if (that._tileQueue.count > that._cacheSize) {
                            trimTiles(that._tileQueue, that._cacheSize / 2);
                        }

                        canvas.xMvt = x;
                        canvas.yMvt = y;
                        canvas.zMvt = z;
                        that._tileQueue.markTileRendered(canvas);

                        delete _replayGroup;
                        _replayGroup = null;

                        return canvas;
                    }).otherwise(function (error) {
                    });
                    // return Cesium.loadArrayBuffer(url).then(function(arrayBuffer) {

                    // }).otherwise(function(error) {
                    // });
                }(x, y, level);
            }
        };

        MVTProvider.prototype.pickFeatures = function (x, y, level, longitude, latitude) {
            return undefined;
        };

        return new MVTProvider(options);
    }
     

    // Styles for the mapbox-streets-v6 vector tile data set. Loosely based on
    // http://a.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6.json
    function createMapboxStreetsV6Style() {
        var fill = new ol.style.Fill({ color: '#ccc' });
        var stroke = new ol.style.Stroke({ color: '#ccc', width: 1 });
        var polygon = new ol.style.Style({ fill: fill });
        var strokedPolygon = new ol.style.Style({ fill: fill, stroke: stroke });
        var line = new ol.style.Style({ stroke: stroke });
        var text = new ol.style.Style({
            text: new ol.style.Text({
                text: '', fill: fill, stroke: stroke
            })
        });
        var iconCache = {};
        function getIcon(iconName) {
            var icon = iconCache[iconName];
            if (!icon) {
                icon = new ol.style.Style({
                    image: new ol.style.Icon({
                        src: 'https://cdn.rawgit.com/mapbox/maki/master/icons/' + iconName + '-15.svg',
                        imgSize: [15, 15]
                    })
                });
                iconCache[iconName] = icon;
            }
            return icon;
        }
        var styles = [];
        return function (feature, resolution) {
            var length = 0;
            var layer = feature.get('layer');
            var cls = feature.get('class');
            var type = feature.get('type');
            var scalerank = feature.get('scalerank');
            var labelrank = feature.get('labelrank');
            var adminLevel = feature.get('admin_level');
            var maritime = feature.get('maritime');
            var disputed = feature.get('disputed');
            var maki = feature.get('maki');
            var geom = feature.getGeometry().getType();
            if (layer == 'landuse' && cls == 'park') {
                fill.setColor('#d8e8c8');
                styles[length++] = polygon;
            } else if (layer == 'landuse' && cls == 'cemetery') {
                fill.setColor('#e0e4dd');
                styles[length++] = polygon;
            } else if (layer == 'landuse' && cls == 'hospital') {
                fill.setColor('#fde');
                styles[length++] = polygon;
            } else if (layer == 'landuse' && cls == 'school') {
                fill.setColor('#f0e8f8');
                styles[length++] = polygon;
            } else if (layer == 'landuse' && cls == 'wood') {
                fill.setColor('rgb(233,238,223)');
                styles[length++] = polygon;
            } else if (layer == 'waterway' &&
                cls != 'river' && cls != 'stream' && cls != 'canal') {
                stroke.setColor('#a0c8f0');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'waterway' && cls == 'river') {
                stroke.setColor('#a0c8f0');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'waterway' && (cls == 'stream' ||
                cls == 'canal')) {
                stroke.setColor('#a0c8f0');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'water') {
                fill.setColor('#a0c8f0');
                styles[length++] = polygon;
            } else if (layer == 'aeroway' && geom == 'Polygon') {
                fill.setColor('rgb(242,239,235)');
                styles[length++] = polygon;
            } else if (layer == 'aeroway' && geom == 'LineString' &&
                resolution <= 76.43702828517625) {
                stroke.setColor('#f0ede9');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'building') {
                fill.setColor('#f2eae2');
                stroke.setColor('#dfdbd7');
                stroke.setWidth(1);
                styles[length++] = strokedPolygon;
            } else if (layer == 'tunnel' && cls == 'motorway_link') {
                stroke.setColor('#e9ac77');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'tunnel' && cls == 'service') {
                stroke.setColor('#cfcdca');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'tunnel' &&
                (cls == 'street' || cls == 'street_limited')) {
                stroke.setColor('#cfcdca');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'tunnel' && cls == 'main' &&
                resolution <= 1222.99245256282) {
                stroke.setColor('#e9ac77');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'tunnel' && cls == 'motorway') {
                stroke.setColor('#e9ac77');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'tunnel' && cls == 'path') {
                stroke.setColor('#cba');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'tunnel' && cls == 'major_rail') {
                stroke.setColor('#bbb');
                stroke.setWidth(2);
                styles[length++] = line;
            } else if (layer == 'road' && cls == 'motorway_link') {
                stroke.setColor('#e9ac77');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'road' && (cls == 'street' ||
                cls == 'street_limited') && geom == 'LineString') {
                stroke.setColor('#cfcdca');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'road' && cls == 'main' &&
                resolution <= 1222.99245256282) {
                stroke.setColor('#e9ac77');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'road' && cls == 'motorway' &&
                resolution <= 4891.96981025128) {
                stroke.setColor('#e9ac77');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'road' && cls == 'path') {
                stroke.setColor('#cba');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'road' && cls == 'major_rail') {
                stroke.setColor('#bbb');
                stroke.setWidth(2);
                styles[length++] = line;
            } else if (layer == 'bridge' && cls == 'motorway_link') {
                stroke.setColor('#e9ac77');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'bridge' && cls == 'motorway') {
                stroke.setColor('#e9ac77');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'bridge' && cls == 'service') {
                stroke.setColor('#cfcdca');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'bridge' &&
                (cls == 'street' || cls == 'street_limited')) {
                stroke.setColor('#cfcdca');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'bridge' && cls == 'main' &&
                resolution <= 1222.99245256282) {
                stroke.setColor('#e9ac77');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'bridge' && cls == 'path') {
                stroke.setColor('#cba');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'bridge' && cls == 'major_rail') {
                stroke.setColor('#bbb');
                stroke.setWidth(2);
                styles[length++] = line;
            } else if (layer == 'admin' && adminLevel >= 3 && maritime === 0) {
                stroke.setColor('#9e9cab');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'admin' && adminLevel == 2 &&
                disputed === 0 && maritime === 0) {
                stroke.setColor('#9e9cab');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'admin' && adminLevel == 2 &&
                disputed === 1 && maritime === 0) {
                stroke.setColor('#9e9cab');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'admin' && adminLevel >= 3 && maritime === 1) {
                stroke.setColor('#a0c8f0');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'admin' && adminLevel == 2 && maritime === 1) {
                stroke.setColor('#a0c8f0');
                stroke.setWidth(1);
                styles[length++] = line;
            } else if (layer == 'country_label' && scalerank === 1) {
                text.getText().setText(feature.get('name_en'));
                text.getText().setFont('bold 11px "Open Sans", "Arial Unicode MS"');
                fill.setColor('#334');
                stroke.setColor('rgba(255,255,255,0.8)');
                stroke.setWidth(2);
                styles[length++] = text;
            } else if (layer == 'country_label' && scalerank === 2 &&
                resolution <= 19567.87924100512) {
                text.getText().setText(feature.get('name_en'));
                text.getText().setFont('bold 10px "Open Sans", "Arial Unicode MS"');
                fill.setColor('#334');
                stroke.setColor('rgba(255,255,255,0.8)');
                stroke.setWidth(2);
                styles[length++] = text;
            } else if (layer == 'country_label' && scalerank === 3 &&
                resolution <= 9783.93962050256) {
                text.getText().setText(feature.get('name_en'));
                text.getText().setFont('bold 9px "Open Sans", "Arial Unicode MS"');
                fill.setColor('#334');
                stroke.setColor('rgba(255,255,255,0.8)');
                stroke.setWidth(2);
                styles[length++] = text;
            } else if (layer == 'country_label' && scalerank === 4 &&
                resolution <= 4891.96981025128) {
                text.getText().setText(feature.get('name_en'));
                text.getText().setFont('bold 8px "Open Sans", "Arial Unicode MS"');
                fill.setColor('#334');
                stroke.setColor('rgba(255,255,255,0.8)');
                stroke.setWidth(2);
                styles[length++] = text;
            } else if (layer == 'marine_label' && labelrank === 1 &&
                geom == 'Point') {
                text.getText().setText(feature.get('name_en'));
                text.getText().setFont(
                    'italic 11px "Open Sans", "Arial Unicode MS"');
                fill.setColor('#74aee9');
                stroke.setColor('rgba(255,255,255,0.8)');
                stroke.setWidth(1);
                styles[length++] = text;
            } else if (layer == 'marine_label' && labelrank === 2 &&
                geom == 'Point') {
                text.getText().setText(feature.get('name_en'));
                text.getText().setFont(
                    'italic 11px "Open Sans", "Arial Unicode MS"');
                fill.setColor('#74aee9');
                stroke.setColor('rgba(255,255,255,0.8)');
                stroke.setWidth(1);
                styles[length++] = text;
            } else if (layer == 'marine_label' && labelrank === 3 &&
                geom == 'Point') {
                text.getText().setText(feature.get('name_en'));
                text.getText().setFont(
                    'italic 10px "Open Sans", "Arial Unicode MS"');
                fill.setColor('#74aee9');
                stroke.setColor('rgba(255,255,255,0.8)');
                stroke.setWidth(1);
                styles[length++] = text;
            } else if (layer == 'marine_label' && labelrank === 4 &&
                geom == 'Point') {
                text.getText().setText(feature.get('name_en'));
                text.getText().setFont(
                    'italic 9px "Open Sans", "Arial Unicode MS"');
                fill.setColor('#74aee9');
                stroke.setColor('rgba(255,255,255,0.8)');
                stroke.setWidth(1);
                styles[length++] = text;
            } else if (layer == 'place_label' && type == 'city' &&
                resolution <= 1222.99245256282) {
                text.getText().setText(feature.get('name_en'));
                text.getText().setFont('11px "Open Sans", "Arial Unicode MS"');
                fill.setColor('#333');
                stroke.setColor('rgba(255,255,255,0.8)');
                stroke.setWidth(1);
                styles[length++] = text;
            } else if (layer == 'place_label' && type == 'town' &&
                resolution <= 305.748113140705) {
                text.getText().setText(feature.get('name_en'));
                text.getText().setFont('9px "Open Sans", "Arial Unicode MS"');
                fill.setColor('#333');
                stroke.setColor('rgba(255,255,255,0.8)');
                stroke.setWidth(1);
                styles[length++] = text;
            } else if (layer == 'place_label' && type == 'village' &&
                resolution <= 38.21851414258813) {
                text.getText().setText(feature.get('name_en'));
                text.getText().setFont('8px "Open Sans", "Arial Unicode MS"');
                fill.setColor('#333');
                stroke.setColor('rgba(255,255,255,0.8)');
                stroke.setWidth(1);
                styles[length++] = text;
            } else if (layer == 'place_label' &&
                resolution <= 19.109257071294063 && (type == 'hamlet' ||
                type == 'suburb' || type == 'neighbourhood')) {
                text.getText().setText(feature.get('name_en'));
                text.getText().setFont('bold 9px "Arial Narrow"');
                fill.setColor('#633');
                stroke.setColor('rgba(255,255,255,0.8)');
                stroke.setWidth(1);
                styles[length++] = text;
            } else if (layer == 'poi_label' && resolution <= 19.109257071294063 &&
                scalerank == 1 && maki !== 'marker') {
                styles[length++] = getIcon(maki);
            } else if (layer == 'poi_label' && resolution <= 9.554628535647032 &&
                scalerank == 2 && maki !== 'marker') {
                styles[length++] = getIcon(maki);
            } else if (layer == 'poi_label' && resolution <= 4.777314267823516 &&
                scalerank == 3 && maki !== 'marker') {
                styles[length++] = getIcon(maki);
            } else if (layer == 'poi_label' && resolution <= 2.388657133911758 &&
                scalerank == 4 && maki !== 'marker') {
                styles[length++] = getIcon(maki);
            } else if (layer == 'poi_label' && resolution <= 1.194328566955879 &&
                scalerank >= 5 && maki !== 'marker') {
                styles[length++] = getIcon(maki);
            } else  {
                fill.setColor('#a0c8f0');
                stroke.setColor('rgba(255,255,255,0.8)');
                stroke.setWidth(1);
                styles[length++] = polygon;
            }
            styles.length = length;
            return styles;
        };
    }

    window.mvt = {
        create: createMVTWithStyle,
        StreetsV6Style: createMapboxStreetsV6Style
    };

})(window);
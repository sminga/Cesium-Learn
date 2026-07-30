/*
Roaming.js 使用速查表
------------------------------------------------------------------------------------------------------------------------
一、初始化

const roaming = new Roaming(viewer, {
    time: 360,        // 漫游总时长（秒），默认 360
    multiplier: 1     // 播放速度倍率，默认 1
});
------------------------------------------------------------------------------------------------------------------------
二、相机漫游（无模型，纯镜头飞行）

roaming.cameraRoaming([
    Cesium.Cartesian3.fromDegrees(114.35, 30.53, 1000),  // 起点
    Cesium.Cartesian3.fromDegrees(114.40, 30.51, 100),   // 终点
    // 可继续添加更多航点...
]);

要点   说明
参数   Cartesian3[] 航点数组，至少 2 个点

相机行为   距实体 100m、水平平视、航向 117.7°

插值算法   Hermite 多项式（degree=100）

无模型/轨迹   只有相机在飞，画面上看不到任何实体

三、模型漫游（带 3D 模型 + 可选轨迹/圆柱/标注）

roaming.modelRoaming({
    // ===== 必填 =====
    Lines: [
        Cesium.Cartesian3.fromDegrees(114.35, 30.53, 1000),
        Cesium.Cartesian3.fromDegrees(114.40, 30.51, 100),
    ],

    // ===== 模型 =====
    model: {
        uri: './models/car.glb',   // 模型路径（.glb/.gltf）
        scale: 2,                  // 缩放倍数
        minimumPixelSize: 64,      // 最小像素尺寸（默认已有）
    },

    // ===== 轨迹线（预飞行路径） =====
    path: {
        show: true,
        width: 3,
        material: Cesium.Color.YELLOW,
    },

    // ===== 折线（已走过的路径） =====
    polyline: {
        show: true,
        width: 4,
        material: Cesium.Color.RED,
    },

    // ===== 圆柱体（光柱效果） =====
    cylinder: {
        show: true,
        topRadius: 0,
        bottomRadius: 100,
        material: Cesium.Color.RED.withAlpha(0.3),
    },

    // ===== 文字标注 =====
    label: {
        show: true,
        text: '巡逻车-01',
        font: '16px sans-serif',
        fillColor: Cesium.Color.WHITE,
    },

    // ===== 行为开关 =====
    ifClockLoop: false,      // 是否循环播放
    ifAffixedTo: false,      // 是否贴地形
    ifTileset: false,        // 是否贴 3D Tiles 模型
    interpolation: false,    // 是否用 Lagrange 弧形插值
});

配置项速查
参数   类型   默认值   说明
Lines   Cartesian3[]   必填   航点数组

model   Object   {minimumPixelSize:64}   模型配置，合并到默认值

path   Object   {show:false}   Cesium 内置轨迹线

polyline   Object   {show:false, material:RED}   已走路径折线

cylinder   Object   {show:false, topRadius:0, bottomRadius:100}   圆锥光柱

label   Object   {show:false}   文字标注

ifClockLoop   Boolean   false   循环播放

ifAffixedTo   Boolean   false   贴地形（异步采样高程）

ifTileset   Boolean   false   贴 3D Tiles 表面

interpolation   Boolean   false   Lagrange 弧形插值

------------------------------------------------------------------------------------------------------------------------
四、播放控制
方法   代码   效果
暂停   roaming.PauseOrContinue(false)   时钟冻结，画面静止

继续   roaming.PauseOrContinue(true)   从暂停处恢复

变速   roaming.ChangeRoamingSpeed(2)   2 倍速（支持小数和负值倒放）

结束   roaming.EndRoaming()   移除所有实体，停止时钟

// 典型按钮绑定
<button onclick="roaming.PauseOrContinue(false)">暂停</button>
<button onclick="roaming.PauseOrContinue(true)">继续</button>
<button onclick="roaming.ChangeRoamingSpeed(2)">2倍速</button>
<button onclick="roaming.ChangeRoamingSpeed(0.5)">慢放</button>
<button onclick="roaming.EndRoaming()">结束</button>
------------------------------------------------------------------------------------------------------------------------

五、视角切换

roaming.changingView(value, options);

value   视角   参数   效果
1   跟踪   无   相机自动跟随实体（第三人称）

2   俯瞰   无   正上方垂直向下看（pitch=-90°）

3   侧视   无   从正西方、距 8km、俯 15° 观察

4   自定义   {heading, pitch, range}   自由指定角度和距离

// 自定义视角示例：从东南方 45° 俯视 30°，距离 500m
roaming.changingView(4, {
    heading: 135,
    pitch: -30,
    range: 500
});
------------------------------------------------------------------------------------------------------------------------
六、实时数据回调

roaming.getData(function (data) {
    console.log(data.longitude);      // 当前经度（度，6位小数）
    console.log(data.latitude);       // 当前纬度（度，6位小数）
    console.log(data.progress);       // 进度 "42%"
    console.log(data.delTime);        // 已用时间 "3分钟20秒"
    console.log(data.totalTime);      // 总时间 "6分钟"
    console.log(data.totalLength);    // 路径总长（米）
    console.log(data.roamingLength);  // 已飞距离（米）
    console.log(data.roamingElevation); // 当前海拔（米）
    console.log(data.terrainHeight);  // 地面高程（米）
    console.log(data.liftoffHeight);  // 离地高度（米）
});

⚠️ 回调每帧触发（约 60 次/秒），如需更新 DOM 建议加节流。
------------------------------------------------------------------------------------------------------------------------
七、完整使用示例

<div id="map" style="width:100%;height:100%"></div>
<div style="position:absolute;top:10px;left:10px;z-index:9999">
    <button onclick="start()">开始</button>
    <button onclick="roaming.PauseOrContinue(false)">暂停</button>
    <button onclick="roaming.PauseOrContinue(true)">继续</button>
    <button onclick="roaming.ChangeRoamingSpeed(2)">加速</button>
    <button onclick="roaming.changingView(1)">跟踪</button>
    <button onclick="roaming.changingView(2)">俯瞰</button>
    <button onclick="roaming.EndRoaming()">结束</button>
    <span id="info"></span>
</div>

<script>
const viewer = new Cesium.Viewer('map', {
    imageryProvider: false,
    baseLayerPicker: false,
});

// 加载天地图
viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
        url: 'https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=你的key',
        subdomains: ['0','1','2','3','4','5','6','7'],
    })
);

const roaming = new Roaming(viewer, { time: 30, multiplier: 1 });

// 实时数据 → 更新页面
roaming.getData(function (data) {
    document.getElementById('info').textContent =
        进度:{data.progress} | 经度:{data.longitude} | 纬度:{data.latitude} | 离地:{data.liftoffHeight}m;
});

function start() {
    roaming.modelRoaming({
        Lines: [
            Cesium.Cartesian3.fromDegrees(114.35, 30.53, 500),
            Cesium.Cartesian3.fromDegrees(114.38, 30.52, 300),
            Cesium.Cartesian3.fromDegrees(114.40, 30.51, 100),
        ],
        model: { uri: './models/drone.glb', scale: 1.5 },
        polyline: { show: true, width: 3, material: Cesium.Color.CYAN },
        cylinder: { show: true },
        interpolation: true,
    });
}
</script>
------------------------------------------------------------------------------------------------------------------------
八、注意事项速查
⚠️ 事项   说明
必须先有 viewer   new Roaming(viewer) 之前 Viewer 必须已创建

航点至少 2 个   少于 2 个点无法构成路径

高度单位是米   fromDegrees(经度, 纬度, 高度米)

贴地有性能开销   ifAffixedTo: true 每帧发异步请求，航点多时会卡

结束后需重新调用   EndRoaming() 后实体已销毁，需重新调 cameraRoaming / modelRoaming

暂停后时钟仍在   shouldAnimate=false 只是冻结，currentTime 不变，继续后无缝衔接

负速度可倒放   ChangeRoamingSpeed(-1) 会反向播放

循环模式   仅 modelRoaming 的 ifClockLoop 参数控制；cameraRoaming 需在构造前设 roaming.ifClockLoop = true

*/
//------------------------------------------------------------------------------------------------------------------------






/**
   * @class DEUGlobe.Scene.Roaming
   * @category  场景
   * @classdesc 漫游
   * @param {Object} viewer -  Cesium.viewer。
   * @param {Object} options -  参数。
   * @param {Boolean} options.time  -  漫游时间 。
   * @param {Boolean} options.multiplier  -  飞行速度 默认1。
   */



// 1. 定义初始默认值
class Roaming {  //声明类 
  constructor(viewer, options) {
    this.viewer = viewer;
    this.pause = true;
    options = options || {};
    this.Lines = [];  //存储漫游路径的航点数组（Cartesian3[]），初始为空。
    this.entity = undefined;    //代表漫游主体的 Cesium 实体，它包含了位置、朝向等信息。
    this.start = undefined;   //漫游的 起始 时间，用于控制时钟的播放。
    this.stop = undefined;    //结束 时间。
    this.time = options.time !== undefined ? options.time : 360;  //漫游总时长（秒），默认 360 秒。
    this.multiplier = options.multiplier !== undefined ? options.multiplier : 1; //飞行速度倍率，控制时钟的播放速度，默认为 1
    this.isPattern = true;  //是否是漫游模式，true 为漫游模式，false 为非漫游模式。
    this.data = {};   //一个对象，用于存储和回调漫游过程中的实时数据（如进度、坐标、高程等）。
    this.ifClockLoop = false;   // 是否循环播放。false = 飞完一次就停；true = 到终点后自动回到起点重新飞。默认为 false。
    this.ifTileset=false;  // 是否贴模型漫游。true 为贴模型漫游，false 为不贴模型漫游。
    this.ifAffixedTo = false;   // 是否贴地漫游。true 为贴地漫游，false 为不贴地漫游。
    this.ifCamera = false;   // 是否相机漫游。true 为相机漫游，false 为不相机漫游。
    this.interpolation=false;   //是否使用弧形插值，让路径更平滑。true 为使用弧形插值，false 为不使用弧形插值。
  }



  //-----------------------------------------------------------------------  //-----------------------------------------------------------------------  //-----------------------------------------------------------------------
  //2. 计算漫游路径属性 （位置、朝向、速度等）

  /**
 * @param {*} Lines 点集合
 * @param {*} time 漫游时间
 * @param {*} start 开始时间节点
 * @returns
 * @memberof Roaming
 */

  _ComputeRoamingLineProperty(Lines, time) {  // Lines	航点数组 [Cartesian3, Cartesian3, ...] , time	总飞行时长（秒）
    let property = new Cesium.SampledPositionProperty(); //Cesium 的采样位置属性：存储 (时间, 位置) 对，Cesium 自动在采样点之间插值
    let lineLength = Lines.length; //航点总数
    let tempTime = time; //暂存总时间
    let start = Cesium.JulianDate.now(); //获取当前时刻的儒略日时间
    this.start = start;
    let stop = Cesium.JulianDate.addSeconds(start, time, new Cesium.JulianDate());
    this.stop = stop; //保存结束时间。

//.clone()`： 深拷贝，防止后续修改`start` / `stop` 变量时意外影响时钟 
      this.viewer.clock.startTime = start.clone();//时钟的最早时间，不能往前拨
    this.viewer.clock.stopTime = stop.clone(); //时钟的最晚时间，不能往后拨
    this.viewer.clock.currentTime = start.clone(); //时钟的当前时间，设为起点 = 从头开始播


    if (this.ifClockLoop) { //循环模式
      this.viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;   //ture，时钟到达 stopTime 后自动跳回 startTime 重新播放
    } 
    else {  //false
      this.viewer.clock.clockRange = Cesium.ClockRange.CLAMPED; // 时钟到达 stopTime 后停住不动
      this.viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK; //时钟步进方式：跟随系统真实时间（每帧取 Date.now() 的差值
    }

    this.viewer.clock.shouldAnimate = true; //启动时钟动画。设为 true 后，Cesium 每帧自动推进 currentTime。
    this.viewer.clock.multiplier = this.multiplier; //设置播放倍率。multiplier = 2 表示时钟以 2 倍速推进。



    for (let i = 0; i < lineLength; i++) {  //   遍历每个航点
      var time = Cesium.JulianDate.addSeconds(start, i * tempTime / lineLength, new Cesium.JulianDate()); //确保到达每个航点的时间间隔相等，计算每个航点对应的时间点
      if (i == lineLength - 1) {
        time = stop; //最后一个航点的时间点直接设为 stop，避免累积误差
      }

      let position = Lines[i]; //取当前航点坐标。
      if (this.ifTileset) { //仅在 ifTileset = true 时执行
        position = this.viewer.scene.clampToHeight(position); //`clampToHeight`	:将坐标垂直投影到 3D Tiles 模型表面（如楼顶、桥面）
      }
      property.addSample(time, position); //使Cesium 内部会在相邻采样点之间自动插值，生成平滑的运动轨迹
    };
    return property
  }


  //----------------------------------------------------------------------- //-----------------------------------------------------------------------
//3. 漫游主体的初始化（相机漫游 / 模型漫游）
  /**
  * @class DEUGlobe.Scene.Roaming.cameraRoaming
  * @classdesc 相机漫游
  * @param {Array} Lines -  点集合 (必填)。
 */
  cameraRoaming(Lines) {
    this.Lines = Lines;
    var property = this._ComputeRoamingLineProperty(this.Lines, this.time);
    this._InitRoaming(property, this.start, this.stop);
  }
  /**
   * @param {*} position computeRoamingLineProperty计算的属性
   * @param {*} start 开始时间节点
   * @param {*} stop 结束时间节点
   * @memberof Roaming
  */
  _InitRoaming(position, start, stop) {
    this.entity = this.viewer.entities.add({
      availability: new Cesium.TimeIntervalCollection([
        new Cesium.TimeInterval({
          start: start,
          stop: stop
        })
      ]),
      // 位置
      position: position,
      orientation: new Cesium.VelocityOrientationProperty(position)
    });
    this.entity.position.setInterpolationOptions({// 点插值
      interpolationDegree: 100,
      interpolationAlgorithm: Cesium.HermitePolynomialApproximation
    });
    this.viewer.trackedEntity = this.entity;
    var camera = this.viewer.camera;
    var _this = this;
    var Exection = function () {
      if (_this.entity) {
        var center = _this.entity.position.getValue(_this.viewer.clock.currentTime);
        if (center) camera.lookAt(center, {
          heading: Cesium.Math.toRadians(117.7),
          pitch: Cesium.Math.toRadians(0),
          range: 100
        });
        if (_this.viewer.clock.shouldAnimate) {
          if (center) _this._realTimeData(center)
        }
      } else {
        _this.viewer.scene.preUpdate.removeEventListener(Exection);
      }
    }
    _this.viewer.scene.preUpdate.addEventListener(Exection);
  }
  /**
   * @class DEUGlobe.Scene.Roaming.modelRoaming
   * @classdesc 模型漫游
   * @param {Object} options -  参数。
   * @param {Array}  options.Lines -  点集合 (必填)。
   * @param {Object} options.model - 模型  Cesium.ModelGraphics.ConstructorOptions。
   * @param {Boolean} options.ifAffixedTo  - 是否贴地漫游 (默认 false)
   * @param {Boolean} options.ifClockLoop  - 是否循环漫游 (默认 false)
   * @param {Boolean} options.interpolation  - 是否弧形差值 (默认 false)
   * @param {Boolean} options.model.minimumPixelSize - 模型最小刻度 (默认 64)
   * @param {Object} options.path - 漫游轨迹 Cesium.PathGraphics.ConstructorOptions。
   * @param {Boolean} options.path.show - 漫游轨迹可见性 (默认 false)
   * @param {Object} options.polyline - 绘制折线 Cesium.PolylineGraphics.ConstructorOptions.
   * @param {Boolean} options.polyline.show  - 绘制折线可见性 (默认 false)
   * @param {Object} options.label  - 标注  Cesium.LabelGraphics.ConstructorOptions
   * @param {Boolean} options.label.show  -标注可见性 (默认 false)
   * @param {Object} options.cylinder - 绘制圆柱体 Cesium.CylinderGraphics.ConstructorOptions
   * @param {Boolean} options.cylinder.show  - 绘制折线可见性 (默认 false)
   * @param {Boolean} options.cylinder.topRadius  -用于指定圆柱体顶部的半径 (默认 0)
   * @param {Boolean} options.cylinder.bottomRadius  - 用于指定圆柱体底部的半径。 (默认 200)
   * @param {Boolean} options.cylinder.material  - 指定用于填充圆柱体的材料 (默认 Cesium.Color.RED)
   * @param {Boolean} options.cylinder.heightReference  - 指定距实体位置的高度是相对于什么的高度。 (默认 Cesium.HeightReference.CLAMP_TO_GROUND)
   * @param {Object} options.polyline.material  - 绘制折线颜色 (默认 Cesium.Color.RED)
   * @param {Boolean} options.ifTileset  - 是否贴模型漫游 (默认 false)
  */
  modelRoaming(options) {
    this.modelData = {};
    this.Lines = options.Lines;
    var model = {
      minimumPixelSize: 64,
    };
    var path = {
      show: false
    }
    var polyline = {
      show: false,
      material: Cesium.Color.RED,
    }
    var cylinder = {
      show: false,
      topRadius: 0.0,
      bottomRadius: 100.0,
      material: Cesium.Color.RED.withAlpha(0.3),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
    var label = {
      show: false
    }
    this.ifAffixedTo = options.ifAffixedTo ? options.ifAffixedTo : false;
    this.ifClockLoop = options.ifClockLoop ? options.ifClockLoop : false;
    this.interpolation = options.interpolation ? options.interpolation : false;
    this.showLabel = options.showLabel ? options.showLabel : false;
    this.ifTileset = options.ifTileset ? options.ifTileset : false;
    this.modelData.model = Object.assign(model, options.model);
    this.modelData.path = Object.assign(path, options.path);
    this.modelData.label = Object.assign(label, options.label);
    this.modelData.polyline = Object.assign(polyline, options.polyline);
    this.modelData.cylinder = Object.assign(cylinder, options.cylinder);
    this.modelData.polyline.positions = new Cesium.CallbackProperty(function () { }, false);
    this.modelData.cylinder.length = new Cesium.CallbackProperty(function () { }, false);
    var property = this._ComputeRoamingLineProperty(this.Lines, this.time);
    this._modelInitRoaming(property, this.start, this.stop, options.model, options.path);
  }
  /**
   * 模型漫游
  */
  _modelInitRoaming(position, start, stop) {
    var _this = this;
    this.entity = this.viewer.entities.add({
      availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({
        start: start,
        stop: stop
      })]),
      // 位置
      position: position,
      // 计算朝向
      orientation: new Cesium.VelocityOrientationProperty(position),
      // 加载模型
      model: this.modelData.model,
      //添加标题
      label: this.modelData.label,
      path: this.modelData.path,
    });
    if (!_this.ifAffixedTo && _this.interpolation) {
      this.entity.position.setInterpolationOptions({// 点插值
        interpolationDegree: 5,
        interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
      });
    }
    _this.polyline = _this.viewer.entities.add({
      polyline: _this.modelData.polyline,
    });
    _this.cylinder = _this.viewer.entities.add({
      position: position,
      orientation: new Cesium.VelocityOrientationProperty(position),
      cylinder: this.modelData.cylinder
    });
    var positions = [];
    var Exection = function () {
      if (_this.entity) {
        if (_this.viewer.clock.shouldAnimate) {
          var center = _this.entity.position.getValue(_this.viewer.clock.currentTime);
          if (_this.modelData.polyline.show) {
            positions.push(center);
            _this.modelData.polyline.positions._callback = function () {
              return positions;
            }
          }
          if (_this.ifAffixedTo) {
            var geoPt1 = _this.viewer.scene.globe.ellipsoid.cartesianToCartographic(center);
            let terrainProvider = !_this.viewer.terrainProvider.availability ? Cesium.createWorldTerrain() : _this.viewer.terrainProvider;
            Cesium.sampleTerrainMostDetailed(terrainProvider, [Cesium.Cartographic.fromDegrees(geoPt1.longitude / Math.PI * 180, geoPt1.latitude / Math.PI * 180)]).then(function (updatedPositions) {
              _this.entity.position.addSample(_this.viewer.clock.currentTime, Cesium.Cartesian3.fromRadians(
                updatedPositions[0].longitude,
                updatedPositions[0].latitude,
                updatedPositions[0].height
              ));
            });
          }
          if (_this.ifTileset) {
            _this.entity.position.addSample(_this.viewer.clock.currentTime, _this.viewer.scene.clampToHeight(center, [_this.entity]));
          }
          if (_this.modelData.cylinder.show) {
            _this.modelData.cylinder.length._callback = function () {
              let length = _this.viewer.scene.globe.ellipsoid.cartesianToCartographic(center)
              return length.height;
            }
          }
          if (center) _this._realTimeData(center)
        }
      } else {
        _this.viewer.scene.preUpdate.removeEventListener(Exection);
      }
    }
    _this.viewer.scene.preUpdate.addEventListener(Exection);
    _this.changingView(2);
  }
  /**
   *漫游的暂停和继续
  *
  * @param {*} state bool类型 false为暂停，ture为继续
  * @memberof Roaming
  */
  PauseOrContinue(state) {
    this.viewer.clock.shouldAnimate = state;
  }
  /**
   *改变飞行的速度
  *
  * @param {} value  整数类型
  * @memberof Roaming
  */
  ChangeRoamingSpeed(value) {
    this.viewer.clock.multiplier = value;
  }
  /**
   *
   *取消漫游
  * @memberof Roaming
  */
  EndRoaming() {
    if (this.entity !== undefined) {
      this.viewer.entities.remove(this.entity);
      this.viewer.entities.remove(this.polyline);
      this.viewer.entities.remove(this.cylinder);
      this.entity = undefined;
      this.polyline = undefined;
      this.cylinder = undefined;
      this.PauseOrContinue(false);

    }
  }
  /**
   *
   *获取飞行数据
  * @memberof Roaming
  * @param {RequestCallback} callback - 回调函数 (单位米)。
  */
  getData(callback) {
    var _this = this;
    Object.defineProperty(this.data, 'shouldAnimate', {
      set: function (value) {
        return callback(_this.data)
      }
    })
  }
  /**
   *切换视角
  * @memberof Roaming、
  * @param {Boolean} value   1视角跟踪 2上方视角 3侧方视角 4自定义视角
  * @param {Object} options 参数 自定义视角 模式时才有效
  * @param {Object} options.heading 可选 航向角（弧度）默认 0
  * @param {Object} options.pitch 可选俯仰角（弧度） 默认 0。
  * @param {Object} options.range 可选距中心的距离，以米为单位 默认 0。
  */
  changingView(value, options) {
    var options = options || {};
    this.viewer.trackedEntity = undefined;
    if (value == 1) {
      this.viewer.trackedEntity = this.entity;
    } else if (value == 2) {
      this.viewer.zoomTo(
        this.viewer.entities,
        new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-90))
      );
    } else if (value == 3) {
      this.viewer.zoomTo(
        this.viewer.entities,
        new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(-90),
          Cesium.Math.toRadians(-15),
          8000
        )
      );
    } else if (value == 4) {
      this.viewer.zoomTo(
        this.viewer.entities,
        new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(!options.heading ? 0 : options.heading),
          Cesium.Math.toRadians(!options.pitch ? 0 : options.pitch),
          !options.range ? 0 : options.range
        )
      );
    }
  }
  //实时数据
  _realTimeData(center) {
    var _this = this;
    _this.data.shouldAnimate = _this.viewer.clock.shouldAnimate;
    _this.data.totalLength = _this._disTance(_this.Lines);//总长度
    _this.data.totalTime = _this._formateSeconds(_this.time); //总时长
    var delTime = Cesium.JulianDate.secondsDifference(_this.viewer.clock.currentTime, _this.viewer.clock.startTime);//已经漫游的时间
    _this.data.delTime = _this._formateSeconds(delTime);
    _this.data.roamingLength = (_this.data.totalLength / _this.time * delTime).toFixed(3);//已经漫游长度
    var geoPt1 = _this.viewer.scene.globe.ellipsoid.cartesianToCartographic(center);
    _this.data.longitude = (geoPt1.longitude / Math.PI * 180).toFixed(6);//经度
    _this.data.latitude = (geoPt1.latitude / Math.PI * 180).toFixed(6);//纬度
    // _this.data.roamingElevation = (geoPt1.height).toFixed(2)==-0.00?0:(geoPt1.height).toFixed(2);//漫游高程
    // _this.data.liftoffHeight = (_this.data.roamingElevation-_this.data.terrainHeight).toFixed(2);//离地距离
    let terrainProvider = !_this.viewer.terrainProvider.availability ? Cesium.createWorldTerrain() : _this.viewer.terrainProvider;
    Cesium.sampleTerrainMostDetailed(terrainProvider, [Cesium.Cartographic.fromDegrees(geoPt1.longitude / Math.PI * 180, geoPt1.latitude / Math.PI * 180)]).then(function (updatedPositions) {
      _this.data.roamingElevation = (updatedPositions[0].height + geoPt1.height).toFixed(2);//漫游高程
      _this.data.terrainHeight = (updatedPositions[0].height).toFixed(2);//地面高程
      _this.data.liftoffHeight = (_this.data.roamingElevation - _this.data.terrainHeight).toFixed(2);//离地距离
    });
    _this.data.progress = (_this.data.roamingLength / _this.data.totalLength * 100).toFixed(0) + '%';//进度
  }
  /**
   *计算距离
  */
  _disTance(positions) {
    var distance = 0;
    for (var i = 0; i < positions.length - 1; i++) {
      var point1cartographic = Cesium.Cartographic.fromCartesian(positions[i]);
      var point2cartographic = Cesium.Cartographic.fromCartesian(positions[i + 1]);
      /**根据经纬度计算出距离**/
      var geodesic = new Cesium.EllipsoidGeodesic();
      geodesic.setEndPoints(point1cartographic, point2cartographic);
      var s = geodesic.surfaceDistance;
      //返回两点之间的距离
      s = Math.sqrt(Math.pow(s, 2) + Math.pow(point2cartographic.height - point1cartographic.height, 2));
      // s=Math.abs(point2cartographic.height - point1cartographic.height);	
      distance = distance + s;
    }
    return distance.toFixed(3);
  }
  //将秒转化为时分秒
  _formateSeconds(endTime) {
    let secondTime = parseInt(endTime)//将传入的秒的值转化为Number
    let min = 0// 初始化分
    let h = 0// 初始化小时
    let result = ''
    if (secondTime >= 60) {//如果秒数大于60，将秒数转换成整数
      min = parseInt(secondTime / 60)//获取分钟，除以60取整数，得到整数分钟
      secondTime = parseInt(secondTime % 60)//获取秒数，秒数取佘，得到整数秒数
      if (min >= 60) {//如果分钟大于60，将分钟转换成小时
        h = parseInt(min / 60)//获取小时，获取分钟除以60，得到整数小时
        min = parseInt(min % 60) //获取小时后取佘的分，获取分钟除以60取佘的分
      }
    }
    h = h.toString() == 0 ? '' : h.toString() + '小时';
    min = min.toString() == 0 ? '' : min.toString() + '分钟';
    secondTime = secondTime.toString() == 0 ? '' : secondTime.toString() + '秒';
    result = `${h + min + secondTime}`
    return result == '' ? '0秒' : result
  }
}
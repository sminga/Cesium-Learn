import netcdfjs from 'netcdfjs'
import * as Cesium from 'cesium'
import { defaultFields } from './options'
import DataCleaner from './DataCleaner.js'

const processArrayOptimized = (rawArray, offset = 0, valueRange = null) => {
  const length = rawArray.length;
  const result = new Float32Array(length);
  let min = Infinity;
  let max = -Infinity;
  let hasNumber = false;

  for (let i = 0; i < length; i++) {
    let val = rawArray[i];
    
    if (isNaN(val)) {
      result[i] = 0;
      continue;
    }
    
    val += offset;
    
    if (valueRange && (val < valueRange.min || val > valueRange.max)) {
      result[i] = 0;
      continue;
    }
    
    result[i] = val;
    hasNumber = true;
    
    if (val < min) min = val;
    if (val > max) max = val;
  }

  return {
    array: result,
    min: hasNumber ? min : 0,
    max: hasNumber ? max : 0
  };
};

export default (function () {
  var data;
  var dataCleaner = null;
  var cleaningReport = null;

  var loadColorTable = function (colorTable) {
    let colorNum = colorTable.length;
    let arr = [];
    colorTable.map(color => {
      arr = arr.concat(color);
    })
    data.colorTable = {
      colorNum,
      array: new Float32Array(arr.flat())
    };
  }

  var loadNetCDF = function (input, {
    fields,
    valueRange,
    offset,
  }) {

    return new Promise(async function (resolve, reject) {
      var arrayToMap = function (array) {
        return array.reduce(function (map, object) {
          map[object.name] = object;
          return map;
        }, {});
      }
      
      let arrayBuffer;
      if (typeof input === 'string') {
        try {
          const response = await fetch(input);
          if (!response.ok) {
            reject(new Error(`Failed to fetch NetCDF file: ${response.status} ${response.statusText}`));
            return;
          }
          arrayBuffer = await response.arrayBuffer();
        } catch (e) {
          reject(e);
          return;
        }
      } else if (input instanceof File || input instanceof Blob) {
        const reader = new FileReader();
        arrayBuffer = await new Promise((res, rej) => {
          reader.onload = () => res(reader.result);
          reader.onerror = () => rej(reader.error);
          reader.readAsArrayBuffer(input);
        });
      } else if (input instanceof ArrayBuffer) {
        arrayBuffer = input;
      } else {
        reject(new Error('Invalid input type for NetCDF loading'));
        return;
      }
      
      var NetCDF = new netcdfjs(arrayBuffer);
      data = {};

      let variables = NetCDF.header.variables.map(item => item.name);
      for (let key in fields) {
        let arr = [];
        if (fields[key] && variables.indexOf(fields[key]) === -1) {
          arr.push(fields[key]);
        }
        if (arr.length) {
          reject("NetCDF file no such attribute: " + arr + '\n all variables are: ' + variables);
          return;
        }
      }

      var dimensions = arrayToMap(NetCDF.dimensions);
      data.dimensions = {
        lon: 1,
        lat: 1,
        lev: 1
      };
      
      ['lon', 'lat', 'lev'].forEach(key => {
        try {
          if (fields[key]) {
            data.dimensions[key] = dimensions[fields[key]].size;
            const rawArray = NetCDF.getDataVariable(fields[key]).flat();
            const offsetVal = offset[key] || 0;
            const result = processArrayOptimized(rawArray, offsetVal);
            data[key] = result;
          }
        } catch(e) {
          reject(e);
          return;
        }
      });

      ["U", "V", "W", "H"].forEach(key => {
        try {
          if (fields[key]) {
            const rawArray = NetCDF.getDataVariable(fields[key]).flat();
            const result = processArrayOptimized(rawArray, 0, valueRange);
            data[key] = result;
          }
        } catch(e) {
          reject(e);
          return;
        }
      });

      if (!data.lev) {
        data.lev = {
          array: new Float32Array([0]),
          min: 0,
          max: 0
        }
      }

      if (!fields['W']) {
        data.W = {
          array: new Float32Array(data.U.array.length),
          min: 0,
          max: 0
        }
      }

      if (!fields['H']) {
        data.H = {
          array: new Float32Array(data.U.array.length),
          min: 0,
          max: 0
        }
        if (fields['lev']) {
          const { lon, lat, lev } = data.dimensions;
          const levArray = data.lev.array;
          let hMin = Infinity;
          let hMax = -Infinity;
          
          for (let i = 0; i < lev; i++) {
            const hVal = levArray[i];
            if (hVal < hMin) hMin = hVal;
            if (hVal > hMax) hMax = hVal;
            
            for (let j = 0; j < lat; j++) {
              const baseIndex = i * (lon * lat) + j * lon;
              for (let k = 0; k < lon; k++) {
                data.H.array[baseIndex + k] = hVal;
              }
            }
          }
          data.H.min = hMin;
          data.H.max = hMax;
        }
      }

      dataCleaner = new DataCleaner({
        outlierMethod: 'iqr',
        iqrMultiplier: 1.5,
        maxWindSpeed: 100,
        missingValueHandling: 'interpolate',
        dimensions: data.dimensions
      });

      const validation = dataCleaner.validate(data);
      if (!validation.isValid) {
        console.warn('[DataCleaner] 数据验证警告:', validation.warnings);
        if (validation.errors.length > 0) {
          console.error('[DataCleaner] 数据验证错误:', validation.errors);
        }
      }

      data = dataCleaner.clean(data);
      cleaningReport = dataCleaner.getReport();

      console.log('[DataCleaner] 数据清洗完成:', cleaningReport.statistics);

      resolve(data);
    });
  }

  var loadData = async function (input, type, {
    fields,
    valueRange,
    offset,
    colorTable
  }) {
    
    if (type === 'json') {
      data = input
    }
    else {
      try {
        await loadNetCDF(input, {
          fields,
          valueRange,
          offset,
        });
      } catch (e) {
        throw(e)
      }
    }

    loadColorTable(colorTable);

    return data;
  }

  // 先找一个随机的像素点,以此像素点经纬度范围生成随机位置
  var getValidRange = function () {
    const dimensions = [data.dimensions.lon, data.dimensions.lat, data.dimensions.lev];
    const minimum = [data.lon.min, data.lat.min, data.lev.min];
    const maximum = [data.lon.max, data.lat.max, data.lev.max];
    const interval = [
        (maximum[0]- minimum[0]) / (dimensions[0]- 1),
        (maximum[1] - minimum[1]) / (dimensions[1] - 1),
        dimensions[2] > 1 ? (maximum[2] - minimum[2]) / (dimensions[2] - 1) : 1.0
    ];
    let id = Math.floor(Math.random() * data.U.array.length);

    let z = Math.floor(id / (dimensions[0] * dimensions[1]));
    let left = id % (dimensions[0] * dimensions[1]);
    let y = Math.floor(left / dimensions[0]);
    let x = left % dimensions[0];

    let lon = Cesium.Math.randomBetween(minimum[0]+ x * interval[0], minimum[0]+ (x + 1) * interval[0])
    let lat = Cesium.Math.randomBetween(minimum[1] + (y - 1) * interval[1], minimum[1] + y * interval[1])
    // let lev = Cesium.Math.randomBetween(minimum[2] + (z - 1) * interval[2], minimum[2] + z * interval[2])
    let lev = data.H.array[id] || 0;
    return [lon, lat, lev]
  }
  
  var randomizeParticles = function (maxParticles, viewerParameters) {
    var array = new Float32Array(4 * maxParticles);
    for (var i = 0; i < maxParticles; i++) {
      let pos = getValidRange();
      array[4 * i] = pos[0];
      array[4 * i + 1] = pos[1];
      array[4 * i + 2] = pos[2];
      array[4 * i + 3] = 0.0;
    }
    return array;
  }

  return {
    loadData: loadData,
    randomizeParticles: randomizeParticles,
    getCleaningReport: function() { return cleaningReport; },
    getDataCleaner: function() { return dataCleaner; }
  };

})();

/**
 * NetCDF 解析器
 * @module utils/netcdfParser
 */

export async function parseNetCDF(arrayBuffer, fieldNames = {}) {
  const netcdfjs = await import('netcdfjs');
  const reader = new netcdfjs.default(arrayBuffer);
  
  const defaultFields = {
    U: 'U',
    V: 'V',
    W: null,
    lon: 'lon',
    lat: 'lat',
    lev: 'lev'
  };
  
  const fields = { ...defaultFields, ...fieldNames };
  
  const dimensions = {};
  reader.dimensions.forEach(dim => {
    dimensions[dim.name] = dim.size;
  });
  
  const variables = {};
  reader.variables.forEach(variable => {
    variables[variable.name] = {
      dimensions: variable.dimensions,
      attributes: variable.attributes,
      data: reader.getDataVariable(variable.name)
    };
  });
  
  const result = {
    dimensions,
    variables,
    u: variables[fields.U]?.data || null,
    v: variables[fields.V]?.data || null,
    w: fields.W && variables[fields.W] ? variables[fields.W].data : null,
    lon: variables[fields.lon]?.data || null,
    lat: variables[fields.lat]?.data || null,
    lev: variables[fields.lev]?.data || null
  };
  
  if (result.lon && result.lat) {
    result.extent = {
      minLon: Math.min(...result.lon),
      maxLon: Math.max(...result.lon),
      minLat: Math.min(...result.lat),
      maxLat: Math.max(...result.lat)
    };
  }
  
  return result;
}

export function getWindAtLocation(windData, lon, lat, levIndex = 0) {
  const { u, v, lon: lons, lat: lats, lev: levs } = windData;
  
  if (!u || !v || !lons || !lats) {
    return null;
  }
  
  const lonIndex = Math.floor((lon - lons[0]) / (lons[1] - lons[0]));
  const latIndex = Math.floor((lat - lats[0]) / (lats[1] - lats[0]));
  
  if (lonIndex < 0 || latIndex < 0 || 
      lonIndex >= lons.length || latIndex >= lats.length) {
    return null;
  }
  
  const hasLevels = levs && levs.length > 1;
  const levelOffset = hasLevels ? levIndex * lats.length * lons.length : 0;
  const index = levelOffset + latIndex * lons.length + lonIndex;
  
  const uValue = u[index];
  const vValue = v[index];
  
  return {
    u: uValue,
    v: vValue,
    speed: Math.sqrt(uValue * uValue + vValue * vValue),
    direction: Math.atan2(uValue, vValue) * 180 / Math.PI
  };
}

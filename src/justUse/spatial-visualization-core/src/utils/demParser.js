/**
 * DEM 解析器
 * @module utils/demParser
 */

export function parseDEM(text) {
  const lines = text.trim().split('\n');
  const dem = {
    ncols: 0,
    nrows: 0,
    xllcorner: 0,
    yllcorner: 0,
    cellsize: 0,
    nodata_value: -9999,
    data: null
  };
  
  let dataIndex = 0;
  let headerComplete = false;
  const dataValues = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!headerComplete) {
      const lower = trimmed.toLowerCase();
      
      if (lower.startsWith('ncols')) {
        dem.ncols = parseInt(trimmed.split(/\s+/)[1]);
      } else if (lower.startsWith('nrows')) {
        dem.nrows = parseInt(trimmed.split(/\s+/)[1]);
      } else if (lower.startsWith('xllcorner')) {
        dem.xllcorner = parseFloat(trimmed.split(/\s+/)[1]);
      } else if (lower.startsWith('yllcorner')) {
        dem.yllcorner = parseFloat(trimmed.split(/\s+/)[1]);
      } else if (lower.startsWith('cellsize')) {
        dem.cellsize = parseFloat(trimmed.split(/\s+/)[1]);
      } else if (lower.startsWith('nodata_value')) {
        dem.nodata_value = parseFloat(trimmed.split(/\s+/)[1]);
      } else if (/^-?\d/.test(trimmed)) {
        headerComplete = true;
      }
    }
    
    if (headerComplete) {
      const values = trimmed.split(/\s+/).map(v => parseFloat(v));
      dataValues.push(...values);
    }
  }
  
  dem.data = new Float32Array(dataValues);
  
  return dem;
}

export function getElevationAt(dem, lon, lat) {
  const x = Math.floor((lon - dem.xllcorner) / dem.cellsize);
  const y = Math.floor((lat - dem.yllcorner) / dem.cellsize);
  
  if (x < 0 || x >= dem.ncols || y < 0 || y >= dem.nrows) {
    return null;
  }
  
  const index = y * dem.ncols + x;
  const value = dem.data[index];
  
  if (value === dem.nodata_value) {
    return null;
  }
  
  return value;
}

export function getDEMExtent(dem) {
  return {
    minLon: dem.xllcorner,
    maxLon: dem.xllcorner + dem.ncols * dem.cellsize,
    minLat: dem.yllcorner,
    maxLat: dem.yllcorner + dem.nrows * dem.cellsize
  };
}

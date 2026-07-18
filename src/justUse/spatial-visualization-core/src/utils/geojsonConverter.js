/**
 * GeoJSON 转换器
 * @module utils/geojsonConverter
 */

export function pointsToGeoJSON(points, properties = {}) {
  return {
    type: 'FeatureCollection',
    features: points.map((point, index) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [point.lon || point.x, point.lat || point.y]
      },
      properties: {
        id: index,
        ...properties,
        ...point
      }
    }))
  };
}

export function polygonToGeoJSON(coordinates, properties = {}) {
  if (coordinates.length < 3) {
    return null;
  }
  
  const closedCoords = [...coordinates];
  closedCoords.push(closedCoords[0]);
  
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [closedCoords.map(c => [c.lon || c.x, c.lat || c.y])]
    },
    properties
  };
}

export function lineStringToGeoJSON(coordinates, properties = {}) {
  if (coordinates.length < 2) {
    return null;
  }
  
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: coordinates.map(c => [c.lon || c.x, c.lat || c.y])
    },
    properties
  };
}

export function gridToGeoJSON(grid, options = {}) {
  const {
    threshold = 0,
    xllcorner = 0,
    yllcorner = 0,
    cellsize = 1,
    ncols,
    nrows
  } = options;
  
  const features = [];
  
  for (let y = 0; y < nrows; y++) {
    for (let x = 0; x < ncols; x++) {
      const index = y * ncols + x;
      const value = grid[index];
      
      if (value >= threshold) {
        const lon = xllcorner + x * cellsize;
        const lat = yllcorner + y * cellsize;
        
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lon, lat]
          },
          properties: {
            value,
            row: y,
            col: x
          }
        });
      }
    }
  }
  
  return {
    type: 'FeatureCollection',
    features
  };
}

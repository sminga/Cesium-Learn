/**
 * GIS 连接器
 * @module modules/fire/GISConnector
 * @description 与主流地理信息系统的接口
 * 参考: FARSITE 与 ArcGIS 的集成方案
 */

import EventEmitter from '../../core/EventEmitter.js';

class GISConnector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      arcgisPortal: options.arcgisPortal || null,
      arcgisToken: options.arcgisToken || null,
      geoserverUrl: options.geoserverUrl || null,
      ...options
    };
    
    this.services = new Map();
  }

  async connectArcGIS(portalUrl, credentials) {
    if (!portalUrl) {
      portalUrl = 'https://www.arcgis.com';
    }
    
    this.options.arcgisPortal = portalUrl;
    
    if (credentials) {
      try {
        const token = await this._getArcGISToken(portalUrl, credentials);
        this.options.arcgisToken = token;
        this.emit('arcgisConnected', { portalUrl });
        return true;
      } catch (error) {
        this.emit('error', { source: 'arcgis', error });
        return false;
      }
    }
    
    return true;
  }

  async _getArcGISToken(portalUrl, credentials) {
    const url = `${portalUrl}/sharing/rest/generateToken`;
    
    const params = new URLSearchParams({
      username: credentials.username,
      password: credentials.password,
      client: 'requestip',
      f: 'json'
    });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    return data.token;
  }

  async publishFireLayer(engine, options = {}) {
    if (!this.options.arcgisToken) {
      throw new Error('Not connected to ArcGIS');
    }
    
    const boundary = engine.getBoundary();
    const statistics = engine.getStatistics();
    
    const features = this._convertToArcGISFeatures(boundary, statistics);
    
    const layerData = {
      type: 'Feature Collection',
      features,
      layerDefinition: {
        name: options.name || `Fire_Simulation_${Date.now()}`,
        geometryType: 'esriGeometryPolygon',
        fields: [
          { name: 'OBJECTID', type: 'esriFieldTypeOID', alias: 'ID' },
          { name: 'burnedArea', type: 'esriFieldTypeDouble', alias: 'Burned Area (m²)' },
          { name: 'perimeter', type: 'esriFieldTypeDouble', alias: 'Perimeter (m)' },
          { name: 'maxSpreadRate', type: 'esriFieldTypeDouble', alias: 'Max Spread Rate (m/s)' },
          { name: 'timestamp', type: 'esriFieldTypeDate', alias: 'Timestamp' }
        ]
      }
    };
    
    this.emit('layerPublished', { name: layerData.layerDefinition.name });
    
    return layerData;
  }

  _convertToArcGISFeatures(boundary, statistics) {
    if (!boundary || boundary.length < 3) {
      return [];
    }
    
    const rings = boundary.map(p => [p.lon, p.lat]);
    rings.push(rings[0]);
    
    return [{
      attributes: {
        burnedArea: statistics.burnedArea,
        perimeter: statistics.perimeter,
        maxSpreadRate: statistics.maxSpreadRate,
        timestamp: Date.now()
      },
      geometry: {
        rings: [rings],
        spatialReference: { wkid: 4326 }
      }
    }];
  }

  async importFuelData(source, options = {}) {
    const { type, url, data } = source;
    
    switch (type) {
      case 'arcgis':
        return this._importFromArcGIS(url, options);
      case 'geojson':
        return this._importFromGeoJSON(data || url);
      case 'wfs':
        return this._importFromWFS(url, options);
      default:
        throw new Error(`Unknown source type: ${type}`);
    }
  }

  async _importFromArcGIS(layerUrl, options = {}) {
    const params = new URLSearchParams({
      where: options.where || '1=1',
      outFields: options.outFields || '*',
      f: 'geojson',
      token: this.options.arcgisToken || ''
    });
    
    const url = `${layerUrl}/query?${params}`;
    const response = await fetch(url);
    const geojson = await response.json();
    
    return this._processFuelGeoJSON(geojson, options);
  }

  async _importFromGeoJSON(source) {
    let geojson = source;
    
    if (typeof source === 'string') {
      const response = await fetch(source);
      geojson = await response.json();
    }
    
    return this._processFuelGeoJSON(geojson);
  }

  async _importFromWFS(url, options = {}) {
    const params = new URLSearchParams({
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeName: options.typeName,
      outputFormat: 'application/json'
    });
    
    const response = await fetch(`${url}?${params}`);
    const geojson = await response.json();
    
    return this._processFuelGeoJSON(geojson, options);
  }

  _processFuelGeoJSON(geojson, options = {}) {
    const fuelProperty = options.fuelProperty || 'fuel_type';
    const fuelGrid = new Map();
    
    if (geojson.features) {
      geojson.features.forEach(feature => {
        const fuelType = feature.properties?.[fuelProperty] || 1;
        
        if (feature.geometry) {
          if (feature.geometry.type === 'Polygon') {
            this._rasterizePolygon(feature.geometry.coordinates[0], fuelType, fuelGrid);
          } else if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates.forEach(ring => {
              this._rasterizePolygon(ring[0], fuelType, fuelGrid);
            });
          }
        }
      });
    }
    
    return {
      type: 'fuelGrid',
      data: fuelGrid,
      bounds: this._calculateBounds(geojson)
    };
  }

  _rasterizePolygon(coordinates, fuelType, fuelGrid) {
    const resolution = 0.0001;
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    coordinates.forEach(coord => {
      minX = Math.min(minX, coord[0]);
      maxX = Math.max(maxX, coord[0]);
      minY = Math.min(minY, coord[1]);
      maxY = Math.max(maxY, coord[1]);
    });
    
    for (let x = minX; x <= maxX; x += resolution) {
      for (let y = minY; y <= maxY; y += resolution) {
        if (this._pointInPolygon([x, y], coordinates)) {
          const key = `${x.toFixed(6)}_${y.toFixed(6)}`;
          fuelGrid.set(key, fuelType);
        }
      }
    }
  }

  _pointInPolygon(point, polygon) {
    let inside = false;
    const [x, y] = point;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  _calculateBounds(geojson) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    const processCoordinates = (coords) => {
      if (typeof coords[0] === 'number') {
        minX = Math.min(minX, coords[0]);
        maxX = Math.max(maxX, coords[0]);
        minY = Math.min(minY, coords[1]);
        maxY = Math.max(maxY, coords[1]);
      } else {
        coords.forEach(processCoordinates);
      }
    };
    
    if (geojson.features) {
      geojson.features.forEach(feature => {
        if (feature.geometry) {
          processCoordinates(feature.geometry.coordinates);
        }
      });
    }
    
    return { minX, maxX, minY, maxY };
  }

  createWMSUrl(engine, options = {}) {
    const extent = this._getEngineExtent(engine);
    
    const params = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.3.0',
      REQUEST: 'GetMap',
      LAYERS: options.layer || 'fire_boundary',
      CRS: 'EPSG:4326',
      BBOX: `${extent.minY},${extent.minX},${extent.maxY},${extent.maxX}`,
      WIDTH: options.width || 1024,
      HEIGHT: options.height || 1024,
      FORMAT: 'image/png',
      STYLES: options.styles || '',
      TIME: options.time || new Date().toISOString()
    });
    
    return `${this.options.geoserverUrl || '/geoserver'}/wms?${params}`;
  }

  createWFSUrl(options = {}) {
    const params = new URLSearchParams({
      SERVICE: 'WFS',
      VERSION: '2.0.0',
      REQUEST: 'GetFeature',
      TYPENAME: options.typeName || 'fire:boundary',
      OUTPUTFORMAT: 'application/json',
      SRSNAME: 'EPSG:4326'
    });
    
    if (options.bbox) {
      params.set('BBOX', options.bbox.join(','));
    }
    
    if (options.filter) {
      params.set('FILTER', options.filter);
    }
    
    return `${this.options.geoserverUrl || '/geoserver'}/wfs?${params}`;
  }

  _getEngineExtent(engine) {
    const boundary = engine.getBoundary();
    
    if (!boundary || boundary.length === 0) {
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    boundary.forEach(p => {
      minX = Math.min(minX, p.lon);
      maxX = Math.max(maxX, p.lon);
      minY = Math.min(minY, p.lat);
      maxY = Math.max(maxY, p.lat);
    });
    
    const padding = 0.01;
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding
    };
  }

  async exportToQGIS(engine, options = {}) {
    const boundary = engine.getBoundary();
    const statistics = engine.getStatistics();
    
    const qgisProject = `<!DOCTYPE qgis PUBLIC 'http://mrcc.com/qgis.dtd' 'SYSTEM'>
<QGIS version="3.28" projectname="Fire Simulation">
  <title>Fire Simulation Result</title>
  <projectlayers>
    <maplayer>
      <id>fire_boundary_${Date.now()}</id>
      <layername>Fire Boundary</layername>
      <srs>
        <spatialrefsys>
          <authid>EPSG:4326</authid>
        </spatialrefsys>
      </srs>
      <provider>memory</provider>
      <vectorjoins/>
      <layerDependencies/>
      <expressionfields/>
    </maplayer>
  </projectlayers>
</QGIS>`;
    
    return {
      project: qgisProject,
      geojson: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [boundary.map(p => [p.lon, p.lat])]
          },
          properties: statistics
        }]
      }
    };
  }

  destroy() {
    this.services.clear();
    this.removeAllListeners();
  }
}

export default GISConnector;

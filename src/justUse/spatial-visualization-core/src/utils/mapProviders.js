/**
 * 地图服务提供商配置
 * 支持多种高分辨率地图服务，包含3D地形和建筑
 */

import * as Cesium from 'cesium';

export const MapProviders = {
  NATURAL_EARTH: {
    name: 'Natural Earth II (默认离线)',
    maxZoom: 6,
    create: async () => {
      return await Cesium.TileMapServiceImageryProvider.fromUrl(
        Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
      );
    }
  },

  LOCAL_TILES: {
    name: '本地地图切片',
    maxZoom: 18,
    create: async () => {
      return new Cesium.UrlTemplateImageryProvider({
        url: '/tiles/{z}/{x}/{y}.png',
        fileExtension: 'png'
      });
    }
  },

  OPENSTREETMAP: {
    name: 'OpenStreetMap',
    maxZoom: 19,
    create: async () => {
      return await Cesium.OpenStreetMapImageryProvider.fromUrl(
        'https://a.tile.openstreetmap.org/'
      );
    }
  },

  ARCGIS_IMAGERY: {
    name: 'ArcGIS 卫星影像',
    maxZoom: 19,
    create: async () => {
      return await Cesium.ArcGisMapServerImageryProvider.fromUrl(
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
      );
    }
  },

  ARCGIS_STREET: {
    name: 'ArcGIS 街道地图',
    maxZoom: 19,
    create: async () => {
      return await Cesium.ArcGisMapServerImageryProvider.fromUrl(
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer'
      );
    }
  },

  ARCGIS_TOPO: {
    name: 'ArcGIS 地形图',
    maxZoom: 19,
    create: async () => {
      return await Cesium.ArcGisMapServerImageryProvider.fromUrl(
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer'
      );
    }
  },

  CARTO_DARK: {
    name: 'CartoDB 暗色主题',
    maxZoom: 18,
    create: async () => {
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
      });
    }
  },

  CARTO_VOYAGER: {
    name: 'CartoDB Voyager',
    maxZoom: 18,
    create: async () => {
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
      });
    }
  },

  TIANDITU_IMG: {
    name: '天地图卫星影像',
    maxZoom: 18,
    create: async () => {
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://t{s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=4edc21dcea50d284398875be1bb2f7d9',
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        credit: new Cesium.Credit('天地图')
      });
    }
  },

  TIANDITU_VEC: {
    name: '天地图矢量地图',
    maxZoom: 18,
    create: async () => {
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://t{s}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=4edc21dcea50d284398875be1bb2f7d9',
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        credit: new Cesium.Credit('天地图')
      });
    }
  },

  NASA_GIBS: {
    name: 'NASA GIBS 卫星影像',
    maxZoom: 9,
    create: async () => {
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
        credit: new Cesium.Credit('NASA GIBS')
      });
    }
  },

  STAMEN_TERRAIN: {
    name: 'Stamen 地形图',
    maxZoom: 18,
    create: async () => {
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png',
        credit: new Cesium.Credit('Stadia Maps')
      });
    }
  }
};

export const TerrainProviders = {
  NONE: {
    name: '无地形（平面）',
    create: async () => {
      return new Cesium.EllipsoidTerrainProvider();
    }
  },
  
  CESIUM_WORLD: {
    name: 'Cesium World Terrain',
    create: async () => {
      try {
        return await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
      } catch (e) {
        console.warn('[Terrain] Cesium World Terrain 加载失败，使用平面地形');
        return new Cesium.EllipsoidTerrainProvider();
      }
    }
  },

  LOCAL_TERRAIN: {
    name: '本地地形切片',
    create: async () => {
      return new Cesium.CesiumTerrainProvider({
        url: '/terrain/'
      });
    }
  }
};

export async function createMapProvider(providerKey) {
  console.log('[MapProvider] 尝试加载地图:', providerKey);
  
  const provider = MapProviders[providerKey];
  if (!provider) {
    console.warn('[MapProvider] 未知的地图提供商，使用 Natural Earth');
    return await MapProviders.NATURAL_EARTH.create();
  }
  
  try {
    const result = await provider.create();
    console.log('[MapProvider] 地图加载成功:', provider.name);
    return result;
  } catch (error) {
    console.error('[MapProvider] 地图加载失败:', provider.name, error);
    console.log('[MapProvider] 回退到 Natural Earth');
    return await MapProviders.NATURAL_EARTH.create();
  }
}

export async function createTerrainProvider(terrainKey = 'NONE') {
  console.log('[TerrainProvider] 尝试加载地形:', terrainKey);
  
  const provider = TerrainProviders[terrainKey];
  if (!provider) {
    return await TerrainProviders.NONE.create();
  }
  
  try {
    const result = await provider.create();
    console.log('[TerrainProvider] 地形加载成功:', provider.name);
    return result;
  } catch (error) {
    console.error('[TerrainProvider] 地形加载失败:', error);
    return await TerrainProviders.NONE.create();
  }
}

export function getProviderList() {
  return Object.keys(MapProviders).map(key => ({
    key,
    name: MapProviders[key].name,
    maxZoom: MapProviders[key].maxZoom
  }));
}

export function getTerrainList() {
  return Object.keys(TerrainProviders).map(key => ({
    key,
    name: TerrainProviders[key].name
  }));
}

export const DEFAULT_PROVIDER = 'NATURAL_EARTH';
export const DEFAULT_TERRAIN = 'NONE';

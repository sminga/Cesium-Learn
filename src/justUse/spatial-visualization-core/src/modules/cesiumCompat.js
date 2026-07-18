export function defined(value) {
  return value !== undefined && value !== null;
}

export function defaultValue(a, b) {
  if (a !== undefined && a !== null) {
    return a;
  }
  return b;
}

export function destroyObject(object) {
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      delete object[key];
    }
  }
}

export const Pass = {
  ENVIRONMENT: 0,
  COMPUTE: 1,
  GLOBE: 2,
  TERRAIN_CLASSIFICATION: 3,
  CESIUM_3D_TILE_EDGES: 4,
  CESIUM_3D_TILE: 5,
  CESIUM_3D_TILE_CLASSIFICATION: 6,
  CESIUM_3D_TILE_CLASSIFICATION_IGNORE_SHOW: 7,
  OPAQUE: 8,
  TRANSLUCENT: 9,
  VOXELS: 10,
  GAUSSIAN_SPLATS: 11,
  OVERLAY: 12,
  NUMBER_OF_PASSES: 13
};

/**
 * 燃料模型定义
 * @module modules/fire/FuelModels
 * @description 基于 Anderson 13 燃料模型的扩展实现
 */

export const FuelModelTypes = {
  GRASS_1: 1,      // 短草
  GRASS_2: 2,      // 木材和草地
  GRASS_3: 3,      // 高草
  SHRUB_4: 4,      // 灌木
  SHRUB_5: 5,      // 灌木
  SHRUB_6: 6,      // 灌木
  SHRUB_7: 7,      // 灌木
  TIMBER_8: 8,     // 封闭林冠
  TIMBER_9: 9,     // 封闭林冠
  TIMBER_10: 10,   // 封闭林冠
  TIMBER_11: 11,   // 轻型采伐
  TIMBER_12: 12,   // 中型采伐
  TIMBER_13: 13,   // 重型采伐
  CUSTOM: 99
};

export const FuelModels = {
  1: {
    name: '短草草地',
    nameEn: 'Short Grass',
    category: 'grass',
    baseRate: 0.4,
    moistureFactor: 0.8,
    windFactor: 1.2,
    slopeFactor: 0.5,
    flameLength: 0.8,
    heatPerUnitArea: 1500,
    description: '高度约30cm的草地，连续分布'
  },
  2: {
    name: '木材和草地',
    nameEn: 'Timber and Grass',
    category: 'mixed',
    baseRate: 0.3,
    moistureFactor: 0.7,
    windFactor: 1.0,
    slopeFactor: 0.4,
    flameLength: 1.0,
    heatPerUnitArea: 2000,
    description: '草地与散生树木混合'
  },
  3: {
    name: '高草草地',
    nameEn: 'Tall Grass',
    category: 'grass',
    baseRate: 0.5,
    moistureFactor: 0.9,
    windFactor: 1.5,
    slopeFactor: 0.6,
    flameLength: 1.5,
    heatPerUnitArea: 2500,
    description: '高度超过60cm的草地'
  },
  4: {
    name: '灌木丛',
    nameEn: 'Chaparral',
    category: 'shrub',
    baseRate: 0.6,
    moistureFactor: 0.6,
    windFactor: 0.8,
    slopeFactor: 0.7,
    flameLength: 2.5,
    heatPerUnitArea: 3000,
    description: '密集灌木丛，高度约2m'
  },
  5: {
    name: '灌木',
    nameEn: 'Brush',
    category: 'shrub',
    baseRate: 0.2,
    moistureFactor: 0.5,
    windFactor: 0.6,
    slopeFactor: 0.5,
    flameLength: 1.5,
    heatPerUnitArea: 2000,
    description: '散生灌木'
  },
  6: {
    name: '灌木林',
    nameEn: 'Dormant Brush',
    category: 'shrub',
    baseRate: 0.3,
    moistureFactor: 0.5,
    windFactor: 0.7,
    slopeFactor: 0.6,
    flameLength: 1.8,
    heatPerUnitArea: 2200,
    description: '休眠期灌木林'
  },
  7: {
    name: '灌木林地',
    nameEn: 'Southern Rough',
    category: 'shrub',
    baseRate: 0.2,
    moistureFactor: 0.4,
    windFactor: 0.5,
    slopeFactor: 0.4,
    flameLength: 1.2,
    heatPerUnitArea: 1800,
    description: '南方灌木林地'
  },
  8: {
    name: '封闭林冠',
    nameEn: 'Closed Timber Litter',
    category: 'timber',
    baseRate: 0.1,
    moistureFactor: 0.3,
    windFactor: 0.3,
    slopeFactor: 0.3,
    flameLength: 0.5,
    heatPerUnitArea: 1000,
    description: '密闭林冠，地表枯枝落叶'
  },
  9: {
    name: '硬木林',
    nameEn: 'Hardwood Litter',
    category: 'timber',
    baseRate: 0.1,
    moistureFactor: 0.3,
    windFactor: 0.4,
    slopeFactor: 0.3,
    flameLength: 0.6,
    heatPerUnitArea: 1200,
    description: '硬木林地表枯枝落叶'
  },
  10: {
    name: '针叶林',
    nameEn: 'Timber Litter',
    category: 'timber',
    baseRate: 0.2,
    moistureFactor: 0.4,
    windFactor: 0.5,
    slopeFactor: 0.4,
    flameLength: 1.0,
    heatPerUnitArea: 1500,
    description: '针叶林地表枯枝落叶'
  },
  11: {
    name: '轻型采伐地',
    nameEn: 'Light Logging Slash',
    category: 'slash',
    baseRate: 0.1,
    moistureFactor: 0.3,
    windFactor: 0.4,
    slopeFactor: 0.3,
    flameLength: 0.8,
    heatPerUnitArea: 1000,
    description: '采伐剩余物较少'
  },
  12: {
    name: '中型采伐地',
    nameEn: 'Medium Logging Slash',
    category: 'slash',
    baseRate: 0.2,
    moistureFactor: 0.4,
    windFactor: 0.5,
    slopeFactor: 0.4,
    flameLength: 1.5,
    heatPerUnitArea: 1800,
    description: '采伐剩余物中等'
  },
  13: {
    name: '重型采伐地',
    nameEn: 'Heavy Logging Slash',
    category: 'slash',
    baseRate: 0.3,
    moistureFactor: 0.5,
    windFactor: 0.6,
    slopeFactor: 0.5,
    flameLength: 2.0,
    heatPerUnitArea: 2500,
    description: '采伐剩余物较多'
  },
  99: {
    name: '自定义',
    nameEn: 'Custom',
    category: 'custom',
    baseRate: 0.3,
    moistureFactor: 0.5,
    windFactor: 0.8,
    slopeFactor: 0.5,
    flameLength: 1.0,
    heatPerUnitArea: 1500,
    description: '用户自定义燃料模型'
  }
};

export function getFuelModel(modelId) {
  return FuelModels[modelId] || FuelModels[1];
}

export function createCustomFuelModel(params) {
  return {
    ...FuelModels[99],
    ...params,
    id: 99
  };
}

export function getFuelModelsByCategory(category) {
  return Object.entries(FuelModels)
    .filter(([_, model]) => model.category === category)
    .map(([id, model]) => ({ id: parseInt(id), ...model }));
}

export function listFuelModels() {
  return Object.entries(FuelModels).map(([id, model]) => ({
    id: parseInt(id),
    ...model
  }));
}

export default {
  FuelModelTypes,
  FuelModels,
  getFuelModel,
  createCustomFuelModel,
  getFuelModelsByCategory,
  listFuelModels
};

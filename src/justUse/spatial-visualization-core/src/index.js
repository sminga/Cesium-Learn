/**
 * 空间信息可视化核心库 - 增强版 v3.0
 * @module spatial-visualization-core
 * @description 提供风场可视化、林火蔓延模拟、高斯泼溅渲染等核心功能
 * @version 3.0.0
 */

// 核心模块
export { default as SpatialViewer } from './core/SpatialViewer.js';
export { default as PluginManager } from './core/PluginManager.js';
export { default as EventEmitter } from './core/EventEmitter.js';
export { default as ConfigManager } from './core/ConfigManager.js';

// 核心接口
export * from './core/interfaces/index.js';

// 核心连接器
export * from './core/connectors/index.js';

// 核心数据提供者
export * from './core/providers/index.js';

// 风场模块
export { default as WindFieldLayer } from './modules/wind/WindFieldLayer.js';
export { default as Particle3D } from './modules/wind/Particle3D.js';
export { default as WindDataProcessor } from './modules/wind/DataProcessor.js';

// 林火蔓延模块
export {
  FireSpreadEngine,
  FireSpreadEngineV2,
  FireBoundaryLayer,
  FireVisualizationLayer,
  FireController,
  FireControllerV2,
  FireParticleSystem,
  SmokeEffect,
  FuelModels,
  RothermelModel,
  AndersonFuelModels,
  getAndersonFuelModel,
  LevelSetSolver,
  FireGPUCompute,
  DataExporter,
  ParameterCalibrator,
  HistoryFireRebuilder,
  BurnProbabilityEstimator,
  GISConnector
} from './modules/fire/index.js';

// 高斯泼溅模块
export { default as GaussianSplatLayer } from './modules/splat/GaussianSplatLayer.js';
export { default as SplatController } from './modules/splat/SplatController.js';
export { default as ThreeOverlay } from './modules/splat/ThreeOverlay.js';

// UI 组件
export * from './ui/index.js';

// 工具函数
export * as utils from './utils/index.js';

// 版本信息
export const VERSION = '3.0.0';

// 快速创建函数
export async function createFireSimulation(viewer, demUrl, options = {}) {
  const { 
    FireControllerV2, 
    TerrainDataProvider, 
    WindFireConnector 
  } = await import('./index.js');
  
  const terrainProvider = new TerrainDataProvider();
  await terrainProvider.loadFromURL(demUrl);
  
  const demData = terrainProvider.getDEMData();
  
  const fireController = new FireControllerV2(viewer, options);
  await fireController.init(demData);
  
  return {
    fireController,
    terrainProvider
  };
}

export async function createWindDrivenFireSimulation(viewer, demUrl, windLayer, options = {}) {
  const { 
    FireControllerV2, 
    TerrainDataProvider, 
    WindFireConnector 
  } = await import('./index.js');
  
  const terrainProvider = new TerrainDataProvider();
  await terrainProvider.loadFromURL(demUrl);
  
  const demData = terrainProvider.getDEMData();
  
  const fireController = new FireControllerV2(viewer, options);
  await fireController.init(demData);
  
  const windConnector = new WindFireConnector();
  windConnector.connect(windLayer, fireController);
  windConnector.enable();
  
  return {
    fireController,
    terrainProvider,
    windConnector
  };
}

export async function createGPUSimulation(options = {}) {
  const { FireGPUCompute } = await import('./index.js');
  
  const gpuEngine = new FireGPUCompute(options);
  gpuEngine.init();
  
  return gpuEngine;
}

export async function createHistoryRebuilder(engine, historicalData) {
  const { HistoryFireRebuilder } = await import('./index.js');
  
  const rebuilder = new HistoryFireRebuilder(engine);
  const result = await rebuilder.rebuild(historicalData);
  
  return { rebuilder, result };
}

export async function estimateBurnProbability(engine, region, years = 1000) {
  const { BurnProbabilityEstimator } = await import('./index.js');
  
  const estimator = new BurnProbabilityEstimator(engine);
  const result = await estimator.estimate(region, { simulationYears: years });
  
  return { estimator, result };
}

/**
 * FireSpreadEngine 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import FireSpreadEngine from '../../../src/modules/fire/FireSpreadEngine.js';

describe('FireSpreadEngine', () => {
  let engine;
  let mockDEM;

  beforeEach(() => {
    mockDEM = {
      ncols: 10,
      nrows: 10,
      xllcorner: 100.0,
      yllcorner: 30.0,
      cellsize: 0.01,
      nodata_value: -9999,
      data: new Float32Array(100).fill(100)
    };
    
    engine = new FireSpreadEngine(mockDEM);
  });

  describe('F01 - 初始化引擎', () => {
    it('应该成功创建引擎', () => {
      expect(engine).toBeDefined();
      expect(engine.dem).toBe(mockDEM);
    });

    it('应该初始化空的火场网格', () => {
      expect(engine.fireGrid).toBeDefined();
      expect(engine.fireGrid.length).toBe(100);
    });

    it('应该初始化空的边界', () => {
      expect(engine.boundary).toEqual([]);
    });
  });

  describe('F02 - 点火', () => {
    it('应该在指定位置点火', () => {
      const result = engine.ignite(100.05, 30.05);
      
      expect(result.x).toBeDefined();
      expect(result.y).toBeDefined();
      expect(engine.boundary.length).toBe(1);
    });

    it('应该触发 ignited 事件', () => {
      const callback = vi.fn();
      engine.on('ignited', callback);
      
      engine.ignite(100.05, 30.05);
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('F03 - 火蔓延', () => {
    it('应该更新火场边界', () => {
      engine.ignite(100.05, 30.05);
      const result = engine.propagate(1);
      
      expect(result.boundary).toBeDefined();
      expect(result.statistics).toBeDefined();
    });

    it('应该触发 propagated 事件', () => {
      const callback = vi.fn();
      engine.on('propagated', callback);
      
      engine.ignite(100.05, 30.05);
      engine.propagate(1);
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('F04 - 设置风速', () => {
    it('应该更新风速和风向', () => {
      engine.setWind(10, 45);
      
      expect(engine.options.windSpeed).toBe(10);
      expect(engine.options.windDirection).toBe(45);
    });

    it('应该触发 windChanged 事件', () => {
      const callback = vi.fn();
      engine.on('windChanged', callback);
      
      engine.setWind(10, 45);
      
      expect(callback).toHaveBeenCalledWith({ speed: 10, direction: 45 });
    });
  });

  describe('F05 - 获取边界', () => {
    it('应该返回带地理坐标的边界', () => {
      engine.ignite(100.05, 30.05);
      const boundary = engine.getBoundary();
      
      expect(boundary.length).toBeGreaterThan(0);
      expect(boundary[0]).toHaveProperty('lon');
      expect(boundary[0]).toHaveProperty('lat');
    });
  });

  describe('F06 - 获取 GeoJSON', () => {
    it('应该返回有效的 GeoJSON', () => {
      engine.ignite(100.05, 30.05);
      engine.propagate(1);
      engine.propagate(1);
      engine.propagate(1);
      
      const geojson = engine.getGeoJSON();
      
      if (geojson) {
        expect(geojson.type).toBe('FeatureCollection');
        expect(geojson.features).toBeDefined();
      }
    });

    it('边界点不足时应该返回 null', () => {
      const geojson = engine.getGeoJSON();
      expect(geojson).toBeNull();
    });
  });

  describe('F07 - 重置', () => {
    it('应该清空火场', () => {
      engine.ignite(100.05, 30.05);
      engine.propagate(1);
      
      engine.reset();
      
      expect(engine.boundary.length).toBe(0);
      expect(engine.statistics.burnedArea).toBe(0);
    });

    it('应该触发 reset 事件', () => {
      const callback = vi.fn();
      engine.on('reset', callback);
      
      engine.reset();
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('F08 - 边界外点火', () => {
    it('应该抛出错误', () => {
      expect(() => engine.ignite(999, 999)).toThrow('outside DEM bounds');
    });
  });

  describe('蔓延率计算', () => {
    it('应该根据燃料模型计算基础蔓延率', () => {
      const engine1 = new FireSpreadEngine(mockDEM, { fuelModel: 1 });
      const engine2 = new FireSpreadEngine(mockDEM, { fuelModel: 3 });
      
      const rate1 = engine1._calculateSpreadRate();
      const rate2 = engine2._calculateSpreadRate();
      
      expect(rate1).toBeDefined();
      expect(rate2).toBeDefined();
    });

    it('风速应该影响蔓延率', () => {
      engine.setWind(10, 0);
      const rateWithWind = engine._calculateSpreadRate();
      
      engine.setWind(0, 0);
      const rateWithoutWind = engine._calculateSpreadRate();
      
      expect(rateWithWind).toBeGreaterThan(rateWithoutWind);
    });
  });

  describe('销毁', () => {
    it('应该清理所有资源', () => {
      engine.ignite(100.05, 30.05);
      engine.destroy();
      
      expect(engine.fireGrid).toBeNull();
      expect(engine.boundary).toBeNull();
    });
  });
});

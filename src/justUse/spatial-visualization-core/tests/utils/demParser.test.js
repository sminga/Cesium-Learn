/**
 * demParser 单元测试
 */

import { describe, it, expect } from 'vitest';
import { parseDEM, getElevationAt, getDEMExtent } from '../../src/utils/demParser.js';

describe('demParser', () => {
  const sampleDEM = `ncols         5
nrows         5
xllcorner     100.0
yllcorner     30.0
cellsize      0.01
NODATA_value  -9999
100 101 102 103 104
105 106 107 108 109
110 111 112 113 114
115 116 117 118 119
120 121 122 123 124`;

  describe('D01 - 解析 DEM', () => {
    it('应该正确解析 DEM 头部', () => {
      const dem = parseDEM(sampleDEM);
      
      expect(dem.ncols).toBe(5);
      expect(dem.nrows).toBe(5);
      expect(dem.xllcorner).toBe(100.0);
      expect(dem.yllcorner).toBe(30.0);
      expect(dem.cellsize).toBe(0.01);
    });

    it('应该正确解析高程数据', () => {
      const dem = parseDEM(sampleDEM);
      
      expect(dem.data.length).toBe(25);
      expect(dem.data[0]).toBe(100);
      expect(dem.data[24]).toBe(124);
    });

    it('应该正确处理 NODATA_value', () => {
      const dem = parseDEM(sampleDEM);
      expect(dem.nodata_value).toBe(-9999);
    });
  });

  describe('D02 - 获取高程', () => {
    it('应该返回正确的高程值', () => {
      const dem = parseDEM(sampleDEM);
      
      const elevation = getElevationAt(dem, 100.0, 30.0);
      expect(elevation).toBe(100);
    });

    it('应该返回中间位置的高程', () => {
      const dem = parseDEM(sampleDEM);
      
      const elevation = getElevationAt(dem, 100.02, 30.02);
      expect(elevation).toBe(106);
    });
  });

  describe('D03 - 获取范围', () => {
    it('应该返回正确的边界', () => {
      const dem = parseDEM(sampleDEM);
      const extent = getDEMExtent(dem);
      
      expect(extent.minLon).toBe(100.0);
      expect(extent.maxLon).toBe(100.05);
      expect(extent.minLat).toBe(30.0);
      expect(extent.maxLat).toBe(30.05);
    });
  });

  describe('D04 - 边界外查询', () => {
    it('应该返回 null', () => {
      const dem = parseDEM(sampleDEM);
      
      expect(getElevationAt(dem, 999, 999)).toBeNull();
      expect(getElevationAt(dem, -1, -1)).toBeNull();
    });
  });
});

/**
 * mathUtils 单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  degToRad,
  radToDeg,
  clamp,
  lerp,
  smoothstep,
  distance2D,
  distance3D,
  normalizeAngle,
  angleDifference,
  bilinearInterpolate,
  gaussianRandom
} from '../../src/utils/mathUtils.js';

describe('mathUtils', () => {
  describe('M01 - 角度转弧度', () => {
    it('应该正确转换 180 度', () => {
      expect(degToRad(180)).toBeCloseTo(Math.PI);
    });

    it('应该正确转换 90 度', () => {
      expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
    });

    it('应该正确转换 0 度', () => {
      expect(degToRad(0)).toBe(0);
    });

    it('应该正确转换负角度', () => {
      expect(degToRad(-90)).toBeCloseTo(-Math.PI / 2);
    });
  });

  describe('M02 - 弧度转角度', () => {
    it('应该正确转换 π', () => {
      expect(radToDeg(Math.PI)).toBeCloseTo(180);
    });

    it('应该正确转换 π/2', () => {
      expect(radToDeg(Math.PI / 2)).toBeCloseTo(90);
    });

    it('应该正确转换 0', () => {
      expect(radToDeg(0)).toBe(0);
    });
  });

  describe('M03 - 数值限制', () => {
    it('应该在范围内时返回原值', () => {
      expect(clamp(50, 0, 100)).toBe(50);
    });

    it('应该限制到最大值', () => {
      expect(clamp(150, 0, 100)).toBe(100);
    });

    it('应该限制到最小值', () => {
      expect(clamp(-10, 0, 100)).toBe(0);
    });
  });

  describe('M04 - 线性插值', () => {
    it('应该在中间点正确插值', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
    });

    it('t=0 时应该返回起点', () => {
      expect(lerp(0, 10, 0)).toBe(0);
    });

    it('t=1 时应该返回终点', () => {
      expect(lerp(0, 10, 1)).toBe(10);
    });
  });

  describe('smoothstep', () => {
    it('在边界内应该平滑插值', () => {
      expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
    });

    it('小于下边界应该返回 0', () => {
      expect(smoothstep(0, 1, -1)).toBe(0);
    });

    it('大于上边界应该返回 1', () => {
      expect(smoothstep(0, 1, 2)).toBe(1);
    });
  });

  describe('M05 - 2D 距离', () => {
    it('应该计算正确的距离', () => {
      expect(distance2D(0, 0, 3, 4)).toBe(5);
    });

    it('相同点距离应该为 0', () => {
      expect(distance2D(5, 5, 5, 5)).toBe(0);
    });
  });

  describe('distance3D', () => {
    it('应该计算正确的 3D 距离', () => {
      expect(distance3D(0, 0, 0, 1, 2, 2)).toBeCloseTo(3);
    });
  });

  describe('M06 - 角度归一化', () => {
    it('应该归一化大于 360 的角度', () => {
      expect(normalizeAngle(370)).toBe(10);
    });

    it('应该归一化负角度', () => {
      expect(normalizeAngle(-10)).toBe(350);
    });

    it('0-360 内的角度应该不变', () => {
      expect(normalizeAngle(180)).toBe(180);
    });
  });

  describe('angleDifference', () => {
    it('应该计算正确的角度差', () => {
      expect(angleDifference(0, 90)).toBe(90);
    });

    it('应该返回最短路径', () => {
      expect(angleDifference(0, 270)).toBe(-90);
    });
  });

  describe('bilinearInterpolate', () => {
    it('应该正确进行双线性插值', () => {
      const values = {
        x0: 0, x1: 1,
        y0: 0, y1: 1,
        v00: 0, v10: 1,
        v01: 1, v11: 2
      };
      
      expect(bilinearInterpolate(0.5, 0.5, values)).toBeCloseTo(1);
    });
  });

  describe('gaussianRandom', () => {
    it('应该生成随机数', () => {
      const values = [];
      for (let i = 0; i < 100; i++) {
        values.push(gaussianRandom(0, 1));
      }
      
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      expect(Math.abs(mean)).toBeLessThan(0.5);
    });
  });
});

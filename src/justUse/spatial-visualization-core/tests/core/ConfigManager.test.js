/**
 * ConfigManager 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConfigManager from '../../src/core/ConfigManager.js';

describe('ConfigManager', () => {
  let config;

  beforeEach(() => {
    config = new ConfigManager({
      app: {
        name: 'TestApp',
        version: '1.0.0'
      },
      settings: {
        theme: 'dark',
        language: 'zh-CN'
      }
    });
  });

  describe('C01 - 获取配置', () => {
    it('应该返回顶层配置值', () => {
      expect(config.get('app')).toEqual({
        name: 'TestApp',
        version: '1.0.0'
      });
    });

    it('应该返回嵌套配置值', () => {
      expect(config.get('app.name')).toBe('TestApp');
      expect(config.get('settings.theme')).toBe('dark');
    });

    it('不存在的键应该返回 undefined', () => {
      expect(config.get('nonexistent')).toBeUndefined();
    });
  });

  describe('C02 - 设置配置', () => {
    it('应该设置顶层配置值', () => {
      config.set('newKey', 'newValue');
      expect(config.get('newKey')).toBe('newValue');
    });

    it('应该设置嵌套配置值', () => {
      config.set('app.name', 'NewApp');
      expect(config.get('app.name')).toBe('NewApp');
    });

    it('应该创建不存在的嵌套路径', () => {
      config.set('a.b.c.d', 'deep');
      expect(config.get('a.b.c.d')).toBe('deep');
    });
  });

  describe('C03 - 嵌套配置', () => {
    it('应该正确处理深层嵌套', () => {
      config.set('level1.level2.level3.value', 'deep');
      expect(config.get('level1.level2.level3.value')).toBe('deep');
    });
  });

  describe('C04 - 默认值', () => {
    it('不存在的键应该返回默认值', () => {
      expect(config.get('missing', 'default')).toBe('default');
    });

    it('存在的键应该返回实际值', () => {
      expect(config.get('app.name', 'default')).toBe('TestApp');
    });
  });

  describe('C05 - 监听配置变化', () => {
    it('应该在配置变化时触发回调', () => {
      const callback = vi.fn();
      config.watch('app.name', callback);
      
      config.set('app.name', 'NewApp');
      
      expect(callback).toHaveBeenCalledWith('NewApp', 'TestApp', 'app.name');
    });

    it('应该返回取消订阅函数', () => {
      const callback = vi.fn();
      const unsubscribe = config.watch('test', callback);
      
      unsubscribe();
      config.set('test', 'value');
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('C06 - 批量更新', () => {
    it('应该合并配置', () => {
      config.update({
        app: { name: 'UpdatedApp' },
        newSection: { key: 'value' }
      });
      
      expect(config.get('app.name')).toBe('UpdatedApp');
      expect(config.get('app.version')).toBe('1.0.0');
      expect(config.get('newSection.key')).toBe('value');
    });
  });

  describe('toJSON', () => {
    it('应该返回配置的深拷贝', () => {
      const json = config.toJSON();
      
      json.app.name = 'Modified';
      
      expect(config.get('app.name')).toBe('TestApp');
    });
  });

  describe('reset', () => {
    it('应该重置配置', () => {
      config.set('app.name', 'Modified');
      config.reset({ app: { name: 'ResetApp' } });
      
      expect(config.get('app.name')).toBe('ResetApp');
    });
  });
});

/**
 * PluginManager 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import PluginManager from '../../src/core/PluginManager.js';

describe('PluginManager', () => {
  let manager;

  beforeEach(() => {
    manager = new PluginManager();
  });

  describe('注册插件', () => {
    it('应该成功注册插件', () => {
      const plugin = { name: 'test-plugin' };
      const result = manager.register(plugin);
      
      expect(result).toBe(true);
      expect(manager.hasPlugin('test-plugin')).toBe(true);
    });

    it('没有名称的插件应该抛出错误', () => {
      const plugin = {};
      
      expect(() => manager.register(plugin)).toThrow('Plugin must have a name');
    });

    it('重复注册应该返回 false', () => {
      const plugin = { name: 'test-plugin' };
      manager.register(plugin);
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = manager.register(plugin);
      
      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('注销插件', () => {
    it('应该成功注销插件', () => {
      const plugin = { name: 'test-plugin' };
      manager.register(plugin);
      
      const result = manager.unregister('test-plugin');
      
      expect(result).toBe(true);
      expect(manager.hasPlugin('test-plugin')).toBe(false);
    });

    it('注销不存在的插件应该返回 false', () => {
      const result = manager.unregister('nonexistent');
      expect(result).toBe(false);
    });

    it('应该调用插件的 destroy 方法', () => {
      const plugin = { name: 'test-plugin', destroy: vi.fn() };
      manager.register(plugin);
      manager.unregister('test-plugin');
      
      expect(plugin.destroy).toHaveBeenCalled();
    });
  });

  describe('钩子系统', () => {
    it('应该添加钩子', () => {
      const handler = vi.fn();
      manager.addHook('init', handler);
      
      manager.executeHook('init', 'arg1', 'arg2');
      
      expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('应该移除钩子', () => {
      const handler = vi.fn();
      manager.addHook('init', handler);
      manager.removeHook('init', handler);
      
      manager.executeHook('init');
      
      expect(handler).not.toHaveBeenCalled();
    });

    it('插件注册时应该自动添加钩子', async () => {
      const handler = vi.fn();
      const plugin = {
        name: 'hook-plugin',
        hooks: {
          'test-hook': handler
        }
      };
      
      manager.register(plugin);
      await manager.executeHook('test-hook', 'data');
      
      expect(handler).toHaveBeenCalledWith('data');
    });
  });

  describe('获取插件', () => {
    it('应该返回指定插件', () => {
      const plugin = { name: 'test-plugin' };
      manager.register(plugin);
      
      expect(manager.getPlugin('test-plugin')).toBe(plugin);
    });

    it('不存在的插件应该返回 undefined', () => {
      expect(manager.getPlugin('nonexistent')).toBeUndefined();
    });
  });

  describe('列出插件', () => {
    it('应该返回所有插件名称', () => {
      manager.register({ name: 'plugin1' });
      manager.register({ name: 'plugin2' });
      
      const list = manager.listPlugins();
      
      expect(list).toContain('plugin1');
      expect(list).toContain('plugin2');
    });
  });

  describe('销毁', () => {
    it('应该清理所有资源', () => {
      manager.register({ name: 'plugin1' });
      manager.addHook('test', () => {});
      
      manager.destroy();
      
      expect(manager.plugins.size).toBe(0);
      expect(manager.hooks.size).toBe(0);
    });
  });
});

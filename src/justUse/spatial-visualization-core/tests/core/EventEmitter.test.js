/**
 * EventEmitter 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventEmitter from '../../src/core/EventEmitter.js';

describe('EventEmitter', () => {
  let emitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe('E01 - 订阅事件', () => {
    it('应该成功添加事件监听器', () => {
      const callback = vi.fn();
      emitter.on('test', callback);
      
      expect(emitter.listenerCount('test')).toBe(1);
    });

    it('应该返回取消订阅函数', () => {
      const callback = vi.fn();
      const unsubscribe = emitter.on('test', callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
      expect(emitter.listenerCount('test')).toBe(0);
    });
  });

  describe('E02 - 触发事件', () => {
    it('应该调用所有监听器', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      emitter.on('test', callback1);
      emitter.on('test', callback2);
      emitter.emit('test', 'data');
      
      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');
    });

    it('应该传递多个参数', () => {
      const callback = vi.fn();
      emitter.on('test', callback);
      emitter.emit('test', 'arg1', 'arg2', 'arg3');
      
      expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });
  });

  describe('E03 - 取消订阅', () => {
    it('应该移除指定监听器', () => {
      const callback = vi.fn();
      emitter.on('test', callback);
      emitter.off('test', callback);
      
      emitter.emit('test');
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('应该只移除匹配的监听器', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      emitter.on('test', callback1);
      emitter.on('test', callback2);
      emitter.off('test', callback1);
      
      emitter.emit('test');
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('E04 - 单次订阅', () => {
    it('应该只触发一次', () => {
      const callback = vi.fn();
      emitter.once('test', callback);
      
      emitter.emit('test', 'first');
      emitter.emit('test', 'second');
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('first');
    });
  });

  describe('E05 - 移除所有监听器', () => {
    it('应该移除指定事件的所有监听器', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      emitter.on('test', callback1);
      emitter.on('test', callback2);
      emitter.removeAllListeners('test');
      
      emitter.emit('test');
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('应该移除所有事件的监听器', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      emitter.on('test1', callback1);
      emitter.on('test2', callback2);
      emitter.removeAllListeners();
      
      emitter.emit('test1');
      emitter.emit('test2');
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('E06 - 无监听器时触发', () => {
    it('应该不抛出错误', () => {
      expect(() => emitter.emit('no-listener')).not.toThrow();
    });
  });

  describe('异常处理', () => {
    it('应该捕获监听器中的错误', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorCallback = () => { throw new Error('Test error'); };
      const normalCallback = vi.fn();
      
      emitter.on('test', errorCallback);
      emitter.on('test', normalCallback);
      emitter.emit('test');
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});

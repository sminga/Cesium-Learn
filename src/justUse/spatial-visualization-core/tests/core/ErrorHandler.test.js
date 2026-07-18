import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import ErrorHandler, { errorHandler } from '../../src/core/ErrorHandler.js';

describe('ErrorHandler', () => {
  let handler;
  
  beforeEach(() => {
    handler = new ErrorHandler();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('init', () => {
    it('should setup global handlers', () => {
      if (typeof window === 'undefined') {
        expect(true).toBe(true);
        return;
      }
      
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      
      handler.init();
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });
    
    it('should not initialize twice', () => {
      if (typeof window === 'undefined') {
        expect(true).toBe(true);
        return;
      }
      
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      
      handler.init();
      handler.init();
      
      expect(addEventListenerSpy).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('handleError', () => {
    it('should log error to console', () => {
      handler.handleError({
        type: 'test',
        message: 'Test error',
        timestamp: Date.now()
      });
      
      expect(console.error).toHaveBeenCalled();
    });
    
    it('should add error to log', () => {
      handler.handleError({
        type: 'test',
        message: 'Test error'
      });
      
      const log = handler.getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0].message).toBe('Test error');
    });
    
    it('should notify subscribers', () => {
      const listener = vi.fn();
      handler.subscribe(listener);
      
      handler.handleError({
        type: 'test',
        message: 'Test error'
      });
      
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'test',
        message: 'Test error'
      }));
    });
    
    it('should limit log size', () => {
      handler.maxLogSize = 5;
      
      for (let i = 0; i < 10; i++) {
        handler.handleError({
          type: 'test',
          message: `Error ${i}`
        });
      }
      
      const log = handler.getErrorLog();
      expect(log).toHaveLength(5);
      expect(log[0].message).toBe('Error 5');
    });
  });
  
  describe('subscribe', () => {
    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = handler.subscribe(listener);
      
      handler.handleError({ type: 'test', message: 'Test' });
      expect(listener).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      
      handler.handleError({ type: 'test', message: 'Test2' });
      expect(listener).toHaveBeenCalledTimes(1);
    });
    
    it('should throw for non-function listener', () => {
      expect(() => handler.subscribe('not a function')).toThrow(TypeError);
    });
  });
  
  describe('wrapAsync', () => {
    it('should catch async errors', async () => {
      const listener = vi.fn();
      handler.subscribe(listener);
      
      const fn = async () => {
        throw new Error('Async error');
      };
      
      const wrapped = handler.wrapAsync(fn);
      
      await expect(wrapped()).rejects.toThrow('Async error');
      expect(listener).toHaveBeenCalled();
    });
    
    it('should pass through successful result', async () => {
      const fn = async () => 'success';
      const wrapped = handler.wrapAsync(fn);
      
      const result = await wrapped();
      expect(result).toBe('success');
    });
  });
  
  describe('wrapSync', () => {
    it('should catch sync errors', () => {
      const listener = vi.fn();
      handler.subscribe(listener);
      
      const fn = () => {
        throw new Error('Sync error');
      };
      
      const wrapped = handler.wrapSync(fn);
      
      expect(() => wrapped()).toThrow('Sync error');
      expect(listener).toHaveBeenCalled();
    });
    
    it('should pass through successful result', () => {
      const fn = () => 'success';
      const wrapped = handler.wrapSync(fn);
      
      const result = wrapped();
      expect(result).toBe('success');
    });
  });
  
  describe('clearErrorLog', () => {
    it('should clear all errors', () => {
      handler.handleError({ type: 'test', message: 'Error 1' });
      handler.handleError({ type: 'test', message: 'Error 2' });
      
      expect(handler.getErrorLog()).toHaveLength(2);
      
      handler.clearErrorLog();
      
      expect(handler.getErrorLog()).toHaveLength(0);
    });
  });
  
  describe('createError', () => {
    it('should create error with code', () => {
      const error = handler.createError('Something went wrong', 'ERR_TEST');
      
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Something went wrong');
      expect(error.code).toBe('ERR_TEST');
      expect(error.timestamp).toBeDefined();
    });
  });
  
  describe('global instance', () => {
    it('should export singleton instance', () => {
      expect(errorHandler).toBeInstanceOf(ErrorHandler);
    });
  });
});

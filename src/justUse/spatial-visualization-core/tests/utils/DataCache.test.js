import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import DataCache, { windDataCache, modelDataCache } from '../../src/utils/DataCache.js';

describe('DataCache', () => {
  let cache;
  
  beforeEach(() => {
    cache = new DataCache({ maxSize: 3, ttl: 100 });
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('set and get', () => {
    it('should store and retrieve data', () => {
      cache.set('key1', { data: 'value1' });
      expect(cache.get('key1')).toEqual({ data: 'value1' });
    });
    
    it('should return null for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });
    
    it('should update existing key', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });
  
  describe('LRU eviction', () => {
    it('should evict least recently used item when full', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toEqual('value2');
      expect(cache.get('key3')).toEqual('value3');
      expect(cache.get('key4')).toEqual('value4');
    });
    
    it('should update access order on get', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      cache.get('key1');
      
      cache.set('key4', 'value4');
      
      expect(cache.get('key1')).toEqual('value1');
      expect(cache.get('key2')).toBeNull();
    });
  });
  
  describe('TTL expiration', () => {
    it('should expire items after TTL', () => {
      cache.set('key1', 'value1');
      
      vi.advanceTimersByTime(50);
      expect(cache.get('key1')).toEqual('value1');
      
      vi.advanceTimersByTime(51);
      expect(cache.get('key1')).toBeNull();
    });
    
    it('should remove expired items on has check', () => {
      cache.set('key1', 'value1');
      
      vi.advanceTimersByTime(101);
      
      expect(cache.has('key1')).toBe(false);
    });
  });
  
  describe('delete and clear', () => {
    it('should delete specific key', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toEqual('value2');
    });
    
    it('should return false for non-existent key', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });
    
    it('should clear all items', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.getStats().size).toBe(0);
    });
  });
  
  describe('statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');
      
      cache.get('key1');
      cache.get('key1');
      cache.get('nonexistent');
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe('66.67%');
    });
    
    it('should return correct size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.getStats().size).toBe(2);
    });
  });
  
  describe('has', () => {
    it('should return true for existing key', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });
    
    it('should return false for non-existent key', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });
    
    it('should return false for expired key', () => {
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(101);
      expect(cache.has('key1')).toBe(false);
    });
  });
});

describe('Predefined caches', () => {
  it('should have windDataCache with correct config', () => {
    expect(windDataCache).toBeInstanceOf(DataCache);
    expect(windDataCache.getStats().maxSize).toBe(10);
  });
  
  it('should have modelDataCache with correct config', () => {
    expect(modelDataCache).toBeInstanceOf(DataCache);
    expect(modelDataCache.getStats().maxSize).toBe(5);
  });
});

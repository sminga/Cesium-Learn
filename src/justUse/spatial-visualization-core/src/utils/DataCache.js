/**
 * 数据缓存工具
 * @module utils/DataCache
 * @description 提供内存缓存功能，支持 LRU 淘汰策略
 */

class DataCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 50;
    this.ttl = options.ttl || 5 * 60 * 1000;
    this.cache = new Map();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      this.misses++;
      return null;
    }
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.delete(key);
      this.misses++;
      return null;
    }
    
    this.hits++;
    this._updateAccessOrder(key);
    return item.data;
  }
  
  set(key, data) {
    if (this.cache.has(key)) {
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
      this._updateAccessOrder(key);
      return;
    }
    
    if (this.cache.size >= this.maxSize) {
      this._evictLRU();
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    this.accessOrder.push(key);
  }
  
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.delete(key);
      return false;
    }
    
    return true;
  }
  
  delete(key) {
    if (this.cache.delete(key)) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      return true;
    }
    return false;
  }
  
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
  }
  
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total * 100).toFixed(2) + '%' : '0%'
    };
  }
  
  _updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }
  }
  
  _evictLRU() {
    const lruKey = this.accessOrder.shift();
    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }
}

export const windDataCache = new DataCache({ maxSize: 10, ttl: 10 * 60 * 1000 });
export const modelDataCache = new DataCache({ maxSize: 5, ttl: 30 * 60 * 1000 });
export const textureCache = new DataCache({ maxSize: 20, ttl: 15 * 60 * 1000 });

export default DataCache;

/**
 * 配置管理器
 * @module core/ConfigManager
 */

class ConfigManager {
  constructor(defaultConfig = {}) {
    this.config = { ...defaultConfig };
    this.listeners = new Map();
  }

  get(key, defaultValue = undefined) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value === undefined || value === null) {
        return defaultValue;
      }
      value = value[k];
    }
    
    return value !== undefined ? value : defaultValue;
  }

  set(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let target = this.config;
    
    for (const k of keys) {
      if (target[k] === undefined || target[k] === null) {
        target[k] = {};
      }
      target = target[k];
    }
    
    const oldValue = target[lastKey];
    target[lastKey] = value;
    
    this._notifyChange(key, value, oldValue);
    return this;
  }

  update(newConfig) {
    const changes = this._deepMerge(this.config, newConfig);
    changes.forEach(({ key, newValue, oldValue }) => {
      this._notifyChange(key, newValue, oldValue);
    });
    return this;
  }

  _deepMerge(target, source, prefix = '') {
    const changes = [];
    
    Object.keys(source).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        if (target[key] === undefined) {
          target[key] = {};
        }
        changes.push(...this._deepMerge(target[key], source[key], fullKey));
      } else {
        const oldValue = target[key];
        target[key] = source[key];
        changes.push({ key: fullKey, newValue: source[key], oldValue });
      }
    });
    
    return changes;
  }

  watch(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    
    return () => {
      this.listeners.get(key).delete(callback);
    };
  }

  _notifyChange(key, newValue, oldValue) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(callback => {
        try {
          callback(newValue, oldValue, key);
        } catch (error) {
          console.error(`Error in config listener for "${key}":`, error);
        }
      });
    }
    
    const keyParts = key.split('.');
    for (let i = keyParts.length - 1; i > 0; i--) {
      const parentKey = keyParts.slice(0, i).join('.');
      if (this.listeners.has(parentKey)) {
        this.listeners.get(parentKey).forEach(callback => {
          try {
            callback(this.get(parentKey), undefined, parentKey);
          } catch (error) {
            console.error(`Error in config listener for "${parentKey}":`, error);
          }
        });
      }
    }
  }

  toJSON() {
    return JSON.parse(JSON.stringify(this.config));
  }

  load(json) {
    this.config = { ...this.config, ...json };
    return this;
  }

  reset(defaultConfig = {}) {
    this.config = { ...defaultConfig };
    return this;
  }
}

export default ConfigManager;

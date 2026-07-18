/**
 * 插件管理器
 * @module core/PluginManager
 */

import EventEmitter from './EventEmitter.js';

class PluginManager extends EventEmitter {
  constructor() {
    super();
    this.plugins = new Map();
    this.hooks = new Map();
  }

  register(plugin) {
    if (!plugin.name) {
      throw new Error('Plugin must have a name');
    }
    
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin "${plugin.name}" is already registered`);
      return false;
    }
    
    this.plugins.set(plugin.name, plugin);
    
    if (plugin.hooks) {
      Object.entries(plugin.hooks).forEach(([hook, handler]) => {
        this.addHook(hook, handler);
      });
    }
    
    this.emit('plugin:registered', { name: plugin.name, plugin });
    return true;
  }

  unregister(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    
    if (plugin.hooks) {
      Object.keys(plugin.hooks).forEach(hook => {
        this.removeHook(hook, plugin.hooks[hook]);
      });
    }
    
    if (plugin.destroy) {
      plugin.destroy();
    }
    
    this.plugins.delete(name);
    this.emit('plugin:unregistered', { name });
    return true;
  }

  addHook(name, handler) {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }
    this.hooks.get(name).push(handler);
  }

  removeHook(name, handler) {
    if (!this.hooks.has(name)) return;
    
    const handlers = this.hooks.get(name);
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  async executeHook(name, ...args) {
    if (!this.hooks.has(name)) return args;
    
    const handlers = this.hooks.get(name);
    let result = args;
    
    for (const handler of handlers) {
      try {
        result = await handler(...result);
      } catch (error) {
        console.error(`Error executing hook "${name}":`, error);
      }
    }
    
    return result;
  }

  getPlugin(name) {
    return this.plugins.get(name);
  }

  hasPlugin(name) {
    return this.plugins.has(name);
  }

  listPlugins() {
    return Array.from(this.plugins.keys());
  }

  destroy() {
    this.plugins.forEach((plugin, name) => {
      this.unregister(name);
    });
    this.hooks.clear();
    this.removeAllListeners();
  }
}

export default PluginManager;

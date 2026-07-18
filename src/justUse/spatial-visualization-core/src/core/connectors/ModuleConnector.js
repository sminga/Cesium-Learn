/**
 * 模块连接器
 * @module core/connectors/ModuleConnector
 * @description 实现模块间的数据流转和通信
 */

import EventEmitter from '../EventEmitter.js';

class ModuleConnector extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();
    this.transformers = new Map();
    this.dataCache = new Map();
  }

  connect(sourceModule, targetModule, options = {}) {
    const connectionId = `${sourceModule.constructor.name}_${targetModule.constructor.name}`;
    
    const connection = {
      id: connectionId,
      source: sourceModule,
      target: targetModule,
      transform: options.transform || null,
      throttle: options.throttle || 0,
      lastSync: 0,
      enabled: true
    };
    
    this.connections.set(connectionId, connection);
    
    if (sourceModule.on) {
      sourceModule.on('dataUpdated', (data) => {
        this._handleSourceUpdate(connectionId, data);
      });
    }
    
    this.emit('connected', { source: sourceModule, target: targetModule });
    
    return connectionId;
  }

  disconnect(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.delete(connectionId);
      this.emit('disconnected', { connectionId });
    }
  }

  setTransformer(name, transformFn) {
    this.transformers.set(name, transformFn);
  }

  async _handleSourceUpdate(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.enabled) return;
    
    const now = Date.now();
    if (connection.throttle > 0 && now - connection.lastSync < connection.throttle) {
      return;
    }
    connection.lastSync = now;
    
    let transformedData = data;
    if (connection.transform) {
      transformedData = await connection.transform(data);
    }
    
    if (connection.target && typeof connection.target.updateFromSource === 'function') {
      connection.target.updateFromSource(transformedData);
    }
    
    this.emit('dataTransferred', {
      connectionId,
      originalData: data,
      transformedData
    });
  }

  sync(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection && connection.source) {
      const data = connection.source.getCurrentData ? connection.source.getCurrentData() : null;
      if (data) {
        this._handleSourceUpdate(connectionId, data);
      }
    }
  }

  syncAll() {
    this.connections.forEach((_, connectionId) => {
      this.sync(connectionId);
    });
  }

  enableConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.enabled = true;
      this.emit('connectionEnabled', { connectionId });
    }
  }

  disableConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.enabled = false;
      this.emit('connectionDisabled', { connectionId });
    }
  }

  getConnection(connectionId) {
    return this.connections.get(connectionId);
  }

  listConnections() {
    return Array.from(this.connections.keys());
  }

  destroy() {
    this.connections.clear();
    this.transformers.clear();
    this.dataCache.clear();
    this.removeAllListeners();
  }
}

export default ModuleConnector;

/**
 * 模型定位服务
 * @module services/ModelLocatorService
 * @description 通过代理服务器获取模型位置信息
 */

import EventEmitter from '../core/EventEmitter.js';
import EnvConfig from '../core/EnvConfig.js';

class ModelLocatorService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      proxyHost: options.proxyHost || EnvConfig.proxyHost,
      proxyPort: options.proxyPort || EnvConfig.proxyPort,
      timeout: options.timeout || EnvConfig.defaultTimeout,
      retryCount: options.retryCount || 3,
      retryDelay: options.retryDelay || 1000,
      ...options
    };
    
    this.baseUrl = `http://${this.options.proxyHost}:${this.options.proxyPort}`;
    this._loading = false;
    this._lastLocation = null;
    this._connectionStatus = 'unknown';
  }

  async checkConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        this._connectionStatus = 'connected';
        this.emit('connectionStatus', { status: 'connected' });
        return true;
      }
      
      this._connectionStatus = 'error';
      return false;
    } catch (error) {
      this._connectionStatus = 'disconnected';
      this.emit('connectionStatus', { status: 'disconnected', error });
      return false;
    }
  }

  async locateModel(modelId) {
    if (this._loading) {
      throw new Error('定位请求正在进行中');
    }
    
    this._loading = true;
    this.emit('locateStart', { modelId });
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.options.retryCount; attempt++) {
      try {
        this.emit('locateAttempt', { modelId, attempt });
        
        const location = await this._fetchModelLocation(modelId);
        
        this._loading = false;
        this._lastLocation = location;
        this._connectionStatus = 'connected';
        
        this.emit('locateSuccess', { 
          modelId, 
          location,
          attempt
        });
        
        return location;
        
      } catch (error) {
        lastError = error;
        this.emit('locateError', { 
          modelId, 
          error, 
          attempt,
          willRetry: attempt < this.options.retryCount
        });
        
        if (attempt < this.options.retryCount) {
          await this._delay(this.options.retryDelay);
        }
      }
    }
    
    this._loading = false;
    this._connectionStatus = 'error';
    
    this.emit('locateFailed', { 
      modelId, 
      error: lastError,
      attempts: this.options.retryCount
    });
    
    throw lastError || new Error('定位失败');
  }

  async _fetchModelLocation(modelId) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/model/${modelId}/location`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`模型 ${modelId} 未找到`);
        }
        throw new Error(`服务器响应错误: ${response.status}`);
      }
      
      const data = await response.json();
      
      return this._validateLocation(data);
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请检查代理服务器连接');
      }
      
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('无法连接到代理服务器，请确认代理服务已启动');
      }
      
      throw error;
    }
  }

  _validateLocation(data) {
    const location = {
      longitude: parseFloat(data.longitude || data.lon || data.lng || 0),
      latitude: parseFloat(data.latitude || data.lat || 0),
      height: parseFloat(data.height || data.altitude || data.alt || 0),
      heading: parseFloat(data.heading || 0),
      pitch: parseFloat(data.pitch || -45),
      range: parseFloat(data.range || data.distance || 500)
    };
    
    if (isNaN(location.longitude) || isNaN(location.latitude)) {
      throw new Error('位置数据无效：经纬度不能为空');
    }
    
    if (location.longitude < -180 || location.longitude > 180) {
      throw new Error('位置数据无效：经度超出范围 (-180, 180)');
    }
    
    if (location.latitude < -90 || location.latitude > 90) {
      throw new Error('位置数据无效：纬度超出范围 (-90, 90)');
    }
    
    return location;
  }

  async locateByCoordinates(lon, lat, height = 0) {
    const location = {
      longitude: lon,
      latitude: lat,
      height: height,
      heading: 0,
      pitch: -45,
      range: 500
    };
    
    this._lastLocation = location;
    this.emit('locateSuccess', { location, source: 'coordinates' });
    
    return location;
  }

  async geocode(address) {
    this._loading = true;
    this.emit('geocodeStart', { address });
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
      
      const url = `${this.baseUrl}/api/geocode?` + new URLSearchParams({
        q: address
      });
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`地理编码失败: ${response.status}`);
      }
      
      const data = await response.json();
      const location = this._validateLocation(data);
      
      this._loading = false;
      this._lastLocation = location;
      
      this.emit('geocodeSuccess', { address, location });
      
      return location;
      
    } catch (error) {
      this._loading = false;
      this.emit('geocodeError', { address, error });
      throw error;
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isLoading() {
    return this._loading;
  }

  getLastLocation() {
    return this._lastLocation;
  }

  getConnectionStatus() {
    return this._connectionStatus;
  }

  getProxyUrl() {
    return this.baseUrl;
  }

  setProxy(host, port) {
    this.options.proxyHost = host;
    this.options.proxyPort = port;
    this.baseUrl = `http://${host}:${port}`;
    this._connectionStatus = 'unknown';
    this.emit('proxyChanged', { host, port, url: this.baseUrl });
  }
}

ModelLocatorService.createDefault = function() {
  return new ModelLocatorService({
    proxyHost: '127.0.0.1',
    proxyPort: 29290,
    timeout: 10000,
    retryCount: 3,
    retryDelay: 1000
  });
};

export default ModelLocatorService;

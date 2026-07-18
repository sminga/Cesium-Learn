/**
 * 模型定位按钮组件
 * @module ui/LocateButton
 * @description 提供模型位置定位功能的交互按钮
 */

import ModelLocatorService from '../services/ModelLocatorService.js';

class LocateButton {
  constructor(options = {}) {
    this.options = {
      container: options.container || document.body,
      viewer: options.viewer || null,
      proxyHost: options.proxyHost || '127.0.0.1',
      proxyPort: options.proxyPort || 29290,
      onLocate: options.onLocate || null,
      onError: options.onError || null,
      ...options
    };
    
    this.locatorService = new ModelLocatorService({
      proxyHost: this.options.proxyHost,
      proxyPort: this.options.proxyPort
    });
    
    this.currentModelId = null;
    this._element = null;
    this._statusElement = null;
    this._loading = false;
    
    this._init();
  }

  _init() {
    this._createUI();
    this._bindEvents();
  }

  _createUI() {
    const container = typeof this.options.container === 'string' 
      ? document.querySelector(this.options.container) 
      : this.options.container;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'locate-button-wrapper';
    wrapper.innerHTML = `
      <style>
        .locate-button-wrapper {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .locate-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, #1a253d 0%, #0d1a30 100%);
          border: 1px solid rgba(20, 122, 216, 0.4);
          color: #fff;
          padding: 10px 16px;
          border-radius: 18px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 400;
          transition: all 0.3s ease;
          min-width: 120px;
        }
        
        .locate-button:hover:not(:disabled) {
          background: linear-gradient(135deg, #1e496f 0%, #0d2a4a 100%);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4), 0 0 20px rgba(20, 122, 216, 0.3);
          transform: translateY(-1px);
        }
        
        .locate-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .locate-button.loading {
          background: linear-gradient(135deg, #2a3a5d 0%, #1a2a4a 100%);
        }
        
        .locate-button.success {
          border-color: #4caf50;
          box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
        }
        
        .locate-button.error {
          border-color: #f44336;
          box-shadow: 0 0 10px rgba(244, 67, 54, 0.3);
        }
        
        .locate-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: locate-spin 0.8s linear infinite;
          display: none;
        }
        
        .locate-button.loading .locate-spinner {
          display: block;
        }
        
        .locate-button.loading .locate-icon {
          display: none;
        }
        
        @keyframes locate-spin {
          to { transform: rotate(360deg); }
        }
        
        .locate-icon {
          width: 16px;
          height: 16px;
          fill: currentColor;
        }
        
        .locate-status {
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.3);
          color: rgba(255, 255, 255, 0.7);
          display: none;
        }
        
        .locate-status.visible {
          display: block;
        }
        
        .locate-status.success {
          background: rgba(76, 175, 80, 0.2);
          color: #81c784;
        }
        
        .locate-status.error {
          background: rgba(244, 67, 54, 0.2);
          color: #e57373;
        }
        
        .locate-status.info {
          background: rgba(33, 150, 243, 0.2);
          color: #64b5f6;
        }
        
        .locate-coords {
          margin-top: 8px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
          font-family: 'Consolas', monospace;
          display: none;
        }
        
        .locate-coords.visible {
          display: block;
        }
      </style>
      
      <button class="locate-button" id="locateBtn">
        <svg class="locate-icon" viewBox="0 0 24 24">
          <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
        </svg>
        <div class="locate-spinner"></div>
        <span class="locate-text">定位模型</span>
      </button>
      
      <div class="locate-status" id="locateStatus"></div>
      <div class="locate-coords" id="locateCoords"></div>
    `;
    
    container.appendChild(wrapper);
    
    this._element = wrapper.querySelector('.locate-button');
    this._statusElement = wrapper.querySelector('.locate-status');
    this._coordsElement = wrapper.querySelector('.locate-coords');
    this._textElement = wrapper.querySelector('.locate-text');
  }

  _bindEvents() {
    this._element.addEventListener('click', () => this.handleLocate());
    
    this.locatorService.on('locateStart', () => {
      this._setLoading(true);
      this._setStatus('正在定位...', 'info');
    });
    
    this.locatorService.on('locateAttempt', (data) => {
      if (data.attempt > 1) {
        this._setStatus(`重试中 (${data.attempt}/${this.locatorService.options.retryCount})...`, 'info');
      }
    });
    
    this.locatorService.on('locateSuccess', (data) => {
      this._setLoading(false);
      this._setSuccess(true);
      this._setStatus('定位成功', 'success');
      this._showCoordinates(data.location);
      
      if (this.options.viewer && data.location) {
        this._flyToLocation(data.location);
      }
      
      if (this.options.onLocate) {
        this.options.onLocate(data.location);
      }
      
      setTimeout(() => this._setSuccess(false), 2000);
    });
    
    this.locatorService.on('locateError', (data) => {
      if (!data.willRetry) {
        this._setLoading(false);
        this._setError(true);
        this._setStatus(`定位失败: ${data.error.message}`, 'error');
        
        if (this.options.onError) {
          this.options.onError(data.error);
        }
        
        setTimeout(() => this._setError(false), 3000);
      }
    });
    
    this.locatorService.on('locateFailed', (data) => {
      this._setLoading(false);
      this._setError(true);
      this._setStatus(`定位失败: ${data.error.message}`, 'error');
      
      if (this.options.onError) {
        this.options.onError(data.error);
      }
      
      setTimeout(() => this._setError(false), 3000);
    });
  }

  async handleLocate() {
    if (this._loading) return;
    
    if (!this.currentModelId) {
      this._setStatus('请先加载模型', 'error');
      this._setError(true);
      setTimeout(() => this._setError(false), 2000);
      return;
    }
    
    try {
      await this.locatorService.locateModel(this.currentModelId);
    } catch (error) {
      console.error('[LocateButton] 定位失败:', error);
    }
  }

  async locateByCoordinates(lon, lat, height = 0) {
    try {
      this._setLoading(true);
      this._setStatus('正在定位...', 'info');
      
      const location = await this.locatorService.locateByCoordinates(lon, lat, height);
      
      this._setLoading(false);
      this._setSuccess(true);
      this._setStatus('定位成功', 'success');
      this._showCoordinates(location);
      
      if (this.options.viewer) {
        this._flyToLocation(location);
      }
      
      if (this.options.onLocate) {
        this.options.onLocate(location);
      }
      
      setTimeout(() => this._setSuccess(false), 2000);
      
      return location;
    } catch (error) {
      this._setLoading(false);
      this._setError(true);
      this._setStatus(`定位失败: ${error.message}`, 'error');
      
      setTimeout(() => this._setError(false), 3000);
      throw error;
    }
  }

  _flyToLocation(location) {
    if (!this.options.viewer || !location) return;
    
    const viewer = this.options.viewer;
    
    if (typeof viewer.camera !== 'undefined') {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          location.longitude,
          location.latitude,
          location.height + (location.range || 500)
        ),
        orientation: {
          heading: Cesium.Math.toRadians(location.heading || 0),
          pitch: Cesium.Math.toRadians(location.pitch || -45),
          roll: 0
        },
        duration: 2
      });
    }
  }

  _setLoading(loading) {
    this._loading = loading;
    this._element.disabled = loading;
    this._element.classList.toggle('loading', loading);
    this._textElement.textContent = loading ? '定位中...' : '定位模型';
  }

  _setSuccess(success) {
    this._element.classList.toggle('success', success);
  }

  _setError(error) {
    this._element.classList.toggle('error', error);
  }

  _setStatus(message, type = 'info') {
    this._statusElement.textContent = message;
    this._statusElement.className = `locate-status visible ${type}`;
  }

  _showCoordinates(location) {
    if (!location) return;
    
    const coords = this._coordsElement;
    coords.textContent = '';
    coords.classList.add('visible');
    
    const lines = [
      `经度: ${location.longitude.toFixed(6)}°`,
      `纬度: ${location.latitude.toFixed(6)}°`,
      `高度: ${location.height.toFixed(2)}m`
    ];
    
    lines.forEach(line => {
      const div = document.createElement('div');
      div.textContent = line;
      coords.appendChild(div);
    });
  }

  setModelId(modelId) {
    this.currentModelId = modelId;
  }

  setViewer(viewer) {
    this.options.viewer = viewer;
  }

  setProxy(host, port) {
    this.locatorService.setProxy(host, port);
  }

  async checkConnection() {
    return this.locatorService.checkConnection();
  }

  getService() {
    return this.locatorService;
  }

  destroy() {
    if (this._element && this._element.parentElement) {
      this._element.parentElement.remove();
    }
    this.locatorService.removeAllListeners();
  }
}

export default LocateButton;

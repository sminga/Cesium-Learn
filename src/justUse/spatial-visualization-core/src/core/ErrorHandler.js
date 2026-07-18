/**
 * 全局错误处理器
 * @module core/ErrorHandler
 * @description 统一处理应用中的错误和异常
 */

import EnvConfig from './EnvConfig.js';

class ErrorHandler {
  constructor() {
    this.listeners = new Set();
    this.errorLog = [];
    this.maxLogSize = 100;
    this._initialized = false;
  }
  
  init() {
    if (this._initialized) return;
    this._initialized = true;
    
    this._setupGlobalHandlers();
  }
  
  _setupGlobalHandlers() {
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'javascript',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: Date.now()
      });
      
      event.preventDefault();
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'promise',
        message: event.reason?.message || 'Unhandled Promise Rejection',
        stack: event.reason?.stack,
        timestamp: Date.now()
      });
      
      event.preventDefault();
    });
  }
  
  handleError(error) {
    this._logError(error);
    
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('[ErrorHandler] Error in listener:', e);
      }
    });
    
    if (EnvConfig.isProduction) {
      return { 
        message: '发生未知错误，请稍后重试',
        type: error.type 
      };
    }
    
    return error;
  }
  
  _logError(error) {
    this.errorLog.push(error);
    
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...error
    };
    
    if (EnvConfig.logEndpoint) {
      this._sendToLogService(logEntry);
    }
    
    const logLevel = error.type === 'promise' ? 'warn' : 'error';
    console[logLevel]('[ErrorHandler]', logEntry);
  }
  
  async _sendToLogService(logEntry) {
    try {
      await fetch(EnvConfig.logEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry),
        credentials: 'omit'
      });
    } catch (e) {
      console.warn('[ErrorHandler] Failed to send log:', e.message);
    }
  }
  
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Listener must be a function');
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  wrapAsync(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError({
          type: 'async',
          message: error.message,
          stack: error.stack,
          context: {
            function: fn.name || 'anonymous',
            ...context
          },
          timestamp: Date.now()
        });
        throw error;
      }
    };
  }
  
  wrapSync(fn, context = {}) {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        this.handleError({
          type: 'sync',
          message: error.message,
          stack: error.stack,
          context: {
            function: fn.name || 'anonymous',
            ...context
          },
          timestamp: Date.now()
        });
        throw error;
      }
    };
  }
  
  getErrorLog() {
    return [...this.errorLog];
  }
  
  clearErrorLog() {
    this.errorLog = [];
  }
  
  createError(message, code = 'UNKNOWN_ERROR') {
    const error = new Error(message);
    error.code = code;
    error.timestamp = Date.now();
    return error;
  }
  
  isInitialized() {
    return this._initialized;
  }
}

export const errorHandler = new ErrorHandler();
export default ErrorHandler;

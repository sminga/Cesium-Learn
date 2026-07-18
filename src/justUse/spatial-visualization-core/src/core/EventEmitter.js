/**
 * 事件发射器
 * @module core/EventEmitter
 * @description 提供事件订阅和发布功能
 */

const DEFAULT_MAX_LISTENERS = 50;

class EventEmitter {
  constructor() {
    this._events = new Map();
    this._maxListeners = DEFAULT_MAX_LISTENERS;
  }
  
  static get defaultMaxListeners() {
    return DEFAULT_MAX_LISTENERS;
  }

  on(event, listener) {
    if (typeof event !== 'string' || event.length === 0) {
      throw new TypeError('Event name must be a non-empty string');
    }
    
    if (typeof listener !== 'function') {
      throw new TypeError('Listener must be a function');
    }
    
    if (!this._events.has(event)) {
      this._events.set(event, []);
    }
    
    const listeners = this._events.get(event);
    
    if (listeners.length >= this._maxListeners) {
      console.warn(
        `[EventEmitter] Possible memory leak detected. ` +
        `${listeners.length} listeners added for event "${event}". ` +
        `Use setMaxListeners() to increase limit.`
      );
    }
    
    listeners.push(listener);
    
    return () => this.off(event, listener);
  }

  once(event, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Listener must be a function');
    }
    
    const onceWrapper = (...args) => {
      this.off(event, onceWrapper);
      listener.apply(this, args);
    };
    
    onceWrapper._original = listener;
    return this.on(event, onceWrapper);
  }

  off(event, listener) {
    if (!this._events.has(event)) return this;
    
    if (!listener) {
      this._events.delete(event);
      return this;
    }
    
    const listeners = this._events.get(event);
    const index = listeners.findIndex(l => l === listener || l._original === listener);
    
    if (index > -1) {
      listeners.splice(index, 1);
      
      if (listeners.length === 0) {
        this._events.delete(event);
      }
    }
    
    return this;
  }

  emit(event, ...args) {
    if (!this._events.has(event)) return false;
    
    const listeners = this._events.get(event).slice();
    let hasError = false;
    
    listeners.forEach(listener => {
      try {
        listener.apply(this, args);
      } catch (error) {
        hasError = true;
        console.error(`[EventEmitter] Error in listener for "${event}":`, error);
        
        this._emitError(error, event, listener);
      }
    });
    
    return !hasError;
  }
  
  _emitError(error, event, listener) {
    if (event === 'error') return;
    
    if (this._events.has('error')) {
      try {
        this._events.get('error').forEach(l => l({ error, event, listener }));
      } catch (e) {
        console.error('[EventEmitter] Error in error handler:', e);
      }
    }
  }

  removeAllListeners(event) {
    if (event) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
    return this;
  }

  listenerCount(event) {
    return this._events.has(event) ? this._events.get(event).length : 0;
  }
  
  listeners(event) {
    return this._events.has(event) ? this._events.get(event).slice() : [];
  }
  
  eventNames() {
    return Array.from(this._events.keys());
  }
  
  setMaxListeners(n) {
    if (typeof n !== 'number' || n < 0) {
      throw new TypeError('n must be a positive number');
    }
    this._maxListeners = n;
    return this;
  }
  
  getMaxListeners() {
    return this._maxListeners;
  }
  
  prependListener(event, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Listener must be a function');
    }
    
    if (!this._events.has(event)) {
      this._events.set(event, []);
    }
    
    this._events.get(event).unshift(listener);
    return () => this.off(event, listener);
  }
  
  prependOnceListener(event, listener) {
    const onceWrapper = (...args) => {
      this.off(event, onceWrapper);
      listener.apply(this, args);
    };
    
    onceWrapper._original = listener;
    return this.prependListener(event, onceWrapper);
  }
}

export default EventEmitter;

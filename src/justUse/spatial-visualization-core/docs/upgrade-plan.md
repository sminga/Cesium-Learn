# 空间信息可视化核心库 - 系统升级方案

**版本**: 1.1.0  
**制定日期**: 2026-04-20  
**基于审核报告**: code-review-report.md

---

## 一、升级目标

### 1.1 核心目标
- **安全性**: 修复所有高危安全漏洞，建立安全开发规范
- **性能**: 提升大数据处理能力，优化内存使用
- **稳定性**: 完善错误处理，提高系统健壮性
- **可维护性**: 统一代码规范，提升测试覆盖率

### 1.2 预期成果
| 指标 | 当前状态 | 目标状态 |
|------|----------|----------|
| 安全漏洞 | 9 个 | 0 个 |
| 性能问题 | 10 个 | 2 个 |
| 测试覆盖率 | 40% | 80% |
| 代码规范符合率 | 60% | 95% |

---

## 二、升级阶段规划

### 阶段一：安全修复 (P0) - 1 周

#### 2.1.1 XSS 漏洞修复
**任务**: 修复 LocateButton.js 中的 innerHTML 使用

**修改文件**: `src/ui/LocateButton.js`

```javascript
// 修改前 (第 338-343 行)
this._coordsElement.innerHTML = `
  经度: ${location.longitude.toFixed(6)}°<br>
  纬度: ${location.latitude.toFixed(6)}°<br>
  高度: ${location.height.toFixed(2)}m
`;

// 修改后
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
```

#### 2.1.2 配置安全化
**任务**: 实现环境变量配置管理

**新建文件**: `src/core/EnvConfig.js`

```javascript
const EnvConfig = {
  get proxyHost() {
    return import.meta.env.VITE_PROXY_HOST || '127.0.0.1';
  },
  get proxyPort() {
    return parseInt(import.meta.env.VITE_PROXY_PORT) || 29290;
  },
  get apiBaseUrl() {
    return import.meta.env.VITE_API_BASE_URL || '';
  },
  get logLevel() {
    return import.meta.env.VITE_LOG_LEVEL || 'info';
  }
};

export default EnvConfig;
```

**新建文件**: `.env.example`
```
VITE_PROXY_HOST=127.0.0.1
VITE_PROXY_PORT=29290
VITE_API_BASE_URL=
VITE_LOG_LEVEL=info
```

#### 2.1.3 输入验证增强
**任务**: 实现统一的数据验证模块

**新建文件**: `src/utils/validators.js`

```javascript
export const validators = {
  coordinates(lon, lat, height = 0) {
    const errors = [];
    
    if (typeof lon !== 'number' || isNaN(lon)) {
      errors.push('经度必须是有效数字');
    } else if (lon < -180 || lon > 180) {
      errors.push('经度超出有效范围 (-180, 180)');
    }
    
    if (typeof lat !== 'number' || isNaN(lat)) {
      errors.push('纬度必须是有效数字');
    } else if (lat < -90 || lat > 90) {
      errors.push('纬度超出有效范围 (-90, 90)');
    }
    
    if (typeof height !== 'number' || isNaN(height)) {
      errors.push('高度必须是有效数字');
    } else if (height < -11000 || height > 100000) {
      errors.push('高度超出合理范围');
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  modelId(id) {
    if (!id || typeof id !== 'string') {
      return { valid: false, errors: ['模型ID不能为空'] };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return { valid: false, errors: ['模型ID包含非法字符'] };
    }
    return { valid: true, errors: [] };
  },
  
  windData(data) {
    const required = ['u', 'v', 'lon', 'lat'];
    const missing = required.filter(key => !data || !data[key]);
    return { 
      valid: missing.length === 0, 
      errors: missing.map(k => `缺少必需字段: ${k}`) 
    };
  }
};
```

---

### 阶段二：性能优化 (P1) - 2 周

#### 2.2.1 大文件流式处理
**任务**: 重构 PlyToSplatConverter 支持流式处理

**修改文件**: `src/modules/splat/PlyToSplatConverter.js`

```javascript
// 新增流式处理方法
async convertStream(input, options = {}) {
  const { chunkSize = 100000, onProgress } = options;
  
  // 检测是否支持 Streams API
  if ('ReadableStream' in window && input instanceof ReadableStream) {
    return this._processWithStreams(input, chunkSize, onProgress);
  }
  
  // 降级到分块处理
  return this._processInChunks(input, chunkSize, onProgress);
}

async _processInChunks(arrayBuffer, chunkSize, onProgress) {
  const header = this._parseHeader(arrayBuffer);
  const totalVertices = header.vertexCount;
  const chunks = Math.ceil(totalVertices / chunkSize);
  const results = [];
  
  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, totalVertices);
    
    // 使用 Web Worker 处理每个块
    const chunkResult = await this._processChunk(arrayBuffer, start, end, header);
    results.push(chunkResult);
    
    if (onProgress) {
      onProgress({
        current: end,
        total: totalVertices,
        percent: (end / totalVertices * 100).toFixed(1)
      });
    }
    
    // 让出主线程
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return this._mergeChunks(results);
}
```

#### 2.2.2 风场数据优化
**任务**: 合并数据处理流程，减少遍历次数

**修改文件**: `src/modules/wind/dataProcess.js`

```javascript
// 优化后的数据处理
function processWindData(NetCDF, fields, valueRange, offset) {
  const data = {};
  const dimensions = arrayToMap(NetCDF.dimensions);
  
  // 单次遍历处理所有维度数据
  data.dimensions = { lon: 1, lat: 1, lev: 1 };
  
  const dimensionKeys = ['lon', 'lat', 'lev'];
  const dataKeys = ['U', 'V', 'W', 'H'];
  
  // 合并维度处理
  dimensionKeys.forEach(key => {
    if (fields[key]) {
      const array = NetCDF.getDataVariable(fields[key]).flat();
      const offsetVal = offset[key] || 0;
      
      data.dimensions[key] = dimensions[fields[key]].size;
      data[key] = processArray(array, offsetVal);
    }
  });
  
  // 合并数据处理 - 单次遍历
  const uvwhData = processUVWH(NetCDF, fields, valueRange, data.dimensions);
  Object.assign(data, uvwhData);
  
  return data;
}

function processArray(array, offset, valueRange = null) {
  let min = Infinity, max = -Infinity;
  const result = new Float32Array(array.length);
  
  for (let i = 0; i < array.length; i++) {
    let val = array[i] + offset;
    
    if (valueRange) {
      val = (val < valueRange.min || val > valueRange.max) ? 0 : val;
    }
    
    result[i] = val;
    if (val < min) min = val;
    if (val > max) max = val;
  }
  
  return { array: result, min, max };
}
```

#### 2.2.3 缓存机制
**任务**: 实现数据缓存层

**新建文件**: `src/utils/DataCache.js`

```javascript
class DataCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || 5 * 60 * 1000; // 5分钟
    this.cache = new Map();
    this.accessOrder = [];
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.delete(key);
      return null;
    }
    
    // 更新访问顺序
    this._updateAccessOrder(key);
    return item.data;
  }
  
  set(key, data) {
    if (this.cache.size >= this.maxSize) {
      this._evictLRU();
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    this.accessOrder.push(key);
  }
  
  delete(key) {
    this.cache.delete(key);
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
  
  clear() {
    this.cache.clear();
    this.accessOrder = [];
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

export const windDataCache = new DataCache({ maxSize: 10 });
export const modelDataCache = new DataCache({ maxSize: 5 });
export default DataCache;
```

---

### 阶段三：架构增强 (P2) - 2 周

#### 2.3.1 全局错误处理
**任务**: 实现统一错误处理机制

**新建文件**: `src/core/ErrorHandler.js`

```javascript
class ErrorHandler {
  constructor() {
    this.listeners = new Set();
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
        stack: event.error?.stack
      });
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'promise',
        message: event.reason?.message || 'Unhandled Promise Rejection',
        stack: event.reason?.stack
      });
    });
  }
  
  handleError(error) {
    // 记录错误
    this._logError(error);
    
    // 通知监听器
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (e) {
        console.error('Error in error handler:', e);
      }
    });
    
    // 生产环境不暴露详细错误
    if (import.meta.env.PROD) {
      return { message: '发生未知错误，请稍后重试' };
    }
    return error;
  }
  
  _logError(error) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...error
    };
    
    // 发送到日志服务（如果配置）
    if (import.meta.env.VITE_LOG_ENDPOINT) {
      fetch(import.meta.env.VITE_LOG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      }).catch(() => {});
    }
    
    console.error('[ErrorHandler]', logEntry);
  }
  
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  wrapAsync(fn) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError({
          type: 'async',
          message: error.message,
          stack: error.stack,
          context: { function: fn.name, args }
        });
        throw error;
      }
    };
  }
}

export const errorHandler = new ErrorHandler();
export default ErrorHandler;
```

#### 2.3.2 事件总线优化
**任务**: 增强事件发射器

**修改文件**: `src/core/EventEmitter.js`

```javascript
class EventEmitter {
  constructor() {
    this._events = new Map();
    this._onceEvents = new Map();
    this._maxListeners = 50;
  }
  
  on(event, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('Listener must be a function');
    }
    
    if (!this._events.has(event)) {
      this._events.set(event, new Set());
    }
    
    const listeners = this._events.get(event);
    if (listeners.size >= this._maxListeners) {
      console.warn(`EventEmitter: ${event} has ${listeners.size} listeners, possible memory leak`);
    }
    
    listeners.add(listener);
    return () => this.off(event, listener);
  }
  
  once(event, listener) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      listener.apply(this, args);
    };
    return this.on(event, wrapper);
  }
  
  emit(event, ...args) {
    const listeners = this._events.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener.apply(this, args);
        } catch (error) {
          console.error(`Error in event listener for "${event}":`, error);
        }
      });
    }
    return this;
  }
  
  off(event, listener) {
    if (listener) {
      this._events.get(event)?.delete(listener);
    } else {
      this._events.delete(event);
    }
    return this;
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
    return this._events.get(event)?.size || 0;
  }
}

export default EventEmitter;
```

---

### 阶段四：测试完善 (P3) - 1 周

#### 2.4.1 单元测试补充

**新建文件**: `tests/services/ModelLocatorService.test.js`

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModelLocatorService from '../../src/services/ModelLocatorService.js';

describe('ModelLocatorService', () => {
  let service;
  
  beforeEach(() => {
    service = new ModelLocatorService({
      proxyHost: 'localhost',
      proxyPort: 8080,
      timeout: 1000,
      retryCount: 2
    });
    
    global.fetch = vi.fn();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
    service.destroy();
  });
  
  describe('checkConnection', () => {
    it('should return true when server is healthy', async () => {
      fetch.mockResolvedValueOnce({ ok: true });
      
      const result = await service.checkConnection();
      
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('http://localhost:8080/health', expect.any(Object));
    });
    
    it('should return false when server is unreachable', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await service.checkConnection();
      
      expect(result).toBe(false);
    });
  });
  
  describe('locateModel', () => {
    it('should validate model ID format', async () => {
      await expect(service.locateModel('')).rejects.toThrow();
      await expect(service.locateModel(null)).rejects.toThrow();
    });
    
    it('should retry on failure', async () => {
      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ longitude: 116, latitude: 40, height: 0 })
        });
      
      const result = await service.locateModel('test-model');
      
      expect(result.longitude).toBe(116);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('_validateLocation', () => {
    it('should reject invalid coordinates', () => {
      expect(() => service._validateLocation({ longitude: 200, latitude: 0 }))
        .toThrow('经度超出范围');
      expect(() => service._validateLocation({ longitude: 0, latitude: 100 }))
        .toThrow('纬度超出范围');
    });
  });
});
```

**新建文件**: `tests/modules/splat/PlyToSplatConverter.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import PlyToSplatConverter from '../../src/modules/splat/PlyToSplatConverter.js';

describe('PlyToSplatConverter', () => {
  describe('_parseHeader', () => {
    it('should parse binary PLY header correctly', () => {
      const converter = new PlyToSplatConverter();
      const headerText = `ply
format binary_little_endian 1.0
element vertex 100
property float x
property float y
property float z
end_header`;
      
      const header = converter._parseHeader(headerText);
      
      expect(header.format).toBe('binary_little_endian');
      expect(header.vertexCount).toBe(100);
      expect(header.properties).toHaveLength(3);
      expect(header.elementSize).toBe(12);
    });
  });
  
  describe('_isPlyFile', () => {
    it('should detect PLY by extension', () => {
      const converter = new PlyToSplatConverter();
      
      expect(converter._isPlyFile('model.ply', new ArrayBuffer(0))).toBe(true);
      expect(converter._isPlyFile('model.PLY', new ArrayBuffer(0))).toBe(true);
      expect(converter._isPlyFile('model.txt', new ArrayBuffer(0))).toBe(false);
    });
    
    it('should detect PLY by header', () => {
      const converter = new PlyToSplatConverter();
      const buffer = new TextEncoder().encode('ply\n').buffer;
      
      expect(converter._isPlyFile('unknown', buffer)).toBe(true);
    });
  });
});
```

---

## 三、依赖升级计划

### 3.1 立即升级

| 依赖 | 当前版本 | 目标版本 | 原因 |
|------|----------|----------|------|
| eslint | ^8.0.0 | ^9.0.0 | 新规则支持、性能提升 |
| cesium | >=1.100.0 | ^1.140.0 | 锁定版本、安全修复 |

### 3.2 评估后升级

| 依赖 | 当前版本 | 目标版本 | 注意事项 |
|------|----------|----------|----------|
| dat.gui | ^0.7.9 | lil-gui ^0.19.0 | API 变化，需适配 |
| netcdfjs | ^1.0.0 | 评估替代方案 | 维护状态检查 |

### 3.3 package.json 更新

```json
{
  "dependencies": {
    "@mkkellogg/gaussian-splats-3d": "^0.4.7",
    "cesium": "^1.140.0",
    "lil-gui": "^0.19.0",
    "netcdfjs": "^1.0.0",
    "ply2splat": "^0.4.4",
    "three": "^0.184.0"
  },
  "devDependencies": {
    "eslint": "^9.0.0",
    "jsdoc": "^4.0.0",
    "vite": "^5.2.0",
    "vite-plugin-cesium": "^1.2.22",
    "vitest": "^1.0.0"
  }
}
```

---

## 四、测试验证计划

### 4.1 单元测试
- 目标覆盖率: 80%
- 关键模块: 100%

### 4.2 集成测试
- 模块间通信测试
- 数据流测试
- 错误处理测试

### 4.3 性能测试
- 大文件处理性能
- 内存使用监控
- 渲染帧率测试

### 4.4 安全测试
- XSS 漏洞扫描
- 输入验证测试
- 敏感数据检查

---

## 五、回滚计划

### 5.1 版本控制
- 创建 `v1.0.0-stable` 分支作为备份
- 每个阶段完成后创建标签

### 5.2 回滚触发条件
- 关键功能失效
- 性能下降超过 20%
- 安全漏洞引入

### 5.3 回滚步骤
1. 停止部署
2. 切换到稳定分支
3. 重新部署
4. 验证功能

---

## 六、时间表

| 阶段 | 任务 | 预计时间 | 负责人 |
|------|------|----------|--------|
| P0 | 安全修复 | 1 周 | - |
| P1 | 性能优化 | 2 周 | - |
| P2 | 架构增强 | 2 周 | - |
| P3 | 测试完善 | 1 周 | - |
| - | 总计 | 6 周 | - |

---

## 七、验收标准

### 7.1 安全验收
- [ ] 所有高危安全漏洞已修复
- [ ] 通过 OWASP 安全检查
- [ ] 无敏感信息泄露

### 7.2 性能验收
- [ ] 大文件处理内存使用降低 50%
- [ ] 风场数据处理时间降低 30%
- [ ] 无内存泄漏

### 7.3 功能验收
- [ ] 所有现有功能正常工作
- [ ] 新增功能测试通过
- [ ] 错误处理完善

### 7.4 质量验收
- [ ] 测试覆盖率达到 80%
- [ ] ESLint 检查通过
- [ ] 文档更新完成

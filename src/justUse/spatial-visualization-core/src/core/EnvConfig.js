/**
 * 环境配置管理
 * @module core/EnvConfig
 * @description 从环境变量读取配置，避免硬编码敏感信息
 */

const EnvConfig = {
  get proxyHost() {
    return import.meta.env.VITE_PROXY_HOST || '127.0.0.1';
  },
  
  get proxyPort() {
    const port = parseInt(import.meta.env.VITE_PROXY_PORT, 10);
    return isNaN(port) ? 29290 : port;
  },
  
  get apiBaseUrl() {
    return import.meta.env.VITE_API_BASE_URL || '';
  },
  
  get logLevel() {
    return import.meta.env.VITE_LOG_LEVEL || 'info';
  },
  
  get isProduction() {
    return import.meta.env.PROD;
  },
  
  get isDevelopment() {
    return import.meta.env.DEV;
  },
  
  get logEndpoint() {
    return import.meta.env.VITE_LOG_ENDPOINT || '';
  },
  
  get maxFileSize() {
    const size = parseInt(import.meta.env.VITE_MAX_FILE_SIZE, 10);
    return isNaN(size) ? 500 * 1024 * 1024 : size;
  },
  
  get defaultTimeout() {
    const timeout = parseInt(import.meta.env.VITE_DEFAULT_TIMEOUT, 10);
    return isNaN(timeout) ? 10000 : timeout;
  },
  
  getProxyUrl() {
    return `http://${this.proxyHost}:${this.proxyPort}`;
  },
  
  validate() {
    const warnings = [];
    
    if (this.isProduction) {
      if (this.proxyHost === '127.0.0.1') {
        warnings.push('生产环境使用本地代理地址');
      }
      if (this.logLevel === 'debug') {
        warnings.push('生产环境启用 debug 日志级别');
      }
    }
    
    return {
      valid: warnings.length === 0,
      warnings
    };
  }
};

if (EnvConfig.isDevelopment) {
  const validation = EnvConfig.validate();
  if (!validation.valid) {
    console.warn('[EnvConfig] 配置警告:', validation.warnings);
  }
}

export default EnvConfig;

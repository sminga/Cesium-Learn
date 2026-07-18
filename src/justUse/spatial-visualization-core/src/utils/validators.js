/**
 * 输入验证工具
 * @module utils/validators
 * @description 提供统一的数据验证功能
 */

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
      errors.push('高度超出合理范围 (-11000m ~ 100000m)');
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  modelId(id) {
    if (!id || typeof id !== 'string') {
      return { valid: false, errors: ['模型ID不能为空'] };
    }
    if (id.length > 256) {
      return { valid: false, errors: ['模型ID长度不能超过256字符'] };
    }
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(id)) {
      return { valid: false, errors: ['模型ID包含非法字符，仅允许字母、数字、下划线、连字符和点'] };
    }
    return { valid: true, errors: [] };
  },
  
  windData(data) {
    const errors = [];
    
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['风场数据必须是非空对象'] };
    }
    
    const required = ['u', 'v'];
    required.forEach(key => {
      if (!data[key]) {
        errors.push(`缺少必需字段: ${key}`);
      } else if (!(data[key] instanceof Float32Array) && !Array.isArray(data[key])) {
        errors.push(`字段 ${key} 必须是数组`);
      }
    });
    
    if (data.u && data.v && data.u.length !== data.v.length) {
      errors.push('U 和 V 分量数组长度不一致');
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  demData(data) {
    const errors = [];
    
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['DEM数据必须是非空对象'] };
    }
    
    const required = ['ncols', 'nrows', 'xllcorner', 'yllcorner', 'cellsize', 'data'];
    required.forEach(key => {
      if (data[key] === undefined || data[key] === null) {
        errors.push(`缺少必需字段: ${key}`);
      }
    });
    
    if (data.ncols !== undefined && data.ncols <= 0) {
      errors.push('列数必须大于0');
    }
    if (data.nrows !== undefined && data.nrows <= 0) {
      errors.push('行数必须大于0');
    }
    if (data.cellsize !== undefined && data.cellsize <= 0) {
      errors.push('单元格大小必须大于0');
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  fileName(name, allowedExtensions = []) {
    if (!name || typeof name !== 'string') {
      return { valid: false, errors: ['文件名不能为空'] };
    }
    
    if (name.length > 255) {
      return { valid: false, errors: ['文件名过长'] };
    }
    
    if (/[<>:"/\\|?*\x00-\x1f]/.test(name)) {
      return { valid: false, errors: ['文件名包含非法字符'] };
    }
    
    if (allowedExtensions.length > 0) {
      const ext = name.split('.').pop().toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return { valid: false, errors: [`不支持的文件类型，允许: ${allowedExtensions.join(', ')}`] };
      }
    }
    
    return { valid: true, errors: [] };
  },
  
  fileSize(size, maxSize = 500 * 1024 * 1024) {
    if (typeof size !== 'number' || isNaN(size) || size < 0) {
      return { valid: false, errors: ['文件大小无效'] };
    }
    
    if (size > maxSize) {
      const maxMB = (maxSize / (1024 * 1024)).toFixed(2);
      return { valid: false, errors: [`文件大小超过限制 (${maxMB}MB)`] };
    }
    
    return { valid: true, errors: [] };
  },
  
  url(urlString) {
    if (!urlString || typeof urlString !== 'string') {
      return { valid: false, errors: ['URL不能为空'] };
    }
    
    try {
      const url = new URL(urlString);
      const allowedProtocols = ['http:', 'https:', 'blob:', 'data:'];
      if (!allowedProtocols.includes(url.protocol)) {
        return { valid: false, errors: [`不支持的协议: ${url.protocol}`] };
      }
      return { valid: true, errors: [] };
    } catch (e) {
      return { valid: false, errors: ['无效的URL格式'] };
    }
  },
  
  numeric(value, options = {}) {
    const { min, max, integer = false } = options;
    const errors = [];
    
    if (typeof value !== 'number' || isNaN(value)) {
      return { valid: false, errors: ['必须是有效数字'] };
    }
    
    if (integer && !Number.isInteger(value)) {
      errors.push('必须是整数');
    }
    
    if (min !== undefined && value < min) {
      errors.push(`不能小于 ${min}`);
    }
    
    if (max !== undefined && value > max) {
      errors.push(`不能大于 ${max}`);
    }
    
    return { valid: errors.length === 0, errors };
  },
  
  sanitize(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
};

export default validators;

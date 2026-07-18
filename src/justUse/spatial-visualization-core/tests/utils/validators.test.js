import { describe, it, expect, beforeEach, vi } from 'vitest';
import validators from '../../src/utils/validators.js';

describe('validators', () => {
  describe('coordinates', () => {
    it('should validate correct coordinates', () => {
      const result = validators.coordinates(116.0, 40.0, 100);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject invalid longitude', () => {
      const result = validators.coordinates(200, 40.0, 100);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('经度超出有效范围 (-180, 180)');
    });
    
    it('should reject invalid latitude', () => {
      const result = validators.coordinates(116.0, 100, 100);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('纬度超出有效范围 (-90, 90)');
    });
    
    it('should reject non-numeric values', () => {
      const result = validators.coordinates('abc', 40.0, 100);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('经度必须是有效数字');
    });
    
    it('should reject NaN values', () => {
      const result = validators.coordinates(NaN, 40.0, 100);
      expect(result.valid).toBe(false);
    });
  });
  
  describe('modelId', () => {
    it('should validate correct model ID', () => {
      const result = validators.modelId('model-123_test');
      expect(result.valid).toBe(true);
    });
    
    it('should reject empty ID', () => {
      const result = validators.modelId('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('模型ID不能为空');
    });
    
    it('should reject null ID', () => {
      const result = validators.modelId(null);
      expect(result.valid).toBe(false);
    });
    
    it('should reject ID with illegal characters', () => {
      const result = validators.modelId('model@123');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('非法字符');
    });
    
    it('should reject ID that is too long', () => {
      const longId = 'a'.repeat(300);
      const result = validators.modelId(longId);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('模型ID长度不能超过256字符');
    });
  });
  
  describe('fileName', () => {
    it('should validate correct file name', () => {
      const result = validators.fileName('model.ply');
      expect(result.valid).toBe(true);
    });
    
    it('should reject empty file name', () => {
      const result = validators.fileName('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('文件名不能为空');
    });
    
    it('should reject file name with illegal characters', () => {
      const result = validators.fileName('file<name>.ply');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('非法字符');
    });
    
    it('should validate extension when specified', () => {
      const result = validators.fileName('model.txt', ['ply', 'splat']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('不支持的文件类型');
    });
    
    it('should accept valid extension', () => {
      const result = validators.fileName('model.ply', ['ply', 'splat']);
      expect(result.valid).toBe(true);
    });
  });
  
  describe('fileSize', () => {
    it('should validate file size within limit', () => {
      const result = validators.fileSize(1024, 2048);
      expect(result.valid).toBe(true);
    });
    
    it('should reject file size exceeding limit', () => {
      const result = validators.fileSize(2048, 1024);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('超过限制');
    });
    
    it('should reject invalid size', () => {
      const result = validators.fileSize(-1);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('文件大小无效');
    });
    
    it('should reject NaN size', () => {
      const result = validators.fileSize(NaN);
      expect(result.valid).toBe(false);
    });
  });
  
  describe('url', () => {
    it('should validate http URL', () => {
      const result = validators.url('http://example.com/model.ply');
      expect(result.valid).toBe(true);
    });
    
    it('should validate https URL', () => {
      const result = validators.url('https://example.com/model.ply');
      expect(result.valid).toBe(true);
    });
    
    it('should validate blob URL', () => {
      const result = validators.url('blob:http://example.com/uuid');
      expect(result.valid).toBe(true);
    });
    
    it('should validate data URL', () => {
      const result = validators.url('data:text/plain;base64,SGVsbG8=');
      expect(result.valid).toBe(true);
    });
    
    it('should reject invalid URL', () => {
      const result = validators.url('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('无效的URL格式');
    });
    
    it('should reject unsupported protocol', () => {
      const result = validators.url('ftp://example.com/file');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('不支持的协议');
    });
  });
  
  describe('numeric', () => {
    it('should validate number in range', () => {
      const result = validators.numeric(5, { min: 0, max: 10 });
      expect(result.valid).toBe(true);
    });
    
    it('should reject number below minimum', () => {
      const result = validators.numeric(-1, { min: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('不能小于');
    });
    
    it('should reject number above maximum', () => {
      const result = validators.numeric(11, { max: 10 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('不能大于');
    });
    
    it('should validate integer', () => {
      const result = validators.numeric(5.5, { integer: true });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('必须是整数');
    });
  });
  
  describe('sanitize', () => {
    it('should escape HTML characters', () => {
      const result = validators.sanitize('<script>alert("xss")</script>');
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });
    
    it('should handle non-string input', () => {
      expect(validators.sanitize(null)).toBe('');
      expect(validators.sanitize(undefined)).toBe('');
      expect(validators.sanitize(123)).toBe('');
    });
  });
});

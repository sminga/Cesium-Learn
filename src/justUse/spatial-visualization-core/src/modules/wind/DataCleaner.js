/**
 * 风场数据清洗模块
 * @module modules/wind/DataCleaner
 * @description 对风场数据进行系统性清洗，识别并移除异常数据
 */

class DataCleaner {
  constructor(options = {}) {
    this.options = {
      // 异常值检测阈值
      outlierMethod: options.outlierMethod || 'iqr',  // 'iqr' | 'zscore' | 'mad'
      iqrMultiplier: options.iqrMultiplier || 1.5,
      zscoreThreshold: options.zscoreThreshold || 3,
      madThreshold: options.madThreshold || 3.5,
      
      // 风速合理性检查
      maxWindSpeed: options.maxWindSpeed || 100,  // m/s
      minWindSpeed: options.minWindSpeed || -100, // m/s
      
      // 空间一致性检查
      spatialCheck: options.spatialCheck !== false,
      spatialThreshold: options.spatialThreshold || 5,  // 标准差倍数
      
      // 时间一致性检查（用于时序数据）
      temporalCheck: options.temporalCheck || false,
      temporalThreshold: options.temporalThreshold || 3,
      
      // 缺失值处理
      missingValueHandling: options.missingValueHandling || 'interpolate',  // 'interpolate' | 'remove' | 'zero'
      
      ...options
    };
    
    this.statistics = {
      originalCount: 0,
      cleanedCount: 0,
      removedCount: 0,
      interpolatedCount: 0,
      outlierCount: 0,
      missingCount: 0
    };
    
    this.report = null;
  }

  clean(data) {
    this.statistics = {
      originalCount: 0,
      cleanedCount: 0,
      removedCount: 0,
      interpolatedCount: 0,
      outlierCount: 0,
      missingCount: 0
    };
    
    const cleanedData = {
      dimensions: { ...data.dimensions },
      lon: { ...data.lon },
      lat: { ...data.lat },
      lev: data.lev ? { ...data.lev } : null
    };
    
    const issues = [];
    
    if (data.U && data.U.array) {
      const result = this._cleanVariable(data.U, 'U', data);
      cleanedData.U = result.data;
      issues.push(...result.issues);
    }
    
    if (data.V && data.V.array) {
      const result = this._cleanVariable(data.V, 'V', data);
      cleanedData.V = result.data;
      issues.push(...result.issues);
    }
    
    if (data.W && data.W.array) {
      const result = this._cleanVariable(data.W, 'W', data);
      cleanedData.W = result.data;
      issues.push(...result.issues);
    }
    
    if (data.H && data.H.array) {
      const result = this._cleanVariable(data.H, 'H', data);
      cleanedData.H = result.data;
      issues.push(...result.issues);
    }
    
    this.report = {
      statistics: { ...this.statistics },
      issues,
      timestamp: new Date().toISOString(),
      options: { ...this.options }
    };
    
    return cleanedData;
  }

  _cleanVariable(variable, name, fullData) {
    const array = variable.array;
    const issues = [];
    
    this.statistics.originalCount += array.length;
    
    const cleanedArray = new Float32Array(array.length);
    const outlierMask = new Uint8Array(array.length);
    const missingMask = new Uint8Array(array.length);
    
    for (let i = 0; i < array.length; i++) {
      const value = array[i];
      
      if (this._isMissing(value)) {
        missingMask[i] = 1;
        this.statistics.missingCount++;
      } else if (this._isOutOfRange(value, name)) {
        outlierMask[i] = 1;
        this.statistics.outlierCount++;
        issues.push({
          type: 'out_of_range',
          variable: name,
          index: i,
          value,
          message: `${name}[${i}] = ${value} 超出合理范围`
        });
      }
    }
    
    const validValues = [];
    for (let i = 0; i < array.length; i++) {
      if (!missingMask[i] && !outlierMask[i]) {
        validValues.push(array[i]);
      }
    }
    
    if (validValues.length > 0) {
      const outlierIndices = this._detectStatisticalOutliers(validValues, array, outlierMask, missingMask);
      outlierIndices.forEach(i => {
        outlierMask[i] = 1;
        this.statistics.outlierCount++;
      });
    }
    
    for (let i = 0; i < array.length; i++) {
      if (missingMask[i] || outlierMask[i]) {
        if (this.options.missingValueHandling === 'interpolate') {
          cleanedArray[i] = this._interpolateValue(array, i, outlierMask, missingMask);
          this.statistics.interpolatedCount++;
        } else if (this.options.missingValueHandling === 'zero') {
          cleanedArray[i] = 0;
          this.statistics.interpolatedCount++;
        } else {
          cleanedArray[i] = NaN;
          this.statistics.removedCount++;
        }
      } else {
        cleanedArray[i] = array[i];
        this.statistics.cleanedCount++;
      }
    }
    
    const minMax = this._calculateMinMax(cleanedArray);
    
    return {
      data: {
        array: cleanedArray,
        min: minMax.min,
        max: minMax.max
      },
      issues
    };
  }

  _isMissing(value) {
    return isNaN(value) || 
           value === null || 
           value === undefined ||
           value === -9999 ||
           value === -9999.0 ||
           value === 1e20 ||
           value === -1e20;
  }

  _isOutOfRange(value, variableName) {
    if (variableName === 'U' || variableName === 'V' || variableName === 'W') {
      return Math.abs(value) > this.options.maxWindSpeed;
    }
    return false;
  }

  _detectStatisticalOutliers(validValues, fullArray, outlierMask, missingMask) {
    const outlierIndices = [];
    
    if (validValues.length < 4) return outlierIndices;
    
    const sorted = [...validValues].sort((a, b) => a - b);
    
    let lowerBound, upperBound;
    
    if (this.options.outlierMethod === 'iqr') {
      const q1Index = Math.floor(sorted.length * 0.25);
      const q3Index = Math.floor(sorted.length * 0.75);
      const q1 = sorted[q1Index];
      const q3 = sorted[q3Index];
      const iqr = q3 - q1;
      
      lowerBound = q1 - this.options.iqrMultiplier * iqr;
      upperBound = q3 + this.options.iqrMultiplier * iqr;
    } else if (this.options.outlierMethod === 'zscore') {
      const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
      const variance = validValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validValues.length;
      const std = Math.sqrt(variance);
      
      lowerBound = mean - this.options.zscoreThreshold * std;
      upperBound = mean + this.options.zscoreThreshold * std;
    } else if (this.options.outlierMethod === 'mad') {
      const median = sorted[Math.floor(sorted.length / 2)];
      const deviations = validValues.map(v => Math.abs(v - median)).sort((a, b) => a - b);
      const mad = deviations[Math.floor(deviations.length / 2)] * 1.4826;
      
      lowerBound = median - this.options.madThreshold * mad;
      upperBound = median + this.options.madThreshold * mad;
    }
    
    for (let i = 0; i < fullArray.length; i++) {
      if (!missingMask[i] && !outlierMask[i]) {
        const value = fullArray[i];
        if (value < lowerBound || value > upperBound) {
          outlierIndices.push(i);
        }
      }
    }
    
    return outlierIndices;
  }

  _interpolateValue(array, index, outlierMask, missingMask) {
    const { dimensions } = this.options;
    const width = dimensions?.lon || Math.sqrt(array.length);
    
    let leftIndex = index - 1;
    while (leftIndex >= 0 && (missingMask[leftIndex] || outlierMask[leftIndex])) {
      leftIndex--;
    }
    
    let rightIndex = index + 1;
    while (rightIndex < array.length && (missingMask[rightIndex] || outlierMask[rightIndex])) {
      rightIndex++;
    }
    
    if (leftIndex >= 0 && rightIndex < array.length) {
      const leftValue = array[leftIndex];
      const rightValue = array[rightIndex];
      const weight = (index - leftIndex) / (rightIndex - leftIndex);
      return leftValue * (1 - weight) + rightValue * weight;
    } else if (leftIndex >= 0) {
      return array[leftIndex];
    } else if (rightIndex < array.length) {
      return array[rightIndex];
    }
    
    return 0;
  }

  _calculateMinMax(array) {
    let min = Infinity;
    let max = -Infinity;
    
    for (const value of array) {
      if (!isNaN(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    
    if (min === Infinity) min = 0;
    if (max === -Infinity) max = 0;
    
    return { min, max };
  }

  validate(data) {
    const validationResults = {
      isValid: true,
      warnings: [],
      errors: [],
      statistics: {}
    };
    
    if (!data.dimensions) {
      validationResults.errors.push('缺少 dimensions 字段');
      validationResults.isValid = false;
    }
    
    if (!data.U || !data.U.array) {
      validationResults.errors.push('缺少 U (横向速度) 数据');
      validationResults.isValid = false;
    }
    
    if (!data.V || !data.V.array) {
      validationResults.errors.push('缺少 V (纵向速度) 数据');
      validationResults.isValid = false;
    }
    
    if (data.U && data.V) {
      if (data.U.array.length !== data.V.array.length) {
        validationResults.errors.push(`U 和 V 数据长度不一致: U=${data.U.array.length}, V=${data.V.array.length}`);
        validationResults.isValid = false;
      }
    }
    
    if (data.dimensions) {
      const expectedSize = (data.dimensions.lon || 1) * (data.dimensions.lat || 1) * (data.dimensions.lev || 1);
      if (data.U && data.U.array.length !== expectedSize) {
        validationResults.warnings.push(`数据大小 ${data.U.array.length} 与维度计算 ${expectedSize} 不匹配`);
      }
    }
    
    if (data.U && data.U.array) {
      const uStats = this._analyzeVariable(data.U.array, 'U');
      validationResults.statistics.U = uStats;
      
      if (uStats.missingPercent > 10) {
        validationResults.warnings.push(`U 数据缺失率过高: ${uStats.missingPercent.toFixed(1)}%`);
      }
      if (uStats.outlierPercent > 5) {
        validationResults.warnings.push(`U 数据异常值比例过高: ${uStats.outlierPercent.toFixed(1)}%`);
      }
    }
    
    if (data.V && data.V.array) {
      const vStats = this._analyzeVariable(data.V.array, 'V');
      validationResults.statistics.V = vStats;
      
      if (vStats.missingPercent > 10) {
        validationResults.warnings.push(`V 数据缺失率过高: ${vStats.missingPercent.toFixed(1)}%`);
      }
      if (vStats.outlierPercent > 5) {
        validationResults.warnings.push(`V 数据异常值比例过高: ${vStats.outlierPercent.toFixed(1)}%`);
      }
    }
    
    return validationResults;
  }

  _analyzeVariable(array, name) {
    let validCount = 0;
    let missingCount = 0;
    let outlierCount = 0;
    let sum = 0;
    let sumSq = 0;
    let min = Infinity;
    let max = -Infinity;
    
    for (const value of array) {
      if (this._isMissing(value)) {
        missingCount++;
      } else {
        validCount++;
        sum += value;
        sumSq += value * value;
        min = Math.min(min, value);
        max = Math.max(max, value);
        
        if (this._isOutOfRange(value, name)) {
          outlierCount++;
        }
      }
    }
    
    const mean = validCount > 0 ? sum / validCount : 0;
    const variance = validCount > 0 ? (sumSq / validCount) - (mean * mean) : 0;
    const std = Math.sqrt(Math.max(0, variance));
    
    return {
      count: array.length,
      validCount,
      missingCount,
      outlierCount,
      missingPercent: (missingCount / array.length) * 100,
      outlierPercent: (outlierCount / array.length) * 100,
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 0 : max,
      mean,
      std
    };
  }

  getReport() {
    return this.report;
  }

  getStatistics() {
    return this.statistics;
  }

  generateReportMarkdown() {
    if (!this.report) {
      return '# 数据清洗报告\n\n尚未执行数据清洗。';
    }
    
    const { statistics, issues, options } = this.report;
    
    let md = `# 风场数据清洗报告

## 清洗统计

| 指标 | 数值 |
|------|------|
| 原始数据点数 | ${statistics.originalCount} |
| 有效数据点数 | ${statistics.cleanedCount} |
| 移除数据点数 | ${statistics.removedCount} |
| 插值数据点数 | ${statistics.interpolatedCount} |
| 异常值数量 | ${statistics.outlierCount} |
| 缺失值数量 | ${statistics.missingCount} |

## 清洗参数

- **异常值检测方法**: ${options.outlierMethod}
- **缺失值处理方式**: ${options.missingValueHandling}
- **风速范围限制**: ${options.minWindSpeed} ~ ${options.maxWindSpeed} m/s

## 问题列表

`;
    
    if (issues.length === 0) {
      md += '未发现异常问题。\n';
    } else {
      const displayIssues = issues.slice(0, 20);
      displayIssues.forEach((issue, i) => {
        md += `${i + 1}. [${issue.type}] ${issue.message}\n`;
      });
      
      if (issues.length > 20) {
        md += `\n... 还有 ${issues.length - 20} 个问题未显示\n`;
      }
    }
    
    md += `
## 生成时间

${this.report.timestamp}
`;
    
    return md;
  }
}

export default DataCleaner;

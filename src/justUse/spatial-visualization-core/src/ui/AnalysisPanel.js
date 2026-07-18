/**
 * 分析面板
 * @module ui/AnalysisPanel
 * @description 提供火蔓延模拟结果的可视化分析
 */

class AnalysisPanel {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)
      : container;
    
    this.options = {
      chartHeight: options.chartHeight || 150,
      updateInterval: options.updateInterval || 1000,
      ...options
    };
    
    this.data = {
      burnedAreaHistory: [],
      perimeterHistory: [],
      spreadRateHistory: [],
      timestamps: []
    };
    
    this.charts = {};
    this._updateTimer = null;
    
    this._init();
  }

  _init() {
    this.container.innerHTML = `
      <div class="analysis-panel">
        <div class="analysis-header">
          <h3>火蔓延分析</h3>
          <div class="analysis-controls">
            <button id="exportAnalysisBtn" class="btn btn-sm">导出数据</button>
            <button id="clearAnalysisBtn" class="btn btn-sm">清除数据</button>
          </div>
        </div>
        <div class="analysis-content">
          <div class="chart-container" id="burnedAreaChart">
            <div class="chart-title">过火面积变化 (km²)</div>
            <canvas id="burnedAreaCanvas"></canvas>
          </div>
          <div class="chart-container" id="perimeterChart">
            <div class="chart-title">火线周长变化 (km)</div>
            <canvas id="perimeterCanvas"></canvas>
          </div>
          <div class="chart-container" id="spreadRateChart">
            <div class="chart-title">蔓延速度变化 (m/s)</div>
            <canvas id="spreadRateCanvas"></canvas>
          </div>
          <div class="statistics-summary" id="statsSummary">
            <div class="stat-item">
              <span class="stat-label">总过火面积</span>
              <span class="stat-value" id="totalBurnedArea">0.00 km²</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">当前周长</span>
              <span class="stat-value" id="currentPerimeter">0.00 km</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">最大蔓延速度</span>
              <span class="stat-value" id="maxSpreadRate">0.00 m/s</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">平均蔓延速度</span>
              <span class="stat-value" id="avgSpreadRate">0.00 m/s</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this._setupStyles();
    this._setupEventListeners();
    this._initCharts();
  }

  _setupStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .analysis-panel {
        background: rgba(30, 30, 30, 0.9);
        border-radius: 8px;
        padding: 15px;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .analysis-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        padding-bottom: 10px;
      }
      .analysis-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
      }
      .analysis-controls {
        display: flex;
        gap: 8px;
      }
      .btn {
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        color: #fff;
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .btn:hover {
        background: rgba(255,255,255,0.2);
      }
      .chart-container {
        margin-bottom: 15px;
      }
      .chart-title {
        font-size: 12px;
        color: rgba(255,255,255,0.7);
        margin-bottom: 5px;
      }
      .chart-container canvas {
        width: 100%;
        height: ${this.options.chartHeight}px;
        background: rgba(0,0,0,0.3);
        border-radius: 4px;
      }
      .statistics-summary {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
      .stat-item {
        background: rgba(255,255,255,0.05);
        padding: 10px;
        border-radius: 4px;
      }
      .stat-label {
        display: block;
        font-size: 11px;
        color: rgba(255,255,255,0.6);
        margin-bottom: 4px;
      }
      .stat-value {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  _setupEventListeners() {
    document.getElementById('exportAnalysisBtn')?.addEventListener('click', () => {
      this.exportData();
    });
    
    document.getElementById('clearAnalysisBtn')?.addEventListener('click', () => {
      this.clear();
    });
  }

  _initCharts() {
    this.charts.burnedArea = {
      canvas: document.getElementById('burnedAreaCanvas'),
      data: [],
      color: '#ff6b6b'
    };
    
    this.charts.perimeter = {
      canvas: document.getElementById('perimeterCanvas'),
      data: [],
      color: '#ffd93d'
    };
    
    this.charts.spreadRate = {
      canvas: document.getElementById('spreadRateCanvas'),
      data: [],
      color: '#6bcb77'
    };
  }

  update(statistics, history = null) {
    if (history) {
      this.data.burnedAreaHistory = history.map(h => h.burnedArea / 1000000);
      this.data.perimeterHistory = history.map(h => h.perimeter / 1000);
      this.data.spreadRateHistory = history.map(h => h.maxSpreadRate);
      this.data.timestamps = history.map(h => h.iteration);
    } else if (statistics) {
      this.data.burnedAreaHistory.push(statistics.burnedArea / 1000000);
      this.data.perimeterHistory.push(statistics.perimeter / 1000);
      this.data.spreadRateHistory.push(statistics.maxSpreadRate);
      this.data.timestamps.push(this.data.timestamps.length);
    }
    
    this._renderCharts();
    this._updateSummary(statistics);
  }

  _renderCharts() {
    this._renderChart(this.charts.burnedArea, this.data.burnedAreaHistory);
    this._renderChart(this.charts.perimeter, this.data.perimeterHistory);
    this._renderChart(this.charts.spreadRate, this.data.spreadRateHistory);
  }

  _renderChart(chart, data) {
    const canvas = chart.canvas;
    if (!canvas || data.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth * 2;
    const height = canvas.height = canvas.offsetHeight * 2;
    
    ctx.clearRect(0, 0, width, height);
    
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    const maxVal = Math.max(...data, 0.1);
    const minVal = Math.min(...data, 0);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    ctx.strokeStyle = chart.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    data.forEach((val, i) => {
      const x = padding + (chartWidth / (data.length - 1 || 1)) * i;
      const y = padding + chartHeight - ((val - minVal) / (maxVal - minVal || 1)) * chartHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(maxVal.toFixed(2), width - padding, padding - 5);
    ctx.fillText(minVal.toFixed(2), width - padding, height - padding + 20);
  }

  _updateSummary(statistics) {
    if (!statistics) return;
    
    document.getElementById('totalBurnedArea').textContent = 
      `${(statistics.burnedArea / 1000000).toFixed(2)} km²`;
    document.getElementById('currentPerimeter').textContent = 
      `${(statistics.perimeter / 1000).toFixed(2)} km`;
    document.getElementById('maxSpreadRate').textContent = 
      `${statistics.maxSpreadRate.toFixed(2)} m/s`;
    document.getElementById('avgSpreadRate').textContent = 
      `${(statistics.avgSpreadRate || 0).toFixed(2)} m/s`;
  }

  exportData() {
    const exportData = {
      timestamp: new Date().toISOString(),
      data: this.data,
      summary: {
        totalBurnedArea: this.data.burnedAreaHistory[this.data.burnedAreaHistory.length - 1] || 0,
        maxPerimeter: Math.max(...this.data.perimeterHistory, 0),
        maxSpreadRate: Math.max(...this.data.spreadRateHistory, 0)
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fire_analysis_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  clear() {
    this.data = {
      burnedAreaHistory: [],
      perimeterHistory: [],
      spreadRateHistory: [],
      timestamps: []
    };
    
    this._renderCharts();
    
    document.getElementById('totalBurnedArea').textContent = '0.00 km²';
    document.getElementById('currentPerimeter').textContent = '0.00 km';
    document.getElementById('maxSpreadRate').textContent = '0.00 m/s';
    document.getElementById('avgSpreadRate').textContent = '0.00 m/s';
  }

  show() {
    this.container.style.display = 'block';
  }

  hide() {
    this.container.style.display = 'none';
  }

  destroy() {
    if (this._updateTimer) {
      clearInterval(this._updateTimer);
    }
    this.container.innerHTML = '';
  }
}

export default AnalysisPanel;

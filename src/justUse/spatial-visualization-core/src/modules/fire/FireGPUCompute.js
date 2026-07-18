/**
 * GPU 加速火蔓延计算
 * @module modules/fire/FireGPUCompute
 * @description 使用 WebGL 进行 GPU 并行计算
 * 参考: PyTorchFire GPU 加速技术
 */

import EventEmitter from '../../core/EventEmitter.js';

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const PROPAGATE_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D u_fireGrid;
uniform sampler2D u_dem;
uniform sampler2D u_fuel;
uniform sampler2D u_wind;
uniform sampler2D u_moisture;

uniform float u_timeStep;
uniform float u_cellSize;
uniform vec2 u_resolution;
uniform float u_baseRate;

varying vec2 v_texCoord;

float getFireValue(sampler2D tex, vec2 coord, vec2 offset) {
  vec2 uv = coord + offset / u_resolution;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return -1.0;
  }
  return texture2D(tex, uv).r;
}

float calculateSlopeFactor(float elev1, float elev2, float cellSize) {
  float slope = (elev2 - elev1) / cellSize;
  float slopeAngle = atan(slope);
  return 1.0 + 0.5 * sin(2.0 * slopeAngle);
}

float calculateWindFactor(vec2 wind, vec2 direction) {
  float windSpeed = length(wind);
  if (windSpeed < 0.01) return 1.0;
  
  vec2 windDir = normalize(wind);
  float angleDiff = acos(dot(windDir, normalize(direction)));
  
  return 1.0 + 0.5 * cos(angleDiff) * windSpeed / 10.0;
}

void main() {
  float currentFire = texture2D(u_fireGrid, v_texCoord).r;
  
  // 已经燃烧过的区域
  if (currentFire >= 0.0 && currentFire < 1000.0) {
    gl_FragColor = vec4(currentFire, 0.0, 0.0, 1.0);
    return;
  }
  
  // 未燃烧区域，检查是否会被点燃
  float currentElev = texture2D(u_dem, v_texCoord).r;
  float currentFuel = texture2D(u_fuel, v_texCoord).r;
  vec2 currentWind = texture2D(u_wind, v_texCoord).rg;
  float currentMoisture = texture2D(u_moisture, v_texCoord).r;
  
  // 8 方向邻居
  vec2 offsets[8];
  offsets[0] = vec2(-1.0, -1.0);
  offsets[1] = vec2( 0.0, -1.0);
  offsets[2] = vec2( 1.0, -1.0);
  offsets[3] = vec2(-1.0,  0.0);
  offsets[4] = vec2( 1.0,  0.0);
  offsets[5] = vec2(-1.0,  1.0);
  offsets[6] = vec2( 0.0,  1.0);
  offsets[7] = vec2( 1.0,  1.0);
  
  float minIgnitionTime = 1000.0;
  
  for (int i = 0; i < 8; i++) {
    float neighborFire = getFireValue(u_fireGrid, v_texCoord, offsets[i]);
    
    // 邻居已燃烧
    if (neighborFire >= 0.0 && neighborFire < 1000.0) {
      float neighborElev = getFireValue(u_dem, v_texCoord, offsets[i]);
      
      // 计算蔓延速度
      float slopeFactor = calculateSlopeFactor(neighborElev, currentElev, u_cellSize);
      float windFactor = calculateWindFactor(currentWind, offsets[i]);
      
      // 燃料和湿度因子
      float fuelFactor = 0.5 + 0.5 * currentFuel;
      float moistureFactor = 1.0 - 0.5 * currentMoisture;
      
      float spreadRate = u_baseRate * slopeFactor * windFactor * fuelFactor * moistureFactor;
      spreadRate = max(0.01, spreadRate);
      
      // 计算距离
      float distance = length(offsets[i]) * u_cellSize;
      float timeToSpread = distance / spreadRate;
      
      float ignitionTime = neighborFire + timeToSpread;
      minIgnitionTime = min(minIgnitionTime, ignitionTime);
    }
  }
  
  // 如果在当前时间步内可以点燃
  if (minIgnitionTime < u_timeStep) {
    gl_FragColor = vec4(minIgnitionTime, 0.0, 0.0, 1.0);
  } else {
    gl_FragColor = vec4(1000.0, 0.0, 0.0, 1.0);
  }
}
`;

const LEVELSET_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D u_phi;
uniform sampler2D u_velocity;
uniform float u_dt;
uniform vec2 u_resolution;

varying vec2 v_texCoord;

void main() {
  float phi = texture2D(u_phi, v_texCoord).r;
  vec2 velocity = texture2D_velocity, v_texCoord).rg;
  
  // 计算梯度 (中心差分)
  float phiL = texture2D(u_phi, v_texCoord - vec2(1.0/u_resolution.x, 0.0)).r;
  float phiR = texture2D(u_phi, v_texCoord + vec2(1.0/u_resolution.x, 0.0)).r;
  float phiB = texture2D(u_phi, v_texCoord - vec2(0.0, 1.0/u_resolution.y)).r;
  float phiT = texture2D(u_phi, v_texCoord + vec2(0.0, 1.0/u_resolution.y)).r;
  
  // 迎风格式
  float gradX, gradY;
  
  if (velocity.x > 0.0) {
    gradX = (phi - phiL) * u_resolution.x;
  } else {
    gradX = (phiR - phi) * u_resolution.x;
  }
  
  if (velocity.y > 0.0) {
    gradY = (phi - phiB) * u_resolution.y;
  } else {
    gradY = (phiT - phi) * u_resolution.y;
  }
  
  float gradMag = sqrt(gradX * gradX + gradY * gradY);
  float speed = length(velocity);
  
  float newPhi = phi - speed * gradMag * u_dt;
  
  gl_FragColor = vec4(newPhi, 0.0, 0.0, 1.0);
}
`;

const REINIT_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D u_phi;
uniform vec2 u_resolution;

varying vec2 v_texCoord;

void main() {
  float phi = texture2D(u_phi, v_texCoord).r;
  
  // 计算梯度
  float phiL = texture2D(u_phi, v_texCoord - vec2(1.0/u_resolution.x, 0.0)).r;
  float phiR = texture2D(u_phi, v_texCoord + vec2(1.0/u_resolution.x, 0.0)).r;
  float phiB = texture2D(u_phi, v_texCoord - vec2(0.0, 1.0/u_resolution.y)).r;
  float phiT = texture2D(u_phi, v_texCoord + vec2(0.0, 1.0/u_resolution.y)).r;
  
  // Godunov 格式
  float dxm = phi - phiL;
  float dxp = phiR - phi;
  float dym = phi - phiB;
  float dyp = phiT - phi;
  
  float dx, dy;
  
  if (phi > 0.0) {
    dx = max(0.0, max(dxm, -dxp));
    dy = max(0.0, max(dym, -dyp));
  } else {
    dx = min(0.0, min(dxm, -dxp));
    dy = min(0.0, min(dym, -dyp));
  }
  
  float gradMag = sqrt(dx * dx + dy * dy);
  float sign = phi > 0.0 ? 1.0 : -1.0;
  
  float newPhi = phi - 0.5 * sign * (gradMag - 1.0);
  
  gl_FragColor = vec4(newPhi, 0.0, 0.0, 1.0);
}
`;

class FireGPUCompute extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      width: options.width || 512,
      height: options.height || 512,
      cellSize: options.cellSize || 30,
      baseRate: options.baseRate || 0.3,
      ...options
    };
    
    this.gl = null;
    this.programs = {};
    this.textures = {};
    this.framebuffers = {};
    
    this._initialized = false;
    this._iteration = 0;
  }

  init() {
    const canvas = document.createElement('canvas');
    canvas.width = this.options.width;
    canvas.height = this.options.height;
    
    this.gl = canvas.getContext('webgl2', {
      antialias: false,
      depth: false,
      stencil: false,
      alpha: false,
      preserveDrawingBuffer: true
    });
    
    if (!this.gl) {
      throw new Error('WebGL2 not supported');
    }
    
    this._initPrograms();
    this._initTextures();
    this._initBuffers();
    
    this._initialized = true;
    this.emit('initialized');
    
    return this;
  }

  _initPrograms() {
    this.programs.propagate = this._createProgram(VERTEX_SHADER, PROPAGATE_FRAGMENT_SHADER);
    this.programs.levelset = this._createProgram(VERTEX_SHADER, LEVELSET_FRAGMENT_SHADER);
    this.programs.reinit = this._createProgram(VERTEX_SHADER, REINIT_FRAGMENT_SHADER);
  }

  _createProgram(vertexSource, fragmentSource) {
    const gl = this.gl;
    
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);
    
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      throw new Error('Vertex shader compile error: ' + gl.getShaderInfoLog(vertexShader));
    }
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);
    
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      throw new Error('Fragment shader compile error: ' + gl.getShaderInfoLog(fragmentShader));
    }
    
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
    }
    
    return program;
  }

  _initTextures() {
    const gl = this.gl;
    const { width, height } = this.options;
    
    this.textures.fireGrid = this._createTexture(width, height);
    this.textures.fireGridBack = this._createTexture(width, height);
    this.textures.dem = this._createTexture(width, height);
    this.textures.fuel = this._createTexture(width, height);
    this.textures.wind = this._createTexture(width, height);
    this.textures.moisture = this._createTexture(width, height);
    this.textures.phi = this._createTexture(width, height);
    this.textures.phiBack = this._createTexture(width, height);
  }

  _createTexture(width, height) {
    const gl = this.gl;
    const texture = gl.createTexture();
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    return texture;
  }

  _initBuffers() {
    const gl = this.gl;
    
    const quadVertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);
    
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    
    this.framebuffers.main = gl.createFramebuffer();
  }

  setData(name, data) {
    const gl = this.gl;
    const texture = this.textures[name];
    
    if (!texture) {
      throw new Error(`Unknown texture: ${name}`);
    }
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    if (data instanceof Float32Array) {
      gl.texSubImage2D(
        gl.TEXTURE_2D, 0, 0, 0,
        this.options.width, this.options.height,
        gl.RED, gl.FLOAT, data
      );
    } else if (data.width && data.height) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    }
  }

  setDEM(demData) {
    this.setData('dem', demData);
  }

  setFuelGrid(fuelData) {
    this.setData('fuel', fuelData);
  }

  setWindField(windData) {
    const gl = this.gl;
    
    gl.bindTexture(gl.TEXTURE_2D, this.textures.wind);
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0, 0, 0,
      this.options.width, this.options.height,
      gl.RG, gl.FLOAT, windData
    );
  }

  setMoisture(moistureData) {
    this.setData('moisture', moistureData);
  }

  ignite(x, y) {
    const gl = this.gl;
    
    gl.bindTexture(gl.TEXTURE_2D, this.textures.fireGrid);
    
    const pixelData = new Float32Array([0]);
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0, x, y, 1, 1,
      gl.RED, gl.FLOAT, pixelData
    );
    
    this.emit('ignited', { x, y });
  }

  propagate(timeStep) {
    const gl = this.gl;
    
    gl.useProgram(this.programs.propagate);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.fireGrid);
    gl.uniform1i(gl.getUniformLocation(this.programs.propagate, 'u_fireGrid'), 0);
    
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.dem);
    gl.uniform1i(gl.getUniformLocation(this.programs.propagate, 'u_dem'), 1);
    
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.fuel);
    gl.uniform1i(gl.getUniformLocation(this.programs.propagate, 'u_fuel'), 2);
    
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.wind);
    gl.uniform1i(gl.getUniformLocation(this.programs.propagate, 'u_wind'), 3);
    
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.moisture);
    gl.uniform1i(gl.getUniformLocation(this.programs.propagate, 'u_moisture'), 4);
    
    gl.uniform1f(gl.getUniformLocation(this.programs.propagate, 'u_timeStep'), timeStep);
    gl.uniform1f(gl.getUniformLocation(this.programs.propagate, 'u_cellSize'), this.options.cellSize);
    gl.uniform2f(gl.getUniformLocation(this.programs.propagate, 'u_resolution'), this.options.width, this.options.height);
    gl.uniform1f(gl.getUniformLocation(this.programs.propagate, 'u_baseRate'), this.options.baseRate);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.main);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures.fireGridBack, 0);
    
    this._drawQuad();
    
    [this.textures.fireGrid, this.textures.fireGridBack] = 
      [this.textures.fireGridBack, this.textures.fireGrid];
    
    this._iteration++;
    
    const result = this._readResult();
    this.emit('propagated', { iteration: this._iteration, result });
    
    return result;
  }

  _drawQuad() {
    const gl = this.gl;
    
    const positionLocation = gl.getAttribLocation(this.programs.propagate, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    gl.viewport(0, 0, this.options.width, this.options.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  _readResult() {
    const gl = this.gl;
    const { width, height } = this.options;
    
    const result = new Float32Array(width * height * 4);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.main);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures.fireGrid, 0);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, result);
    
    return result;
  }

  getFireGrid() {
    return this._readResult();
  }

  getStatistics() {
    const data = this._readResult();
    let burnedCount = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] >= 0 && data[i] < 1000) {
        burnedCount++;
      }
    }
    
    const burnedArea = burnedCount * this.options.cellSize * this.options.cellSize;
    
    return {
      burnedCells: burnedCount,
      burnedArea,
      iteration: this._iteration
    };
  }

  reset() {
    const gl = this.gl;
    const { width, height } = this.options;
    
    const emptyData = new Float32Array(width * height * 4);
    emptyData.fill(1000);
    
    gl.bindTexture(gl.TEXTURE_2D, this.textures.fireGrid);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, emptyData);
    
    this._iteration = 0;
    this.emit('reset');
  }

  destroy() {
    const gl = this.gl;
    
    if (gl) {
      Object.values(this.textures).forEach(tex => gl.deleteTexture(tex));
      Object.values(this.programs).forEach(prog => gl.deleteProgram(prog));
      gl.deleteBuffer(this.vertexBuffer);
      gl.deleteFramebuffer(this.framebuffers.main);
    }
    
    this.textures = null;
    this.programs = null;
    this.gl = null;
    this._initialized = false;
    
    this.removeAllListeners();
  }
}

export default FireGPUCompute;

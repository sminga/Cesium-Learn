/**
 * 数学工具函数
 * @module utils/mathUtils
 */

export function degToRad(degrees) {
  return degrees * Math.PI / 180;
}

export function radToDeg(radians) {
  return radians * 180 / Math.PI;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function distance2D(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distance3D(x1, y1, z1, x2, y2, z2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function normalizeAngle(angle) {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

export function angleDifference(angle1, angle2) {
  let diff = angle2 - angle1;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

export function bilinearInterpolate(x, y, values) {
  const { x0, x1, y0, y1, v00, v10, v01, v11 } = values;
  
  const tx = (x - x0) / (x1 - x0);
  const ty = (y - y0) / (y1 - y0);
  
  const v0 = lerp(v00, v10, tx);
  const v1 = lerp(v01, v11, tx);
  
  return lerp(v0, v1, ty);
}

export function gaussianRandom(mean = 0, std = 1) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * std + mean;
}

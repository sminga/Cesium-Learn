/**
 * Three.js 覆盖层
 * @module modules/splat/ThreeOverlay
 * @description 将 Three.js 渲染与 Cesium 相机同步
 */

import * as THREE from 'three';
import * as Cesium from 'cesium';

class ThreeOverlay {
  constructor(camera) {
    this.cesiumCamera = camera;
    
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera();
    
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      logarithmicDepthBuffer: true
    });
    
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.autoClear = false;
    
    this.layers = [];
    
    this._syncCamera();
  }

  addLayer(layer) {
    const mesh = layer.getMesh();
    if (mesh) {
      this.scene.add(mesh);
      this.layers.push(layer);
    }
  }

  removeLayer(layer) {
    const mesh = layer.getMesh();
    if (mesh) {
      this.scene.remove(mesh);
      const index = this.layers.indexOf(layer);
      if (index > -1) {
        this.layers.splice(index, 1);
      }
    }
  }

  _syncCamera() {
    const cesiumPosition = this.cesiumCamera.position;
    const cesiumDirection = this.cesiumCamera.direction;
    const cesiumUp = this.cesiumCamera.up;
    
    const fov = Cesium.Math.toDegrees(this.cesiumCamera.frustum.fovy);
    const aspect = this.cesiumCamera.frustum.aspectRatio;
    const near = this.cesiumCamera.frustum.near;
    const far = this.cesiumCamera.frustum.far;
    
    this.camera.fov = fov;
    this.camera.aspect = aspect;
    this.camera.near = near;
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
    
    this.camera.position.set(
      cesiumPosition.x,
      cesiumPosition.y,
      cesiumPosition.z
    );
    
    this.camera.up.set(
      cesiumUp.x,
      cesiumUp.y,
      cesiumUp.z
    );
    
    this.camera.lookAt(
      cesiumPosition.x + cesiumDirection.x,
      cesiumPosition.y + cesiumDirection.y,
      cesiumPosition.z + cesiumDirection.z
    );
  }

  render() {
    this._syncCamera();
    this.renderer.resetState();
    this.renderer.clear(false, true, false);
    this.renderer.render(this.scene, this.camera);
  }

  setSize(width, height) {
    this.renderer.setSize(width, height);
  }

  destroy() {
    this.renderer.dispose();
    this.scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        object.material.dispose();
      }
    });
    
    this.layers = [];
  }
}

export default ThreeOverlay;

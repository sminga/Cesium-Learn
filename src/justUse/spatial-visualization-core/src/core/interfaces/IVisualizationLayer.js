/**
 * 可视化层接口
 * @module core/interfaces/IVisualizationLayer
 */

class IVisualizationLayer {
  constructor() {
    if (this.constructor === IVisualizationLayer) {
      throw new Error('IVisualizationLayer is an abstract class and cannot be instantiated directly');
    }
  }

  async init(viewer) {
    throw new Error('Method init must be implemented');
  }

  show() {
    throw new Error('Method show must be implemented');
  }

  hide() {
    throw new Error('Method hide must be implemented');
  }

  setVisible(visible) {
    throw new Error('Method setVisible must be implemented');
  }

  isVisible() {
    throw new Error('Method isVisible must be implemented');
  }

  setOptions(options) {
    throw new Error('Method setOptions must be implemented');
  }

  destroy() {
    throw new Error('Method destroy must be implemented');
  }
}

export default IVisualizationLayer;

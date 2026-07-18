/**
 * 统一数据提供者接口
 * @module core/interfaces/IDataProvider
 */

class IDataProvider {
  constructor() {
    if (this.constructor === IDataProvider) {
      throw new Error('IDataProvider is an abstract class and cannot be instantiated directly');
    }
  }

  async getDataAt(lon, lat, height = 0) {
    throw new Error('Method getDataAt must be implemented');
  }

  getExtent() {
    throw new Error('Method getExtent must be implemented');
  }

  isLoading() {
    throw new Error('Method isLoading must be implemented');
  }

  isReady() {
    throw new Error('Method isReady must be implemented');
  }

  destroy() {
    throw new Error('Method destroy must be implemented');
  }
}

export default IDataProvider;

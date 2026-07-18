import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [cesium()],
  server: {
    port: 5173,
    host: true,
    open: true
  },
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'SpatialVisualizationCore',
      fileName: (format) => `spatial-visualization-core.${format}.js`
    },
    rollupOptions: {
      external: ['cesium'],
      output: {
        globals: {
          cesium: 'Cesium'
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@core': '/src/core',
      '@modules': '/src/modules',
      '@utils': '/src/utils'
    }
  },
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['ply2splat']
  }
});

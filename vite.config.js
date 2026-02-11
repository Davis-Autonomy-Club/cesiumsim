import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 4173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  // Cesium is loaded from CDN, not bundled
  optimizeDeps: {
    include: [
      'three',
      'postprocessing',
      '@takram/three-atmosphere',
      '@takram/three-geospatial',
      '@takram/three-geospatial-effects',
      '@takram/three-clouds',
    ],
  },
});

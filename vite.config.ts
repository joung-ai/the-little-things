import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  define: { __STANDALONE__: 'false', __MODEL_EXT__: JSON.stringify('.glb') },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
  server: { host: true },
});

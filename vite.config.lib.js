import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/z-carousel.ts',
      name: 'z-carousel',
      fileName: 'index',
    },
  },
});

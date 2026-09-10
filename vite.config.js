import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './', // Relatív útvonalra állítva mindenhol helyesen fogja betölteni az asseteket
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        generator: resolve(__dirname, 'Dungeongenerator/View/dungeongenerator.html'),
      },
    },
  },
});
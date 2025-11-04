import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './js'),
      '@test': resolve(__dirname, './test'),
    },
  },
});
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@pathforge/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@pathforge/core': path.resolve(__dirname, '../../packages/core/src'),
      '@pathforge/validator': path.resolve(__dirname, '../../packages/validator/src'),
    },
  },
  server: {
    port: 3000,
  },
});

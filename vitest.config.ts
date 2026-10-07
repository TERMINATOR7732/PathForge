import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@pathforge/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@pathforge/core': path.resolve(__dirname, 'packages/core/src'),
      '@pathforge/validator': path.resolve(__dirname, 'packages/validator/src'),
    },
  },
});

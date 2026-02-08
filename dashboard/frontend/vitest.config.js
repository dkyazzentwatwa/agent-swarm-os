import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Use happy-dom for faster DOM simulation (alternative: jsdom)
    environment: 'happy-dom',

    // Setup file to run before all tests
    setupFiles: ['./src/test/setup.js'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.config.js',
        '**/dist/',
        '**/*.d.ts',
        'src-tauri/',
      ],
      // Target coverage thresholds
      lines: 60,
      functions: 60,
      branches: 60,
      statements: 60,
    },

    // Global test configuration
    globals: true,

    // Test file patterns
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],

    // Timeout for tests (ms)
    testTimeout: 10000,

    // Mock CSS modules
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
  },

  // Resolve alias to match vite.config.js
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

import { defineConfig } from 'vitest/config';

// Vitest configuration for the backend.
// The backend is TypeScript + ESM ("type": "module", run via tsx), and Vitest
// handles TS/ESM natively with no extra transpiler. The setup file applies the
// global fast-check configuration (numRuns >= 100) before any test runs.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});

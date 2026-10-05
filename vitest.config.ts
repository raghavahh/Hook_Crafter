import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'domain', root: './packages/domain', include: ['test/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'browser', root: './packages/browser', include: ['test/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'api', root: './api', include: ['test/**/*.test.ts'], environment: 'node' } },
      { test: { name: 'db', root: './supabase', include: ['tests/**/*.test.ts'], environment: 'node', testTimeout: 60000 } },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/domain/src/**', 'packages/browser/src/**', 'api/src/**'],
      exclude: ['**/index.ts', 'api/src/infrastructure/**', 'api/src/worker.ts'],
    },
  },
});

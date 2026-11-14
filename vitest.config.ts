// vitest.config.ts
// -----------------------------------------------------------------------------
// Vitest configuration for Sameer Shared SDK
//
// • Fully native ESM + TypeScript support (no build step needed)
// • Includes coverage reports using the v8 provider
// • Runs in Node environment (SDKs, APIs, crypto, filesystem)
// -----------------------------------------------------------------------------

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    silent: false, // for logs to appear
    globals: true, // Use global describe/it/expect like Jest
    environment: 'node', // Node.js environment (not browser)
    include: [
      'src/modules/**/tests/**/*.test.ts',
      'src/cli/**/tests/**/*.test.ts',
      'src/tests/api/tests/**/*.test.ts',
      'src/tests/seeds/tests/**/*.test.ts',
    ],
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      'src/modules/**/tests/integration/**',
      'src/modules/**/tests/vitests/integration/**',
      'src/modules/audit/tests/unit/audit.log.mongo.repo.unit.test.ts',
      'src/modules/shared/tests/unit/{mongo,rabbitmq,redis}/**/*.test.ts',
      'src/modules/security/tests/unit/{encryption,jwt,session,vault}/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8', // Fast native coverage via V8 engine
      reporter: ['text', 'html'], // Console + HTML report
      reportsDirectory: './coverage',
    },
    clearMocks: true,
    restoreMocks: true,
    passWithNoTests: false,
    logHeapUsage: false,
    slowTestThreshold: 2000,
  },
});

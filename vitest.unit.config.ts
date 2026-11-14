/**
 * @fileoverview Vitest configuration for integration and API functional tests.
 *
 * Purpose
 * ------------------------------------------------------------------------
 * Runs tests against the real Message Board application infrastructure:
 *
 * - Real MongoDB
 * - Real Redis
 * - Real Vault
 * - Real RabbitMQ
 * - Real repositories
 * - Real services
 * - Real controllers
 * - Real HTTP middleware
 *
 * No application dependencies are mocked.
 *
 * Important
 * ------------------------------------------------------------------------
 * The required infrastructure must already be running before this test suite
 * starts.
 *
 * `.env.development` is the default for local integration tests. Set
 * INTEGRATION_ENV_FILE to select another file. Runtime-injected values take
 * precedence, so the same config can run inside a Kubernetes workload.
 */

import { resolve } from 'node:path';

import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

/*
 * Load the integration environment before application modules are imported.
 *
 * This is important because env.config.ts may read process.env during module
 * initialization.
 */
const integrationEnvFile =
  process.env.INTEGRATION_ENV_FILE ?? process.env.ENV_FILE ?? '.env.development';
process.env.ENV_FILE = integrationEnvFile;

dotenv.config({
  path: resolve(process.cwd(), integrationEnvFile),
  override: false,
  quiet: true,
});

export default defineConfig({
  test: {
    silent: false,
    globals: true,
    environment: 'node',

    include: [
      'src/modules/**/tests/vitests/unit/**/*.test.ts',
      'src/modules/**/tests/unit/**/*.test.ts',
      'src/cli/**/tests/**/*.test.ts',
      'src/tests/api/tests/**/*.test.ts',
      'src/tests/seeds/tests/**/*.test.ts',
    ],

    exclude: [
      'node_modules',
      'dist',
      'coverage',
      'src/modules/**/tests/vitests/integration/**/*.test.ts',
      'src/modules/**/tests/integration/**/*.test.ts',
    ],

    /**
     * Run integration test files sequentially.
     *
     * This is important because the tests currently share:
     * - one MongoDB test database
     * - one Redis integration database
     * - one Vault instance
     * - one RabbitMQ instance
     */
    fileParallelism: false,

    /**
     * Optional but explicit.
     *
     * `fileParallelism: false` already forces one worker, but keeping
     * `maxWorkers: 1` makes the intended test behavior immediately clear.
     */
    maxWorkers: 1,

    /**
     * Real infrastructure and rate-limit scenarios can exceed 30 seconds when
     * the complete suite is running. Allow them to finish their cleanup before
     * Vitest advances to the next file that shares MongoDB and Redis.
     */
    testTimeout: 60_000,
    hookTimeout: 60_000,

    passWithNoTests: false,

    clearMocks: true,
    restoreMocks: true,

    logHeapUsage: false,
    slowTestThreshold: 5_000,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage/integration',
    },
  },
});

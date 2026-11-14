/** External-server API scenarios only; infrastructure and the server are started separately. */
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

// Load test/seed settings before scenarios import configuration-dependent modules.
const envFile = process.env.INTEGRATION_ENV_FILE ?? process.env.ENV_FILE ?? '.env.development';
process.env.ENV_FILE = resolve(process.cwd(), envFile);
dotenv.config({ path: process.env.ENV_FILE, override: false, quiet: true });
process.env.API_TEST_EMAIL_CLEANUP_JOURNAL = join(
  tmpdir(),
  `message-board-api-email-${randomUUID()}.jsonl`
);

export default defineConfig({
  test: {
    name: 'api',
    environment: 'node',
    globals: true,
    include: ['src/modules/**/tests/vitests/integration/api/**/*.test.ts'],
    globalSetup: ['src/tests/api/api.test.email-cleanup.setup.ts'],
    // Scenarios initially share real infrastructure; run files one at a time.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    passWithNoTests: false,
  },
});

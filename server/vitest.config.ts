import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    include: ['src/tests/**/*.test.ts'],
    globalSetup: './src/tests/global-setup.ts',
    setupFiles: ['./src/tests/setup-database.ts'],
  },
});

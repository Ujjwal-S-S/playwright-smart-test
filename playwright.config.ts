import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './examples/e-commerce/tests',
  timeout: 30000,
});

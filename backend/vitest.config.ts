import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { testTimeout: 150_000, hookTimeout: 30_000 },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/api.test.ts'],
    // Run tests sequentially in a single fork because they share a real DB
    pool: 'forks',
    forks: {
      singleFork: true,
    },
  },
});

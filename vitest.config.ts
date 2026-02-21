import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: false,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/e2e/**',
      // Hardhat tests must be run from /contracts via `npx hardhat test`
      '**/contracts/test/**',
    ],
  }
});

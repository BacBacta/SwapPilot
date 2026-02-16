import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests sequentially to avoid race conditions */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Use single worker for stability */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',

  expect: {
    timeout: 30_000,
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    navigationTimeout: 60_000,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    // Ensure the server starts from the web app directory even if Playwright is
    // launched from a different working directory (e.g. repo root or /contracts).
    // Use a production server for E2E stability (avoid lazy dev compilation timeouts).
    command: 'cd /workspaces/SwapPilot/apps/web && pnpm build && pnpm start',
    url: 'http://localhost:3000',
    // Avoid reusing a potentially stale/half-crashed dev server which can cause
    // cascading ERR_CONNECTION_REFUSED / page crashes across tests.
    // Opt-in reuse locally via PW_REUSE_EXISTING_SERVER=1.
    reuseExistingServer: !!process.env.PW_REUSE_EXISTING_SERVER,
    timeout: 300 * 1000,
  },
});

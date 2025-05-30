import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Docker environment
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: false, // Disable parallel execution to prevent race conditions
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: true,
  /* Retry on CI only */
  retries: 2,
  /* Opt out of parallel tests on CI. */
  workers: 1, // Run tests serially
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],
  /* Maximum time one test can run for */
  timeout: 120000, // 120 seconds per test (increased for Docker)
  /* Maximum time the whole test run can take */
  globalTimeout: 45 * 60 * 1000, // 45 minutes
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',

    /* Maximum time each action can take */
    actionTimeout: 30000, // Increased for Docker environment

    /* Navigation timeout */
    navigationTimeout: 60000, // Increased for Docker environment

    /* Expect timeout */
    expect: {
      timeout: 20000, // Increased for Docker environment
    },

    /* Configure test id attribute */
    testIdAttribute: 'data-testid',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },

    /* Test against Safari mobile browsers. */
    {
      name: 'Mobile Safari iPhone 12',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Mobile Safari iPhone 12 Pro Max',
      use: { ...devices['iPhone 12 Pro Max'] },
    },
  ],

  /* No webServer configuration for Docker - services are already running */
  webServer: undefined,
});
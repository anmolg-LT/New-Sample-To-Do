import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://anmolg-lt.github.io/New-Sample-To-Do/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Project name format parsed by lambdatest-setup.js:
      //   "<browser>:<version>:<platform>@lambdatest"
      // Examples: "pw-chromium:latest:macOS Sonoma@lambdatest"
      //           "pw-firefox:latest:Windows 11@lambdatest"
      name: 'chrome:latest:Windows 11@lambdatest',
      use: {},
      // Cloud browser provisioning + remote actions are slow. The fixture also
      // calls testInfo.setTimeout(180_000) per test as a safety net.
      timeout: 180_000,
    },
  ],
})

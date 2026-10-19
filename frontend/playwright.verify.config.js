import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'off',
    viewport: { width: 1600, height: 1000 }
  },
  webServer: {
    command: 'npx vite --config vite.verify.config.mjs',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})

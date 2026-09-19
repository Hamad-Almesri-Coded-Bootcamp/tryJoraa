import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local' })

/**
 * verify:ui runs against the DEPLOYED url, never localhost — a check that
 * passes locally and fails in production is worth nothing on Thursday.
 */
const baseURL = process.env.PUBLIC_SITE_URL
if (!baseURL) {
  throw new Error('PUBLIC_SITE_URL is not set. verify:ui runs against the deployed site, not localhost.')
}
if (!/^https:\/\//.test(baseURL)) {
  throw new Error(`PUBLIC_SITE_URL must be https (SE-4), got: ${baseURL}`)
}

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'ar-KW',
    timezoneId: 'Asia/Kuwait',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        // PLAYWRIGHT_CHANNEL=chrome uses the system Chrome when the Chromium download is unavailable
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
      },
    },
  ],
})

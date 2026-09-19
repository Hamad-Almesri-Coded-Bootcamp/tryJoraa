import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local' })

/**
 * verify:ui runs against the DEPLOYED url, never localhost — a check that
 * passes locally and fails in production is worth nothing on Thursday.
 *
 * Lane evidence only: a lane branch is never deployed to PUBLIC_SITE_URL before
 * it merges, so `VERIFY_UI_TARGET=http://localhost:3000 npm run verify:ui` runs
 * the same spec against a local `next start`. It is opt-in, localhost-only, and
 * is not the gate — the boss's run against PUBLIC_SITE_URL is (.plans/b.md,
 * Workflow proposals).
 */
const laneTarget = process.env.VERIFY_UI_TARGET
if (laneTarget && !/^http:\/\/localhost(:\d+)?\/?$/.test(laneTarget)) {
  throw new Error(`VERIFY_UI_TARGET may only be a localhost URL for lane evidence, got: ${laneTarget}`)
}
const baseURL = laneTarget || process.env.PUBLIC_SITE_URL
if (!baseURL) {
  throw new Error('PUBLIC_SITE_URL is not set. verify:ui runs against the deployed site, not localhost.')
}
if (!laneTarget && !/^https:\/\//.test(baseURL)) {
  throw new Error(`PUBLIC_SITE_URL must be https (SE-4), got: ${baseURL}`)
}

export default defineConfig({
  testDir: './e2e',
  // The gate is verify-ui.spec.ts only. The lane's proof spec (writes and removes a
  // row as RLS_TEST_A) runs only when asked: VERIFY_UI_PROOFS=1 npx playwright test e2e/proof-forms.spec.ts
  testMatch: process.env.VERIFY_UI_PROOFS ? ['**/*.spec.ts'] : ['**/verify-ui.spec.ts'],
  timeout: 120_000,
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

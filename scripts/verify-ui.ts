#!/usr/bin/env tsx
/**
 * verify-ui.ts — thin runner. `npm run verify:ui` calls `playwright test`
 * directly; this file exists so the command is discoverable next to
 * verify-rls.ts and so it can be run as `npx tsx scripts/verify-ui.ts`.
 * The actual checks live in e2e/verify-ui.spec.ts, configured by
 * playwright.config.ts (PUBLIC_SITE_URL, 390×844, Arabic pinned).
 */
import { spawnSync } from 'node:child_process'

const r = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(r.status ?? 1)

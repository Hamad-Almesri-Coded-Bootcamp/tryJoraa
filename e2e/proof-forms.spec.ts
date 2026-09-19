import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/**
 * Lane B proof runs for FE-3 / SE-5 / FE-5 (.plans/b.md tasks 4 and 5), run on
 * demand with `VERIFY_UI_PROOFS=1 npx playwright test e2e/proof-forms.spec.ts`.
 * Not part of the nightly gate (playwright.config.ts testMatch): it writes and
 * then removes one prescription as RLS_TEST_A.
 */
function need(k: string): string {
  const v = process.env[k]
  if (!v) throw new Error(`Missing ${k}`)
  return v
}
const A = { email: need('RLS_TEST_A_EMAIL'), password: need('RLS_TEST_A_PASSWORD') }
const sb = () => createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } })

async function countRxAsA() {
  const c = sb()
  await c.auth.signInWithPassword(A)
  const { count } = await c.from('prescriptions').select('id', { count: 'exact', head: true })
  await c.auth.signOut({ scope: 'local' })
  return count ?? 0
}

async function signIn(page: Page) {
  await page.goto('/sign-in?lang=en')
  await page.getByLabel(/Email/).fill(A.email)
  await page.getByLabel(/Password/).fill(A.password)
  await page.getByRole('button', { name: /^Sign in$/ }).click()
  await page.waitForURL(/\/dashboard/)
}

test.describe.configure({ mode: 'serial' })

test('add prescription: empty and 5,000-character entries are refused with a message and no row; a good entry lands', async ({ page }) => {
  const before = await countRxAsA()
  await signIn(page)
  await page.goto('/prescriptions/add')

  // 1 · empty submit
  await page.getByRole('button', { name: /Save prescription/ }).click()
  const status = page.getByRole('status')
  await expect(status).not.toHaveText('')
  console.log('empty submit →', (await status.innerText()).trim())
  expect(await countRxAsA(), 'no row after the empty submit').toBe(before)

  // 2 · 5,000 characters
  await page.getByLabel(/Generic name/).fill('x'.repeat(5000))
  await page.getByLabel(/^Strength$/).fill('500')
  await page.getByLabel(/Per dose/).fill('1')
  await page.getByLabel(/Times a day/).fill('2')
  await page.getByLabel(/Course length/).fill('7')
  await page.getByLabel(/Dispensing facility/).fill('Al-Amiri Hospital')
  await page.getByText('Public', { exact: true }).click()
  await page.getByRole('button', { name: /Save prescription/ }).click()
  await expect(status).not.toHaveText('')
  console.log('5,000-char submit →', (await status.innerText()).trim().slice(0, 120))
  expect(await countRxAsA(), 'no row after the 5,000-character submit').toBe(before)

  // 3 · a good entry
  await page.getByLabel(/Generic name/).fill('amoxicillin')
  await page.getByRole('button', { name: /Save prescription/ }).click()
  await page.waitForURL(/\/prescriptions$/, { timeout: 30_000 })
  await expect(page.getByText(/amoxicillin/i).first()).toBeVisible()
  await expect(page.getByText(/Al-Amiri Hospital/).first()).toBeVisible()
  const after = await countRxAsA()
  console.log(`good submit → rows ${before} → ${after}, badge "Al-Amiri Hospital · Public" visible`)
  expect(after).toBe(before + 1)

  // clean up as A (rx_delete_patient)
  const c = sb()
  await c.auth.signInWithPassword(A)
  const { data } = await c.from('prescriptions').select('id').eq('drug_name_generic', 'amoxicillin').eq('source_facility', 'Al-Amiri Hospital')
  for (const r of data ?? []) await c.from('prescriptions').delete().eq('id', r.id)
  await c.auth.signOut({ scope: 'local' })
  expect(await countRxAsA()).toBe(before)
})

test('dashboard: one real Mark taken press survives a refresh (FE-3, FE-5)', async ({ page }) => {
  await signIn(page)
  await page.goto('/dashboard?lang=en')
  const due = page.locator('[data-state="due"], [data-state="missed"]').first()
  if ((await due.count()) === 0) {
    console.log('no due dose today for RLS_TEST_A — press skipped, nothing to mark')
    return
  }
  const name = (await due.locator('p').first().innerText()).trim()
  await due.getByRole('button', { name: /Mark taken/ }).click()
  await expect(page.locator('[data-state="taken"]').filter({ hasText: name.split(' · ').pop() ?? '' }).first()).toBeVisible({ timeout: 15_000 })
  await page.reload()
  await expect(page.locator('[data-state="taken"]').filter({ hasText: name.split(' · ').pop() ?? '' }).first()).toBeVisible()
  console.log(`marked taken → "${name}" shows Taken after reload`)
  // put it back so the nightly gate sees the same data
  const c = sb()
  await c.auth.signInWithPassword(A)
  const { data: rx } = await c.from('prescriptions').select('id')
  const ids = (rx ?? []).map((r) => r.id)
  const { data: doses } = await c.from('doses').select('id, scheduled_at').in('prescription_id', ids).eq('status', 'taken').order('answered_at', { ascending: false }).limit(1)
  for (const d of doses ?? []) await c.from('doses').update({ status: 'due', answered_at: null }).eq('id', d.id)
  await c.auth.signOut({ scope: 'local' })
})

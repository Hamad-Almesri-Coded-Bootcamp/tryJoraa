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

/** D26: an extraction draft is accepted only by the patient, after correction; or discarded. */
async function insertDraftAsA(generic: string) {
  const c = sb()
  await c.auth.signInWithPassword(A)
  const me = (await c.auth.getUser()).data.user!.id
  const { data, error } = await c.from('prescription_drafts').insert({
    patient_id: me, source_image: null,
    extracted: { drug_name_generic: generic, strength_value: 500, strength_unit: 'mg', dose_per_administration: 1, frequency_per_day: 3, duration_days: 7, dosing_pattern: 'daily', route: 'oral', source_facility: 'Dar Al Shifa Hospital', source_sector: 'private' },
    confidence: { drug_name_generic: 0.94, strength_value: 0.81 },
  }).select('id').single()
  if (error) throw error
  await c.auth.signOut({ scope: 'local' })
  return data.id as string
}

test('drafts: the list shows the draft, accept with a correction inserts an `extracted` prescription and stamps the draft; discard deletes', async ({ page }) => {
  const before = await countRxAsA()
  const draftId = await insertDraftAsA('amoxicillin')
  const discardId = await insertDraftAsA('ibuprofen')
  await signIn(page)

  await page.goto('/prescriptions?lang=en')
  await expect(page.getByText(/Drafts awaiting your review/)).toBeVisible()
  await page.getByRole('link', { name: /amoxicillin/i }).first().click()
  await expect(page).toHaveURL(new RegExp(`/prescriptions/drafts/${draftId}`))
  await expect(page.getByText(/confidence 94%/)).toBeVisible()
  const strength = page.getByRole('spinbutton', { name: /^Strength/ }) // the label also carries the confidence hint
  await expect(strength).toHaveValue('500')
  await strength.fill('250') // the patient corrects the agent
  await page.getByRole('button', { name: /Accept into my prescriptions/ }).click()
  await page.waitForURL(/\/prescriptions$/, { timeout: 30_000 })
  await expect(page.getByText(/amoxicillin/i).first()).toBeVisible()

  const c = sb()
  await c.auth.signInWithPassword(A)
  const { data: rx } = await c.from('prescriptions').select('id, strength_value, source').eq('drug_name_generic', 'amoxicillin').eq('source', 'extracted')
  const { data: d } = await c.from('prescription_drafts').select('accepted_at').eq('id', draftId).single()
  console.log(`accepted → prescription source=${rx?.[0]?.source} strength=${rx?.[0]?.strength_value} (corrected from 500); draft accepted_at=${d?.accepted_at ? 'set' : 'NULL'}`)
  expect(rx?.[0]?.source).toBe('extracted')
  expect(Number(rx?.[0]?.strength_value)).toBe(250)
  expect(d?.accepted_at).not.toBeNull()

  // discard the second draft from its page
  await page.goto(`/prescriptions/drafts/${discardId}`)
  await page.getByRole('button', { name: /Discard draft/ }).click()
  await page.waitForURL(/\/prescriptions$/, { timeout: 30_000 })
  const { data: gone } = await c.from('prescription_drafts').select('id').eq('id', discardId)
  console.log(`discarded → draft rows left with that id: ${gone?.length ?? 0}`)
  expect(gone?.length ?? 0).toBe(0)

  // clean up: the accepted prescription and the accepted draft
  for (const r of rx ?? []) await c.from('prescriptions').delete().eq('id', r.id)
  await c.from('prescription_drafts').delete().eq('id', draftId)
  await c.auth.signOut({ scope: 'local' })
  expect(await countRxAsA()).toBe(before)
})

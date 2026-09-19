import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync } from 'node:fs'

/**
 * verify-ui — docs/technical-plan.md §10. Against PUBLIC_SITE_URL, locale
 * pinned to Arabic via ?lang=ar, 390×844. Signs in as RLS_TEST_A, walks the
 * four screens, screenshots each into docs/evidence/<date>/, asserts nothing
 * scrolls sideways; then signs in as RLS_TEST_B and opens A's prescription by
 * id and asserts the not-found state (SE-1, in a real browser).
 */

function need(k: string): string {
  const v = process.env[k]
  if (!v) throw new Error(`Missing ${k} in the environment (.env.local or CI secrets)`)
  return v
}

const A = { email: need('RLS_TEST_A_EMAIL'), password: need('RLS_TEST_A_PASSWORD') }
const B = { email: need('RLS_TEST_B_EMAIL'), password: need('RLS_TEST_B_PASSWORD') }
const DATE = new Date().toISOString().slice(0, 10)
const DIR = `docs/evidence/${DATE}`
mkdirSync(DIR, { recursive: true })

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true })
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth, `${name}: nothing scrolls sideways at 390px`).toBeLessThanOrEqual(390)
  await expect(page.getByRole('note'), `${name}: safety line present`).toBeVisible()
}

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto('/sign-in?lang=ar')
  await page.getByLabel(/البريد الإلكتروني/).fill(who.email)
  await page.getByLabel(/كلمة المرور/).fill(who.password)
  await page.getByRole('button', { name: /متابعة/ }).click()
  await page.waitForURL(/\/(dashboard|doctor)/)
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: /تسجيل الخروج/ }).click()
  await page.waitForURL(/\/sign-in/)
}

/** A's first prescription id, read as A with the anon key — RLS lets A see it. */
async function firstPrescriptionIdOfA(): Promise<string> {
  const sb = createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
  })
  const { error } = await sb.auth.signInWithPassword(A)
  if (error) throw error
  let { data } = await sb.from('prescriptions').select('id').limit(1).maybeSingle()
  if (!data) {
    // A has no prescriptions yet — create one so the cross-account probe has a target
    const ins = await sb.from('prescriptions').insert({
      patient_id: (await sb.auth.getUser()).data.user!.id,
      source: 'patient_entered', source_facility: 'UI probe clinic', source_sector: 'private',
      drug_name_generic: 'UI probe medicine', strength_value: 5, strength_unit: 'mg',
      dose_per_administration: 1, frequency_per_day: 1, duration_days: 1,
    }).select('id').single()
    if (ins.error) throw ins.error
    data = ins.data
  }
  await sb.auth.signOut()
  return data!.id
}

test.describe.configure({ mode: 'serial' })

test('the four screens at 390px, Arabic, as patient A', async ({ page }) => {
  await page.goto('/?lang=ar')
  await expect(page).toHaveURL(/\/$/)
  await shot(page, '01-landing')

  await page.goto('/sign-in')
  await shot(page, '02-sign-in')

  await signIn(page, A)
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('جرعات اليوم')
  await shot(page, '03-dashboard')

  await page.goto('/prescriptions')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('وصفاتي')
  await shot(page, '04-prescriptions')

  await signOut(page)
})

test("account B opening account A's prescription by id gets nothing back", async ({ page }) => {
  const id = await firstPrescriptionIdOfA()
  await signIn(page, B)
  await page.goto(`/prescriptions/${id}`)
  await expect(page.getByTestId('not-found')).toBeVisible()
  await expect(page.getByTestId('not-found')).toContainText('لا يوجد')
  await shot(page, '05-cross-account-not-found')
  console.log(`cross-account attempt: B opened /prescriptions/${id} → not-found state shown, no data`)
})

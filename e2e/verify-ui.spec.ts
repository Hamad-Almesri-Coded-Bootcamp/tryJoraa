import { test, expect, type Page, type ConsoleMessage } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync } from 'node:fs'

/**
 * verify-ui — docs/technical-plan.md §10, extended per .plans/b.md task 3.
 * Against PUBLIC_SITE_URL (or VERIFY_UI_TARGET=localhost for lane evidence), 390×844.
 *
 *  1. Click-through by real links: / → sign in → /dashboard → /prescriptions,
 *     then browser back twice — no error page, no blank screen (FE-2).
 *  2. Every built D29 route screenshotted in Arabic and in English into
 *     docs/evidence/<date>/; patient routes as RLS_TEST_A, doctor routes as
 *     RLS_TEST_DOCTOR_LINKED. On every shot: scrollWidth ≤ 390, no element with a
 *     computed font-size under 12px, the safety line present (FE-4).
 *  3. Console collected on every page: no mixed-content warning, no uncaught error (SE-4).
 *  4. The cross-account probe, unchanged: B opens A's prescription by id and gets
 *     the not-found state (SE-1, in a real browser).
 *
 * The route lists below grow with the branch; a route is added the task it lands.
 */

function need(k: string): string {
  const v = process.env[k]
  if (!v) throw new Error(`Missing ${k} in the environment (.env.local or CI secrets)`)
  return v
}

const A = { email: need('RLS_TEST_A_EMAIL'), password: need('RLS_TEST_A_PASSWORD') }
const B = { email: need('RLS_TEST_B_EMAIL'), password: need('RLS_TEST_B_PASSWORD') }
const DOC = { email: need('RLS_TEST_DOCTOR_LINKED_EMAIL'), password: need('RLS_TEST_DOCTOR_LINKED_PASSWORD') }
const DATE = new Date().toISOString().slice(0, 10)
const DIR = `docs/evidence/${DATE}`
mkdirSync(DIR, { recursive: true })

/** Built D29 routes. Dynamic ids are resolved at run time. */
const PUBLIC_ROUTES = ['/', '/sign-in', '/sign-up']
const PATIENT_ROUTES = ['/dashboard', '/prescriptions', '/prescriptions/[id]', '/prescriptions/add', '/history']
const DOCTOR_ROUTES = ['/doctor', '/doctor/patients/add', '/doctor/patients/[id]', '/doctor/prescriptions/new', '/doctor/alerts', '/doctor/medications']

const consoleIssues: string[] = []
function watchConsole(page: Page) {
  page.on('console', (m: ConsoleMessage) => {
    const text = m.text()
    if (/mixed content/i.test(text)) consoleIssues.push(`mixed content: ${text}`)
    if (m.type() === 'error' && !/favicon|ERR_ABORTED|net::ERR_/.test(text)) consoleIssues.push(`console.error: ${text}`)
  })
  page.on('pageerror', (e) => consoleIssues.push(`uncaught: ${e.message}`))
}

async function assertShot(page: Page, name: string) {
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready).catch(() => {})
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true })
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth, `${name}: nothing scrolls sideways at 390px`).toBeLessThanOrEqual(390)
  const small = await page.evaluate(() => {
    const out: string[] = []
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      if (!el.textContent?.trim()) continue
      if (el.classList.contains('sr-only')) continue
      const px = parseFloat(cs.fontSize)
      if (px > 0 && px < 12) out.push(`${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 40)} ${px}px`)
    }
    return out.slice(0, 5)
  })
  expect(small, `${name}: no text under 12px`).toEqual([])
  await expect(page.getByRole('note'), `${name}: safety line present`).toBeVisible()
  const bodyText = (await page.locator('body').innerText()).trim()
  expect(bodyText.length, `${name}: not a blank screen`).toBeGreaterThan(20)
  expect(bodyText, `${name}: no Next.js error page`).not.toMatch(/Application error|Unhandled Runtime Error|This page could not be found/)
}

async function signIn(page: Page, who: { email: string; password: string }, lang: 'ar' | 'en' = 'ar') {
  await page.goto(`/sign-in?lang=${lang}`)
  await page.getByLabel(lang === 'ar' ? /البريد الإلكتروني/ : /Email/).fill(who.email)
  await page.getByLabel(lang === 'ar' ? /كلمة المرور/ : /Password/).fill(who.password)
  await page.getByRole('button', { name: lang === 'ar' ? /تسجيل الدخول/ : /^Sign in$/ }).click()
  await page.waitForURL(/\/(dashboard|doctor)/)
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: /تسجيل الخروج|Sign out/ }).first().click()
  await page.waitForURL(/\/sign-in/)
}

function anonClient() {
  return createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } })
}

/** A's first prescription id, read as A with the anon key — RLS lets A see it. */
async function firstPrescriptionIdOfA(): Promise<string> {
  const sb = anonClient()
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
  await sb.auth.signOut({ scope: 'local' })
  return data!.id
}

/** The id of the patient the linked doctor may open (A), as the doctor sees it through doctor_patients. */
async function linkedPatientId(): Promise<string | null> {
  const sb = anonClient()
  const { error } = await sb.auth.signInWithPassword(DOC)
  if (error) throw error
  const { data } = await sb.from('doctor_patients').select('patient_id').limit(1).maybeSingle()
  await sb.auth.signOut({ scope: 'local' })
  return data?.patient_id ?? null
}

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ page }) => watchConsole(page))

test('click-through by real links, then back twice (FE-2)', async ({ page }) => {
  await page.goto('/?lang=ar')
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('link', { name: /تسجيل الدخول/ }).first().click()
  await expect(page).toHaveURL(/\/sign-in/)
  await page.getByLabel(/البريد الإلكتروني/).fill(A.email)
  await page.getByLabel(/كلمة المرور/).fill(A.password)
  await page.getByRole('button', { name: /تسجيل الدخول/ }).click()
  await page.waitForURL(/\/dashboard/)
  await page.getByRole('link', { name: /^وصفاتي$/ }).first().click()
  await expect(page).toHaveURL(/\/prescriptions$/)
  await assertShot(page, '00-clickthrough-prescriptions')
  await page.goBack()
  await expect(page).toHaveURL(/\/dashboard/)
  await assertShot(page, '00-back-1-dashboard')
  await page.goBack()
  await assertShot(page, '00-back-2')
  await page.goto('/dashboard')
  await signOut(page)
})

for (const lang of ['ar', 'en'] as const) {
  test(`public routes at 390px, ${lang}`, async ({ page }) => {
    for (const r of PUBLIC_ROUTES) {
      await page.goto(`${r}${r.includes('?') ? '&' : '?'}lang=${lang}`)
      await assertShot(page, `${lang}-public${r === '/' ? '-landing' : r.replaceAll('/', '-')}`)
    }
  })

  test(`patient routes at 390px as A, ${lang}`, async ({ page }) => {
    const rxId = await firstPrescriptionIdOfA()
    await signIn(page, A, lang)
    for (const r of PATIENT_ROUTES) {
      const url = r.replace('[id]', rxId)
      await page.goto(url)
      await assertShot(page, `${lang}-patient${r.replaceAll('/', '-').replace('[id]', 'id')}`)
    }
    await signOut(page)
  })

  test(`doctor routes at 390px as the linked doctor, ${lang}`, async ({ page }) => {
    const pid = await linkedPatientId()
    await signIn(page, DOC, lang)
    await expect(page).toHaveURL(/\/doctor/)
    for (const r of DOCTOR_ROUTES) {
      if (r.includes('[id]') && !pid) continue
      await page.goto(r.replace('[id]', pid ?? ''))
      await assertShot(page, `${lang}-doctor${r.replaceAll('/', '-').replace('[id]', 'id')}`)
    }
    await signOut(page)
  })
}

test("account B opening account A's prescription by id gets nothing back", async ({ page }) => {
  const id = await firstPrescriptionIdOfA()
  await signIn(page, B)
  await page.goto(`/prescriptions/${id}`)
  await expect(page.getByTestId('not-found')).toBeVisible()
  await expect(page.getByTestId('not-found')).toContainText('لا يوجد')
  await assertShot(page, '05-cross-account-not-found')
  console.log(`cross-account attempt: B opened /prescriptions/${id} → not-found state shown, no data`)
})

test('console: no mixed content, no uncaught error (SE-4)', async () => {
  expect(consoleIssues, 'console issues collected across every page').toEqual([])
})

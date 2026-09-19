#!/usr/bin/env tsx
/**
 * verify-rls.ts — proves account isolation. This is the gate.
 *
 * Signs in as PATIENT A with the ANON key only, creates rows, signs out,
 * signs in as PATIENT B, and then tries five different ways to touch A's data.
 * Every one of them must come back empty or error. Exits 1 if any succeeds.
 *
 *   Install once:  npm i -D tsx dotenv
 *   package.json:  "verify:rls": "tsx scripts/verify-rls.ts"
 *   Run:           npm run verify:rls
 *
 * .env.local needs:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
 *   RLS_TEST_A_EMAIL=...        RLS_TEST_A_PASSWORD=...
 *   RLS_TEST_B_EMAIL=...        RLS_TEST_B_PASSWORD=...
 *
 * The service role key must NEVER appear in this file or in the env it reads.
 * If it did, every probe below would pass and prove nothing.
 *
 * >>> EDIT THE `TABLES` BLOCK to match your real column names. <<<
 */

import { config } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

config({ path: '.env.local' })
config()

// ---------------------------------------------------------------- config ---

function need(key: string): string {
  const v = process.env[key]
  if (!v) {
    console.error(`\n  Missing env var ${key}. See the header of this file.\n`)
    process.exit(1)
  }
  return v
}

const SUPABASE_URL = need('NEXT_PUBLIC_SUPABASE_URL')
const ANON_KEY = need('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const A = { email: need('RLS_TEST_A_EMAIL'), password: need('RLS_TEST_A_PASSWORD') }
const B = { email: need('RLS_TEST_B_EMAIL'), password: need('RLS_TEST_B_PASSWORD') }

/**
 * Refuse to run with a privileged key. A service-role key bypasses RLS, so the
 * whole script would report PASS while proving nothing at all.
 */
function assertNotPrivileged(key: string) {
  if (key.startsWith('sb_secret_')) fail()
  const parts = key.split('.')
  if (parts.length === 3) {
    try {
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
      if (claims.role && claims.role !== 'anon') fail(claims.role)
    } catch {
      /* not a JWT we can read — the prefix check above still applies */
    }
  }
  function fail(role?: string) {
    console.error(
      `\n  REFUSING TO RUN: NEXT_PUBLIC_SUPABASE_ANON_KEY looks privileged` +
        (role ? ` (role="${role}")` : '') +
        `.\n  This test is meaningless with a key that bypasses RLS.\n`
    )
    process.exit(1)
  }
}
assertNotPrivileged(ANON_KEY)

// -------------------------------------------------------------- the plan ---
// Each entry: a table, how to create one row as A, and the column that says
// who owns it. `optional` means "if A cannot insert here directly, that is
// fine — skip it", which is correct for tables only the server writes to.

type Seed = { table: string; id: string }

const TABLES: Array<{
  table: string
  ownerColumn: string
  optional?: boolean
  row: (ctx: { userId: string; prescriptionId?: string }) => Record<string, unknown>
}> = [
  {
    table: 'prescriptions',
    ownerColumn: 'patient_id',
    row: ({ userId }) => ({
      patient_id: userId,
      doctor_id: userId, // self-prescribed test row; fine for an isolation probe
      medicine_name: 'RLS PROBE — delete me',
      strength: '500mg',
      dose_amount: 1,
      times_per_day: 2,
      duration_days: 3,
      pattern: 'daily',
    }),
  },
  {
    table: 'doses',
    ownerColumn: 'prescription_id',
    row: ({ prescriptionId }) => ({
      prescription_id: prescriptionId,
      scheduled_at: new Date().toISOString(),
      status: 'due',
    }),
  },
  {
    table: 'runs',
    ownerColumn: 'patient_id',
    optional: true,
    row: ({ userId }) => ({ patient_id: userId, status: 'queued' }),
  },
  {
    table: 'alerts',
    ownerColumn: 'patient_id',
    optional: true,
    row: ({ userId, prescriptionId }) => ({
      patient_id: userId,
      prescription_id: prescriptionId,
      reason: 'RLS PROBE — delete me',
      acknowledged: false,
    }),
  },
]

// ----------------------------------------------------------------- runner ---

const client = (): SupabaseClient =>
  createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })

async function signIn(who: { email: string; password: string }) {
  const sb = client()
  const { data, error } = await sb.auth.signInWithPassword(who)
  if (error || !data.user) {
    console.error(`\n  Could not sign in as ${who.email}: ${error?.message}`)
    console.error(`  Create both test accounts in Supabase Auth first.\n`)
    process.exit(1)
  }
  return { sb, userId: data.user.id }
}

let failures = 0
let checks = 0

function record(ok: boolean, label: string, detail = '') {
  checks++
  if (!ok) failures++
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`  ${mark}  ${label}${detail ? `  — ${detail}` : ''}`)
}

async function main() {
  console.log('\n  verify-rls · anon key only · two accounts\n')

  // --- 1. Seed as A -------------------------------------------------------
  console.log('  Signing in as A and seeding rows…')
  const a = await signIn(A)
  const seeds: Seed[] = []
  let prescriptionId: string | undefined

  for (const t of TABLES) {
    const payload = t.row({ userId: a.userId, prescriptionId })
    const { data, error } = await a.sb.from(t.table).insert(payload).select('id').single()
    if (error || !data) {
      if (t.optional) {
        console.log(`  note  ${t.table}: A cannot insert directly (${error?.message}). Skipping.`)
        continue
      }
      console.error(`\n  Could not seed ${t.table}: ${error?.message}`)
      console.error(`  Fix the column names in the TABLES block at the top of this file.\n`)
      process.exit(1)
    }
    seeds.push({ table: t.table, id: data.id })
    if (t.table === 'prescriptions') prescriptionId = data.id
  }
  await a.sb.auth.signOut()
  console.log(`  seeded ${seeds.length} row(s)\n`)

  // --- 2. Probe as B ------------------------------------------------------
  console.log('  Signing in as B and probing A\'s rows…\n')
  const b = await signIn(B)

  for (const seed of seeds) {
    console.log(`  [${seed.table}]`)

    const byId = await b.sb.from(seed.table).select('*').eq('id', seed.id)
    record((byId.data?.length ?? 0) === 0, 'select by id returns nothing')

    const all = await b.sb.from(seed.table).select('id')
    const leaked = (all.data ?? []).some((r: { id: string }) => r.id === seed.id)
    record(!leaked, 'select all does not contain A\'s row')

    const upd = await b.sb
      .from(seed.table)
      .update({ updated_at: new Date().toISOString() })
      .eq('id', seed.id)
      .select('id')
    record((upd.data?.length ?? 0) === 0, 'update affects nothing')

    const del = await b.sb.from(seed.table).delete().eq('id', seed.id).select('id')
    record((del.data?.length ?? 0) === 0, 'delete affects nothing')

    console.log('')
  }

  // The `with check` probe: can B create a row it claims A owns?
  const spoof = await b.sb
    .from('prescriptions')
    .insert({
      patient_id: a.userId,
      doctor_id: a.userId,
      medicine_name: 'SPOOF — should never exist',
      strength: '1mg',
      dose_amount: 1,
      times_per_day: 1,
      duration_days: 1,
      pattern: 'daily',
    })
    .select('id')
  record(
    !!spoof.error || (spoof.data?.length ?? 0) === 0,
    'B cannot insert a prescription owned by A',
    spoof.error ? '' : 'MISSING `with check` ON THE INSERT POLICY'
  )
  if (!spoof.error && spoof.data?.[0]?.id) {
    seeds.push({ table: 'prescriptions', id: spoof.data[0].id })
  }

  await b.sb.auth.signOut()

  // --- 3. Clean up as A ---------------------------------------------------
  const a2 = await signIn(A)
  for (const seed of [...seeds].reverse()) {
    await a2.sb.from(seed.table).delete().eq('id', seed.id)
  }
  await a2.sb.auth.signOut()

  // --- 4. Verdict ---------------------------------------------------------
  console.log(`\n  ${checks - failures}/${checks} checks passed\n`)
  if (failures > 0) {
    console.error(`  ${failures} FAILURE(S). Account B can reach account A's data.`)
    console.error(`  Do not merge. Do not demo. Fix the policy first.\n`)
    process.exit(1)
  }
  console.log('  Isolation holds. Safe to merge.\n')
}

main().catch((err) => {
  console.error('\n  verify-rls crashed:', err)
  process.exit(1)
})

#!/usr/bin/env tsx
/**
 * verify-rls.ts — proves account isolation. This is the gate.
 * docs/technical-plan.md §4. PRODUCT-DECISIONS.md D25, D28, D30.
 *
 * ANON KEY ONLY. The service role key appears nowhere in this file, not in
 * setup, not in teardown. Four throwaway accounts created by seed-auth.ts:
 *   A, B          two patients
 *   DOCTOR_LINKED  linked to A through doctor_patients
 *   DOCTOR_UNLINKED linked to nobody
 *
 * Eight probes. Every one prints PASS or FAIL. Exit 1 on any FAIL.
 *   1  B cannot select, update or delete any of A's rows — prescriptions, doses, runs, alerts
 *   2  B cannot insert a prescription with patient_id = A
 *   3  B cannot insert a row claiming source = 'jurah_doctor'
 *   4  the UNLINKED doctor reads nothing of A's, on every table
 *   5  the LINKED doctor reads A's prescription but cannot update one they did not author
 *   6  B reads nothing from depletion_forecast
 *   7  B reads none of A's audit_log rows; nobody can insert, update or delete an audit row
 *   8  SE-5 — oversized and absurd values are refused on A's OWN rows
 *
 * Probe 8 is not isolation, it is SE-5, and it lives here because this is the
 * one gate that talks to the database over PostgREST with the anon key — which
 * is the surface a judge (or anyone) actually reaches. Zod in the form cannot be
 * proved from here and does not need to be: the point of probe 8 is that the
 * database refuses on its own when the form is bypassed.
 *
 * When a probe fails, fix the policy. Never the assertion.
 */

import { config } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

config({ path: '.env.local' })
config()

// ---------------------------------------------------------------- config ---

function need(key: string): string {
  const v = process.env[key]
  if (!v) {
    console.error(`\n  Missing env var ${key}. Run scripts/seed-auth.ts first (lead's machine) or set CI secrets.\n`)
    process.exit(1)
  }
  return v
}

const SUPABASE_URL = need('NEXT_PUBLIC_SUPABASE_URL')
const ANON_KEY = need('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const A = { email: need('RLS_TEST_A_EMAIL'), password: need('RLS_TEST_A_PASSWORD') }
const B = { email: need('RLS_TEST_B_EMAIL'), password: need('RLS_TEST_B_PASSWORD') }
const DL = { email: need('RLS_TEST_DOCTOR_LINKED_EMAIL'), password: need('RLS_TEST_DOCTOR_LINKED_PASSWORD') }
const DU = { email: need('RLS_TEST_DOCTOR_UNLINKED_EMAIL'), password: need('RLS_TEST_DOCTOR_UNLINKED_PASSWORD') }

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
// Each entry: a table, how A creates one row, and a column B may try to update.
// `optional` means "if A cannot insert here directly, that is fine — skip it",
// which is correct for tables only the server writes to (alerts).

type Seed = { table: string; id: string }

const TABLES: Array<{
  table: string
  optional?: boolean
  /**
   * If the insert is refused, fall back to A's most recent existing row instead
   * of exiting. `runs` needs this: the cooldown trigger allows five inserts per
   * patient per fifteen minutes, and `runs` has no delete policy (it is a log,
   * by design — BE-5), so this script cannot clean up after itself. Without the
   * fallback the sixth run of `npm run verify:rls` inside fifteen minutes dies
   * on a hard exit and the merge gate goes red for a reason that looks like a
   * broken database. Isolation is just as provable against an older row.
   */
  reusable?: boolean
  update: Record<string, unknown>
  row: (ctx: { userId: string; prescriptionId?: string }) => Record<string, unknown>
}> = [
  {
    table: 'prescriptions',
    update: { notes: 'B was here' },
    row: ({ userId }) => ({
      patient_id: userId,
      source: 'patient_entered',
      source_facility: 'Isolation probe clinic',
      source_sector: 'private',
      drug_name_generic: 'Isolation probe medicine',
      strength_value: 500,
      strength_unit: 'mg',
      dose_per_administration: 1,
      frequency_per_day: 2,
      duration_days: 3,
      dosing_pattern: 'daily',
      // so the row appears in depletion_forecast (probe 6)
      dispense_date: new Date().toISOString().slice(0, 10),
      total_quantity_dispensed: 30,
      units_per_package: 30,
    }),
  },
  {
    table: 'runs',
    reusable: true,
    update: { status: 'failed' },
    row: ({ userId }) => ({ patient_id: userId, kind: 'check_doses' }),
  },
  {
    table: 'alerts',
    optional: true,
    update: { acknowledged_at: new Date().toISOString() },
    row: ({ userId, prescriptionId }) => ({
      patient_id: userId,
      prescription_id: prescriptionId,
      guardrail: 'G7',
      reason: 'isolation probe',
    }),
  },
]

// ----------------------------------------------------------------- runner ---

const client = (): SupabaseClient =>
  createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

async function signIn(who: { email: string; password: string }) {
  const sb = client()
  const { data, error } = await sb.auth.signInWithPassword(who)
  if (error || !data.user) {
    console.error(`\n  Could not sign in as ${who.email}: ${error?.message}`)
    console.error(`  Run scripts/seed-auth.ts on the lead's machine first.\n`)
    process.exit(1)
  }
  return { sb, userId: data.user.id }
}

let failures = 0
let checks = 0

function record(ok: boolean, label: string, detail = '') {
  checks++
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? `  — ${detail}` : ''}`)
}

const none = (r: { data: unknown[] | null; error: unknown }) => !!r.error || (r.data?.length ?? 0) === 0

async function main() {
  console.log('\n  verify-rls · anon key only · four accounts · eight probes\n')

  // --- 0. Seed as A -------------------------------------------------------
  console.log('  Signing in as A and seeding rows…')
  const a = await signIn(A)
  const seeds: Seed[] = []
  let prescriptionId: string | undefined

  for (const t of TABLES) {
    const payload = t.row({ userId: a.userId, prescriptionId })
    const { data, error } = await a.sb.from(t.table).insert(payload).select('id').single()
    if (error || !data) {
      if (t.optional) {
        console.log(`  note  ${t.table}: A cannot insert directly (${error?.message}). Only the agent writes it. Skipping.`)
        continue
      }
      if (t.reusable) {
        const prior = await a.sb.from(t.table).select('id').eq('patient_id', a.userId)
          .order('started_at', { ascending: false }).limit(1).maybeSingle()
        if (prior.data?.id) {
          console.log(`  note  ${t.table}: insert refused (${error?.message}) — reusing A's most recent row.`)
          seeds.push({ table: t.table, id: prior.data.id })
          continue
        }
      }
      console.error(`\n  Could not seed ${t.table}: ${error?.message}\n`)
      process.exit(1)
    }
    seeds.push({ table: t.table, id: data.id })
    if (t.table === 'prescriptions') prescriptionId = data.id
  }
  // the schedule engine generated doses for A's prescription — probe one of them
  const dose = await a.sb.from('doses').select('id').eq('prescription_id', prescriptionId!).limit(1).single()
  if (dose.error || !dose.data) {
    console.error(`\n  generate_doses produced no doses for A's prescription: ${dose.error?.message}\n`)
    process.exit(1)
  }
  seeds.splice(1, 0, { table: 'doses', id: dose.data.id })
  // A's own audit row exists (written by the trigger) — needed for probe 7
  const aAudit = await a.sb.from('audit_log').select('id').eq('row_id', prescriptionId!).limit(1)
  record((aAudit.data?.length ?? 0) > 0, 'setup: the audit trigger wrote a row A can read')
  const aDepl = await a.sb.from('depletion_forecast').select('prescription_id').eq('prescription_id', prescriptionId!)
  record((aDepl.data?.length ?? 0) === 1, 'setup: A sees their own depletion_forecast row')
  await a.sb.auth.signOut()
  console.log(`  seeded ${seeds.length} row(s): ${seeds.map((s) => s.table).join(', ')}\n`)

  const updateFor = (table: string) =>
    TABLES.find((t) => t.table === table)?.update ?? { status: 'skipped' }

  // --- 1. B against A's rows ---------------------------------------------
  console.log('  Probe 1 · B cannot select, update or delete A\'s rows')
  const b = await signIn(B)
  for (const seed of seeds) {
    const byId = await b.sb.from(seed.table).select('*').eq('id', seed.id)
    record(none(byId), `[${seed.table}] select by id returns nothing`)
    const all = await b.sb.from(seed.table).select('id')
    record(!(all.data ?? []).some((r: { id: string }) => r.id === seed.id), `[${seed.table}] select all omits A's row`)
    const upd = await b.sb.from(seed.table).update(updateFor(seed.table)).eq('id', seed.id).select('id')
    record(none(upd), `[${seed.table}] update affects nothing`)
    const del = await b.sb.from(seed.table).delete().eq('id', seed.id).select('id')
    record(none(del), `[${seed.table}] delete affects nothing`)
  }

  // --- 2. B spoofs patient_id = A -------------------------------------------
  console.log('\n  Probe 2 · B cannot insert a prescription owned by A')
  const spoof = await b.sb
    .from('prescriptions')
    .insert({ ...TABLES[0].row({ userId: a.userId }), drug_name_generic: 'Spoof — must never exist' })
    .select('id')
  record(none(spoof), 'insert with patient_id = A is refused', spoof.error ? '' : 'MISSING with check ON THE INSERT POLICY')
  if (!spoof.error && spoof.data?.[0]?.id) seeds.push({ table: 'prescriptions', id: spoof.data[0].id })

  // --- 3. B claims source = jurah_doctor ------------------------------------
  console.log('\n  Probe 3 · B cannot claim source = jurah_doctor')
  const claim = await b.sb
    .from('prescriptions')
    .insert({ ...TABLES[0].row({ userId: b.userId }), source: 'jurah_doctor', doctor_id: b.userId })
    .select('id')
  record(none(claim), 'insert with source = jurah_doctor by a patient is refused')
  if (!claim.error && claim.data?.[0]?.id) seeds.push({ table: 'prescriptions', id: claim.data[0].id })

  // --- 6. B and depletion_forecast -----------------------------------------
  console.log('\n  Probe 6 · B reads nothing from depletion_forecast')
  const depl = await b.sb.from('depletion_forecast').select('prescription_id').eq('prescription_id', prescriptionId!)
  record(none(depl), 'A\'s forecast row is invisible to B', depl.error ? '' : 'VIEW IS NOT security_invoker')

  // --- 7. audit_log -----------------------------------------------------------
  console.log('\n  Probe 7 · audit_log is read like a prescription and never written directly')
  const bAudit = await b.sb.from('audit_log').select('id').eq('patient_id', a.userId)
  record(none(bAudit), 'B reads none of A\'s audit rows')
  const bAuditIns = await b.sb.from('audit_log').insert({
    actor_role: 'patient', patient_id: b.userId, table_name: 'prescriptions',
    row_id: prescriptionId, action: 'insert', after: {},
  }).select('id')
  record(!!bAuditIns.error, 'B cannot insert an audit row about themselves', bAuditIns.error ? '' : 'AUDIT_LOG HAS A WRITE PATH')
  await b.sb.auth.signOut()

  const a2 = await signIn(A)
  const aAuditIns = await a2.sb.from('audit_log').insert({
    actor_role: 'patient', patient_id: a.userId, table_name: 'prescriptions',
    row_id: prescriptionId, action: 'insert', after: {},
  }).select('id')
  record(!!aAuditIns.error, 'A cannot insert into their own trail')
  const aAuditUpd = await a2.sb.from('audit_log').update({ action: 'delete' }).eq('patient_id', a.userId).select('id')
  record(none(aAuditUpd), 'A cannot update their own trail')
  const aAuditDel = await a2.sb.from('audit_log').delete().eq('patient_id', a.userId).select('id')
  record(none(aAuditDel), 'A cannot delete their own trail')
  await a2.sb.auth.signOut()

  // --- 4. the unlinked doctor -------------------------------------------------
  console.log('\n  Probe 4 · the unlinked doctor reads nothing of A\'s')
  const du = await signIn(DU)
  for (const seed of seeds) {
    const r = await du.sb.from(seed.table).select('id').eq('id', seed.id)
    record(none(r), `[${seed.table}] unlinked doctor sees nothing`)
  }
  record(none(await du.sb.from('audit_log').select('id').eq('patient_id', a.userId)), '[audit_log] unlinked doctor sees nothing')
  record(none(await du.sb.from('depletion_forecast').select('prescription_id').eq('patient_id', a.userId)), '[depletion_forecast] unlinked doctor sees nothing')
  record(none(await du.sb.from('profiles').select('id').eq('id', a.userId)), '[profiles] unlinked doctor cannot see A\'s profile')
  await du.sb.auth.signOut()

  // --- 5. the linked doctor -----------------------------------------------------
  console.log('\n  Probe 5 · the linked doctor reads A but cannot edit what they did not author')
  const dl = await signIn(DL)
  const dlRx = await dl.sb.from('prescriptions').select('id').eq('id', prescriptionId!)
  record((dlRx.data?.length ?? 0) === 1, 'linked doctor reads A\'s prescription')
  const dlDose = await dl.sb.from('doses').select('id').eq('prescription_id', prescriptionId!).limit(1)
  record((dlDose.data?.length ?? 0) === 1, 'linked doctor reads A\'s doses')
  const dlAudit = await dl.sb.from('audit_log').select('id').eq('patient_id', a.userId).limit(1)
  record((dlAudit.data?.length ?? 0) === 1, 'linked doctor reads A\'s audit trail')
  const dlUpd = await dl.sb.from('prescriptions').update({ notes: 'doctor was here' }).eq('id', prescriptionId!).select('id')
  record(none(dlUpd), 'linked doctor cannot update a prescription they did not author', dlUpd.error ? '' : 'rx_update_doctor MUST USE doctor_id, NOT THE LINK')
  const dlDel = await dl.sb.from('prescriptions').delete().eq('id', prescriptionId!).select('id')
  record(none(dlDel), 'linked doctor cannot delete A\'s prescription')
  const dlDraft = await dl.sb.from('prescription_drafts').select('id').eq('patient_id', a.userId)
  record(none(dlDraft), 'linked doctor reads no prescription_drafts (patient-only)')
  const dlRun = await dl.sb.from('runs').select('id').eq('patient_id', a.userId)
  record(none(dlRun), 'linked doctor reads no runs (patient-only)')
  await dl.sb.auth.signOut()

  // --- 8. SE-5, on A's own rows ---------------------------------------------
  // Everything above asks "can B reach A?". This asks "can A store nonsense?",
  // which is the other way a row goes bad. A owns these rows, so RLS is happy
  // and only the CHECK constraints and handle_new_user stand in the way.
  console.log('\n  Probe 8 · SE-5 · oversized input is refused by the database')
  const a4 = await signIn(A)
  const long = 'x'.repeat(5000)

  /**
   * A refusal only counts if the DATABASE refused it. `!!error` would let a
   * dropped connection or an expired token report PASS, which is the one way a
   * security probe can lie. 23514 = check_violation, 23505 = unique_violation,
   * 22001 = string too long.
   */
  const CONSTRAINT = new Set(['23514', '23505', '22001'])
  const refused = (r: { error: { code?: string } | null }) => CONSTRAINT.has(r.error?.code ?? '')

  const rxNotes = await a4.sb.from('prescriptions').update({ notes: long }).eq('id', prescriptionId!).select('id')
  record(refused(rxNotes), '5,000-character notes is refused', rxNotes.error ? '' : 'rx_notes_len IS MISSING — 20260919235500_input_limits.sql NOT APPLIED')

  const rxName = await a4.sb.from('prescriptions').insert({ ...TABLES[0].row({ userId: a4.userId }), drug_name_generic: long }).select('id')
  record(refused(rxName), '5,000-character drug name is refused', rxName.error ? '' : 'rx_generic_len IS MISSING')
  if (!rxName.error && rxName.data?.[0]?.id) seeds.push({ table: 'prescriptions', id: rxName.data[0].id })

  const rxDose = await a4.sb.from('prescriptions').insert({ ...TABLES[0].row({ userId: a4.userId }), dose_per_administration: 500000 }).select('id')
  record(refused(rxDose), 'a dose of 500000 is refused', rxDose.error ? '' : 'rx_dose_max IS MISSING')
  if (!rxDose.error && rxDose.data?.[0]?.id) seeds.push({ table: 'prescriptions', id: rxDose.data[0].id })

  // profiles: authenticated holds UPDATE on (full_name, civil_id) only.
  // Read first, attempt the bad writes, then confirm nothing moved — the test
  // account is left exactly as it was found.
  const before = await a4.sb.from('profiles').select('full_name, civil_id').eq('id', a4.userId).single()
  const pName = await a4.sb.from('profiles').update({ full_name: long }).eq('id', a4.userId).select('id')
  record(refused(pName), '5,000-character full_name is refused', pName.error ? '' : 'profiles_full_name_len IS MISSING')
  const pCivil = await a4.sb.from('profiles').update({ civil_id: 'not-twelve-digits' }).eq('id', a4.userId).select('id')
  record(refused(pCivil), 'a civil_id that is not 12 digits is refused', pCivil.error ? '' : 'profiles_civil_id_format IS MISSING')
  // `authenticated` really does hold `grant update (full_name, civil_id) on
  // profiles`, so if the constraints are absent those two writes LAND. Checking
  // and walking away would leave A with a 5,000-character name and a malformed
  // civil ID — and 20260919235500_input_limits.sql could then never be applied,
  // because validating `profiles_civil_id_format` against that row fails. The
  // gate would have poisoned the fix for its own failure. Restore, always.
  const after = await a4.sb.from('profiles').select('full_name, civil_id').eq('id', a4.userId).single()
  const intact =
    before.data?.full_name === after.data?.full_name &&
    before.data?.civil_id === after.data?.civil_id

  if (!intact && before.data) {
    const restore = await a4.sb
      .from('profiles')
      .update({ full_name: before.data.full_name, civil_id: before.data.civil_id })
      .eq('id', a4.userId)
      .select('id')
    record(false, 'A\'s profile was MODIFIED by the refused writes', restore.error
      ? `restore FAILED: ${restore.error.message} — fix A's profile by hand before applying input_limits`
      : 'restored to its previous values')
  } else {
    record(true, 'A\'s profile is unchanged after the refused writes')
  }

  // The mirror of all of the above: ordinary values still go in. A gate that
  // refuses everything is not a gate, it is an outage.
  const ok = await a4.sb.from('prescriptions').update({ notes: 'Take with food.' }).eq('id', prescriptionId!).select('id')
  record(!ok.error && (ok.data?.length ?? 0) === 1, 'an ordinary note is still accepted', ok.error?.message ?? '')
  await a4.sb.auth.signOut()

  // --- Clean up as A -----------------------------------------------------------
  const a3 = await signIn(A)
  for (const seed of [...seeds].reverse()) {
    if (seed.table === 'runs') continue // runs is a log — no delete policy, by design (BE-5)
    await a3.sb.from(seed.table).delete().eq('id', seed.id)
  }
  await a3.sb.auth.signOut()

  // --- Verdict -------------------------------------------------------------------
  console.log(`\n  ${checks - failures}/${checks} checks passed\n`)
  if (failures > 0) {
    console.error(`  ${failures} FAILURE(S). Another account can reach data it must not.`)
    console.error(`  Do not merge. Do not demo. Fix the policy first — never the assertion.\n`)
    process.exit(1)
  }
  console.log('  Isolation holds. Safe to merge.\n')
}

main().catch((err) => {
  console.error('\n  verify-rls crashed:', err)
  process.exit(1)
})

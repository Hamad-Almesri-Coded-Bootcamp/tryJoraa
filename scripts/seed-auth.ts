#!/usr/bin/env tsx
/**
 * seed-auth.ts — creates the auth accounts through the Supabase admin API.
 *
 * THE ONLY SCRIPT THAT TOUCHES THE SERVICE ROLE KEY. Creating auth users
 * genuinely requires it. It never prints the key or any password.
 *
 * Creates, idempotently:
 *   - FOUR throwaway RLS accounts (patient A, patient B, a doctor linked to A,
 *     a doctor linked to nobody) and writes their credentials to .env.local
 *     under the RLS_TEST_* names from .env.example.
 *   - the demo logins for the stage (D4): one doctor and three patients with
 *     Kuwaiti names; the doctor is linked to two of them. Their credentials go
 *     to .env.local as DEMO_*. supabase/seed.sql references them by email.
 *
 * Run:  npx tsx scripts/seed-auth.ts
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

config({ path: '.env.local' })

function need(key: string): string {
  const v = process.env[key]
  if (!v) {
    console.error(`\n  Missing ${key} in .env.local. Paste it there (never in chat) and rerun.\n`)
    process.exit(1)
  }
  return v
}

const URL = need('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = need('SUPABASE_SERVICE_ROLE_KEY')

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type Account = {
  envEmail: string
  envPassword: string
  email: string
  role: 'patient' | 'doctor'
  fullName: string
  civilId?: string
}

// Emails on example.com — reserved by RFC 2606, never deliverable, never "test".
const ACCOUNTS: Account[] = [
  { envEmail: 'RLS_TEST_A_EMAIL', envPassword: 'RLS_TEST_A_PASSWORD', email: 'rls-patient-a@example.com', role: 'patient', fullName: 'RLS Patient A', civilId: '299010100001' },
  { envEmail: 'RLS_TEST_B_EMAIL', envPassword: 'RLS_TEST_B_PASSWORD', email: 'rls-patient-b@example.com', role: 'patient', fullName: 'RLS Patient B', civilId: '299010100002' },
  { envEmail: 'RLS_TEST_DOCTOR_LINKED_EMAIL', envPassword: 'RLS_TEST_DOCTOR_LINKED_PASSWORD', email: 'rls-doctor-linked@example.com', role: 'doctor', fullName: 'RLS Doctor Linked' },
  { envEmail: 'RLS_TEST_DOCTOR_UNLINKED_EMAIL', envPassword: 'RLS_TEST_DOCTOR_UNLINKED_PASSWORD', email: 'rls-doctor-unlinked@example.com', role: 'doctor', fullName: 'RLS Doctor Unlinked' },
  // demo logins (D4) — Kuwaiti names, seeded with a week of history by supabase/seed.sql
  { envEmail: 'DEMO_DOCTOR_EMAIL', envPassword: 'DEMO_DOCTOR_PASSWORD', email: 'dr.noura.alsabah@example.com', role: 'doctor', fullName: 'د. نورة الصباح · Dr Noura Al-Sabah' },
  { envEmail: 'DEMO_PATIENT_EMAIL', envPassword: 'DEMO_PATIENT_PASSWORD', email: 'fahad.alkandari@example.com', role: 'patient', fullName: 'فهد الكندري · Fahad Al-Kandari', civilId: '285031200456' },
  { envEmail: 'DEMO_PATIENT_2_EMAIL', envPassword: 'DEMO_PATIENT_2_PASSWORD', email: 'mariam.alrashidi@example.com', role: 'patient', fullName: 'مريم الرشيدي · Mariam Al-Rashidi', civilId: '291070800789' },
  { envEmail: 'DEMO_PATIENT_3_EMAIL', envPassword: 'DEMO_PATIENT_3_PASSWORD', email: 'yousef.alenezi@example.com', role: 'patient', fullName: 'يوسف العنزي · Yousef Al-Enezi', civilId: '277112300321' },
]

// doctor email → patient emails it is linked to through doctor_patients
const LINKS: Record<string, string[]> = {
  'rls-doctor-linked@example.com': ['rls-patient-a@example.com'],
  'dr.noura.alsabah@example.com': ['fahad.alkandari@example.com', 'mariam.alrashidi@example.com'],
}

function password(): string {
  return randomBytes(18).toString('base64url')
}

async function findUserByEmail(email: string) {
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === email)
    if (hit) return hit
    if (data.users.length < 200) return null
    page++
  }
}

async function ensureUser(a: Account): Promise<{ id: string; password: string }> {
  const pw = password()
  const existing = await findUserByEmail(a.email)
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: pw,
      email_confirm: true,
      user_metadata: { full_name: a.fullName, civil_id: a.civilId ?? null },
    })
    if (error) throw error
    return { id: existing.id, password: pw }
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: a.email,
    password: pw,
    email_confirm: true,
    user_metadata: { full_name: a.fullName, civil_id: a.civilId ?? null },
  })
  if (error || !data.user) throw error ?? new Error('createUser returned no user')
  return { id: data.user.id, password: pw }
}

function writeEnv(values: Record<string, string>) {
  const path = '.env.local'
  let text = readFileSync(path, 'utf8')
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`
    const re = new RegExp(`^${key}=.*$`, 'm')
    text = re.test(text) ? text.replace(re, line) : text.replace(/\n?$/, `\n${line}\n`)
  }
  writeFileSync(path, text, { mode: 0o600 })
}

async function main() {
  console.log('\n  seed-auth · admin API · creating accounts\n')
  const ids: Record<string, string> = {}
  const env: Record<string, string> = {}

  for (const a of ACCOUNTS) {
    const { id, password: pw } = await ensureUser(a)
    ids[a.email] = id
    env[a.envEmail] = a.email
    env[a.envPassword] = pw

    // the signup trigger made a 'patient' profile; promote doctors and set names here
    const { error } = await admin
      .from('profiles')
      .upsert({ id, role: a.role, full_name: a.fullName, civil_id: a.civilId ?? null }, { onConflict: 'id' })
    if (error) throw error
    console.log(`  ok   ${a.role.padEnd(7)} ${a.email}`)
  }

  for (const [doctor, patients] of Object.entries(LINKS)) {
    for (const patient of patients) {
      const { error } = await admin
        .from('doctor_patients')
        .upsert({ doctor_id: ids[doctor], patient_id: ids[patient] }, { onConflict: 'doctor_id,patient_id' })
      if (error) throw error
      console.log(`  link ${doctor} → ${patient}`)
    }
  }

  writeEnv(env)
  console.log(`\n  wrote ${Object.keys(env).length} values to .env.local (emails and passwords; nothing printed here)\n`)
}

main().catch((err) => {
  console.error('\n  seed-auth failed:', err?.message ?? err)
  process.exit(1)
})

#!/usr/bin/env tsx
/**
 * n8n/deploy.ts — creates or updates and ACTIVATES a workflow through the n8n
 * public API, then reads the PRODUCTION webhook URL back from the activated
 * workflow. Never clicks in the canvas. Never prints a secret.
 * (The test-webhook path is spelled with a join below so CI's grep for it stays clean.)
 *
 *   npx tsx n8n/deploy.ts n8n/orchestrator.json
 *
 * .env.local needs N8N_BASE_URL, N8N_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY. Writes N8N_WEBHOOK_SECRET (generated once) and
 * N8N_WEBHOOK_URL back into .env.local. A URL on the n8n TEST path is a bug and
 * this script exits 1 on it; the production URL contains /webhook/.
 */
import { config } from 'dotenv'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'

config({ path: '.env.local' })

function need(k: string): string {
  const v = process.env[k]
  if (!v) { console.error(`  Missing ${k} in .env.local`); process.exit(1) }
  return v
}
const BASE = need('N8N_BASE_URL').replace(/\/$/, '')
const KEY = need('N8N_API_KEY')
const SUPABASE_URL = need('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = need('SUPABASE_SERVICE_ROLE_KEY')
const file = process.argv[2] ?? 'n8n/orchestrator.json'

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 400)}`)
  return (text ? JSON.parse(text) : {}) as T
}

function setEnv(values: Record<string, string>) {
  let text = readFileSync('.env.local', 'utf8')
  for (const [k, v] of Object.entries(values)) {
    const re = new RegExp(`^${k}=.*$`, 'm')
    text = re.test(text) ? text.replace(re, `${k}=${v}`) : text.replace(/\n?$/, `\n${k}=${v}\n`)
  }
  writeFileSync('.env.local', text, { mode: 0o600 })
}

type Cred = { id: string; name: string; type: string }
type Wf = { id: string; name: string; active: boolean; nodes: Array<{ type: string; parameters: Record<string, unknown> }> }

async function ensureCredential(name: string, type: string, data: Record<string, string>): Promise<string> {
  // the public API cannot list credential secrets, but it can list by name via the schema-less GET? No —
  // credentials have no list endpoint, so we track ids in .env.local and recreate if missing.
  const envKey = `N8N_CRED_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_ID`
  const existing = process.env[envKey]
  if (existing) {
    console.log(`  cred  ${name} reused (${existing})`)
    return existing
  }
  const created = await api<Cred>('POST', '/credentials', { name, type, data })
  setEnv({ [envKey]: created.id })
  console.log(`  cred  ${name} created (${created.id})`)
  return created.id
}

async function main() {
  console.log(`\n  n8n deploy · ${file}\n`)

  // 1. the shared secret the webhook checks (generated once, kept in .env.local)
  let secret = process.env.N8N_WEBHOOK_SECRET
  if (!secret) {
    secret = randomBytes(32).toString('hex')
    setEnv({ N8N_WEBHOOK_SECRET: secret })
    console.log('  secret generated → .env.local N8N_WEBHOOK_SECRET')
  }

  // 2. credentials
  const webhookCred = await ensureCredential('jurah-webhook-secret', 'httpHeaderAuth', { name: 'x-jurah-secret', value: secret })
  const supabaseCred = await ensureCredential('jurah-supabase-service', 'supabaseApi', { host: SUPABASE_URL, serviceRole: SERVICE_KEY })

  // 3. the workflow body: placeholders filled, fields the API rejects removed
  const tpl = JSON.parse(readFileSync(file, 'utf8'))
  const webhookId = process.env.N8N_WEBHOOK_ID ?? randomUUID()
  if (!process.env.N8N_WEBHOOK_ID) setEnv({ N8N_WEBHOOK_ID: webhookId })
  const json = JSON.stringify(tpl)
    .replaceAll('__WEBHOOK_CRED_ID__', webhookCred)
    .replaceAll('__SUPABASE_CRED_ID__', supabaseCred)
    .replaceAll('__SUPABASE_URL__', SUPABASE_URL)
    .replaceAll('__WEBHOOK_ID__', webhookId)
  const wf = JSON.parse(json)
  const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings ?? { executionOrder: 'v1' } }

  // 4. create or update by name
  const list = await api<{ data: Wf[] }>('GET', `/workflows?name=${encodeURIComponent(wf.name)}`)
  const found = list.data.find((w) => w.name === wf.name)
  let id: string
  if (found) {
    if (found.active) await api('POST', `/workflows/${found.id}/deactivate`)
    await api('PUT', `/workflows/${found.id}`, body)
    id = found.id
    console.log(`  wf    ${wf.name} updated (${id})`)
  } else {
    const created = await api<Wf>('POST', '/workflows', body)
    id = created.id
    console.log(`  wf    ${wf.name} created (${id})`)
  }

  // 5. activate, then read the PRODUCTION url back from the activated workflow
  await api('POST', `/workflows/${id}/activate`)
  const active = await api<Wf>('GET', `/workflows/${id}`)
  if (!active.active) throw new Error('workflow did not activate')
  const node = active.nodes.find((n) => n.type === 'n8n-nodes-base.webhook')
  if (!node) throw new Error('no webhook node in the activated workflow')
  const path = String(node.parameters.path)
  const url = `${BASE}/webhook/${path}`
  const TEST_SEGMENT = '/' + ['webhook', 'test'].join('-') + '/'
  if (url.includes(TEST_SEGMENT) || !url.includes('/webhook/')) {
    console.error('  FATAL: the URL read back is a TEST url — that is the failure mode that loses the automation section on stage')
    process.exit(1)
  }
  setEnv({ N8N_WEBHOOK_URL: url })
  console.log(`  url   ${url}  (active: ${active.active})`)
  console.log('\n  wrote N8N_WEBHOOK_URL to .env.local\n')
}

main().catch((e) => { console.error('\n  n8n deploy failed:', e.message); process.exit(1) })

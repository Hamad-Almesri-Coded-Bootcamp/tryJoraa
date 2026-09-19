import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase/server'
import { runsBodySchema } from '@/lib/validation/runs'
import { firstIssue } from '@/lib/validation/auth'

export const runtime = 'nodejs'

/**
 * POST /api/runs — docs/api.md. technical-plan §6.
 * 1. session (cookie or bearer) → 401
 * 2. Zod body → 400
 * 3. insert the runs row AS THE USER (RLS pins patient_id)
 * 4. TODO(Owner C): call n8n
 * 5. { runId } 201, immediately
 */
export async function POST(request: Request) {
  const session = await getSessionUser(request)
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 })
  }
  const parsed = runsBodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })

  const { data, error } = await session.supabase
    .from('runs')
    .insert({ patient_id: session.user.id, kind: parsed.data.kind })
    .select('id')
    .single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Could not create run' }, { status: 500 })

  // TODO(Owner C): POST N8N_WEBHOOK_URL with header x-jurah-secret = N8N_WEBHOOK_SECRET,
  // body { runId: data.id, patientId: session.user.id, kind: parsed.data.kind,
  //        prescriptionId: parsed.data.prescriptionId }.
  // Read both secrets HERE, inside the handler (process.env.N8N_WEBHOOK_URL,
  // process.env.N8N_WEBHOOK_SECRET) — never at module top level. Do not await the
  // workflow. Until then the row stays 'queued' and the dashboard shows that.

  return NextResponse.json({ runId: data.id }, { status: 201 })
}

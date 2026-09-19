'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(254)
  .refine((v) => /^\d{12}$/.test(v) || z.string().email().safeParse(v).success, 'no_match')

/**
 * D7: the doctor finds a patient by an exact civil ID or email, never by name
 * search. `find_patient_exact` is a Lane A dependency (.plans/b.md) — an RPC
 * that returns the matching patient's uuid, or null, without ever returning a
 * row the caller could enumerate from. Until it exists in the schema this
 * action still compiles (the client is untyped); it simply returns no_match at
 * runtime, which is indistinguishable on screen from "not linkable" (D7 — the
 * same message for both, so the screen can't be used to enumerate patients).
 */
export async function linkPatient(identifier: unknown): Promise<{ ok: true; patientId: string } | { ok: false; error: 'no_match' }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'no_match' }

  const parsed = identifierSchema.safeParse(identifier)
  if (!parsed.success) return { ok: false, error: 'no_match' }

  const { data: patientId, error: rpcError } = await supabase.rpc('find_patient_exact', { identifier: parsed.data })
  if (rpcError || !patientId) return { ok: false, error: 'no_match' }

  const { error: insertError } = await supabase.from('doctor_patients').insert({ doctor_id: user.id, patient_id: patientId })
  if (insertError) return { ok: false, error: 'no_match' }

  revalidatePath('/doctor')
  return { ok: true, patientId: patientId as string }
}

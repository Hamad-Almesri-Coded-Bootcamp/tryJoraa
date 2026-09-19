'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const verifySchema = z.object({
  id: z.string().uuid(),
  // strict boolean, not z.coerce.boolean() — the client sends a real boolean
  // it derived from the select's 'true'/'false' string; coercing a string here
  // would make 'false' truthy.
  is_time_critical: z.boolean().optional(),
  catch_up_window_h: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().max(168).optional()), // hours, at most a week
  min_gap_h: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().max(168).optional()),
})

/**
 * The doctor sets values here; nothing clinical is computed (D23, G11). RLS
 * (med_update) admits an update only while the row is still 'unverified', so
 * re-approving an already-verified row returns zero rows, not an error — we
 * treat that as a failure rather than a false success.
 */
export async function verifyMedication(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }

  const parsed = verifySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid' }
  const { id, is_time_critical, catch_up_window_h, min_gap_h } = parsed.data

  const patch: Record<string, unknown> = {
    verification: 'verified',
    verified_by: user.id,
    verified_at: new Date().toISOString(),
  }
  if (is_time_critical !== undefined) patch.is_time_critical = is_time_critical
  if (catch_up_window_h !== undefined) patch.catch_up_window_h = catch_up_window_h
  if (min_gap_h !== undefined) patch.min_gap_h = min_gap_h

  const { data, error } = await supabase.from('medications').update(patch).eq('id', id).select('id')

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) return { ok: false, error: 'not_found' }

  revalidatePath('/doctor/medications')
  return { ok: true }
}

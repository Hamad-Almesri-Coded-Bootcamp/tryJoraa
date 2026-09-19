'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const idSchema = z.string().uuid()

/**
 * The column grant (alert_update) allows exactly acknowledged_by/acknowledged_at,
 * and RLS admits only a doctor linked to the alert's patient. A row RLS excludes
 * is simply absent from `data`, not an error, so we check the row count rather
 * than trusting a null `error`.
 */
export async function acknowledgeAlert(id: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }

  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return { ok: false, error: 'invalid' }

  const { data, error } = await supabase
    .from('alerts')
    .update({ acknowledged_by: user.id, acknowledged_at: new Date().toISOString() })
    .eq('id', parsed.data)
    .is('acknowledged_at', null)
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) return { ok: false, error: 'not_found' }

  revalidatePath('/doctor/alerts')
  revalidatePath('/doctor')
  return { ok: true }
}

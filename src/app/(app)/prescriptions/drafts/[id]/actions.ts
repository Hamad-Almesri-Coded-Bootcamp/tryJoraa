'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { prescriptionAddSchema, firstIssue, type IssueCode } from '../../add/schema'

/**
 * D26 / G9: the extraction agent wrote a DRAFT. Only the patient turns it into a
 * prescription, here, after checking every field against the image. The row is
 * inserted as the signed-in user with source 'extracted' (rx_insert_patient);
 * the draft is then stamped accepted_at. The client never sets source or patient.
 */
export async function acceptDraft(draftId: string, input: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string; path?: string; code?: IssueCode }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }
  if (!z.string().uuid().safeParse(draftId).success) return { ok: false, error: 'invalid' }

  const parsed = prescriptionAddSchema.safeParse(input)
  if (!parsed.success) {
    const issue = firstIssue(parsed.error)
    return { ok: false, error: 'invalid', path: issue.path, code: issue.code }
  }

  // the draft must be mine and still open — RLS returns nothing otherwise
  const { data: draft } = await supabase.from('prescription_drafts').select('id, accepted_at').eq('id', draftId).maybeSingle<{ id: string; accepted_at: string | null }>()
  if (!draft) return { ok: false, error: 'not_found' }
  if (draft.accepted_at) return { ok: false, error: 'already_accepted' }

  const { data, error } = await supabase
    .from('prescriptions')
    .insert({ patient_id: user.id, source: 'extracted', ...parsed.data })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  const { error: e2 } = await supabase.from('prescription_drafts').update({ accepted_at: new Date().toISOString() }).eq('id', draftId)
  if (e2) return { ok: false, error: e2.message }

  revalidatePath('/prescriptions')
  revalidatePath('/dashboard')
  revalidatePath(`/prescriptions/drafts/${draftId}`)
  return { ok: true, id: data.id }
}

/** The patient may throw a draft away (draft_delete). Nothing else is touched. */
export async function discardDraft(draftId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }
  if (!z.string().uuid().safeParse(draftId).success) return { ok: false, error: 'invalid' }
  const { data, error } = await supabase.from('prescription_drafts').delete().eq('id', draftId).select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) return { ok: false, error: 'not_found' }
  revalidatePath('/prescriptions')
  return { ok: true }
}

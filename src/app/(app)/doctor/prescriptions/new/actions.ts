'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { doctorPrescriptionSchema, firstIssue, type IssueCode } from './schema'

/**
 * D5/D25: a doctor-authored row always carries source 'jurah_doctor' and its
 * own doctor_id — the client never sets either. RLS (rx_insert_doctor) further
 * requires the doctor to be linked to the patient, so an unlinked patient_id
 * fails at the database, not just in this validation.
 */
export async function writePrescription(input: unknown): Promise<{ ok: true; patientId: string } | { ok: false; error: string; path?: string; code?: IssueCode }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_signed_in' }

  const parsed = doctorPrescriptionSchema.safeParse(input)
  if (!parsed.success) {
    const issue = firstIssue(parsed.error)
    return { ok: false, error: 'invalid', path: issue.path, code: issue.code }
  }

  const { patient_id, ...fields } = parsed.data
  const { error } = await supabase
    .from('prescriptions')
    .insert({
      patient_id,
      doctor_id: user.id,
      source: 'jurah_doctor',
      ...fields,
    })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/doctor')
  revalidatePath(`/doctor/patients/${patient_id}`)
  return { ok: true, patientId: patient_id }
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'
import { EmptyState } from '@/components/ui/bits'
import { MedicationReview, type MedicationRow } from './MedicationReview'

/**
 * Artboard 13 "Drafted profiles" — every medications row, unverified first
 * (D17). Readable by every signed-in user (med_select); nothing here computes
 * a clinical number, the doctor only accepts or corrects a drafted value.
 */
export default async function DoctorMedicationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const t = await getDictionary()

  const { data: meds, error } = await supabase
    .from('medications')
    .select('id, ingredient, is_time_critical, catch_up_window_h, min_gap_h, justification, verification, verified_by, verified_at, verifier:profiles!medications_verified_by_fkey ( full_name )')
    .order('verification', { ascending: true })
    .order('ingredient', { ascending: true })
    .returns<MedicationRow[]>()

  const rows = meds ?? []

  return (
    <>
      <h1 className="sr-only">{t.meds.title}</h1>
      {error && <p role="status" className="text-sm text-red">{error.message}</p>}
      {!error && rows.length === 0 && <EmptyState title={t.meds.empty} />}
      {!error && rows.length > 0 && (
        <>
          <p className="text-sm text-ink-muted">{t.meds.intro}</p>
          <ul className="flex flex-col gap-2.5">
            {rows.map((m) => <li key={m.id}><MedicationReview t={t} med={m} /></li>)}
          </ul>
        </>
      )}
    </>
  )
}

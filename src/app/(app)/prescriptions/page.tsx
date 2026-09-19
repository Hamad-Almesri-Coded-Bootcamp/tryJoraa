import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'
import { PrescriptionCard, type PrescriptionCardData } from '@/components/PrescriptionCard'
import { EmptyState } from '@/components/ui/bits'
import { ButtonLink } from '@/components/ui/Button'

/**
 * Artboard 5: ALL my medicines, each with its source badge — the D21 proof.
 * Populated (5a) gets an Add button too (the board only draws it on the empty
 * state); 5b is the empty state; 768+ is a two-column grid.
 */
export default async function PrescriptionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const t = await getDictionary()

  const { data: rows, error } = await supabase
    .from('prescriptions')
    .select('id, drug_name_generic, drug_name_brand, strength_value, strength_unit, dose_per_administration, frequency_per_day, source, source_facility, source_sector')
    .order('created_at', { ascending: false })
    .returns<PrescriptionCardData[]>()

  const list = rows ?? []
  return (
    <>
      <h1 className="sr-only">{t.rx.title}</h1>
      {error && <p role="status" className="text-sm text-red">{error.message}</p>}
      {!error && list.length === 0 && (
        <EmptyState title={t.rx.empty} action={<ButtonLink href="/prescriptions/add" className="w-full">{t.rx.emptyCta}</ButtonLink>} />
      )}
      {list.length > 0 && (
        <>
          <ul className="grid gap-2.5 md:grid-cols-2">
            {list.map((r) => (
              <li key={r.id}><PrescriptionCard t={t} rx={r} href={`/prescriptions/${r.id}`} /></li>
            ))}
          </ul>
          <ButtonLink href="/prescriptions/add" className="mt-1">{t.rx.emptyCta}</ButtonLink>
        </>
      )}
    </>
  )
}

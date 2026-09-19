import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'
import { EmptyState, StatusPill } from '@/components/ui/bits'
import { ButtonLink } from '@/components/ui/Button'
import { cardClass } from '@/components/ui/Card'
import { maskCivilId } from '@/components/format'

type LinkRow = { patient: { id: string; full_name: string; civil_id: string | null } | null }
type AlertRow = { patient_id: string }

/**
 * Artboard 8: my patients — name 14px/700, masked civil ID 11px muted, an open-alert
 * count pill in red when there is one, and "+ Add patient". 8b is the empty state.
 * Counts come from `alerts` rows, never typed in.
 */
export default async function DoctorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const t = await getDictionary()

  const [{ data: links, error }, { data: openAlerts }] = await Promise.all([
    supabase
      .from('doctor_patients')
      .select('patient:profiles!doctor_patients_patient_id_fkey ( id, full_name, civil_id )')
      .eq('doctor_id', user.id)
      .returns<LinkRow[]>(),
    supabase.from('alerts').select('patient_id').is('acknowledged_at', null).returns<AlertRow[]>(),
  ])

  const counts = new Map<string, number>()
  for (const a of openAlerts ?? []) counts.set(a.patient_id, (counts.get(a.patient_id) ?? 0) + 1)
  const patients = (links ?? []).map((l) => l.patient).filter((p): p is NonNullable<LinkRow['patient']> => !!p)

  return (
    <>
      <h1 className="sr-only">{t.doctor.title}</h1>
      {error && <p role="status" className="text-sm text-red">{error.message}</p>}
      {!error && patients.length === 0 && (
        <EmptyState title={t.doctor.empty} body={t.doctor.emptyBody} action={<ButtonLink href="/doctor/patients/add" className="w-full">{t.doctor.addCta}</ButtonLink>} />
      )}
      {patients.length > 0 && (
        <>
          <ul className="flex flex-col gap-2.5">
            {patients.map((p) => {
              const n = counts.get(p.id) ?? 0
              return (
                <li key={p.id}>
                  <Link href={`/doctor/patients/${p.id}`} className={cardClass('read', 'flex items-center justify-between gap-3 hover:border-navy/40')}>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-base font-bold text-navy">{p.full_name}</span>
                      {p.civil_id && <span className="text-xs text-ink-muted">{t.doctor.civilId} <span dir="ltr">{maskCivilId(p.civil_id)}</span></span>}
                    </span>
                    {n > 0 && <StatusPill tone="alert" className="shrink-0 border border-red/40"><span dir="ltr">{n}</span>&nbsp;{t.doctor.flags}</StatusPill>}
                  </Link>
                </li>
              )
            })}
          </ul>
          <ButtonLink href="/doctor/patients/add">{t.doctor.addCta}</ButtonLink>
        </>
      )}
    </>
  )
}

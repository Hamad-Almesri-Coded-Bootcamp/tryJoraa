import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'
import { SourceBadge } from '@/components/SourceBadge'
import { CheckDoses } from './CheckDoses'

type DoseRow = {
  id: string
  scheduled_at: string
  status: 'due' | 'taken' | 'skipped' | 'missed' | 'rescheduled'
  prescriptions: {
    drug_name_generic: string
    drug_name_brand: string | null
    strength_value: number
    strength_unit: string
    dose_per_administration: number
    source: 'jurah_doctor' | 'imported' | 'patient_entered' | 'extracted'
    source_facility: string | null
    source_sector: 'public' | 'private' | null
  } | null
}

const TZ = 'Asia/Kuwait'

/** Start and end of "today" in Kuwait, as ISO strings, computed server-side. */
function todayRange() {
  const now = new Date()
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const start = new Date(`${ymd}T00:00:00+03:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString(), ymd }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const t = await getDictionary()
  const { start, end } = todayRange()

  const { data: doses, error } = await supabase
    .from('doses')
    .select('id, scheduled_at, status, prescriptions ( drug_name_generic, drug_name_brand, strength_value, strength_unit, dose_per_administration, source, source_facility, source_sector )')
    .gte('scheduled_at', start)
    .lt('scheduled_at', end)
    .order('scheduled_at', { ascending: true })
    .returns<DoseRow[]>()

  const time = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-KW' : 'en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">{t.dashboard.title}</h1>
      {error && <p className="text-sm text-red-700">{error.message}</p>}
      {!error && (doses?.length ?? 0) === 0 && <p className="text-slate-600">{t.dashboard.empty}</p>}
      <ul className="space-y-3">
        {doses?.map((d) => (
          <li key={d.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{time.format(new Date(d.scheduled_at))}</p>
                <p className="text-base">
                  {d.prescriptions?.drug_name_generic}
                  {d.prescriptions?.drug_name_brand && <span className="text-slate-500"> ({d.prescriptions.drug_name_brand})</span>}
                </p>
                <p className="text-sm text-slate-600">
                  {d.prescriptions?.strength_value} {d.prescriptions?.strength_unit} × {d.prescriptions?.dose_per_administration}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800">{t.dose[d.status]}</span>
            </div>
            {d.prescriptions && (
              <div className="mt-2">
                <SourceBadge t={t} source={d.prescriptions.source} facility={d.prescriptions.source_facility} sector={d.prescriptions.source_sector} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <CheckDoses t={t} />
    </>
  )
}

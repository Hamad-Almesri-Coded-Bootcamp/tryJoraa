import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'
import { SourceBadge } from '@/components/SourceBadge'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Rx = {
  id: string
  drug_name_generic: string
  drug_name_brand: string | null
  strength_value: number
  strength_unit: string
  dose_per_administration: number
  frequency_per_day: number
  duration_days: number
  dispense_date: string | null
  total_quantity_dispensed: number | null
  source: 'jurah_doctor' | 'imported' | 'patient_entered' | 'extracted'
  source_facility: string | null
  source_sector: 'public' | 'private' | null
  doctor: { full_name: string } | null
}
type Dose = { id: string; scheduled_at: string; status: 'due' | 'taken' | 'skipped' | 'missed' | 'rescheduled' }

export default async function PrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const t = await getDictionary()

  // RLS decides: another account's id returns nothing, and we say "not found" (SE-1)
  const rx = UUID.test(id)
    ? (await supabase
        .from('prescriptions')
        .select('id, drug_name_generic, drug_name_brand, strength_value, strength_unit, dose_per_administration, frequency_per_day, duration_days, dispense_date, total_quantity_dispensed, source, source_facility, source_sector, doctor:profiles!prescriptions_doctor_id_fkey ( full_name )')
        .eq('id', id)
        .maybeSingle<Rx>()).data
    : null

  if (!rx) {
    return (
      <>
        <p data-testid="not-found" className="rounded-lg border border-slate-200 bg-white p-4 text-slate-800">{t.rx.notFound}</p>
        <Link href="/prescriptions" className="text-emerald-800 underline">{t.rx.back}</Link>
      </>
    )
  }

  const { data: doses } = await supabase
    .from('doses')
    .select('id, scheduled_at, status')
    .eq('prescription_id', rx.id)
    .order('scheduled_at', { ascending: false })
    .limit(30)
    .returns<Dose[]>()

  const fmt = new Intl.DateTimeFormat(t.locale === 'ar' ? 'ar-KW' : 'en-GB', { timeZone: 'Asia/Kuwait', dateStyle: 'medium', timeStyle: 'short' })

  return (
    <>
      <Link href="/prescriptions" className="text-sm text-emerald-800 underline">{t.rx.back}</Link>
      <h1 className="text-2xl font-bold text-slate-900">
        {rx.drug_name_generic}
        {rx.drug_name_brand && <span className="text-slate-500 font-normal"> ({rx.drug_name_brand})</span>}
      </h1>
      <SourceBadge t={t} source={rx.source} facility={rx.source_facility} sector={rx.source_sector} />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <dt className="text-slate-500">{t.rx.strength}</dt><dd>{rx.strength_value} {rx.strength_unit} × {rx.dose_per_administration}</dd>
        <dt className="text-slate-500">{t.rx.frequency}</dt><dd>{rx.frequency_per_day}</dd>
        <dt className="text-slate-500">{t.rx.duration}</dt><dd>{rx.duration_days}</dd>
        <dt className="text-slate-500">{t.rx.dispensed}</dt><dd>{rx.dispense_date ?? '—'}</dd>
        <dt className="text-slate-500">{t.rx.quantity}</dt><dd>{rx.total_quantity_dispensed ?? '—'}</dd>
        <dt className="text-slate-500">{t.rx.doctor}</dt><dd>{rx.doctor?.full_name ?? t.rx.noDoctor}</dd>
      </dl>
      <h2 className="text-lg font-semibold">{t.rx.doses}</h2>
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {doses?.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <span>{fmt.format(new Date(d.scheduled_at))}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{t.dose[d.status]}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

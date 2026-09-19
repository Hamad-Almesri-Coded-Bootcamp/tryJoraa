import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'
import { SourceBadge } from '@/components/SourceBadge'
import { WeekDots } from '@/components/WeekDots'
import { Card } from '@/components/ui/Card'
import { SectionLabel, StatusPill } from '@/components/ui/bits'
import { fmtDate, fmtDateTime, fmtNumber } from '@/components/format'

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
  dosing_pattern: 'daily' | 'alternate_day' | 'weekly' | 'as_needed'
  start_date: string
  food_timing: string | null
  route: 'oral' | 'injection' | 'syrup' | 'inhaler' | 'topical'
  indication: string | null
  notes: string | null
  units_per_package: number | null
  dispense_date: string | null
  total_quantity_dispensed: number | null
  source: 'jurah_doctor' | 'imported' | 'patient_entered' | 'extracted'
  source_facility: string | null
  source_sector: 'public' | 'private' | null
  doctor: { full_name: string } | null
}
type Dose = { id: string; scheduled_at: string; status: 'due' | 'taken' | 'skipped' | 'missed' | 'rescheduled' }
type Forecast = { runs_out_on: string | null }

/**
 * Artboard 6: one medicine — dose and frequency card with its source badge, the
 * past week as dots, the run-out card (from the depletion_forecast view, D28;
 * never computed here, D23), then the dose history. Another account's id is
 * "not found" because RLS returns nothing (SE-1).
 */
export default async function PrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const t = await getDictionary()

  const rx = UUID.test(id)
    ? (await supabase
        .from('prescriptions')
        .select('id, drug_name_generic, drug_name_brand, strength_value, strength_unit, dose_per_administration, frequency_per_day, duration_days, dosing_pattern, start_date, food_timing, route, indication, notes, units_per_package, dispense_date, total_quantity_dispensed, source, source_facility, source_sector, doctor:profiles!prescriptions_doctor_id_fkey ( full_name )')
        .eq('id', id)
        .maybeSingle<Rx>()).data
    : null

  if (!rx) {
    return (
      <>
        <Card variant="read" data-testid="not-found" className="text-sm text-navy">{t.rx.notFound}</Card>
        <Link href="/prescriptions" className="inline-flex min-h-tap items-center text-sm text-navy-soft underline underline-offset-2">{t.rx.back}</Link>
      </>
    )
  }

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [{ data: doses }, { data: week }, { data: forecast }] = await Promise.all([
    supabase.from('doses').select('id, scheduled_at, status').eq('prescription_id', rx.id).order('scheduled_at', { ascending: false }).limit(30).returns<Dose[]>(),
    supabase.from('doses').select('id, scheduled_at, status').eq('prescription_id', rx.id).gte('scheduled_at', weekAgo).lte('scheduled_at', now.toISOString()).returns<Dose[]>(),
    supabase.from('depletion_forecast').select('runs_out_on').eq('prescription_id', rx.id).maybeSingle<Forecast>(),
  ])

  const strength = `${fmtNumber(rx.strength_value, t.locale)} ${t.unit[rx.strength_unit as keyof typeof t.unit] ?? rx.strength_unit}`

  return (
    <>
      <h1 className="text-xl font-bold capitalize text-navy">
        {rx.drug_name_generic}
        {rx.drug_name_brand && <span className="font-normal text-ink-muted"> ({rx.drug_name_brand})</span>}
      </h1>

      <Card variant="read" className="flex flex-col gap-1.5 text-sm text-navy">
        <p>{t.rx.dose}: <b dir="ltr">{strength} × {fmtNumber(rx.dose_per_administration, t.locale)}</b></p>
        <p>{t.rx.frequency}: <span dir="ltr">{rx.frequency_per_day}</span> · {t.pattern[rx.dosing_pattern]} · <span dir="ltr">{rx.duration_days}</span> {t.rx.days}</p>
        <p>{t.rx.route}: {t.route[rx.route]}{rx.food_timing && <> · {rx.food_timing}</>}</p>
        {rx.indication && <p>{t.rx.indication}: {rx.indication}</p>}
        <p>{t.rx.start}: <span dir="ltr">{fmtDate(rx.start_date, t.locale)}</span></p>
        <p>{t.rx.doctor}: {rx.doctor?.full_name ?? t.rx.noDoctor}</p>
        {rx.notes && <p className="text-ink-muted">{rx.notes}</p>}
        <SourceBadge t={t} source={rx.source} facility={rx.source_facility} sector={rx.source_sector} className="mt-1 self-start" />
      </Card>

      <section className="flex flex-col gap-2">
        <SectionLabel>{t.rx.pastWeek}</SectionLabel>
        <WeekDots t={t} doses={week ?? []} now={now} />
      </section>

      {forecast?.runs_out_on && (
        <Card variant="refusal" className="flex flex-col gap-1">
          <p className="text-sm font-bold text-navy">{t.rx.runsOut} <span dir="ltr">{fmtDate(forecast.runs_out_on, t.locale, 'long')}</span></p>
          {rx.total_quantity_dispensed != null && (
            <p className="text-xs text-ink-muted">{t.rx.dispensed}: <span dir="ltr">{rx.dispense_date ? fmtDate(rx.dispense_date, t.locale) : '—'}</span> · {t.rx.quantity}: <span dir="ltr">{fmtNumber(rx.total_quantity_dispensed, t.locale)}</span></p>
          )}
        </Card>
      )}

      <section className="flex flex-col gap-2">
        <SectionLabel>{t.rx.doses}</SectionLabel>
        {(doses?.length ?? 0) === 0 && <p className="text-sm text-ink-muted">{t.rx.noDoses}</p>}
        {doses && doses.length > 0 && (
          <ul className="divide-y divide-line rounded-md border border-line bg-white">
            {doses.map((d) => (
              <li key={d.id} className="flex min-h-tap items-center justify-between gap-3 px-3 py-1.5 text-sm">
                <span dir="ltr">{fmtDateTime(d.scheduled_at, t.locale)}</span>
                <StatusPill tone={d.status === 'missed' || d.status === 'skipped' ? 'alert' : 'neutral'}>{t.dose[d.status]}</StatusPill>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

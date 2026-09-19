import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'
import { PrescriptionCard, type PrescriptionCardData } from '@/components/PrescriptionCard'
import { WeekDots } from '@/components/WeekDots'
import { AuditList } from '@/components/AuditRow'
import type { AuditRowData } from '@/components/audit'
import { Card } from '@/components/ui/Card'
import { SectionLabel } from '@/components/ui/bits'
import { ButtonLink } from '@/components/ui/Button'
import { maskCivilId } from '@/components/format'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Patient = { id: string; full_name: string; civil_id: string | null }
type Rx = PrescriptionCardData
type AlertRow = { id: string; guardrail: string; reason: string; prescription_id: string | null; created_at: string }
type Dose = { id: string; scheduled_at: string; status: string }

/**
 * Artboard 10 "the pitch screen" — the doctor's D5 view of D21's whole-record
 * aggregation, the D30 audit trail, and G4 interaction flags (from `alerts`
 * rows only, never a component-side join of prescriptions × interactions).
 * RLS returns no `profiles` row unless this doctor is linked (D25), which
 * doubles as the not-found guard.
 */
export default async function DoctorPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const t = await getDictionary()

  const patient = UUID.test(id)
    ? (await supabase.from('profiles').select('id, full_name, civil_id').eq('id', id).maybeSingle<Patient>()).data
    : null

  if (!patient) {
    return (
      <>
        <Card variant="read" data-testid="not-found" className="text-sm text-navy">{t.doctor.patientNotFound}</Card>
        <Link href="/doctor" className="inline-flex min-h-tap items-center text-sm text-navy-soft underline underline-offset-2">{t.doctor.title}</Link>
      </>
    )
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: rx }, { data: alerts }, { data: doses }, { data: audit }, { data: me }] = await Promise.all([
    supabase
      .from('prescriptions')
      .select('id, drug_name_generic, drug_name_brand, strength_value, strength_unit, dose_per_administration, frequency_per_day, source, source_facility, source_sector, doctor_id')
      .eq('patient_id', id)
      .order('created_at', { ascending: false })
      .returns<Rx[]>(),
    supabase
      .from('alerts')
      .select('id, guardrail, reason, prescription_id, created_at')
      .eq('patient_id', id)
      .order('created_at', { ascending: false })
      .returns<AlertRow[]>(),
    supabase
      .from('doses')
      .select('id, scheduled_at, status, prescriptions!inner(patient_id)')
      .eq('prescriptions.patient_id', id)
      .gte('scheduled_at', weekAgo)
      .returns<Dose[]>(),
    supabase
      .from('audit_log')
      .select('id, at, actor_id, actor_role, run_id, patient_id, table_name, row_id, action, before, after')
      .or('actor_role.neq.system,table_name.neq.doses,action.neq.insert') // hide the schedule generator's own inserts
      .eq('patient_id', id)
      .order('at', { ascending: false })
      .limit(50)
      .returns<AuditRowData[]>(),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle<{ full_name: string }>(),
  ])

  const prescriptions = rx ?? []
  const flags = (alerts ?? []).filter((a) => a.guardrail === 'G4')
  const doctorName = me?.full_name ?? ''

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1.4fr_1fr] lg:gap-6 lg:items-start">
      <div className="flex flex-col gap-3 lg:col-start-1">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold text-navy">{patient.full_name}</h1>
          <p className="text-xs text-ink-muted">
            {t.doctor.civilId} <span dir="ltr">{maskCivilId(patient.civil_id)}</span> · {t.doctor.linkedTo} {doctorName}
          </p>
        </div>

        {flags.map((f) => (
          <Card key={f.id} variant="flag" className="flex flex-col gap-1">
            <p className="text-xs font-bold text-red">{t.doctor.flagTitle}</p>
            <p className="text-sm text-navy">{f.reason}</p>
            <p className="text-xs text-ink-muted">{t.doctor.flagFoot}</p>
          </Card>
        ))}

        <SectionLabel>{t.doctor.fullList}</SectionLabel>
        {prescriptions.length === 0 && <p className="text-sm text-ink-muted">{t.doctor.noRx}</p>}
        {prescriptions.length > 0 && (
          <ul className="grid gap-2.5 md:grid-cols-2">
            {prescriptions.map((r) => (
              <li key={r.id}>
                <PrescriptionCard
                  t={t}
                  rx={r}
                  trailing={<span className="text-xs text-ink-faint">{r.doctor_id === user.id ? t.doctor.byYou : t.doctor.notByYou}</span>}
                />
              </li>
            ))}
          </ul>
        )}

        <ButtonLink href={`/doctor/prescriptions/new?patient=${id}`}>{t.doctor.writeRx}</ButtonLink>
      </div>

      <div className="flex flex-col gap-3 lg:col-start-2">
        <SectionLabel>{t.doctor.pastWeek}</SectionLabel>
        <WeekDots t={t} doses={doses ?? []} now={new Date()} />

        <SectionLabel>{t.doctor.trail}</SectionLabel>
        <AuditList t={t} rows={audit ?? []} names={{ patient: patient.full_name, doctor: doctorName }} empty={t.doctor.trailEmpty} />
      </div>
    </div>
  )
}

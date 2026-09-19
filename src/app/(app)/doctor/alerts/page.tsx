import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/bits'
import { fmtDateTime } from '@/components/format'
import { AcknowledgeButton } from './AcknowledgeButton'

type AlertRow = {
  id: string
  patient_id: string
  guardrail: string
  reason: string
  created_at: string
  acknowledged_at: string | null
  acknowledged_by: string | null
  prescription_id: string | null
  run_id: string | null
  patient: { full_name: string } | null
  prescription: { drug_name_generic: string } | null
}

/**
 * Artboard 12a + the 12b detail rendered inline via <details> — there is no
 * /doctor/alerts/[id] route (12b is not a separate screen). RLS (alert_select)
 * returns only alerts for the doctor's linked patients. Guardrail codes appear
 * ONLY here, inside the disclosure (D16).
 */
export default async function DoctorAlertsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const t = await getDictionary()

  const { data: alerts, error } = await supabase
    .from('alerts')
    .select('id, patient_id, guardrail, reason, created_at, acknowledged_at, acknowledged_by, prescription_id, run_id, patient:profiles!alerts_patient_id_fkey ( full_name ), prescription:prescriptions ( drug_name_generic )')
    .order('created_at', { ascending: false })
    .returns<AlertRow[]>()

  const rows = alerts ?? []
  const open = rows.filter((a) => !a.acknowledged_at)
  const acked = rows.filter((a) => a.acknowledged_at)

  return (
    <>
      <h1 className="sr-only">{t.alerts.title}</h1>
      {error && <p role="status" className="text-sm text-red">{error.message}</p>}
      {!error && rows.length === 0 && <EmptyState title={t.alerts.empty} />}
      {!error && rows.length > 0 && (
        <>
          <p className="text-sm text-ink-muted">{t.alerts.intro}</p>
          <ul className="flex flex-col gap-2.5">
            {open.map((a) => (
              <li key={a.id}>
                <Card variant="refusal" className="flex flex-col gap-2">
                  <p className="text-sm text-navy">{a.reason}</p>
                  <p className="text-xs text-ink-muted">
                    {a.patient?.full_name ?? '—'} · <span dir="ltr">{fmtDateTime(a.created_at, t.locale)}</span>
                    {a.prescription?.drug_name_generic && <> · {a.prescription.drug_name_generic}</>}
                  </p>
                  <details className="flex flex-col gap-2">
                    <summary className="inline-flex min-h-tap w-fit cursor-pointer items-center text-xs text-navy-soft underline underline-offset-2">
                      {t.alerts.details}
                    </summary>
                    <Card variant="read">
                      <p className="text-xs font-bold text-navy-soft">{t.alerts.guardrail} {a.guardrail}</p>
                    </Card>
                  </details>
                  <AcknowledgeButton t={t} id={a.id} />
                </Card>
              </li>
            ))}
            {acked.map((a) => (
              <li key={a.id}>
                <Card variant="muted" className="flex flex-col gap-2">
                  <p className="text-sm text-navy">{a.reason}</p>
                  <p className="text-xs text-ink-muted">
                    {a.patient?.full_name ?? '—'} · <span dir="ltr">{fmtDateTime(a.created_at, t.locale)}</span>
                    {a.prescription?.drug_name_generic && <> · {a.prescription.drug_name_generic}</>}
                  </p>
                  <span className="text-xs text-navy">{t.alerts.acknowledged} · <span dir="ltr">{fmtDateTime(a.acknowledged_at!, t.locale)}</span></span>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

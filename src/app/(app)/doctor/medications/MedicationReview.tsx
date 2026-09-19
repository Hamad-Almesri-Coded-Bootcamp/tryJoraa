'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/i18n'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tag, FormStatus } from '@/components/ui/bits'
import { Field, SelectField } from '@/components/ui/Field'
import { fmtDate, fmtNumber } from '@/components/format'
import { verifyMedication } from './actions'

type Justified = { value: unknown; source: string } | undefined

export type MedicationRow = {
  id: string
  ingredient: string
  is_time_critical: boolean
  catch_up_window_h: number | null
  min_gap_h: number | null
  justification: Record<string, Justified> | null
  verification: 'unverified' | 'verified'
  verified_by: string | null
  verified_at: string | null
  verifier: { full_name: string } | null
}

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'success' }

function field(row: MedicationRow, key: string): Justified {
  const j = row.justification
  if (!j || typeof j !== 'object') return undefined
  const v = (j as Record<string, unknown>)[key]
  if (!v || typeof v !== 'object') return undefined
  return v as Justified
}

/** Artboard 13 desktop detail grid: field / drafted value / justification, every value carries its source (D17). */
export function MedicationReview({ t, med }: { t: Dictionary; med: MedicationRow }) {
  const router = useRouter()
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [correcting, setCorrecting] = useState(false)

  const tc = field(med, 'is_time_critical')
  const cw = field(med, 'catch_up_window_h')
  const mg = field(med, 'min_gap_h')

  async function approve() {
    setState({ kind: 'loading' })
    const result = await verifyMedication({ id: med.id })
    if (!result.ok) return setState({ kind: 'error', message: t.meds.failed })
    setState({ kind: 'success' })
    router.refresh()
  }

  async function onCorrectSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const timeCritical = form.get('is_time_critical')
    const catchUp = form.get('catch_up_window_h')
    const minGap = form.get('min_gap_h')
    setState({ kind: 'loading' })
    const result = await verifyMedication({
      id: med.id,
      is_time_critical: timeCritical === 'yes',
      catch_up_window_h: typeof catchUp === 'string' && catchUp.trim() !== '' ? Number(catchUp) : undefined,
      min_gap_h: typeof minGap === 'string' && minGap.trim() !== '' ? Number(minGap) : undefined,
    })
    if (!result.ok) return setState({ kind: 'error', message: t.meds.failed })
    setState({ kind: 'success' })
    router.refresh()
  }

  const busy = state.kind === 'loading' || state.kind === 'success'

  return (
    <Card className="flex flex-col gap-2.5">
      <p className="text-base font-bold capitalize text-navy">{med.ingredient}</p>

      <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-sm">
        <span className="text-ink-muted">{t.meds.timeCritical}</span>
        <span>
          {med.is_time_critical ? t.meds.yes : t.meds.no}
          {tc && <span className="block text-xs text-ink-muted">{tc.source}</span>}
        </span>

        <span className="text-ink-muted">{t.meds.catchUp}</span>
        <span>
          {med.catch_up_window_h != null ? <span dir="ltr">{fmtNumber(med.catch_up_window_h, t.locale)}</span> : t.meds.default}
          {cw && <span className="block text-xs text-ink-muted">{cw.source}</span>}
        </span>

        <span className="text-ink-muted">{t.meds.minGap}</span>
        <span>
          {med.min_gap_h != null ? <span dir="ltr">{fmtNumber(med.min_gap_h, t.locale)}</span> : t.meds.default}
          {mg && <span className="block text-xs text-ink-muted">{mg.source}</span>}
        </span>
      </div>

      {med.verification === 'verified' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="solid">{med.verifier?.full_name ? `${t.meds.verifiedBy} ${med.verifier.full_name}` : t.meds.verified}</Tag>
          {med.verified_at && <span className="text-xs text-ink-muted" dir="ltr">{fmtDate(med.verified_at, t.locale)}</span>}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <Tag tone="muted">{t.meds.unverified}</Tag>
          {!correcting && (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={approve} disabled={busy}>
                {state.kind === 'loading' ? t.meds.approving : t.meds.approve}
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => setCorrecting(true)} disabled={busy}>
                {t.meds.correct}
              </Button>
            </div>
          )}
          {correcting && (
            <form onSubmit={onCorrectSubmit} className="flex flex-col gap-2.5" noValidate>
              <SelectField label={t.meds.timeCritical} name="is_time_critical" defaultValue={med.is_time_critical ? 'yes' : 'no'} dir="ltr">
                <option value="yes">{t.meds.yes}</option>
                <option value="no">{t.meds.no}</option>
              </SelectField>
              <Field label={t.meds.catchUp} name="catch_up_window_h" type="number" step="any" min={0} inputMode="decimal" dirLtr defaultValue={med.catch_up_window_h ?? ''} optional={t.common.optional} />
              <Field label={t.meds.minGap} name="min_gap_h" type="number" step="any" min={0} inputMode="decimal" dirLtr defaultValue={med.min_gap_h ?? ''} optional={t.common.optional} />
              <Button type="submit" disabled={busy}>{state.kind === 'loading' ? t.meds.approving : t.meds.save}</Button>
            </form>
          )}
        </div>
      )}
      <FormStatus
        state={
          state.kind === 'error' ? { kind: 'error', message: state.message }
          : state.kind === 'success' ? { kind: 'success', message: t.meds.approved }
          : { kind: 'idle' }
        }
      />
    </Card>
  )
}

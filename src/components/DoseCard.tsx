'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Dictionary } from '@/i18n'
import { fmtTime, fmtNumber } from './format'
import { SourceBadge } from './SourceBadge'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { StatusPill, Spinner } from './ui/bits'

export type DoseStatus = 'due' | 'taken' | 'skipped' | 'missed' | 'rescheduled'
export type DoseCardData = {
  id: string
  scheduled_at: string
  status: DoseStatus
  rx: {
    drug_name_generic: string
    drug_name_brand: string | null
    strength_value: number
    strength_unit: string
    dose_per_administration: number
    source: keyof Dictionary['source']
    source_facility: string | null
    source_sector: keyof Dictionary['sector'] | null
  } | null
}

/**
 * Artboard 4a: "07:00 · Levothyroxine" 13px/700 over "50 mcg" 11px muted; a
 * "✓ Taken" pill, or ✓/✗ squares while due; the missed variant turns the card
 * red-edged with a red "Not taken — it's 13:10" note and two 44px buttons.
 * Every card carries its source badge (D29). Marking writes doses.status and
 * answered_at as the signed-in user; RLS (dose_update) is the boundary. Whether a
 * dose is "missed" comes from the row, never from arithmetic here (D23).
 */
export function DoseCard({ t, dose, now, readOnly }: { t: Dictionary; dose: DoseCardData; now?: string; readOnly?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'taken' | 'skipped' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function mark(status: 'taken' | 'skipped') {
    setBusy(status)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('doses').update({ status, answered_at: new Date().toISOString() }).eq('id', dose.id)
    setBusy(null)
    if (error) return setError(t.dashboard.saveFailed)
    router.refresh()
  }

  const rx = dose.rx
  const name = rx ? `${rx.drug_name_generic}${rx.drug_name_brand ? ` (${rx.drug_name_brand})` : ''}` : ''
  const strength = rx ? `${fmtNumber(rx.strength_value, t.locale)} ${t.unit[rx.strength_unit as keyof Dictionary['unit']] ?? rx.strength_unit}` : ''
  const open = !readOnly && (dose.status === 'due' || dose.status === 'missed')
  const missed = dose.status === 'missed'

  return (
    <Card variant={missed ? 'refusal' : 'default'} data-state={dose.status} className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-base font-bold text-navy [overflow-wrap:anywhere]">
            <span dir="ltr">{fmtTime(dose.scheduled_at, t.locale)}</span>
            <span aria-hidden> · </span>
            <span className="capitalize">{name}</span>
          </p>
          <p className="text-xs text-ink-muted" dir="ltr">{strength} × {rx ? fmtNumber(rx.dose_per_administration, t.locale) : ''}</p>
        </div>
        {missed && now && (
          <StatusPill tone="alert" className="shrink-0 px-0 text-end whitespace-normal">
            {t.dashboard.notTaken}&nbsp;<span dir="ltr">{fmtTime(now, t.locale)}</span>
          </StatusPill>
        )}
        {!open && !missed && <StatusPill className="shrink-0">{t.dose[dose.status]}</StatusPill>}
        {open && !missed && (
          <div className="flex shrink-0 gap-1.5">
            <Button size="icon" aria-label={t.dashboard.markTakenShort} onClick={() => mark('taken')} disabled={busy !== null}>
              {busy === 'taken' ? <Spinner className="border-white/40 border-t-white" /> : '✓'}
            </Button>
            <Button size="icon" variant="outline" aria-label={t.dashboard.skipShort} onClick={() => mark('skipped')} disabled={busy !== null}>
              {busy === 'skipped' ? <Spinner /> : '✗'}
            </Button>
          </div>
        )}
      </div>
      {rx && <SourceBadge t={t} source={rx.source} facility={rx.source_facility} sector={rx.source_sector} className="self-start" />}
      {open && missed && (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => mark('taken')} disabled={busy !== null}>
            {busy === 'taken' ? <Spinner className="border-white/40 border-t-white" /> : t.dashboard.markTaken}
          </Button>
          <Button className="flex-1" variant="outline" onClick={() => mark('skipped')} disabled={busy !== null}>
            {busy === 'skipped' ? <Spinner /> : t.dashboard.skip}
          </Button>
        </div>
      )}
      {error && <p role="status" className="text-xs text-red">{error}</p>}
    </Card>
  )
}

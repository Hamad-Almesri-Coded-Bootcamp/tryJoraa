'use client'

import { useState } from 'react'
import type { Dictionary } from '@/i18n'
import { fmtTime } from './format'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Tag, Spinner } from './ui/bits'
import { cx } from './ui/cx'

/** docs/contracts/run-result.example.json — PROVISIONAL until Lane C finalises it Sunday. */
export type RunResult = {
  kind?: string
  run_id?: string
  checked?: number
  proposals?: Proposal[]
  refusals?: Refusal[]
  error?: string
  reason?: string
  reason_en?: string
  reason_ar?: string
}
export type Proposal = { dose_id: string; medicine: string; scheduled_at: string; proposed_at: string; guardrail?: string; reason_en: string; reason_ar: string }
export type Refusal = { dose_id: string; medicine: string; guardrail?: string; reason_en: string; reason_ar: string; alert_id?: string }
export type RunStatusKind = 'queued' | 'running' | 'done' | 'failed'

function reasonFor(t: Dictionary, r: { reason_en?: string; reason_ar?: string }) {
  return (t.locale === 'ar' ? r.reason_ar : r.reason_en) || r.reason_en || r.reason_ar || ''
}

/**
 * Artboard 4a's four inline states: waiting (outline) · running (spinner) ·
 * done (navy fill "✓ Checked") · failed (1.5px red, red text). `role=status` so
 * the change is announced. A failed run says failed and why (SHOULD item).
 */
export function RunStatus({ t, status, failedReason }: { t: Dictionary; status: RunStatusKind; failedReason?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-status={status}
      className={cx(
        'flex min-h-tap items-center justify-center gap-2 rounded-sm border px-3 text-center text-sm',
        status === 'queued' && 'border-line bg-white text-navy',
        status === 'running' && 'border-line bg-white text-navy',
        status === 'done' && 'border-navy bg-navy font-semibold text-white',
        status === 'failed' && 'border-[1.5px] border-red bg-white text-red',
      )}
    >
      {(status === 'queued' || status === 'running') && <Spinner />}
      <span>
        <span className="sr-only">{t.run[status]}: </span>
        {status === 'queued' && t.dashboard.queued}
        {status === 'running' && t.dashboard.running}
        {status === 'done' && t.dashboard.done}
        {status === 'failed' && `${t.dashboard.failed} — ${failedReason || t.dashboard.failedBody}`}
      </span>
    </div>
  )
}

/**
 * Artboard 4a proposal card: "Proposal" tag, the reason in plain words (D16), and
 * Accept / Not now. D15: nothing moves until the patient accepts. Accepting must
 * go through the run-scoped function that sets jurah.run_id (Lane C/A, .plans/b.md);
 * until that endpoint exists the card says so and offers only Not now — never a
 * button that does nothing. Not now dismisses the card in component state.
 */
export function ProposalCard({ t, p, onAccept }: { t: Dictionary; p: Proposal; onAccept?: (p: Proposal) => Promise<void> }) {
  const [state, setState] = useState<'open' | 'accepting' | 'accepted' | 'dismissed' | 'error'>('open')
  if (state === 'dismissed') return null
  return (
    <Card className="flex flex-col gap-2" data-dose={p.dose_id}>
      <Tag>{t.dashboard.proposal}</Tag>
      <p className="text-sm text-navy">{reasonFor(t, p)}</p>
      <p className="text-xs text-ink-muted">
        {p.medicine} · <span dir="ltr">{fmtTime(p.scheduled_at, t.locale)}</span> → <span dir="ltr">{fmtTime(p.proposed_at, t.locale)}</span>
      </p>
      {state === 'accepted' ? (
        <p role="status" className="text-sm font-semibold text-navy">{t.dashboard.accepted}</p>
      ) : (
        <div className="flex gap-2">
          {onAccept ? (
            <Button className="flex-1" disabled={state === 'accepting'} onClick={async () => {
              setState('accepting')
              try { await onAccept(p); setState('accepted') } catch { setState('error') }
            }}>
              {state === 'accepting' ? <Spinner className="border-white/40 border-t-white" /> : t.dashboard.accept}
            </Button>
          ) : (
            <p className="flex-1 self-center text-xs text-ink-muted">{t.dashboard.acceptUnavailable}</p>
          )}
          <Button variant="outline" className="flex-1" onClick={() => setState('dismissed')}>{t.dashboard.notNow}</Button>
        </div>
      )}
      {state === 'error' && <p role="status" className="text-xs text-red">{t.common.error}</p>}
    </Card>
  )
}

/** Artboard 4a refusal card: red-edged, "Refused" tag, plain words, "Got it". No guardrail code here (D16). */
export function RefusalCard({ t, r }: { t: Dictionary; r: Refusal }) {
  const [open, setOpen] = useState(true)
  if (!open) return null
  return (
    <Card variant="refusal" className="flex flex-col gap-2" data-dose={r.dose_id}>
      <Tag tone="red">{t.dashboard.refused}</Tag>
      <p className="text-sm text-navy">{reasonFor(t, r)}</p>
      <p className="text-xs text-ink-muted">{r.medicine}</p>
      <Button variant="outline" className="self-start px-6" onClick={() => setOpen(false)}>{t.dashboard.gotIt}</Button>
    </Card>
  )
}

/** The finished result: a count line, then proposals, then refusals. */
export function ResultPanel({ t, result, onAccept }: { t: Dictionary; result: RunResult | null; onAccept?: (p: Proposal) => Promise<void> }) {
  const proposals = result?.proposals ?? []
  const refusals = result?.refusals ?? []
  return (
    <div className="flex flex-col gap-2.5">
      {typeof result?.checked === 'number' && (
        <p className="text-xs text-ink-muted"><span dir="ltr">{result.checked}</span> {t.dashboard.checked}</p>
      )}
      {proposals.length === 0 && refusals.length === 0 && <p className="text-sm text-navy">{t.dashboard.nothingToDo}</p>}
      {proposals.map((p) => <ProposalCard key={p.dose_id} t={t} p={p} onAccept={onAccept} />)}
      {refusals.map((r) => <RefusalCard key={r.dose_id} t={t} r={r} />)}
    </div>
  )
}

export function failedReasonOf(t: Dictionary, result: RunResult | null): string | undefined {
  if (!result) return undefined
  return reasonFor(t, result) || result.error || result.reason || undefined
}

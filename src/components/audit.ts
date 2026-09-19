import type { Dictionary } from '@/i18n'
import { fmtDateTime, fmtNumber } from './format'

export type AuditRowData = {
  id: number
  at: string
  actor_id: string | null
  actor_role: 'patient' | 'doctor' | 'agent' | 'system'
  run_id: string | null
  patient_id: string
  table_name: string
  row_id: string
  action: 'insert' | 'update' | 'delete'
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

const IGNORED = new Set(['id', 'created_at', 'updated_at', 'patient_id', 'doctor_id', 'prescription_id', 'run_id', 'answered_at', 'original_at', 'acknowledged_by', 'verified_by', 'verified_at', 'added_by', 'justification', 'extracted', 'confidence', 'source_image'])

/**
 * D30 / technical plan §9: an audit row renders as a plain sentence built from
 * before/after — "You changed a dose of Metformin: status Due → Taken, Sun 14:02"
 * — never as raw JSON. Turning a row into words is presentation; nothing is computed.
 * `names` lets the doctor's screen say the patient's name instead of "You".
 */
export function auditSentence(t: Dictionary, row: AuditRowData, names?: { patient?: string; doctor?: string }): { who: string; what: string; detail: string; when: string } {
  const who =
    row.actor_role === 'patient' ? clip(names?.patient ?? t.history.byPatient)
    : row.actor_role === 'doctor' ? clip(names?.doctor ?? t.history.byDoctor)
    : row.actor_role === 'agent' ? t.history.byAgent
    : t.history.bySystem
  const verb = row.action === 'insert' ? t.history.inserted : row.action === 'update' ? t.history.updated : t.history.deleted
  const objectLabel = (t.history as Record<string, string>)[row.table_name] ?? row.table_name
  const rec = row.after ?? row.before ?? {}
  const medicine = typeof rec.drug_name_generic === 'string' ? clip(rec.drug_name_generic) : typeof rec.ingredient === 'string' ? clip(rec.ingredient) : null
  const what = `${verb} ${objectLabel}${medicine ? ` (${medicine})` : ''}`

  const changes: string[] = []
  if (row.action === 'update' && row.before && row.after) {
    for (const k of Object.keys(row.after)) {
      if (IGNORED.has(k)) continue
      const b = row.before[k], a = row.after[k]
      if (JSON.stringify(b) === JSON.stringify(a)) continue
      changes.push(`${fieldLabel(t, k)}: ${fmtValue(t, k, b)} → ${fmtValue(t, k, a)}`)
      if (changes.length === 3) break
    }
  }
  const detail = changes.join(' · ')
  return { who, what, detail, when: fmtDateTime(row.at, t.locale) }
}

/** A sentence, not a dump: a stored value longer than this is shown cut, with an ellipsis (presentation only). */
function clip(v: string, max = 80): string {
  return v.length > max ? v.slice(0, max) + '…' : v
}

function fieldLabel(t: Dictionary, k: string): string {
  const map: Record<string, string> = {
    status: t.history.status, scheduled_at: t.history.scheduledAt,
    strength_value: t.rx.strength, dose_per_administration: t.rx.dose, frequency_per_day: t.rx.frequency,
    duration_days: t.rx.duration, notes: t.rx.notes, indication: t.rx.indication,
    verification: t.meds.verified, is_time_critical: t.meds.timeCritical, catch_up_window_h: t.meds.catchUp, min_gap_h: t.meds.minGap,
    acknowledged_at: t.alerts.acknowledged,
  }
  return map[k] ?? k.replaceAll('_', ' ')
}

function fmtValue(t: Dictionary, k: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (k === 'status' && typeof v === 'string' && v in t.dose) return t.dose[v as keyof Dictionary['dose']]
  if (k === 'verification' && typeof v === 'string') return v === 'verified' ? t.meds.verified : t.meds.unverified
  if (typeof v === 'boolean') return v ? t.meds.yes : t.meds.no
  if (typeof v === 'number') return fmtNumber(v, t.locale)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return fmtDateTime(v, t.locale)
  return clip(String(v))
}

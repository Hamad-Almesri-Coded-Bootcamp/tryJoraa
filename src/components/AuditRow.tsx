import type { Dictionary } from '@/i18n'
import { auditSentence, type AuditRowData } from './audit'
import { Card } from './ui/Card'

/** One audit_log row as a sentence in the card idiom (no artboard; D30). */
export function AuditRow({ t, row, names }: { t: Dictionary; row: AuditRowData; names?: { patient?: string; doctor?: string } }) {
  const s = auditSentence(t, row, names)
  return (
    <Card variant="read" className="flex flex-col gap-1">
      <p className="text-sm text-navy [overflow-wrap:anywhere]">
        <span className="font-semibold">{s.who}</span> {s.what}
        {s.detail && <span className="text-ink-muted"> — {s.detail}</span>}
      </p>
      <p className="text-xs text-ink-muted">
        <span dir="ltr">{s.when}</span>
        {row.run_id && <> · {t.history.fromRun}</>}
      </p>
    </Card>
  )
}

export function AuditList({ t, rows, names, empty }: { t: Dictionary; rows: AuditRowData[]; names?: { patient?: string; doctor?: string }; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-ink-muted">{empty}</p>
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => <li key={r.id}><AuditRow t={t} row={r} names={names} /></li>)}
    </ul>
  )
}

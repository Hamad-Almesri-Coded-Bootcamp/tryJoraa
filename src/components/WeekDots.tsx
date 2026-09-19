import type { Dictionary } from '@/i18n'
import { fmtWeekday, kuwaitYmd } from './format'
import { cx } from './ui/cx'

export type DayMark = 'taken' | 'skipped' | 'moved' | 'none'

/**
 * Artboard 6: seven columns, day label 10px muted (→12px) over a 22px circle —
 * taken = navy fill, skipped/missed = red fill, moved = 2px navy ring, no dose = faint ring.
 * Each dot carries its meaning as text for screen readers (never colour alone).
 * Grouping doses by calendar day is presentation; nothing clinical is computed.
 */
export function WeekDots({ t, doses, now }: { t: Dictionary; doses: { scheduled_at: string; status: string }[]; now: Date }) {
  const days: { ymd: string; date: Date }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    days.push({ ymd: kuwaitYmd(d), date: d })
  }
  const byDay = new Map<string, string[]>()
  for (const d of doses) {
    const k = kuwaitYmd(new Date(d.scheduled_at))
    byDay.set(k, [...(byDay.get(k) ?? []), d.status])
  }
  const markOf = (statuses: string[] | undefined): DayMark => {
    if (!statuses || statuses.length === 0) return 'none'
    if (statuses.some((s) => s === 'skipped' || s === 'missed')) return 'skipped'
    if (statuses.some((s) => s === 'rescheduled')) return 'moved'
    if (statuses.every((s) => s === 'taken')) return 'taken'
    return 'none'
  }
  const label: Record<DayMark, string> = {
    taken: t.dose.taken, skipped: t.dose.skipped, moved: t.dose.rescheduled, none: t.rx.noDoses,
  }
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex justify-between" dir="ltr">
        {days.map(({ ymd, date }) => {
          const m = markOf(byDay.get(ymd))
          return (
            <li key={ymd} className="flex flex-col items-center gap-1">
              <span className="text-xs text-ink-muted">{fmtWeekday(date, t.locale)}</span>
              <span
                role="img"
                aria-label={`${fmtWeekday(date, t.locale)}: ${label[m]}`}
                className={cx(
                  'block size-dot rounded-pill',
                  m === 'taken' && 'bg-navy',
                  m === 'skipped' && 'bg-red',
                  m === 'moved' && 'border-2 border-navy bg-transparent',
                  m === 'none' && 'border border-line-strong bg-transparent',
                )}
              />
            </li>
          )
        })}
      </ol>
      <p className="flex gap-2.5 text-xs text-ink-muted">
        <span>{t.rx.legendTaken}</span><span className="text-red">{t.rx.legendSkipped}</span><span>{t.rx.legendMoved}</span>
      </p>
    </div>
  )
}

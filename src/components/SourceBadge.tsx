import type { Dictionary } from '@/i18n'
import { cx } from './ui/cx'

type Props = {
  t: Dictionary
  source: keyof Dictionary['source']
  facility: string | null
  sector: keyof Dictionary['sector'] | null
  className?: string
}

/**
 * D21/D29: where a prescription came from, in two seconds. Board artboards 5a/5c/10:
 * public = navy text with a 1px navy outline; private = white on soft navy;
 * no sector known = muted outline. Text is "Facility · Sector" (or the source kind).
 */
export function SourceBadge({ t, source, facility, sector, className }: Props) {
  const tone =
    sector === 'public' ? 'border border-navy text-navy'
    : sector === 'private' ? 'bg-navy-soft text-white'
    : 'border border-line-strong text-ink-muted'
  return (
    <span className={cx('inline-flex max-w-full items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-semibold', tone, className)}>
      <span className="truncate">{facility ?? t.source[source]}</span>
      {sector && <span className="shrink-0">· {t.sector[sector]}</span>}
    </span>
  )
}

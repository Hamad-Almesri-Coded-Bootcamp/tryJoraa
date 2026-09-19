import type { Dictionary } from '@/i18n'

type Props = {
  t: Dictionary
  source: keyof Dictionary['source']
  facility: string | null
  sector: keyof Dictionary['sector'] | null
}

/** D21/D29: where a prescription came from, in two seconds. */
export function SourceBadge({ t, source, facility, sector }: Props) {
  const tone = sector === 'public' ? 'bg-sky-100 text-sky-900' : sector === 'private' ? 'bg-violet-100 text-violet-900' : 'bg-slate-100 text-slate-800'
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      <span>{facility ?? t.source[source]}</span>
      {sector && <span>· {t.sector[sector]}</span>}
    </span>
  )
}

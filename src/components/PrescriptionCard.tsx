import Link from 'next/link'
import type { Dictionary } from '@/i18n'
import { fmtNumber } from './format'
import { SourceBadge } from './SourceBadge'
import { cardClass } from './ui/Card'

export type PrescriptionCardData = {
  id: string
  drug_name_generic: string
  drug_name_brand: string | null
  strength_value: number
  strength_unit: string
  dose_per_administration: number
  frequency_per_day: number
  source: keyof Dictionary['source']
  source_facility: string | null
  source_sector: keyof Dictionary['sector'] | null
  doctor_id?: string | null
}

/**
 * Artboard 5a: generic name 14px/700 with the strength 12px muted at the end,
 * a frequency line 11.5px muted, then the source badge. Links to the detail.
 */
export function PrescriptionCard({ t, rx, href, trailing }: { t: Dictionary; rx: PrescriptionCardData; href?: string; trailing?: React.ReactNode }) {
  const strength = `${fmtNumber(rx.strength_value, t.locale)} ${t.unit[rx.strength_unit as keyof Dictionary['unit']] ?? rx.strength_unit}`
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-base font-bold capitalize text-navy [overflow-wrap:anywhere]">
          {rx.drug_name_generic}
          {rx.drug_name_brand && <span className="font-normal text-ink-muted"> ({rx.drug_name_brand})</span>}
        </p>
        <span className="shrink-0 text-sm text-ink-muted" dir="ltr">{strength}</span>
      </div>
      <p className="text-xs text-ink-muted">
        <span dir="ltr">{fmtNumber(rx.dose_per_administration, t.locale)} × {rx.frequency_per_day}</span> {t.rx.perDay}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <SourceBadge t={t} source={rx.source} facility={rx.source_facility} sector={rx.source_sector} />
        {trailing}
      </div>
    </>
  )
  const cls = cardClass('default', 'flex flex-col gap-1.5')
  return href ? <Link href={href} className={cls + ' hover:border-navy/40'}>{body}</Link> : <div className={cls}>{body}</div>
}

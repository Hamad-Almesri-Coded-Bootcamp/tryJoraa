import type { HTMLAttributes } from 'react'
import { cx } from './cx'

/**
 * Board card shells:
 *  default — white, 1px navy/12 border, radius 10, padding 10px 12px
 *  refusal — border red/35 + 4px red inline-start bar (not-taken dose, refusal, alert)
 *  flag    — 2px red border, radius 12, padding 14 (interaction flag)
 *  muted   — default at 60% opacity (acknowledged alert)
 */
export type CardVariant = 'default' | 'refusal' | 'flag' | 'muted' | 'read'

export function cardClass(variant: CardVariant = 'default', extra?: string) {
  return cx(
    'bg-white min-w-0 [overflow-wrap:anywhere]',
    variant === 'default' && 'rounded-md border border-line px-3 py-2.5',
    variant === 'read' && 'rounded-md border border-line px-3 py-3',
    variant === 'refusal' && 'rounded-md border border-red-line border-s-4 border-s-red px-3 py-2.5',
    variant === 'flag' && 'rounded-lg border-2 border-red p-3.5',
    variant === 'muted' && 'rounded-md border border-line px-3 py-2.5 opacity-60',
    extra,
  )
}

export function Card({ variant = 'default', className, ...rest }: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return <div className={cardClass(variant, className)} {...rest} />
}

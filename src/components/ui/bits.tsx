import type { ReactNode } from 'react'
import { cx } from './cx'

/** Board: 14px ring, 2px navy/25, top navy, 0.8s spin. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx('inline-block size-3.5 shrink-0 animate-spin rounded-pill border-2 border-navy/25 border-t-navy', className)}
    />
  )
}

/** Board: 11px/700 uppercase, letter-spacing 0.04em, soft navy → 12px. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx('text-xs font-bold uppercase tracking-label text-navy-soft', className)}>{children}</h2>
}

/** Board: 11px navy on surface, pill, padding 4px 10px. Always carries text. */
export function StatusPill({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'alert' | 'solid'; className?: string }) {
  return (
    <span className={cx(
      'inline-flex items-center rounded-pill px-2.5 py-1 text-xs whitespace-nowrap',
      tone === 'neutral' && 'bg-surface text-navy',
      tone === 'alert' && 'font-bold text-red',
      tone === 'solid' && 'bg-navy font-semibold text-white',
      className,
    )}>
      {children}
    </span>
  )
}

/** Board: 10px/700 tag pill — "Proposal" navy outline, "Refused" red outline, "Verified" navy fill → 12px. */
export function Tag({ children, tone = 'navy' }: { children: ReactNode; tone?: 'navy' | 'red' | 'solid' | 'muted' }) {
  return (
    <span className={cx(
      'inline-flex self-start rounded-pill px-2 py-0.5 text-xs font-bold',
      tone === 'navy' && 'border border-navy text-navy',
      tone === 'red' && 'border border-red/40 text-red',
      tone === 'solid' && 'bg-navy font-semibold text-white',
      tone === 'muted' && 'border border-navy/35 font-semibold text-navy',
    )}>
      {children}
    </span>
  )
}

/** Board: padding 36–40px 20px centred; optional 56px navy ✓ circle; title 15–16px/700; body 12.5px muted. */
export function EmptyState({ title, body, action, check }: { title: string; body?: string; action?: ReactNode; check?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-9 text-center">
      {check && <span aria-hidden className="flex size-14 items-center justify-center rounded-pill bg-navy text-2xl text-white">✓</span>}
      <p className="text-lg font-bold text-navy">{title}</p>
      {body && <p className="text-sm text-ink-muted">{body}</p>}
      {action && <div className="w-full pt-1">{action}</div>}
    </div>
  )
}

/** One live region for a form's loading / error / success line (FE-3). */
export function FormStatus({ state, className }: {
  state: { kind: 'idle' } | { kind: 'loading'; message: string } | { kind: 'error'; message: string } | { kind: 'success'; message: string }
  className?: string
}) {
  return (
    <p role="status" aria-live="polite" className={cx('flex min-h-6 items-center gap-2 text-sm', state.kind === 'error' ? 'text-red' : 'text-navy', className)}>
      {state.kind === 'loading' && <Spinner />}
      {state.kind !== 'idle' && state.message}
    </p>
  )
}

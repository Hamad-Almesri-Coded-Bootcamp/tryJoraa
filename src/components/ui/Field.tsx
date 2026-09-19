import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cx } from './cx'

/**
 * Board: label 11px/600 navy (→12px) over a 44px control, 1px navy/25 border,
 * radius 8, padding 0 12px, 13px text (→14px so iOS never zooms), placeholder navy/40.
 * Read-only variant sits on the surface colour.
 */
export const controlClass = cx(
  'min-h-tap w-full rounded-sm border border-line-strong bg-white px-3 text-base text-navy',
  'placeholder:text-ink-faint focus:border-navy focus:outline-2 focus:outline-offset-0 focus:outline-navy-soft/40',
  'read-only:bg-surface disabled:bg-surface',
)

type Common = { label: string; hint?: string; error?: string; optional?: string; className?: string; dirLtr?: boolean }

export function Field({ label, hint, error, optional, className, dirLtr, ...input }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cx('flex flex-col gap-1', className)}>
      <FieldLabel label={label} optional={optional} />
      <input
        className={cx(controlClass, error && 'border-red')}
        dir={dirLtr ? 'ltr' : undefined}
        aria-invalid={error ? true : undefined}
        {...input}
      />
      <FieldFoot hint={hint} error={error} />
    </label>
  )
}

export function SelectField({ label, hint, error, optional, className, children, ...select }: Common & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <label className={cx('flex flex-col gap-1', className)}>
      <FieldLabel label={label} optional={optional} />
      <select className={cx(controlClass, 'appearance-none', error && 'border-red')} aria-invalid={error ? true : undefined} {...select}>
        {children}
      </select>
      <FieldFoot hint={hint} error={error} />
    </label>
  )
}

export function TextareaField({ label, hint, error, optional, className, ...ta }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={cx('flex flex-col gap-1', className)}>
      <FieldLabel label={label} optional={optional} />
      <textarea className={cx(controlClass, 'py-2.5', error && 'border-red')} rows={3} aria-invalid={error ? true : undefined} {...ta} />
      <FieldFoot hint={hint} error={error} />
    </label>
  )
}

function FieldLabel({ label, optional }: { label: string; optional?: string }) {
  return (
    <span className="text-xs font-semibold text-navy">
      {label}
      {optional && <span className="ms-1 font-normal text-ink-muted">({optional})</span>}
    </span>
  )
}

function FieldFoot({ hint, error }: { hint?: string; error?: string }) {
  if (!hint && !error) return null
  return <span className={cx('text-xs', error ? 'text-red' : 'text-ink-muted')}>{error ?? hint}</span>
}

/**
 * Board: choices as pills — selected white on soft navy, others navy text with a
 * navy/30 border. Radios underneath so the form posts a plain value.
 */
export function ChipGroup({ label, name, options, defaultValue, error }: {
  label: string; name: string; options: { value: string; label: string }[]; defaultValue?: string; error?: string
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-semibold text-navy">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} className="peer sr-only" />
            <span className={cx(
              'inline-flex min-h-tap items-center rounded-pill border border-navy/30 px-3 text-xs text-navy',
              'peer-checked:border-navy-soft peer-checked:bg-navy-soft peer-checked:text-white',
              'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy-soft',
            )}>
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {error && <span className="text-xs text-red">{error}</span>}
    </fieldset>
  )
}

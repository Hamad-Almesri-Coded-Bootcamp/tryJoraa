import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

/**
 * Board: primary = navy fill / white / radius 8 / 14px 600 / min-height 44;
 * outline = white / navy / 1.5px navy border; the one CTA per screen is 48px 15px 700.
 * Tap targets floor at 44px everywhere (FE-4), so the board's 36/40px buttons are 44 here.
 */
type Variant = 'primary' | 'outline' | 'ghost'
type Size = 'md' | 'cta' | 'icon'

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-sm font-semibold transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-soft',
    'disabled:cursor-not-allowed disabled:opacity-60',
    size === 'md' && 'min-h-tap px-4 text-base',
    size === 'cta' && 'min-h-cta px-4 text-lg font-bold',
    size === 'icon' && 'size-tap text-base',
    variant === 'primary' && 'bg-navy text-white hover:bg-navy-soft',
    variant === 'outline' && 'border-[1.5px] border-navy bg-white text-navy hover:bg-surface',
    variant === 'ghost' && 'text-navy-soft underline underline-offset-2 hover:text-navy',
    extra,
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />
}

export function ButtonLink({
  href, variant = 'primary', size = 'md', className, children, prefetch,
}: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode; prefetch?: boolean }) {
  return (
    <Link href={href} prefetch={prefetch} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  )
}

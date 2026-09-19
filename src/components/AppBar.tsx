import Link from 'next/link'
import type { Dictionary } from '@/i18n'
import { LangSwitch } from './LangSwitch'
import { cx } from './ui/cx'

export type NavItem = { href: string; label: string; active: boolean }

/**
 * Board: navy bar, padding 14px 16px; title 14px/700 white at the start (detail
 * screens prefix ‹, which flips with dir); at the end the language chip and an
 * underlined 11px "Sign out" (→12px). At ≥768 the tab bar's links move into the
 * bar's centre ("Responsive system" note).
 */
export function AppBar({ t, path, title, backHref, brandMark, nav, signedIn }: {
  t: Dictionary
  path: string
  title: string
  backHref?: string
  brandMark?: boolean
  nav?: NavItem[]
  signedIn?: boolean
}) {
  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-doctor items-center justify-between gap-3 px-4 py-2 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {backHref && (
            <Link href={backHref} aria-label={t.nav.back} className="-ms-3 flex size-tap shrink-0 items-center justify-center">
              <span aria-hidden className="flip-rtl text-2xl leading-none">‹</span>
            </Link>
          )}
          {brandMark && (
            <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-[6px] bg-white">
              <span className="size-2 rounded-pill bg-navy" />
            </span>
          )}
          <span className="min-h-tap truncate py-3 text-base font-bold leading-5">{title}</span>
        </div>

        {nav && nav.length > 0 && (
          <nav className="hidden items-center gap-6 md:flex" aria-label={t.nav.dashboard}>
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={n.active ? 'page' : undefined}
                className={cx('flex min-h-tap items-center text-sm', n.active ? 'font-semibold text-white' : 'text-on-navy-muted hover:text-white')}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <LangSwitch t={t} path={path} />
          {signedIn && (
            <form action="/auth/sign-out" method="post">
              <button type="submit" className="min-h-tap px-1 text-xs text-on-navy-muted underline underline-offset-2 hover:text-white">
                {t.nav.signOut}
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  )
}

import Link from 'next/link'
import type { Dictionary } from '@/i18n'
import type { NavItem } from './AppBar'
import { cx } from './ui/cx'

/**
 * Board (phone): border-top navy/12, equal tabs, each ≥44px, 11px (→12px); the
 * active tab is navy with white 600 text; the last tab is Sign out. Hidden at
 * ≥768 where the app bar carries the links. Sticky so the thumb reaches it.
 */
export function TabBar({ t, items }: { t: Dictionary; items: NavItem[] }) {
  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-line bg-white md:hidden" aria-label={t.nav.dashboard}>
      {items.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={n.active ? 'page' : undefined}
          className={cx(
            'flex min-h-tap flex-1 items-center justify-center px-1 text-center text-xs leading-tight',
            n.active ? 'bg-navy font-semibold text-white' : 'text-navy hover:bg-surface',
          )}
        >
          {n.label}
        </Link>
      ))}
      <form action="/auth/sign-out" method="post" className="flex flex-1">
        <button type="submit" className="flex min-h-tap flex-1 items-center justify-center px-1 text-center text-xs leading-tight text-navy hover:bg-surface">
          {t.nav.signOut}
        </button>
      </form>
    </nav>
  )
}

/**
 * Board (≥1024, doctor): a 180px start sidebar with Patients · Medications; this
 * build adds Alerts so the three doctor lists share one place. Active = navy fill.
 */
export function Sidebar({ items }: { items: NavItem[] }) {
  return (
    <aside className="hidden w-sidebar shrink-0 flex-col gap-1 border-e border-line/80 px-3 py-4 lg:flex">
      {items.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={n.active ? 'page' : undefined}
          className={cx('flex min-h-tap items-center rounded-sm px-3.5 text-sm', n.active ? 'bg-navy font-semibold text-white' : 'text-navy hover:bg-white')}
        >
          {n.label}
        </Link>
      ))}
    </aside>
  )
}

import Link from 'next/link'
import type { Dictionary } from '@/i18n'

/**
 * Board: a 10px/700 chip, white on white/18, pill, in the app bar; reads "EN" on
 * Arabic screens and "AR" on English ones. Sets ?lang=… which the proxy turns
 * into the `lang` cookie and strips. 44px hit area, 12px text.
 */
export function LangSwitch({ t, path }: { t: Dictionary; path: string }) {
  return (
    <Link
      href={`${path}?lang=${t.lang.code}`}
      prefetch={false}
      aria-label={t.lang.switchTo}
      lang={t.lang.code}
      className="flex min-h-tap items-center px-1"
    >
      <span className="rounded-pill bg-on-navy-chip px-2.5 py-1 text-xs font-bold text-white">{t.lang.short}</span>
    </Link>
  )
}

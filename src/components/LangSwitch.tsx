import Link from 'next/link'
import type { Dictionary } from '@/i18n'

/** Sets ?lang=… which the proxy turns into the `lang` cookie and strips. */
export function LangSwitch({ t, path }: { t: Dictionary; path: string }) {
  return (
    <Link
      href={`${path}?lang=${t.lang.code}`}
      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
      prefetch={false}
    >
      {t.lang.switchTo}
    </Link>
  )
}

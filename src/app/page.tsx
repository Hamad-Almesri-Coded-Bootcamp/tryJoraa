import Link from 'next/link'
import { getDictionary } from '@/i18n'

export default async function Home() {
  const t = await getDictionary()
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold text-emerald-900">{t.brand}</h1>
      <ul className="space-y-3 text-base leading-7 text-slate-800">
        <li>{t.landing.line1}</li>
        <li>{t.landing.line2}</li>
        <li>{t.landing.line3}</li>
      </ul>
      <div className="mt-4 flex flex-col gap-3">
        <Link href="/sign-in" className="rounded-lg bg-emerald-700 px-4 py-3 text-center text-base font-medium text-white hover:bg-emerald-800">
          {t.landing.cta}
        </Link>
        <Link href="/sign-up" className="rounded-lg border border-slate-300 px-4 py-3 text-center text-base text-slate-800 hover:bg-white">
          {t.landing.ctaNew}
        </Link>
      </div>
    </main>
  )
}

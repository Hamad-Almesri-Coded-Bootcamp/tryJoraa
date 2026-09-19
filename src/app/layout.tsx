import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import './globals.css'
import { getDictionary } from '@/i18n'
import { SafetyLine } from '@/components/SafetyLine'
import { LangSwitch } from '@/components/LangSwitch'

export const metadata: Metadata = {
  title: "Jur'ah · جرعة",
  description: 'Every prescription a patient holds, from any clinic, in one profile. Student prototype — sample data only.',
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const t = await getDictionary()
  const path = (await headers()).get('x-pathname') ?? '/'
  return (
    <html lang={t.locale} dir={t.dir} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <Link href="/" className="text-lg font-semibold text-emerald-800">
            {t.brand} <span className="text-slate-400 font-normal">· {t.brandOther}</span>
          </Link>
          <LangSwitch t={t} path={path} />
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <SafetyLine />
      </body>
    </html>
  )
}

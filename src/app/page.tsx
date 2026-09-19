import { headers } from 'next/headers'
import { getDictionary } from '@/i18n'
import { AppBar } from '@/components/AppBar'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

/**
 * Artboard 1: headline, three numbered lines, Create account (primary) over
 * Sign in (outline), footnote. At 1440 the board splits it: copy and buttons at
 * the start, the three lines as cards at the end. No login wall (SH-1).
 */
export default async function Home() {
  const t = await getDictionary()
  const path = (await headers()).get('x-pathname') ?? '/'
  const lines = [t.landing.line1, t.landing.line2, t.landing.line3]
  return (
    <div className="flex flex-1 flex-col">
      <AppBar t={t} path={path} title={t.brand} brandMark />
      <main className="mx-auto flex w-full max-w-doctor flex-1 flex-col items-center gap-4 px-5 pt-7 pb-4 lg:flex-row lg:items-center lg:gap-12 lg:px-14 lg:py-12">
        <div className="flex w-full flex-col items-center gap-4 text-center lg:flex-1 lg:items-start lg:text-start">
          <h1 className="text-2xl font-bold text-navy lg:text-3xl">{t.landing.headline}</h1>
          <ol className="flex w-full flex-col gap-2.5 text-start text-sm text-navy/75 lg:hidden">
            {lines.map((l, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 font-semibold" dir="ltr">{i + 1} ·</span>
                <span>{l}</span>
              </li>
            ))}
          </ol>
          <div className="flex w-full flex-col gap-2.5 lg:w-auto lg:flex-row lg:gap-3">
            <ButtonLink href="/sign-up">{t.landing.cta}</ButtonLink>
            <ButtonLink href="/sign-in" variant="outline">{t.landing.ctaSignIn}</ButtonLink>
          </div>
        </div>
        <ul className="hidden w-full flex-col gap-2.5 lg:flex lg:flex-1">
          {lines.map((l, i) => (
            <li key={i}><Card variant="read" className="text-sm">{l}</Card></li>
          ))}
        </ul>
      </main>
      <p className="px-4 pb-3.5 text-center text-xs text-navy/40">{t.landing.footnote}</p>
    </div>
  )
}

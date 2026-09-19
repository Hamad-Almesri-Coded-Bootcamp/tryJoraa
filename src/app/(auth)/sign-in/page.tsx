import Link from 'next/link'
import { getDictionary } from '@/i18n'
import { SignInForm } from './SignInForm'

export default async function SignInPage() {
  const t = await getDictionary()
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">{t.auth.signInTitle}</h1>
      <SignInForm t={t} />
      <p className="text-sm text-slate-600">
        {t.auth.noAccount} <Link href="/sign-up" className="text-emerald-800 underline">{t.nav.signUp}</Link>
      </p>
      <p className="text-xs text-slate-500">{t.auth.doctorNote}</p>
    </main>
  )
}

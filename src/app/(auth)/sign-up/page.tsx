import Link from 'next/link'
import { getDictionary } from '@/i18n'
import { SignUpForm } from './SignUpForm'

export default async function SignUpPage() {
  const t = await getDictionary()
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">{t.auth.signUpTitle}</h1>
      <SignUpForm t={t} />
      <p className="text-sm text-slate-600">
        {t.auth.haveAccount} <Link href="/sign-in" className="text-emerald-800 underline">{t.nav.signIn}</Link>
      </p>
      <p className="text-xs text-slate-500">{t.auth.doctorNote}</p>
    </main>
  )
}

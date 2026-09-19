import Link from 'next/link'
import { getDictionary } from '@/i18n'
import { SignUpForm } from './SignUpForm'

/** Artboard 3: patient self-signup only — name, civil ID, email, password. No doctor option. */
export default async function SignUpPage() {
  const t = await getDictionary()
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-navy">{t.auth.signUpTitle}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t.auth.signUpSub}</p>
      </div>
      <SignUpForm t={t} />
      <p className="text-center text-sm text-navy-soft">
        {t.auth.haveAccount}{' '}
        <Link href="/sign-in" className="inline-flex min-h-tap items-center underline underline-offset-2">{t.nav.signIn}</Link>
      </p>
    </>
  )
}

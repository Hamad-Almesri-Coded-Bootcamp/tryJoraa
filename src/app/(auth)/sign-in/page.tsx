import Link from 'next/link'
import { getDictionary } from '@/i18n'
import { SignInForm } from './SignInForm'

/** Artboard 2: title, subtitle, email + password, Sign in, "New patient? Create an account". */
export default async function SignInPage() {
  const t = await getDictionary()
  return (
    <>
      <div>
        <h1 className="text-xl font-bold text-navy">{t.auth.signInTitle}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t.auth.signInSub}</p>
      </div>
      <SignInForm t={t} />
      <p className="text-center text-sm text-navy-soft">
        {t.auth.newPatient}{' '}
        <Link href="/sign-up" className="inline-flex min-h-tap items-center underline underline-offset-2">{t.auth.createAccount}</Link>
      </p>
    </>
  )
}

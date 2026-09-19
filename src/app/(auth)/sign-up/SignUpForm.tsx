'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signUpSchema } from '@/lib/validation/auth'
import { firstIssueOf, issueMessage } from '@/components/formIssue'
import type { Dictionary } from '@/i18n'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { FormStatus } from '@/components/ui/bits'

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'success' }

export function SignUpForm({ t }: { t: Dictionary }) {
  const router = useRouter()
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const parsed = signUpSchema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
      full_name: form.get('full_name'),
      civil_id: form.get('civil_id'),
    })
    if (!parsed.success) {
      const i = firstIssueOf(parsed.error)
      if (i.path === 'civil_id') return setState({ kind: 'error', message: t.auth.civilIdInvalid })
      const label = i.path === 'email' ? t.auth.email : i.path === 'password' ? t.auth.password : t.auth.fullName
      return setState({ kind: 'error', message: issueMessage(t, label, i.code) })
    }

    setState({ kind: 'loading' })
    const supabase = createClient()
    // the DB trigger handle_new_user creates the profiles row, always as 'patient'
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: parsed.data.full_name, civil_id: parsed.data.civil_id } },
    })
    if (error) return setState({ kind: 'error', message: error.message })
    if (!data.session) {
      // email confirmation may be on in the project: sign in explicitly
      const { error: e2 } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password })
      if (e2) return setState({ kind: 'error', message: e2.message })
    }
    setState({ kind: 'success' })
    router.replace('/dashboard')
    router.refresh()
  }

  const busy = state.kind === 'loading' || state.kind === 'success'
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-3 md:flex-row">
        <Field className="md:flex-1" label={t.auth.fullName} name="full_name" type="text" autoComplete="name" required minLength={2} placeholder={t.auth.fullNameHint} />
        <Field className="md:flex-1" label={t.auth.civilId} name="civil_id" type="text" inputMode="numeric" pattern="\d{12}" required placeholder={t.auth.civilIdHint} dirLtr />
      </div>
      <Field label={t.auth.email} name="email" type="email" autoComplete="email" required placeholder={t.auth.emailHint} dirLtr />
      <Field label={t.auth.password} name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="••••••••" dirLtr />
      <Button type="submit" disabled={busy}>{state.kind === 'loading' ? t.auth.creating : t.auth.signUpSubmit}</Button>
      <FormStatus
        state={
          state.kind === 'loading' ? { kind: 'loading', message: t.auth.creating }
          : state.kind === 'error' ? { kind: 'error', message: state.message }
          : state.kind === 'success' ? { kind: 'success', message: t.auth.created }
          : { kind: 'idle' }
        }
      />
    </form>
  )
}

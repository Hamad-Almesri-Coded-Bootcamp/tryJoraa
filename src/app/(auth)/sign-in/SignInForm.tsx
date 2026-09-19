'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signInSchema } from '@/lib/validation/auth'
import { firstIssueOf, issueMessage } from '@/components/formIssue'
import type { Dictionary } from '@/i18n'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { FormStatus } from '@/components/ui/bits'

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'success' }

/** The form state machine every form copies: idle / loading / success / error (FE-3). */
export function SignInForm({ t }: { t: Dictionary }) {
  const router = useRouter()
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const parsed = signInSchema.safeParse({ email: form.get('email'), password: form.get('password') })
    if (!parsed.success) {
      const i = firstIssueOf(parsed.error)
      return setState({ kind: 'error', message: issueMessage(t, i.path === 'email' ? t.auth.email : t.auth.password, i.code) })
    }

    setState({ kind: 'loading' })
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
    if (error || !data.user) return setState({ kind: 'error', message: t.auth.invalid })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    setState({ kind: 'success' })
    router.replace(profile?.role === 'doctor' ? '/doctor' : '/dashboard')
    router.refresh()
  }

  const busy = state.kind === 'loading' || state.kind === 'success'
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
      <Field label={t.auth.email} name="email" type="email" autoComplete="email" required placeholder={t.auth.emailHint} dirLtr />
      <Field label={t.auth.password} name="password" type="password" autoComplete="current-password" required minLength={8} placeholder="••••••••" dirLtr />
      <Button type="submit" disabled={busy}>{state.kind === 'loading' ? t.auth.working : t.auth.signInSubmit}</Button>
      <FormStatus
        state={
          state.kind === 'loading' ? { kind: 'loading', message: t.auth.working }
          : state.kind === 'error' ? { kind: 'error', message: state.message }
          : state.kind === 'success' ? { kind: 'success', message: t.auth.signedIn }
          : { kind: 'idle' }
        }
      />
    </form>
  )
}

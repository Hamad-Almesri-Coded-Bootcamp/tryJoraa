'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signUpSchema, firstIssue } from '@/lib/validation/auth'
import type { Dictionary } from '@/i18n'

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
    if (!parsed.success) return setState({ kind: 'error', message: firstIssue(parsed.error) })

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
      // email confirmation is on in the project: sign in explicitly
      const { error: e2 } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password })
      if (e2) return setState({ kind: 'error', message: e2.message })
    }
    setState({ kind: 'success' })
    router.replace('/dashboard')
    router.refresh()
  }

  const busy = state.kind === 'loading' || state.kind === 'success'
  const input = 'rounded-md border border-slate-300 px-3 py-3 text-base'
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 text-sm text-slate-700">{t.auth.fullName}
        <input name="full_name" type="text" autoComplete="name" required minLength={2} maxLength={80} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">{t.auth.civilId}
        <input name="civil_id" type="text" inputMode="numeric" pattern="\d{12}" required maxLength={12} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">{t.auth.email}
        <input name="email" type="email" autoComplete="email" required maxLength={254} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">{t.auth.password}
        <input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className={input} />
      </label>
      <button type="submit" disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-3 text-base font-medium text-white disabled:opacity-60">
        {state.kind === 'loading' ? t.auth.creating : t.auth.submit}
      </button>
      <p role="status" aria-live="polite" className={`min-h-6 text-sm ${state.kind === 'error' ? 'text-red-700' : 'text-emerald-800'}`}>
        {state.kind === 'error' && state.message}
        {state.kind === 'success' && t.auth.created}
      </p>
    </form>
  )
}

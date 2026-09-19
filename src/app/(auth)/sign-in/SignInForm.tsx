'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signInSchema, firstIssue } from '@/lib/validation/auth'
import type { Dictionary } from '@/i18n'

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'success' }

export function SignInForm({ t }: { t: Dictionary }) {
  const router = useRouter()
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const parsed = signInSchema.safeParse({ email: form.get('email'), password: form.get('password') })
    if (!parsed.success) return setState({ kind: 'error', message: firstIssue(parsed.error) })

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
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        {t.auth.email}
        <input name="email" type="email" autoComplete="email" required maxLength={254} className="rounded-md border border-slate-300 px-3 py-3 text-base" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        {t.auth.password}
        <input name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={72} className="rounded-md border border-slate-300 px-3 py-3 text-base" />
      </label>
      <button type="submit" disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-3 text-base font-medium text-white disabled:opacity-60">
        {state.kind === 'loading' ? t.auth.working : t.auth.submit}
      </button>
      <p role="status" aria-live="polite" className={`min-h-6 text-sm ${state.kind === 'error' ? 'text-red-700' : 'text-emerald-800'}`}>
        {state.kind === 'error' && state.message}
        {state.kind === 'success' && t.auth.signedIn}
      </p>
    </form>
  )
}

'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/i18n'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { FormStatus } from '@/components/ui/bits'
import { Card } from '@/components/ui/Card'
import { linkPatient } from './actions'

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error' } | { kind: 'success' }

/** Artboard 9a/9b: a single identifier field; 9b's not-found idiom is the same "no_match" wording whether the patient doesn't exist or isn't linkable, so the screen can't be used to enumerate patients (D7). */
export function AddPatientForm({ t }: { t: Dictionary }) {
  const router = useRouter()
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const identifier = form.get('identifier')

    setState({ kind: 'loading' })
    const result = await linkPatient(identifier)
    if (!result.ok) {
      setState({ kind: 'error' })
      return
    }
    setState({ kind: 'success' })
    router.push(`/doctor/patients/${result.patientId}`)
    router.refresh()
  }

  const busy = state.kind === 'loading' || state.kind === 'success'

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
      <Field label={t.doctor.identifier} name="identifier" required placeholder={t.doctor.identifierHint} dirLtr />
      <Button type="submit" disabled={busy}>{state.kind === 'loading' ? t.doctor.finding : t.doctor.find}</Button>
      {state.kind === 'error' && <Card variant="read" className="text-sm text-navy">{t.doctor.noMatch}</Card>}
      <FormStatus
        state={
          state.kind === 'loading' ? { kind: 'loading', message: t.doctor.finding }
          : state.kind === 'success' ? { kind: 'success', message: t.doctor.linked }
          : { kind: 'idle' }
        }
      />
    </form>
  )
}

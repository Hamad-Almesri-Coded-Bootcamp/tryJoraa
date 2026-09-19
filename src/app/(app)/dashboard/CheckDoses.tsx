'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Dictionary } from '@/i18n'
import { Button } from '@/components/ui/Button'
import { RunStatus, ResultPanel, failedReasonOf, type RunResult, type RunStatusKind } from '@/components/RunResult'

type RunRow = { id: string; status: RunStatusKind; result: RunResult | null; finished_at: string | null }
type State =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'polling'; run: RunRow }
  | { kind: 'finished'; run: RunRow }
  | { kind: 'error'; message: string }

/**
 * AU-2 / AU-6: start the automation from our front end, watch its status, read
 * the result — on this screen, never in n8n or the database. POST /api/runs
 * creates the runs row and calls n8n server-side; the browser then polls the
 * row through Supabase (RLS scopes it) until done or failed.
 */
export function CheckDoses({ t }: { t: Dictionary }) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  async function start() {
    if (timer.current) clearInterval(timer.current)
    setState({ kind: 'starting' })
    let res: Response
    try {
      res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'check_doses' }),
      })
    } catch {
      return setState({ kind: 'error', message: t.dashboard.runError })
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return setState({ kind: 'error', message: body.error ?? `${t.dashboard.runError} (${res.status})` })
    }
    const { runId } = (await res.json()) as { runId: string }
    const supabase = createClient()

    const poll = async () => {
      const { data } = await supabase.from('runs').select('id,status,result,finished_at').eq('id', runId).single<RunRow>()
      if (!data) return
      if (data.status === 'done' || data.status === 'failed') {
        if (timer.current) clearInterval(timer.current)
        setState({ kind: 'finished', run: data })
      } else {
        setState({ kind: 'polling', run: data })
      }
    }
    await poll()
    let ticks = 0
    timer.current = setInterval(async () => {
      ticks += 1
      if (ticks > 150) { // five minutes — stop polling and say so (FE-3: never a frozen screen)
        if (timer.current) clearInterval(timer.current)
        return setState({ kind: 'error', message: t.dashboard.runError })
      }
      await poll()
    }, 2000)
  }

  const busy = state.kind === 'starting' || state.kind === 'polling'
  const run = state.kind === 'polling' || state.kind === 'finished' ? state.run : null
  const status: RunStatusKind | null = state.kind === 'starting' ? 'queued' : run ? run.status : null

  return (
    <section aria-labelledby="check-doses" className="flex flex-col gap-2.5 pt-1">
      <h2 id="check-doses" className="sr-only">{t.dashboard.check}</h2>
      <Button size="cta" onClick={start} disabled={busy}>
        {busy ? t.dashboard.checking : t.dashboard.check}
      </Button>
      {state.kind === 'error' && <p role="status" aria-live="polite" className="text-sm text-red">{state.message}</p>}
      {status && <RunStatus t={t} status={status} failedReason={run ? failedReasonOf(t, run.result) : undefined} />}
      {state.kind === 'finished' && state.run.status === 'done' && <ResultPanel t={t} result={state.run.result} />}
      {state.kind === 'finished' && state.run.status === 'failed' && (
        <Button variant="outline" onClick={start}>{t.dashboard.tryAgain}</Button>
      )}
    </section>
  )
}

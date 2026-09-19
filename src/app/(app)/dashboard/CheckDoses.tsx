'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Dictionary } from '@/i18n'

type RunRow = { id: string; status: 'queued' | 'running' | 'done' | 'failed'; result: unknown; finished_at: string | null }
type State =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'polling'; run: RunRow }
  | { kind: 'finished'; run: RunRow }
  | { kind: 'error'; message: string }

/** AU-2: start the automation from our front end, watch its status, read the result. */
export function CheckDoses({ t }: { t: Dictionary }) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  async function start() {
    setState({ kind: 'starting' })
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'check_doses' }),
    })
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
    timer.current = setInterval(poll, 2000)
  }

  const busy = state.kind === 'starting' || state.kind === 'polling'
  const run = state.kind === 'polling' || state.kind === 'finished' ? state.run : null

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-base font-medium text-white disabled:opacity-60"
      >
        {busy ? t.dashboard.checking : t.dashboard.check}
      </button>
      <div role="status" aria-live="polite" className="mt-3 space-y-2 text-sm">
        {state.kind === 'starting' && <p className="text-slate-600">{t.dashboard.runStarted}</p>}
        {state.kind === 'error' && <p className="text-red-700">{state.message}</p>}
        {run && (
          <>
            <p>
              <span className="text-slate-500">{t.dashboard.status}: </span>
              <span className="font-medium">{t.run[run.status]}</span>
            </p>
            {state.kind === 'finished' && (
              <div>
                <p className={run.status === 'failed' ? 'text-red-700' : 'text-emerald-800'}>
                  {run.status === 'failed' ? t.dashboard.runFailed : t.dashboard.runDone}
                </p>
                <p className="mt-1 text-slate-500">{t.dashboard.result}:</p>
                {/* PROVISIONAL rendering — Lane B renders docs/contracts/run-result.example.json properly */}
                <pre dir="ltr" className="mt-1 max-w-full overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-800">
                  {run.result ? JSON.stringify(run.result, null, 2) : t.dashboard.noResult}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

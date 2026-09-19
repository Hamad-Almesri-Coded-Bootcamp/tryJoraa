'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/i18n'
import { Button } from '@/components/ui/Button'
import { FormStatus } from '@/components/ui/bits'
import { discardDraft } from './actions'

/** Secondary action under the accept form: throw the draft away. Same idle/loading/success/error machine. */
export function DiscardButton({ t, draftId }: { t: Dictionary; draftId: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  async function discard() {
    setState('loading')
    const r = await discardDraft(draftId)
    if (!r.ok) return setState('error')
    setState('success')
    router.push('/prescriptions')
    router.refresh()
  }
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <Button type="button" variant="outline" onClick={discard} disabled={state === 'loading' || state === 'success'}>
        {state === 'loading' ? t.drafts.discarding : t.drafts.discard}
      </Button>
      <FormStatus
        state={
          state === 'loading' ? { kind: 'loading', message: t.drafts.discarding }
          : state === 'success' ? { kind: 'success', message: t.drafts.discarded }
          : state === 'error' ? { kind: 'error', message: t.common.error }
          : { kind: 'idle' }
        }
      />
    </div>
  )
}

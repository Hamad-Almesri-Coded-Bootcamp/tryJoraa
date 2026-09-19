'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/i18n'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/bits'
import { acknowledgeAlert } from './actions'

/** Artboard 12a: a 40px outline "Acknowledge" button; acknowledged rows drop it entirely. */
export function AcknowledgeButton({ t, id }: { t: Dictionary; id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function onClick() {
    setBusy(true)
    setError(false)
    const result = await acknowledgeAlert(id)
    setBusy(false)
    if (!result.ok) return setError(true)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="outline" onClick={onClick} disabled={busy}>
        {busy ? <Spinner /> : null}
        {busy ? t.alerts.acknowledging : t.alerts.acknowledge}
      </Button>
      {error && <p role="status" className="text-xs text-red">{t.alerts.failed}</p>}
    </div>
  )
}

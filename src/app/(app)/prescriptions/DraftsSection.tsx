import Link from 'next/link'
import type { Dictionary } from '@/i18n'
import { createClient } from '@/lib/supabase/server'
import { cardClass } from '@/components/ui/Card'
import { SectionLabel, Tag } from '@/components/ui/bits'
import { fmtDateTime } from '@/components/format'

type DraftRow = { id: string; created_at: string; extracted: { drug_name_generic?: string | null; source_facility?: string | null } | null }

/**
 * The entry point for /prescriptions/drafts/[id] (D26): open drafts the extraction
 * agent left for this patient, listed above the prescriptions. Renders nothing
 * when there are none, so a patient without drafts never sees the feature.
 */
export async function DraftsSection({ t }: { t: Dictionary }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('prescription_drafts')
    .select('id, created_at, extracted')
    .is('accepted_at', null)
    .order('created_at', { ascending: false })
    .returns<DraftRow[]>()
  const drafts = data ?? []
  if (drafts.length === 0) return null
  return (
    <section className="flex flex-col gap-2" aria-labelledby="drafts">
      <SectionLabel><span id="drafts">{t.drafts.pending}</span></SectionLabel>
      <p className="text-xs text-ink-muted">{t.drafts.pendingBody}</p>
      <ul className="flex flex-col gap-2">
        {drafts.map((d) => (
          <li key={d.id}>
            <Link href={`/prescriptions/drafts/${d.id}`} className={cardClass('read', 'flex items-center justify-between gap-3 hover:border-navy/40')}>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-base font-bold capitalize text-navy">{d.extracted?.drug_name_generic || t.source.extracted}</span>
                <span className="text-xs text-ink-muted">
                  {d.extracted?.source_facility ? `${d.extracted.source_facility} · ` : ''}<span dir="ltr">{fmtDateTime(d.created_at, t.locale)}</span>
                </span>
              </span>
              <Tag tone="muted">{t.drafts.open}</Tag>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

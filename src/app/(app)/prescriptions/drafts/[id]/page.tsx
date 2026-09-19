import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'
import { Card } from '@/components/ui/Card'
import { SectionLabel, Tag } from '@/components/ui/bits'
import { fmtDateTime } from '@/components/format'
import { AddPrescriptionForm } from '../../add/AddPrescriptionForm'
import { acceptDraft } from './actions'
import { DiscardButton } from './DiscardButton'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Draft = {
  id: string
  source_image: string | null
  extracted: Record<string, string | number | null> | null
  confidence: Record<string, number> | null
  accepted_at: string | null
  created_at: string
}

/**
 * D26 (stretch, no artboard — built in the canon's idiom): each extracted field
 * beside the image, with the agent's confidence under it, editable; the patient
 * corrects and accepts, or discards. Drafts are readable by their patient only
 * (draft_select), so another account's id is "not found". At ≥1024 the image
 * sits beside the form.
 */
export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const t = await getDictionary()

  const draft = UUID.test(id)
    ? (await supabase.from('prescription_drafts').select('id, source_image, extracted, confidence, accepted_at, created_at').eq('id', id).maybeSingle<Draft>()).data
    : null

  if (!draft) {
    return (
      <>
        <Card variant="read" data-testid="not-found" className="text-sm text-navy">{t.drafts.notFound}</Card>
        <Link href="/prescriptions" className="inline-flex min-h-tap items-center text-sm text-navy-soft underline underline-offset-2">{t.rx.back}</Link>
      </>
    )
  }

  const image = draft.source_image && /^https:\/\//.test(draft.source_image) ? draft.source_image : null // https only: no mixed content (SE-4)
  const accept = acceptDraft.bind(null, draft.id)

  return (
    <>
      <h1 className="text-xl font-bold text-navy">{t.drafts.title}</h1>
      <p className="text-sm text-ink-muted">{t.drafts.intro}</p>
      <p className="text-xs text-ink-muted">
        <Tag tone="muted">{t.source.extracted}</Tag>{' '}
        {t.drafts.readOn} <span dir="ltr">{fmtDateTime(draft.created_at, t.locale)}</span>
      </p>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_1.2fr] lg:items-start lg:gap-6">
        <section className="flex flex-col gap-2 lg:sticky lg:top-4">
          <SectionLabel>{t.drafts.image}</SectionLabel>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- a patient's own upload, unknown dimensions
            <img src={image} alt={t.drafts.image} className="w-full rounded-md border border-line bg-white" />
          ) : (
            <Card variant="read" className="text-sm text-ink-muted">{t.drafts.noImage}</Card>
          )}
        </section>

        <section className="flex flex-col gap-2">
          {draft.accepted_at ? (
            <Card variant="read" className="text-sm text-navy">{t.drafts.alreadyAccepted}</Card>
          ) : (
            <AddPrescriptionForm
              t={t}
              initial={draft.extracted ?? {}}
              confidence={draft.confidence ?? {}}
              action={accept}
              labels={{ submit: t.drafts.accept, saving: t.drafts.accepting, saved: t.drafts.accepted }}
              extra={<DiscardButton t={t} draftId={draft.id} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

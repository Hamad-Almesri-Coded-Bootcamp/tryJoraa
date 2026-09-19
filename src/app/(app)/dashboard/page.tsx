import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'
import { DoseCard, type DoseCardData } from '@/components/DoseCard'
import { SectionLabel, EmptyState } from '@/components/ui/bits'
import { ButtonLink } from '@/components/ui/Button'
import { fmtLongDay, kuwaitYmd } from '@/components/format'
import { CheckDoses } from './CheckDoses'

type DoseRow = {
  id: string
  scheduled_at: string
  status: DoseCardData['status']
  prescriptions: DoseCardData['rx']
}

/** Start and end of "today" in Kuwait, as ISO strings — a calendar window for the query, not a clinical number. */
function todayRange(now: Date) {
  const ymd = kuwaitYmd(now)
  const start = new Date(`${ymd}T00:00:00+03:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

/**
 * Artboard 4: the front door (D19). Section label with today's date, one card per
 * dose with its source badge, the Check my doses button, then the agent's
 * proposals and refusals. 4b all-clear and 4c new-account states are here too.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const t = await getDictionary()
  const now = new Date()
  const { start, end } = todayRange(now)

  const [{ data: doses, error }, { count: rxCount }] = await Promise.all([
    supabase
      .from('doses')
      .select('id, scheduled_at, status, prescriptions ( drug_name_generic, drug_name_brand, strength_value, strength_unit, dose_per_administration, source, source_facility, source_sector )')
      .gte('scheduled_at', start)
      .lt('scheduled_at', end)
      .order('scheduled_at', { ascending: true })
      .returns<DoseRow[]>(),
    supabase.from('prescriptions').select('id', { count: 'exact', head: true }),
  ])

  const list = doses ?? []
  const noPrescriptions = (rxCount ?? 0) === 0
  const allClear = list.length > 0 && list.every((d) => d.status === 'taken' || d.status === 'due' || d.status === 'rescheduled') && !list.some((d) => d.status === 'missed')

  return (
    <>
      <h1 className="sr-only">{t.dashboard.title}</h1>
      <SectionLabel>
        {t.dashboard.title} — <span dir="ltr">{fmtLongDay(now, t.locale)}</span>
      </SectionLabel>

      {error && <p role="status" className="text-sm text-red">{error.message}</p>}

      {!error && noPrescriptions && (
        <EmptyState
          title={t.dashboard.emptyTitle}
          body={t.dashboard.emptyBody}
          action={<ButtonLink href="/prescriptions/add" className="w-full">{t.dashboard.emptyCta}</ButtonLink>}
        />
      )}

      {!error && !noPrescriptions && list.length === 0 && (
        <EmptyState title={t.dashboard.nothingToDo} />
      )}

      {(list.length > 0 || !noPrescriptions) && (
        <div className="lg:max-w-doctor lg:w-full lg:grid lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-7">
          <div className="flex flex-col gap-2.5">
            {list.length > 0 && (
              <ul className="flex flex-col gap-2.5">
                {list.map((d) => (
                  <li key={d.id}>
                    <DoseCard t={t} dose={{ id: d.id, scheduled_at: d.scheduled_at, status: d.status, rx: d.prescriptions }} now={now.toISOString()} />
                  </li>
                ))}
              </ul>
            )}

            {allClear && (
              <p className="text-center text-sm text-ink-muted">
                ✓ {t.dashboard.allClearTitle} — <span dir="ltr">{list.length}</span> {t.dashboard.allClearBody}
              </p>
            )}
          </div>

          {!noPrescriptions && (
            <div className="lg:sticky lg:top-4 lg:self-start">
              <CheckDoses t={t} />
            </div>
          )}
        </div>
      )}
    </>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'
import { PrescriptionCard, type PrescriptionCardData } from '@/components/PrescriptionCard'
import { SourceBadge } from '@/components/SourceBadge'
import { EmptyState } from '@/components/ui/bits'
import { ButtonLink } from '@/components/ui/Button'
import { DraftsSection } from './DraftsSection'
import { fmtDate, fmtNumber } from '@/components/format'

type Row = PrescriptionCardData & { start_date: string }

/**
 * Artboard 5: ALL my medicines, each with its source badge — the D21 proof.
 * Populated (5a) gets an Add button too (the board only draws it on the empty
 * state); 5b is the empty state; 768+ is a two-column grid; 1024+ a table.
 */
export default async function PrescriptionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const t = await getDictionary()

  const { data: rows, error } = await supabase
    .from('prescriptions')
    .select('id, drug_name_generic, drug_name_brand, strength_value, strength_unit, dose_per_administration, frequency_per_day, source, source_facility, source_sector, start_date')
    .order('created_at', { ascending: false })
    .returns<Row[]>()

  const list = rows ?? []
  return (
    <>
      <h1 className="sr-only">{t.rx.title}</h1>
      <DraftsSection t={t} />
      {error && <p role="status" className="text-sm text-red">{error.message}</p>}
      {!error && list.length === 0 && (
        <EmptyState title={t.rx.empty} action={<ButtonLink href="/prescriptions/add" className="w-full">{t.rx.emptyCta}</ButtonLink>} />
      )}
      {list.length > 0 && (
        <>
          <ul className="grid gap-2.5 md:grid-cols-2 lg:hidden">
            {list.map((r) => (
              <li key={r.id}><PrescriptionCard t={t} rx={r} href={`/prescriptions/${r.id}`} /></li>
            ))}
          </ul>
          <table className="hidden w-full lg:table">
            <thead>
              <tr className="border-b border-line text-xs font-bold text-navy-soft">
                <th className="px-3 py-2 text-start">{t.cols.medicine}</th>
                <th className="px-3 py-2 text-start">{t.cols.dose}</th>
                <th className="px-3 py-2 text-start">{t.cols.frequency}</th>
                <th className="px-3 py-2 text-start">{t.cols.facility}</th>
                <th className="px-3 py-2 text-start">{t.cols.sector}</th>
                <th className="px-3 py-2 text-start">{t.cols.start}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const strength = `${fmtNumber(r.strength_value, t.locale)} ${t.unit[r.strength_unit as keyof typeof t.unit] ?? r.strength_unit}`
                return (
                  <tr key={r.id} className="border-b border-line text-sm">
                    <td className="px-3 py-2">
                      <Link href={`/prescriptions/${r.id}`} className="flex min-h-tap items-center capitalize text-navy">
                        {r.drug_name_generic}
                        {r.drug_name_brand && <span className="ms-1 font-normal text-ink-muted">({r.drug_name_brand})</span>}
                      </Link>
                    </td>
                    <td className="px-3 py-2" dir="ltr">{strength}</td>
                    <td className="px-3 py-2" dir="ltr">{r.dose_per_administration} × {r.frequency_per_day} <span dir="auto">{t.rx.perDay}</span></td>
                    <td className="px-3 py-2">{r.source_facility ?? t.source[r.source]}</td>
                    <td className="whitespace-nowrap px-3 py-2"><SourceBadge t={t} source={r.source} facility={null} sector={r.source_sector} /></td>
                    <td className="px-3 py-2" dir="ltr">{fmtDate(r.start_date, t.locale)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <ButtonLink href="/prescriptions/add" className="mt-1">{t.rx.emptyCta}</ButtonLink>
        </>
      )}
    </>
  )
}

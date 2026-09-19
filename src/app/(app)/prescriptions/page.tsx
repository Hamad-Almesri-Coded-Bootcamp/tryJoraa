import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'
import { SourceBadge } from '@/components/SourceBadge'

type RxRow = {
  id: string
  drug_name_generic: string
  drug_name_brand: string | null
  strength_value: number
  strength_unit: string
  dose_per_administration: number
  frequency_per_day: number
  duration_days: number
  dispense_date: string | null
  total_quantity_dispensed: number | null
  source: 'jurah_doctor' | 'imported' | 'patient_entered' | 'extracted'
  source_facility: string | null
  source_sector: 'public' | 'private' | null
}

export default async function PrescriptionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const t = await getDictionary()

  const { data: rows, error } = await supabase
    .from('prescriptions')
    .select('id, drug_name_generic, drug_name_brand, strength_value, strength_unit, dose_per_administration, frequency_per_day, duration_days, dispense_date, total_quantity_dispensed, source, source_facility, source_sector')
    .order('created_at', { ascending: false })
    .returns<RxRow[]>()

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">{t.rx.title}</h1>
      {error && <p className="text-sm text-red-700">{error.message}</p>}
      {!error && (rows?.length ?? 0) === 0 && <p className="text-slate-600">{t.rx.empty}</p>}
      <ul className="space-y-3">
        {rows?.map((r) => (
          <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <Link href={`/prescriptions/${r.id}`} className="block">
              <p className="text-lg font-semibold">
                {r.drug_name_generic}
                {r.drug_name_brand && <span className="text-slate-500 font-normal"> ({r.drug_name_brand})</span>}
              </p>
              <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-700">
                <dt className="text-slate-500">{t.rx.strength}</dt><dd>{r.strength_value} {r.strength_unit}</dd>
                <dt className="text-slate-500">{t.rx.frequency}</dt><dd>{r.frequency_per_day}</dd>
                <dt className="text-slate-500">{t.rx.duration}</dt><dd>{r.duration_days}</dd>
                {r.dispense_date && (<><dt className="text-slate-500">{t.rx.dispensed}</dt><dd>{r.dispense_date}</dd></>)}
                {r.total_quantity_dispensed && (<><dt className="text-slate-500">{t.rx.quantity}</dt><dd>{r.total_quantity_dispensed}</dd></>)}
              </dl>
              <div className="mt-2">
                <SourceBadge t={t} source={r.source} facility={r.source_facility} sector={r.source_sector} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

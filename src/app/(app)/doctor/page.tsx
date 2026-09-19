import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'

type Link = { patient: { id: string; full_name: string; civil_id: string | null } | null }

export default async function DoctorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const t = await getDictionary()

  const { data: links } = await supabase
    .from('doctor_patients')
    .select('patient:profiles!doctor_patients_patient_id_fkey ( id, full_name, civil_id )')
    .eq('doctor_id', user.id)
    .returns<Link[]>()

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">{t.doctor.title}</h1>
      <p className="text-sm text-slate-500">{t.doctor.stub}</p>
      {(links?.length ?? 0) === 0 && <p className="text-slate-600">{t.doctor.empty}</p>}
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {links?.map((l) => l.patient && (
          <li key={l.patient.id} className="px-4 py-3">
            <p className="font-medium">{l.patient.full_name}</p>
            {l.patient.civil_id && <p className="text-xs text-slate-500" dir="ltr">{l.patient.civil_id}</p>}
          </li>
        ))}
      </ul>
    </>
  )
}

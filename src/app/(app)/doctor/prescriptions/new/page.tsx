import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'
import { EmptyState } from '@/components/ui/bits'
import { ButtonLink } from '@/components/ui/Button'
import { NewPrescriptionForm, type LinkedPatient } from './NewPrescriptionForm'

type LinkRow = { patient: LinkedPatient | null }

/** Artboard 11 "Write a prescription" (D5), under the D29 path. */
export default async function NewDoctorPrescriptionPage({ searchParams }: { searchParams: Promise<{ patient?: string }> }) {
  const { patient } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const t = await getDictionary()

  const { data: links } = await supabase
    .from('doctor_patients')
    .select('patient:profiles!doctor_patients_patient_id_fkey ( id, full_name )')
    .eq('doctor_id', user.id)
    .returns<LinkRow[]>()

  const patients = (links ?? []).map((l) => l.patient).filter((p): p is LinkedPatient => !!p)

  return (
    <div className="lg:mx-auto lg:w-full lg:max-w-form">
      <h1 className="sr-only">{t.newRx.title}</h1>
      {patients.length === 0 ? (
        <EmptyState title={t.newRx.noPatients} action={<ButtonLink href="/doctor/patients/add" className="w-full">{t.newRx.addPatientCta}</ButtonLink>} />
      ) : (
        <NewPrescriptionForm t={t} patients={patients} defaultPatientId={patient} />
      )}
    </div>
  )
}

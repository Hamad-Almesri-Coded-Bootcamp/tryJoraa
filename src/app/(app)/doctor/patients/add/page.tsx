import { getDictionary } from '@/i18n'
import { AddPatientForm } from './AddPatientForm'

/** Artboard 9a/9b (D7). The app bar already carries the title (nav.ts). */
export default async function AddPatientPage() {
  const t = await getDictionary()
  return (
    <div className="lg:mx-auto lg:w-full lg:max-w-form">
      <h1 className="sr-only">{t.nav.addPatient}</h1>
      <p className="text-sm text-ink-muted">{t.doctor.addIntro}</p>
      <AddPatientForm t={t} />
    </div>
  )
}

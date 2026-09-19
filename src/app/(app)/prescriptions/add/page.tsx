import { getDictionary } from '@/i18n'
import { AddPrescriptionForm } from './AddPrescriptionForm'

/**
 * Artboard 7: the D21 aggregation point — any prescription a patient holds,
 * from any clinic, added to their one profile. The app bar already carries the
 * screen title (nav.ts), so the h1 here is for assistive tech only.
 */
export default async function AddPrescriptionPage() {
  const t = await getDictionary()
  return (
    <>
      <h1 className="sr-only">{t.add.title}</h1>
      <p className="text-sm text-ink-muted">{t.add.intro}</p>
      <AddPrescriptionForm t={t} />
    </>
  )
}

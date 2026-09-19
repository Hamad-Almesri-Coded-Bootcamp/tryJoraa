'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/i18n'
import { Field, SelectField, TextareaField, ChipGroup } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { FormStatus } from '@/components/ui/bits'
import { doctorPrescriptionSchema, firstIssue } from './schema'
import { issueMessage, type IssueCode } from '@/components/formIssue'
import { writePrescription } from './actions'

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'success' }
export type LinkedPatient = { id: string; full_name: string }

/** Artboard 11 "Write a prescription" (D5), extended with the required columns; field layout copies AddPrescriptionForm. */
export function NewPrescriptionForm({ t, patients, defaultPatientId }: { t: Dictionary; patients: LinkedPatient[]; defaultPatientId?: string }) {
  const router = useRouter()
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [fieldError, setFieldError] = useState<{ path: string; message: string } | null>(null)
  const lockPatient = !!defaultPatientId && patients.some((p) => p.id === defaultPatientId)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const obj = Object.fromEntries(form.entries())

    const parsed = doctorPrescriptionSchema.safeParse(obj)
    if (!parsed.success) return fail(firstIssue(parsed.error))
    setFieldError(null)
    setState({ kind: 'loading' })

    const result = await writePrescription(obj)
    if (!result.ok) {
      if (result.code) return fail({ path: result.path ?? '', code: result.code })
      return setState({ kind: 'error', message: t.newRx.failed })
    }
    setState({ kind: 'success' })
    router.push(`/doctor/patients/${result.patientId}`)
    router.refresh()
  }

  const LABEL: Record<string, string> = {
    patient_id: t.newRx.patient,
    drug_name_generic: t.add.generic, drug_name_brand: t.add.brand, strength_value: t.add.strengthValue, strength_unit: t.add.strengthUnit,
    dose_per_administration: t.add.dose, frequency_per_day: t.add.frequency, duration_days: t.add.duration, dosing_pattern: t.add.pattern,
    start_date: t.add.startDate, food_timing: t.add.foodTiming, route: t.add.route, indication: t.add.indication, notes: t.add.notes,
    units_per_package: t.add.unitsPerPackage, total_quantity_dispensed: t.add.quantityDispensed, dispense_date: t.add.dispenseDate,
    source_facility: t.add.facility, source_sector: t.add.sector,
  }
  function fail(issue: { path: string; code: IssueCode }) {
    const message = issueMessage(t, LABEL[issue.path], issue.code)
    setFieldError({ path: issue.path, message })
    setState({ kind: 'error', message })
  }

  const busy = state.kind === 'loading' || state.kind === 'success'
  const errAt = (path: string) => (fieldError?.path === path ? fieldError.message : undefined)

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5" noValidate>
      {lockPatient ? (
        <>
          <SelectField label={t.newRx.patient} disabled defaultValue={defaultPatientId}>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </SelectField>
          <input type="hidden" name="patient_id" value={defaultPatientId} />
        </>
      ) : (
        <SelectField label={t.newRx.patient} name="patient_id" defaultValue="" required error={errAt('patient_id')}>
          <option value="" disabled>{t.newRx.choosePatient}</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </SelectField>
      )}

      <Field label={t.add.generic} name="drug_name_generic" required placeholder={t.add.genericHint} error={errAt('drug_name_generic')} />
      <Field label={t.add.brand} name="drug_name_brand" optional={t.add.optional} error={errAt('drug_name_brand')} />

      <div className="flex gap-2">
        <Field className="flex-1" label={t.add.strengthValue} name="strength_value" type="number" step="any" min={0} required inputMode="decimal" dirLtr error={errAt('strength_value')} />
        <SelectField className="flex-1" label={t.add.strengthUnit} name="strength_unit" defaultValue="mg" error={errAt('strength_unit')}>
          {Object.entries(t.unit).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </SelectField>
      </div>

      <div className="flex gap-2">
        <Field className="flex-1" label={t.add.dose} name="dose_per_administration" type="number" step="any" min={0} required inputMode="decimal" dirLtr placeholder={t.add.doseHint} error={errAt('dose_per_administration')} />
        <Field className="flex-1" label={t.add.frequency} name="frequency_per_day" type="number" min={1} max={6} step={1} required inputMode="numeric" dirLtr error={errAt('frequency_per_day')} />
      </div>

      <div className="flex gap-2">
        <Field className="flex-1" label={t.add.duration} name="duration_days" type="number" min={1} max={365} step={1} required inputMode="numeric" dirLtr error={errAt('duration_days')} />
        <SelectField className="flex-1" label={t.add.pattern} name="dosing_pattern" defaultValue="daily" error={errAt('dosing_pattern')}>
          {Object.entries(t.pattern).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </SelectField>
      </div>

      <Field label={t.add.startDate} name="start_date" type="date" required dirLtr defaultValue={new Date().toISOString().slice(0, 10)} error={errAt('start_date')} />

      <ChipGroup
        label={t.add.route}
        name="route"
        defaultValue="oral"
        options={Object.entries(t.route).map(([value, label]) => ({ value, label }))}
        error={errAt('route')}
      />

      <Field label={t.add.foodTiming} name="food_timing" optional={t.add.optional} placeholder={t.add.foodTimingHint} error={errAt('food_timing')} />
      <Field label={t.add.indication} name="indication" optional={t.add.optional} error={errAt('indication')} />
      <TextareaField label={t.add.notes} name="notes" optional={t.add.optional} error={errAt('notes')} />

      <div className="flex gap-2">
        <Field className="flex-1" label={t.add.dispenseDate} name="dispense_date" type="date" optional={t.add.optional} dirLtr error={errAt('dispense_date')} />
        <Field className="flex-1" label={t.add.quantityDispensed} name="total_quantity_dispensed" type="number" step="any" min={0} optional={t.add.optional} inputMode="decimal" dirLtr error={errAt('total_quantity_dispensed')} />
      </div>

      <Field label={t.add.unitsPerPackage} name="units_per_package" type="number" min={1} step={1} optional={t.add.optional} inputMode="numeric" dirLtr error={errAt('units_per_package')} />

      <Field label={t.add.facility} name="source_facility" required placeholder={t.add.facilityHint} error={errAt('source_facility')} />

      <ChipGroup
        label={t.add.sector}
        name="source_sector"
        options={Object.entries(t.sector).map(([value, label]) => ({ value, label }))}
        error={errAt('source_sector')}
      />

      <Button type="submit" disabled={busy}>{state.kind === 'loading' ? t.newRx.sending : t.newRx.submit}</Button>
      <FormStatus
        state={
          state.kind === 'loading' ? { kind: 'loading', message: t.newRx.sending }
          : state.kind === 'error' ? { kind: 'error', message: state.message }
          : state.kind === 'success' ? { kind: 'success', message: t.newRx.sent }
          : { kind: 'idle' }
        }
      />
    </form>
  )
}

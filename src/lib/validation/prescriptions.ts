import { z } from 'zod'
import {
  LIMITS,
  DOSING_PATTERNS,
  ROUTES_OF_ADMIN,
  STRENGTH_UNITS,
  RX_SOURCES,
  RX_SECTORS,
} from './limits'

const P = LIMITS.prescription

/**
 * Optional free text. An empty field and a field of spaces both mean "not
 * given", so they become `undefined` rather than `''` — otherwise a blank input
 * writes an empty string into a nullable column and the audit trail later reads
 * "changed notes from  to ", which is nonsense to a judge.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? undefined : v))
    .optional()

export const prescriptionSchema = z.object({
  drug_name_generic: z
    .string()
    .trim()
    .min(P.drugNameGeneric.min, 'Enter the generic drug name')
    .max(P.drugNameGeneric.max),
  drug_name_brand: optionalText(P.drugNameBrand.max),

  strength_value: z
    .number()
    .positive('Strength must be greater than zero')
    .max(P.strengthValue.max),
  strength_unit: z.enum(STRENGTH_UNITS),

  dose_per_administration: z
    .number()
    .positive('Dose must be greater than zero')
    .max(P.dosePerAdministration.max),

  frequency_per_day: z
    .number()
    .int()
    .min(P.frequencyPerDay.min)
    .max(P.frequencyPerDay.max, `At most ${P.frequencyPerDay.max} times a day`),

  duration_days: z
    .number()
    .int()
    .min(P.durationDays.min)
    .max(P.durationDays.max, `At most ${P.durationDays.max} days`),

  dosing_pattern: z.enum(DOSING_PATTERNS).default('daily'),
  route: z.enum(ROUTES_OF_ADMIN).default('oral'),
  start_date: z.iso.date(),

  food_timing: optionalText(P.foodTiming.max),
  indication: optionalText(P.indication.max),
  notes: optionalText(P.notes.max),

  units_per_package: z.number().int().min(P.unitsPerPackage.min).max(P.unitsPerPackage.max).optional(),
  total_quantity_dispensed: z.number().positive().max(P.totalQuantityDispensed.max).optional(),
  dispense_date: z.iso.date().optional(),
  brand_dispensed: optionalText(P.brandDispensed.max),

  source: z.enum(RX_SOURCES).default('patient_entered'),
  source_facility: optionalText(P.sourceFacility.max),
  source_sector: z.enum(RX_SECTORS).optional(),
})

export type PrescriptionInput = z.infer<typeof prescriptionSchema>

/**
 * `doctor_row_has_doctor` in init.sql refuses a `jurah_doctor` row with no
 * doctor. Checking it here too means the person sees a sentence instead of a
 * constraint name.
 */
export const prescriptionWithDoctorSchema = prescriptionSchema
  .extend({ doctor_id: z.uuid().optional() })
  .refine((v) => v.source !== 'jurah_doctor' || v.doctor_id != null, {
    path: ['doctor_id'],
    message: 'A prescription written in Jur’ah must name the doctor who wrote it',
  })

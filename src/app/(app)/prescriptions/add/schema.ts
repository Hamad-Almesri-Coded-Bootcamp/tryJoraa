// Lane A owns src/lib/validation; this schema is colocated until Lane A ships
// prescriptionAddSchema there, then this file imports it (.plans/b.md dependency).
import { z } from 'zod'

/** Empty optional strings become undefined so `.optional()` actually applies. */
function optionalText(max: number) {
  return z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(max).optional(),
  )
}

export const prescriptionAddSchema = z.object({
  drug_name_generic: z.string().trim().min(1).max(120),
  drug_name_brand: optionalText(120),
  strength_value: z.coerce.number().positive(),
  strength_unit: z.enum(['mg', 'mcg', 'g', 'ml', 'iu', 'percent']),
  dose_per_administration: z.coerce.number().positive(),
  frequency_per_day: z.coerce.number().int().min(1).max(6),
  duration_days: z.coerce.number().int().min(1).max(365),
  dosing_pattern: z.enum(['daily', 'alternate_day', 'weekly', 'as_needed']).default('daily'),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .default(() => new Date().toISOString().slice(0, 10)),
  food_timing: optionalText(120),
  route: z.enum(['oral', 'injection', 'syrup', 'inhaler', 'topical']).default('oral'),
  indication: optionalText(200),
  notes: optionalText(500),
  units_per_package: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  total_quantity_dispensed: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().positive().optional(),
  ),
  dispense_date: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ),
  brand_dispensed: optionalText(120),
  source_facility: z.string().trim().min(1).max(120),
  source_sector: z.enum(['public', 'private']),
})

export type PrescriptionAddInput = z.infer<typeof prescriptionAddSchema>

export type IssueCode = 'required' | 'tooLong' | 'invalid'

/**
 * The first failing field and WHY, as a code the form turns into a sentence
 * from the dictionary (SE-5, FE-3) — never English text from here.
 */
export function firstIssue(err: z.ZodError): { path: string; code: IssueCode } {
  const i = err.issues[0]
  if (!i) return { path: '', code: 'invalid' }
  const path = i.path.join('.')
  const code: IssueCode =
    i.code === 'too_big' ? 'tooLong'
    : i.code === 'invalid_type' || (i.code === 'too_small' && 'minimum' in i && Number(i.minimum) <= 1 && 'origin' in i && i.origin === 'string') ? 'required'
    : 'invalid'
  return { path, code }
}

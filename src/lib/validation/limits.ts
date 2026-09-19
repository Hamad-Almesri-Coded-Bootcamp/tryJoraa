/**
 * Field limits — the single place the numbers live.
 *
 * SE-5 asks that every input is checked *before it is used*. That means two
 * checks, not one: Zod so the person gets a sentence they can act on, and a
 * `char_length` CHECK in Postgres so the guarantee holds when the form is not
 * involved. The anon key ships in the browser, so "not involved" is a browser
 * console, curl, or any client anyone writes.
 *
 * Both halves read these numbers. The migration
 * `20260919235500_input_limits.sql` mirrors this table constant for constant —
 * if you change a number here, change it there in the same commit, or the app
 * will accept something the database then rejects with a raw Postgres error.
 */
export const LIMITS = {
  profile: {
    fullName: { min: 2, max: 80 },
    /** Kuwaiti civil ID: exactly twelve digits. Sample values only (D-note in init.sql). */
    civilIdDigits: 12,
  },
  prescription: {
    drugNameGeneric: { min: 1, max: 120 },
    drugNameBrand: { max: 120 },
    foodTiming: { max: 80 },
    indication: { max: 200 },
    notes: { max: 1000 },
    sourceFacility: { max: 120 },
    brandDispensed: { max: 120 },
    frequencyPerDay: { min: 1, max: 6 },
    durationDays: { min: 1, max: 365 },
    /** numeric(?) in Postgres is unbounded; these keep a typo out of the dose. */
    strengthValue: { min: 0, max: 100000, exclusiveMin: true },
    dosePerAdministration: { min: 0, max: 1000, exclusiveMin: true },
    unitsPerPackage: { min: 1, max: 10000 },
    totalQuantityDispensed: { min: 0, max: 100000, exclusiveMin: true },
  },
  medication: {
    ingredient: { min: 1, max: 120 },
  },
  interaction: {
    ingredient: { min: 1, max: 120 },
    source: { min: 1, max: 200 },
  },
  alert: {
    guardrail: { min: 1, max: 80 },
    reason: { min: 1, max: 500 },
  },
  auth: {
    email: { max: 254 },
    /** Supabase hashes with bcrypt, which silently ignores past 72 bytes. */
    password: { min: 8, max: 72 },
  },
} as const

/** Enum values, kept beside the limits so a form never invents a member. */
export const DOSING_PATTERNS = ['daily', 'alternate_day', 'weekly', 'as_needed'] as const
export const ROUTES_OF_ADMIN = ['oral', 'injection', 'syrup', 'inhaler', 'topical'] as const
export const STRENGTH_UNITS = ['mg', 'mcg', 'g', 'ml', 'iu', 'percent'] as const
export const RX_SOURCES = ['jurah_doctor', 'imported', 'patient_entered', 'extracted'] as const
export const RX_SECTORS = ['public', 'private'] as const

export type DosingPattern = (typeof DOSING_PATTERNS)[number]
export type RouteOfAdmin = (typeof ROUTES_OF_ADMIN)[number]
export type StrengthUnit = (typeof STRENGTH_UNITS)[number]
export type RxSource = (typeof RX_SOURCES)[number]
export type RxSector = (typeof RX_SECTORS)[number]

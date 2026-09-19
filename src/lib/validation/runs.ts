import { z } from 'zod'

/** Mirrors the run_kind enum in supabase/migrations. */
export const RUN_KINDS = ['check_doses', 'profile_medication', 'screen_interactions', 'extract_prescription'] as const
export type RunKind = (typeof RUN_KINDS)[number]

export const runsBodySchema = z.object({
  kind: z.enum(RUN_KINDS),
  prescriptionId: z.uuid().optional(),
})

export type RunsBody = z.infer<typeof runsBodySchema>

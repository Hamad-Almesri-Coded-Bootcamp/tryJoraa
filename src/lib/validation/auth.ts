import { z } from 'zod'

export const emailSchema = z.string().trim().toLowerCase().email().max(254)
export const passwordSchema = z.string().min(8).max(72)

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: z.string().trim().min(2).max(80),
  civil_id: z.string().trim().regex(/^\d{12}$/, 'Civil ID must be exactly 12 digits'),
})

export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>

/** One human-readable line from a Zod error, for form feedback (SE-5, FE-3). */
export function firstIssue(err: z.ZodError): string {
  const i = err.issues[0]
  return i ? `${i.path.join('.') || 'input'}: ${i.message}` : 'Invalid input'
}

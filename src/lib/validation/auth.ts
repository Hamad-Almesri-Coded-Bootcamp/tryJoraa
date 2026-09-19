import { z } from 'zod'
import { LIMITS } from './limits'

const { auth, profile } = LIMITS

export const emailSchema = z.string().trim().toLowerCase().email().max(auth.email.max)
export const passwordSchema = z.string().min(auth.password.min).max(auth.password.max)

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

/**
 * The same rules are enforced again by `handle_new_user()` and by the
 * `char_length` CHECKs in `20260919235500_input_limits.sql`. That is not
 * belt-and-braces for its own sake: `signUp` passes `full_name` and `civil_id`
 * through `raw_user_meta_data`, which any client holding the public anon key can
 * populate without ever rendering this form (SE-5).
 */
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: z.string().trim().min(profile.fullName.min).max(profile.fullName.max),
  civil_id: z
    .string()
    .trim()
    .regex(
      new RegExp(`^\\d{${profile.civilIdDigits}}$`),
      `Civil ID must be exactly ${profile.civilIdDigits} digits`,
    ),
})

export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>

/** One human-readable line from a Zod error, for form feedback (SE-5, FE-3). */
export function firstIssue(err: z.ZodError): string {
  const i = err.issues[0]
  return i ? `${i.path.join('.') || 'input'}: ${i.message}` : 'Invalid input'
}

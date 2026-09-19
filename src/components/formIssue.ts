import type { z } from 'zod'
import type { Dictionary } from '@/i18n'

export type IssueCode = 'required' | 'tooLong' | 'invalid'

/** Why a Zod issue failed, as one of three codes the dictionary can say (SE-5, FE-3). */
export function codeOf(i: z.core.$ZodIssue | undefined): IssueCode {
  if (!i) return 'invalid'
  if (i.code === 'too_big') return 'tooLong'
  if (i.code === 'invalid_type') return 'required'
  if (i.code === 'too_small' && 'origin' in i && i.origin === 'string' && Number(i.minimum) <= 1) return 'required'
  return 'invalid'
}

/** "Generic name: This field is required." — the label from the dictionary, the reason from t.common. */
export function issueMessage(t: Dictionary, label: string | undefined, code: IssueCode): string {
  const reason = code === 'required' ? t.common.required : code === 'tooLong' ? t.common.tooLong : t.common.invalid
  return label ? `${label}: ${reason}` : reason
}

/** First issue of a ZodError as { path, code }. */
export function firstIssueOf(err: z.ZodError): { path: string; code: IssueCode } {
  const i = err.issues[0]
  return { path: i ? i.path.join('.') : '', code: codeOf(i) }
}

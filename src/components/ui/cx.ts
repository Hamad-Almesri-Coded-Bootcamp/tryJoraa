/** Join class names, dropping falsy ones. No dependency needed at this size. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

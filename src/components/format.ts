/**
 * Presentation-only formatting (D31: formatting a time is presentation; computing
 * one is not). Latin digits in both languages — the board shows 08:00 / 500 mg in
 * Arabic screens too — so ar-KW is pinned to the latn numbering system.
 */
export const TZ = 'Asia/Kuwait'

export function intlLocale(locale: string) {
  return locale === 'ar' ? 'ar-KW-u-nu-latn' : 'en-GB'
}

/** ar-KW output carries RLM/ALM marks that reorder "19/09/2026" even inside a dir="ltr" span; strip them. */
function clean(s: string) {
  return s.replace(/[\u200e\u200f\u061c]/g, '')
}

export function fmtTime(iso: string, locale: string) {
  return clean(new Intl.DateTimeFormat(intlLocale(locale), { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)))
}

export function fmtDate(iso: string, locale: string, style: 'medium' | 'long' | 'short' = 'medium') {
  return clean(new Intl.DateTimeFormat(intlLocale(locale), { timeZone: TZ, dateStyle: style }).format(new Date(iso)))
}

export function fmtDateTime(iso: string, locale: string) {
  return clean(new Intl.DateTimeFormat(intlLocale(locale), { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(iso)))
}

/** "Wed, 16 Sep 2026" — the board's dashboard date. */
export function fmtLongDay(d: Date, locale: string) {
  return clean(new Intl.DateTimeFormat(intlLocale(locale), { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d))
}

/** "Sat" — the past-week dot labels. */
export function fmtWeekday(d: Date, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: TZ, weekday: 'short' }).format(d)
}

export function fmtNumber(n: number, locale: string) {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }).format(n)
}

/** Calendar day in Kuwait as YYYY-MM-DD, for grouping doses by day (not a clinical number). */
export function kuwaitYmd(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** Mask a civil ID as the board draws it: •••••••••233 */
export function maskCivilId(id: string | null | undefined) {
  if (!id) return ''
  return '•'.repeat(Math.max(0, id.length - 3)) + id.slice(-3)
}

/** Headings show a stored name, not a dump: longer than this is cut with an ellipsis (presentation only). */
export function clipText(s: string | null | undefined, max = 120): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max) + '…' : s
}

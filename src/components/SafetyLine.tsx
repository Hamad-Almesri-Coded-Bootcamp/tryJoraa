import { ar } from '@/i18n/ar'
import { en } from '@/i18n/en'

/**
 * On every screen, both languages, never a toast. CLAUDE.md → Product rules.
 * Board: surface background, 3px navy inline-start bar, padding 8–10px 16px, 10px → 12px.
 * The board draws one truncated language; the rule requires both, in full.
 */
export function SafetyLine() {
  return (
    <aside role="note" className="mt-auto border-s-[3px] border-navy bg-surface px-4 py-2.5 text-xs text-navy">
      <div className="mx-auto flex max-w-doctor flex-col gap-1 md:px-2">
        <p lang="ar" dir="rtl">{ar.safety}</p>
        <p lang="en" dir="ltr">{en.safety}</p>
      </div>
    </aside>
  )
}

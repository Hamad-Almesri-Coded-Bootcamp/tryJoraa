import { ar } from '@/i18n/ar'
import { en } from '@/i18n/en'

/** On every screen, both languages, never a toast. CLAUDE.md → Product rules. */
export function SafetyLine() {
  return (
    <aside
      role="note"
      className="mt-auto border-t border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900"
    >
      <p lang="ar" dir="rtl">{ar.safety}</p>
      <p lang="en" dir="ltr" className="mt-1">{en.safety}</p>
    </aside>
  )
}

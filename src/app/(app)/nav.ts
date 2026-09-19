import type { Dictionary } from '@/i18n'
import type { NavItem } from '@/components/AppBar'

/**
 * The signed-in shell's navigation and titles, by role and pathname. The app bar
 * carries the section title (board: "لوحتي", "وصفاتي", "My patients"); detail
 * pages render the entity name as their own h1 and get a back chevron here.
 */
export function navFor(role: 'patient' | 'doctor', t: Dictionary, path: string): NavItem[] {
  const items =
    role === 'doctor'
      ? [
          { href: '/doctor', label: t.nav.patients },
          { href: '/doctor/alerts', label: t.nav.alerts },
          { href: '/doctor/medications', label: t.nav.medications },
        ]
      : [
          { href: '/dashboard', label: t.nav.dashboard },
          { href: '/prescriptions', label: t.nav.prescriptions },
          { href: '/history', label: t.nav.history },
        ]
  return items.map((i) => ({ ...i, active: isActive(i.href, path, items.map((x) => x.href)) }))
}

function isActive(href: string, path: string, all: string[]) {
  // the longest matching prefix wins, so /doctor/alerts does not also light /doctor
  const matches = all.filter((h) => path === h || path.startsWith(h + '/'))
  const best = matches.sort((a, b) => b.length - a.length)[0]
  return best === href
}

export function titleFor(t: Dictionary, path: string, fallbackName?: string): { title: string; backHref?: string } {
  const exact: Record<string, string> = {
    '/dashboard': t.nav.dashboard,
    '/prescriptions': t.nav.prescriptions,
    '/prescriptions/add': t.nav.addPrescription,
    '/history': t.nav.history,
    '/doctor': t.nav.doctor,
    '/doctor/patients/add': t.nav.addPatient,
    '/doctor/prescriptions/new': t.nav.newPrescription,
    '/doctor/alerts': t.nav.alerts,
    '/doctor/medications': t.nav.medications,
  }
  if (exact[path]) {
    const backHref =
      path === '/prescriptions/add' ? '/prescriptions'
      : path === '/doctor/patients/add' || path === '/doctor/prescriptions/new' ? '/doctor'
      : undefined
    return { title: exact[path], backHref }
  }
  if (path.startsWith('/prescriptions/')) return { title: t.nav.prescriptions, backHref: '/prescriptions' } // detail and drafts/[id]
  if (path.startsWith('/doctor/patients/')) return { title: t.nav.patients, backHref: '/doctor' }
  return { title: fallbackName ?? t.brand }
}

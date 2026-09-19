import { NextResponse, type NextRequest } from 'next/server'
import { LANG_COOKIE, isLocale } from '@/i18n'

/**
 * `?lang=ar|en` on any URL pins the locale in a cookie, then the query is
 * stripped. verify:ui relies on this so screenshots are the same everywhere.
 * Also forwards the pathname so the root layout can build the switch link.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const lang = url.searchParams.get('lang')
  if (isLocale(lang)) {
    url.searchParams.delete('lang')
    const res = NextResponse.redirect(url)
    res.cookies.set(LANG_COOKIE, lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
    return res
  }
  const headers = new Headers(request.headers)
  headers.set('x-pathname', url.pathname)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!_next/|api/|.*\\..*).*)'],
}

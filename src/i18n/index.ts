import { cookies, headers } from 'next/headers'
import { ar } from './ar'
import { en, type Dictionary } from './en'

export type Locale = 'ar' | 'en'
export const LOCALES: readonly Locale[] = ['ar', 'en']
export const LANG_COOKIE = 'lang'

export const dictionaries: Record<Locale, Dictionary> = { ar, en }

export function isLocale(v: unknown): v is Locale {
  return v === 'ar' || v === 'en'
}

/** Server components and route handlers: cookie → Accept-Language → Arabic (D10). */
export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LANG_COOKIE)?.value
  if (isLocale(c)) return c
  const accept = (await headers()).get('accept-language') ?? ''
  for (const part of accept.split(',')) {
    const tag = part.trim().slice(0, 2).toLowerCase()
    if (isLocale(tag)) return tag
  }
  return 'ar'
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()]
}

export type { Dictionary }

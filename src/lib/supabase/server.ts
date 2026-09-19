import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createBareClient, type SupabaseClient, type User } from '@supabase/supabase-js'

function env() {
  // read inside the function, never at module top level — `npm run build` needs no env
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  }
}

/** Server-component / server-action client bound to the request cookies. */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, anon } = env()
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          /* called from a server component — the proxy/route refreshes the session instead */
        }
      },
    },
  })
}

export type SessionUser = { user: User; supabase: SupabaseClient }

/**
 * The future mobile contract (D31): a route accepts the session as the cookie
 * OR as `Authorization: Bearer <access token>`. Either way the returned client
 * acts as that user, so RLS applies exactly as in the browser.
 */
export async function getSessionUser(request?: Request): Promise<SessionUser | null> {
  const bearer = request?.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (bearer) {
    const { url, anon } = env()
    const supabase = createBareClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await supabase.auth.getUser(bearer)
    if (error || !data.user) return null
    return { user: data.user, supabase }
  }
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return { user: data.user, supabase }
}

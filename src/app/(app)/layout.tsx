import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'
import { AppBar } from '@/components/AppBar'
import { TabBar, Sidebar } from '@/components/TabBar'
import { navFor, titleFor } from './nav'

/**
 * The signed-in shell. Session and role are checked server-side; a patient URL
 * opened by a doctor (or the reverse) redirects to that role's home. Phone: app
 * bar · content · bottom tab bar. ≥768: links in the app bar. ≥1024 doctor:
 * start sidebar + content up to 1280px; patient: a 720px reading column.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
  const role: 'patient' | 'doctor' = profile?.role === 'doctor' ? 'doctor' : 'patient'
  const known = (await headers()).get('x-pathname')
  const path = known ?? '/'
  // only redirect when the proxy told us where we are; a missing header must never loop a doctor
  if (known && role === 'doctor' && !known.startsWith('/doctor')) redirect('/doctor')
  if (known && role === 'patient' && known.startsWith('/doctor')) redirect('/dashboard')

  const t = await getDictionary()
  const nav = navFor(role, t, path)
  const { title, backHref } = titleFor(t, path)

  return (
    <div className="flex flex-1 flex-col">
      <AppBar t={t} path={path} title={title} backHref={backHref} nav={nav} signedIn />
      <div className={role === 'doctor' ? 'mx-auto flex w-full max-w-doctor flex-1' : 'flex flex-1 flex-col'}>
        {role === 'doctor' && <Sidebar items={nav} />}
        <main className={role === 'doctor'
          ? 'flex w-full min-w-0 flex-1 flex-col gap-2.5 px-4 py-3.5 md:px-6 md:py-6'
          : 'mx-auto flex w-full max-w-patient flex-1 flex-col gap-2.5 px-4 py-3.5 md:px-6 md:py-6'}>
          {children}
        </main>
      </div>
      <TabBar t={t} items={nav} />
    </div>
  )
}

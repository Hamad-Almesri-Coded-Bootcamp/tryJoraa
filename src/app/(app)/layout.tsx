import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
  const t = await getDictionary()
  const isDoctor = profile?.role === 'doctor'

  return (
    <div className="flex flex-1 flex-col">
      <nav className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-sm">
        {isDoctor ? (
          <Link href="/doctor" className="rounded-md px-3 py-2 hover:bg-slate-100">{t.nav.doctor}</Link>
        ) : (
          <>
            <Link href="/dashboard" className="rounded-md px-3 py-2 hover:bg-slate-100">{t.nav.dashboard}</Link>
            <Link href="/prescriptions" className="rounded-md px-3 py-2 hover:bg-slate-100">{t.nav.prescriptions}</Link>
          </>
        )}
        <span className="ms-auto truncate text-slate-600" title={profile?.full_name ?? ''}>{profile?.full_name ?? user.email}</span>
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="rounded-md border border-slate-300 px-3 py-2 hover:bg-slate-100">{t.nav.signOut}</button>
        </form>
      </nav>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">{children}</main>
    </div>
  )
}

import { headers } from 'next/headers'
import { getDictionary } from '@/i18n'
import { AppBar } from '@/components/AppBar'

/** Public shell: brand app bar, content centred as a card at ≥768 (board: "centred 420px card"). */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getDictionary()
  const path = (await headers()).get('x-pathname') ?? '/'
  return (
    <div className="flex flex-1 flex-col">
      <AppBar t={t} path={path} title={t.brand} brandMark />
      <main className="mx-auto flex w-full max-w-auth flex-1 flex-col gap-3.5 px-4 py-5 md:my-10 md:flex-none md:rounded-lg md:border md:border-line md:bg-white md:p-6 md:shadow-card">
        {children}
      </main>
    </div>
  )
}

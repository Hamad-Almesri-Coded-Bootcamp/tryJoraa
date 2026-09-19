import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from 'next/font/google'
import './globals.css'
import { getDictionary } from '@/i18n'
import { SafetyLine } from '@/components/SafetyLine'

/* The board's stack: 'IBM Plex Sans','IBM Plex Sans Arabic'. Plex Sans has no
 * Arabic glyphs; Plex Sans Arabic is the paired face and is already in the stack. */
const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex', display: 'swap' })
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '500', '600', '700'], variable: '--font-plex-arabic', display: 'swap' })

export const metadata: Metadata = {
  title: "Jur'ah · جرعة",
  description: 'Every prescription a patient holds, from any clinic, in one profile. Student prototype — sample data only.',
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const t = await getDictionary()
  return (
    <html lang={t.locale} dir={t.dir} className={`${plex.variable} ${plexArabic.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-surface text-navy">
        {children}
        <SafetyLine />
      </body>
    </html>
  )
}

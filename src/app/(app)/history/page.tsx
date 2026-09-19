import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDictionary } from '@/i18n'
import { AuditList } from '@/components/AuditRow'
import type { AuditRowData } from '@/components/audit'

/**
 * D30: the patient's own append-only audit trail, newest first. RLS scopes the
 * query to the signed-in patient's rows; rendered as plain sentences, never JSON.
 */
export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')
  const t = await getDictionary()

  const { data: rows, error } = await supabase
    .from('audit_log')
    .select('id, at, actor_id, actor_role, run_id, patient_id, table_name, row_id, action, before, after')
    .order('at', { ascending: false })
    .limit(100)
    .returns<AuditRowData[]>()

  return (
    <>
      <h1 className="sr-only">{t.history.title}</h1>
      <p className="text-sm text-ink-muted">{t.history.intro}</p>
      {error && <p role="status" className="text-sm text-red">{error.message}</p>}
      {!error && <AuditList t={t} rows={rows ?? []} empty={t.history.empty} />}
    </>
  )
}

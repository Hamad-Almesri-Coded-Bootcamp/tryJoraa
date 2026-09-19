-- =============================================================================
-- 0008_function_grants.sql — tryJoraa: stop SECURITY DEFINER functions being API
-- Area 03 (Security) · follows C1, evidence for C6
--
-- Found by the Supabase database linter immediately after 0005 went live:
-- every function in `public` is published by PostgREST at /rest/v1/rpc/<name>
-- and granted to PUBLIC by default. Sixteen findings across two lint rules.
--
-- The one that actually bites:
--
--   curl -X POST 'https://<ref>.supabase.co/rest/v1/rpc/generate_doses' \
--        -H "apikey: <ANON_KEY>" \
--        -d '{"p_prescription_id":"<someone-else-s-prescription>"}'
--
-- generate_doses is SECURITY DEFINER, so it runs as the owner and ignores RLS.
-- With the anon key — the key that ships inside the browser — that call writes
-- rows into another patient's calendar. RLS was never the hole; the function
-- standing beside it was.
--
-- Safe to re-run.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Trigger functions are not API. They fire from triggers; nobody calls them.
-- Revoking EXECUTE does not stop a trigger: the trigger function runs as its
-- owner, and the privilege is checked at CREATE TRIGGER, not on each fire.
-- Verified after applying — signup still creates a profile, and inserting a
-- prescription still generates its doses.
-- -----------------------------------------------------------------------------
revoke all on function public.handle_new_user()                  from public, anon, authenticated;
revoke all on function public.guard_profile_role()               from public, anon, authenticated;
revoke all on function public.trg_prescriptions_generate_doses() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- The dose engine. Only the trigger may call it.
-- -----------------------------------------------------------------------------
revoke all on function public.generate_doses(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Role helpers.
--
-- These cannot be locked down as far, and the reason is worth knowing: an RLS
-- policy expression is evaluated as the CALLING role, not as the table owner.
-- Revoke EXECUTE from `authenticated` and every policy that mentions is_staff()
-- starts raising "permission denied for function is_staff" — the app breaks
-- closed, loudly, for everyone.
--
-- So `authenticated` keeps EXECUTE and the linter keeps warning. That is an
-- accepted risk, not an oversight: these functions take no arguments and report
-- only the caller's own role, which the caller already knows. They cannot be
-- pointed at anyone else.
--
-- `anon` loses access — every policy is TO authenticated, so anon never
-- evaluates them. Revoking from PUBLIC drops authenticated's implicit grant
-- too, hence the explicit re-grant.
-- -----------------------------------------------------------------------------
revoke all on function public.my_role()       from public, anon;
revoke all on function public.is_staff()      from public, anon;
revoke all on function public.is_doctor()     from public, anon;
revoke all on function public.is_pharmacist() from public, anon;

grant execute on function public.my_role()       to authenticated;
grant execute on function public.is_staff()      to authenticated;
grant execute on function public.is_doctor()     to authenticated;
grant execute on function public.is_pharmacist() to authenticated;

commit;


-- =============================================================================
-- Before:  16 linter findings (8 anon-executable, 8 authenticated-executable)
-- After:    4 findings, all of them the role helpers above, all accepted.
--
-- Re-check any time:
--   Dashboard -> Advisors -> Security
--
-- Regression tests that must keep passing after this file:
--   * a new signup still lands a profiles row          (B1)
--   * inserting a prescription still generates doses   (A2)
--   * a signed-in patient can still read their own rows (C1)
-- =============================================================================

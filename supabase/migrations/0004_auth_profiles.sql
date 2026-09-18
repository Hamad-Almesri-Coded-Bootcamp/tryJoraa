-- =============================================================================
-- 0004_auth_profiles.sql — tryJoraa: real accounts get a profile automatically
-- Area 02 (Back end & data) · Task B1 · Night 5
--
-- Covers the MUST "real accounts, own empty space". Supabase Auth (email +
-- password) is the identity source; every app table hangs off auth.users
-- through profiles, so a signup with no profile row is an account that can
-- see nothing and write nothing.
--
-- Safe to re-run: CREATE OR REPLACE, the trigger is dropped first, and the
-- backfill ends in ON CONFLICT DO NOTHING.
--
-- Migration 0003 is reserved for Task A5 (v_calendar + type audit) — see
-- supabase/migrations/README.md.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- handle_new_user()
--
-- SECURITY DEFINER is required, not a shortcut. This trigger fires during the
-- signup transaction, before the new account has a session — auth.uid() is not
-- yet the new user, and RLS on profiles (added in 0005) would reject the insert
-- as coming from nobody. Running as the function owner is the only way the row
-- gets created at all.
--
-- The trade-off is that this function ignores RLS, so it is kept deliberately
-- dull: one insert, into one table, with a hard-coded role. Anything cleverer
-- here is a privilege-escalation bug waiting to happen. In particular the role
-- is NOT read from user metadata — metadata is attacker-controlled at signup,
-- and trusting it would let anyone sign up as a doctor. Staff roles are set by
-- hand in the seed (Task B3).
--
-- search_path is pinned so the elevated function cannot be redirected to a
-- lookalike `profiles` table in another schema.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, whatsapp, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data ->> 'whatsapp'), ''),
    'patient'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates the profiles row for a brand-new auth.users account. Role is always patient.';

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- Backfill: accounts that already existed before this trigger did.
-- -----------------------------------------------------------------------------
insert into public.profiles (id, full_name, whatsapp, role)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(u.email, '@', 1)
  ),
  nullif(trim(u.raw_user_meta_data ->> 'whatsapp'), ''),
  'patient'
from auth.users u
on conflict (id) do nothing;

commit;


-- =============================================================================
-- Done when: a brand-new signup in front of the judge works on the first try
-- and lands on an empty dashboard.
--
-- Check it:
--   select count(*) from auth.users;
--   select count(*) from public.profiles;   -- must match
--
--   select u.email
--   from auth.users u
--   left join public.profiles p on p.id = u.id
--   where p.id is null;                     -- must return zero rows
-- =============================================================================

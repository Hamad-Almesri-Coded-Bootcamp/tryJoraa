-- =============================================================================
-- 0005_rls.sql — tryJoraa: row level security on every table
-- Area 03 (Security) · Task C1 · Night 5
--
-- The product's core promise: your medications never leak to the next person.
-- The judge tests this live — two accounts, two private windows, while you
-- watch — so every policy below names the test it has to survive.
--
-- Deny by default: enabling RLS with no matching policy means no rows. Every
-- operation not granted below is therefore already refused. Nothing here is
-- permissive "just in case".
--
-- The service role (n8n) bypasses RLS entirely by design. That is why the
-- service-role key lives in n8n credentials only and never in this repo.
--
-- Safe to re-run: policies are dropped before they are created.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Helpers
--
-- SECURITY DEFINER is load-bearing here, not decoration. These functions read
-- `profiles`, and they are called from a policy *on* `profiles`. An invoker-
-- rights function would re-enter that policy and recurse until Postgres gives
-- up. Running as owner reads the table beneath RLS and breaks the loop.
--
-- They are STABLE so the planner calls them once per statement, not once per
-- row — a policy that runs a subquery per row is a policy people switch off
-- when the demo gets slow.
-- -----------------------------------------------------------------------------

create or replace function public.my_role()
returns user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.my_role() in ('doctor', 'pharmacist'), false);
$$;

create or replace function public.is_doctor()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.my_role() = 'doctor', false);
$$;

create or replace function public.is_pharmacist()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.my_role() = 'pharmacist', false);
$$;

comment on function public.is_staff() is
  'True when the caller is a doctor or pharmacist. SECURITY DEFINER to avoid RLS recursion on profiles.';


-- -----------------------------------------------------------------------------
-- Enable RLS everywhere. Eight tables, no exceptions.
-- -----------------------------------------------------------------------------
alter table profiles         enable row level security;
alter table medications      enable row level security;
alter table prescriptions    enable row level security;
alter table dispenses        enable row level security;
alter table doses            enable row level security;
alter table interactions     enable row level security;
alter table automation_runs  enable row level security;
alter table reorder_requests enable row level security;


-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select_own_or_staff on profiles;
create policy profiles_select_own_or_staff on profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());
-- Judge test: account B cannot read account A's name or WhatsApp number.
-- Staff can read profiles because a doctor has to find the patient they are
-- prescribing for. That widening is deliberate and is listed in the C6 audit.

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
-- Judge test: account B cannot rename account A.
-- No INSERT policy: profiles rows are created only by handle_new_user().
-- No DELETE policy: deleting the auth user cascades; nothing else may.


-- A WITH CHECK clause cannot see the row as it was, so it cannot tell that
-- `role` just changed. Without this trigger a patient could run
--     update profiles set role = 'doctor' where id = auth.uid();
-- and pass every policy above — is_staff() would then return true for them and
-- the whole staff surface opens up. Role changes are a service-role operation.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role
     and current_setting('role', true) is distinct from 'service_role'
     and auth.role() is distinct from 'service_role' then
    raise exception 'role cannot be changed from the app; staff roles are set by an administrator'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on profiles;
create trigger profiles_guard_role
  before update on profiles
  for each row execute function public.guard_profile_role();


-- -----------------------------------------------------------------------------
-- medications — shared drug reference, not patient data.
-- -----------------------------------------------------------------------------
drop policy if exists medications_select_all on medications;
create policy medications_select_all on medications
  for select to authenticated
  using (true);
-- Not a leak: a trade name and its active ingredient are on the box.

drop policy if exists medications_write_staff on medications;
create policy medications_write_staff on medications
  for insert to authenticated
  with check (public.is_staff());
-- Judge test: a patient account cannot invent a drug.


-- -----------------------------------------------------------------------------
-- prescriptions
-- -----------------------------------------------------------------------------
drop policy if exists prescriptions_select_own on prescriptions;
create policy prescriptions_select_own on prescriptions
  for select to authenticated
  using (
    patient_id = auth.uid()
    or doctor_id = auth.uid()
    or public.is_pharmacist()
  );
-- Judge test: account B pastes account A's prescription id into the address
-- bar and gets nothing back.
-- A doctor sees the orders they wrote. A pharmacist sees all prescriptions,
-- because they must be able to fill whichever one is presented at the counter.
-- That is the widest read in the schema and it is named in docs/security.md.

drop policy if exists prescriptions_insert_doctor on prescriptions;
create policy prescriptions_insert_doctor on prescriptions
  for insert to authenticated
  with check (public.is_doctor() and doctor_id = auth.uid());
-- Judge test: a patient cannot write themselves a prescription, and a doctor
-- cannot write one under another doctor's name.

drop policy if exists prescriptions_update_own_doctor on prescriptions;
create policy prescriptions_update_own_doctor on prescriptions
  for update to authenticated
  using (doctor_id = auth.uid() and public.is_doctor())
  with check (doctor_id = auth.uid());
-- No DELETE policy: a prescription is a medical record. It is never deleted.


-- -----------------------------------------------------------------------------
-- dispenses
-- -----------------------------------------------------------------------------
drop policy if exists dispenses_select_own_or_staff on dispenses;
create policy dispenses_select_own_or_staff on dispenses
  for select to authenticated
  using (patient_id = auth.uid() or public.is_staff());
-- Judge test: account B cannot read what account A collected, or what it cost.

drop policy if exists dispenses_insert_pharmacist on dispenses;
create policy dispenses_insert_pharmacist on dispenses
  for insert to authenticated
  with check (public.is_pharmacist() and pharmacist_id = auth.uid());
-- Judge test: a patient cannot log their own handover.
-- No UPDATE or DELETE: a dispense record is history. Corrections are new rows.


-- -----------------------------------------------------------------------------
-- doses — the patient's own calendar.
-- -----------------------------------------------------------------------------
drop policy if exists doses_select_own on doses;
create policy doses_select_own on doses
  for select to authenticated
  using (patient_id = auth.uid());
-- Judge test: account B's calendar is empty of account A's doses.

drop policy if exists doses_insert_own on doses;
create policy doses_insert_own on doses
  for insert to authenticated
  with check (patient_id = auth.uid());
-- Normal inserts come from generate_doses(), which is SECURITY DEFINER. This
-- policy exists so a patient adding an ad-hoc slot in the app still works.

drop policy if exists doses_update_own on doses;
create policy doses_update_own on doses
  for update to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());
-- Judge test: account B cannot mark account A's dose as taken.
-- No DELETE policy: a missed dose is the record. It is not erasable.


-- -----------------------------------------------------------------------------
-- interactions — reference data, read by everyone, written by nobody.
-- -----------------------------------------------------------------------------
drop policy if exists interactions_select_all on interactions;
create policy interactions_select_all on interactions
  for select to authenticated
  using (true);
-- No write policies at all. The table is seeded through a migration; if a user
-- could edit it they could switch off the app's only safety feature.


-- -----------------------------------------------------------------------------
-- automation_runs — written by the agent, read by the patient it concerns.
-- -----------------------------------------------------------------------------
drop policy if exists automation_runs_select_own on automation_runs;
create policy automation_runs_select_own on automation_runs
  for select to authenticated
  using (patient_id = auth.uid());
-- Judge test: account B cannot read what the agent said to account A, and the
-- `input`/`output` jsonb can hold message text, so this one matters.
-- No write policies: n8n writes through log_run() with the service role, which
-- bypasses RLS. A user forging a run row would forge the audit trail.


-- -----------------------------------------------------------------------------
-- reorder_requests — the full-CRUD table for the judge (Task D5).
-- -----------------------------------------------------------------------------
drop policy if exists reorder_select_own_or_staff on reorder_requests;
create policy reorder_select_own_or_staff on reorder_requests
  for select to authenticated
  using (patient_id = auth.uid() or public.is_staff());

drop policy if exists reorder_insert_own on reorder_requests;
create policy reorder_insert_own on reorder_requests
  for insert to authenticated
  with check (patient_id = auth.uid());

drop policy if exists reorder_update_own_pending on reorder_requests;
create policy reorder_update_own_pending on reorder_requests
  for update to authenticated
  using (
    (patient_id = auth.uid() and status = 'pending')
    or public.is_staff()
  )
  with check (patient_id = auth.uid() or public.is_staff());
-- A patient edits the note while it is still pending; staff move it to
-- approved or rejected. Once decided, the patient can no longer touch it.

drop policy if exists reorder_delete_own_pending on reorder_requests;
create policy reorder_delete_own_pending on reorder_requests
  for delete to authenticated
  using (patient_id = auth.uid() and status = 'pending');
-- Withdrawing a pending request is the D (delete) in the judge's CRUD run.

commit;


-- =============================================================================
-- Done when: account B pastes account A's record id into the address bar and
-- gets nothing back — in front of the judge.
--
-- Prove it without a browser: scripts/rls-test.sql
--
-- Confirm RLS is actually on before you claim it is:
--   select relname, relrowsecurity
--   from pg_class
--   where relnamespace = 'public'::regnamespace and relkind = 'r'
--   order by relname;
--   -- every row must read true
-- =============================================================================

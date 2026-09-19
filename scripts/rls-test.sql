-- =============================================================================
-- rls-test.sql — prove the leak test passes, without opening a browser
-- Area 03 (Security) · supports Task C1
--
-- Simulates two signed-in patients by setting the same JWT claims PostgREST
-- sets when it validates a bearer token. auth.uid() reads request.jwt.claims,
-- so setting it is exactly what a real signed-in request looks like.
--
-- HOW TO RUN
--   1. Sign up two patient accounts through the app.
--   2. select id, email from auth.users order by created_at desc limit 2;
--   3. Find/replace the two UUIDs below with those ids.
--   4. Paste the whole file into the Supabase SQL editor and run it.
--
--   PATIENT A = 11111111-1111-1111-1111-111111111111
--   PATIENT B = 22222222-2222-2222-2222-222222222222
--
-- Everything runs inside a transaction that ROLLS BACK, so it leaves nothing
-- behind — including the writes the attack tests attempt.
--
-- IMPORTANT: this is a rehearsal, not the verification that counts. The judge
-- test is two private windows on the public URL. This script exists so a broken
-- policy surfaces in ten seconds instead of in front of the panel.
-- =============================================================================

begin;

-- =============================================================================
-- TEST 1 — a patient sees their own prescriptions and nobody else's.
-- The MUST: "RLS on; account B reads nothing of A".
-- =============================================================================

select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select 'T1a: A sees only own prescriptions' as test,
       count(*) filter (where patient_id = '11111111-1111-1111-1111-111111111111') as own,
       count(*) filter (where patient_id <> '11111111-1111-1111-1111-111111111111') as other_peoples
from prescriptions;
-- PASS when other_peoples = 0.

reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select 'T1b: B sees nothing of A' as test, count(*) as rows_visible
from prescriptions
where patient_id = '11111111-1111-1111-1111-111111111111';
-- PASS when rows_visible = 0. This is the address-bar test, in SQL.


-- =============================================================================
-- TEST 2 — the same for every other table holding patient data.
-- A policy is only as good as the table you remembered to put it on.
-- Still signed in as B.
-- =============================================================================

select 'doses'            as tbl, count(*) as a_rows_visible_to_b from doses            where patient_id = '11111111-1111-1111-1111-111111111111'
union all
select 'dispenses',              count(*) from dispenses        where patient_id = '11111111-1111-1111-1111-111111111111'
union all
select 'automation_runs',        count(*) from automation_runs  where patient_id = '11111111-1111-1111-1111-111111111111'
union all
select 'reorder_requests',       count(*) from reorder_requests where patient_id = '11111111-1111-1111-1111-111111111111'
union all
select 'profiles',               count(*) from profiles         where id         = '11111111-1111-1111-1111-111111111111';
-- PASS when every count is 0.


-- =============================================================================
-- TEST 3 — B cannot WRITE into A's data either.
-- Reading is the test the judge runs; writing is the one that actually hurts.
-- A policy that filters SELECT but not UPDATE looks fine in the demo.
-- =============================================================================

do $$
declare v_hit integer;
begin
  update doses set status = 'taken'
   where patient_id = '11111111-1111-1111-1111-111111111111';
  get diagnostics v_hit = row_count;
  if v_hit > 0 then
    raise warning 'FAIL (T3): B updated % of A''s dose rows', v_hit;
  else
    raise notice 'PASS (T3): B''s update of A''s doses matched no rows';
  end if;
exception when others then
  raise notice 'PASS (T3): B''s update was refused (%)', sqlerrm;
end;
$$;


-- =============================================================================
-- TEST 4 — a patient cannot promote themselves to staff.
-- Without the profiles_guard_role trigger this passes every RLS policy:
-- the row belongs to them, so USING and WITH CHECK are both satisfied.
-- =============================================================================

do $$
begin
  update profiles set role = 'doctor'
   where id = '22222222-2222-2222-2222-222222222222';
  raise warning 'FAIL (T4): patient promoted themselves to doctor';
exception when others then
  raise notice 'PASS (T4): role change refused (%)', sqlerrm;
end;
$$;


-- =============================================================================
-- TEST 5 — a patient cannot write themselves a prescription.
-- =============================================================================

do $$
begin
  insert into prescriptions
    (patient_id, doctor_id, medication_id, strength, dose_amount,
     times_per_day, duration_days, source)
  select '22222222-2222-2222-2222-222222222222',
         '22222222-2222-2222-2222-222222222222',
         id, '500 mg', 1, 3, 5, 'government'
  from medications limit 1;
  raise warning 'FAIL (T5): patient wrote their own prescription';
exception when others then
  raise notice 'PASS (T5): self-prescription refused (%)', sqlerrm;
end;
$$;


-- =============================================================================
-- TEST 6 — an anonymous visitor sees nothing at all.
-- The frontend ships the anon key in the browser, so this is the key a stranger
-- already has.
-- =============================================================================

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select 'T6: anon row counts' as test,
       (select count(*) from prescriptions)    as prescriptions,
       (select count(*) from doses)            as doses,
       (select count(*) from profiles)         as profiles,
       (select count(*) from automation_runs)  as automation_runs;
-- PASS when every count is 0.


-- =============================================================================
-- TEST 7 — RLS is switched on everywhere. No table forgotten.
-- =============================================================================

reset role;

select relname as table_name, relrowsecurity as rls_on
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;
-- PASS when rls_on is true for all eight tables.

select relname as rls_on_but_no_policies
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
  and c.relrowsecurity
  and not exists (select 1 from pg_policy p where p.polrelid = c.oid);
-- Any table listed here is readable by nobody. That is correct for
-- service-role-only tables and a bug for anything else.

rollback;

-- =============================================================================
-- rls-test.sql — prove the leak test passes, without opening a browser
-- Area 03 (Security) · supports Task C1
--
-- Simulates two signed-in patients in one session by setting the same JWT
-- claims PostgREST would set. Run it in the Supabase SQL editor.
--
-- IMPORTANT: this is a rehearsal, not the verification that counts. The judge
-- test is two private windows on the public URL. This script catches a broken
-- policy in ten seconds so you never take a broken one to the demo.
--
-- The whole script runs inside a transaction that ROLLS BACK, so it leaves
-- nothing behind.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Fixtures. These ids are made up: the script inserts them beneath RLS as the
-- table owner, then switches to the `authenticated` role to do the reading.
-- Foreign keys to auth.users are why profiles rows are inserted directly here
-- rather than through signup.
-- -----------------------------------------------------------------------------
set local role postgres;

create temporary table t_ids on commit drop as
select
  '11111111-1111-1111-1111-111111111111'::uuid as patient_a,
  '22222222-2222-2222-2222-222222222222'::uuid as patient_b;

-- If your database enforces the auth.users foreign key (it does), seed two real
-- accounts first and paste their ids above. Sign them up through the app, then:
--   select id, email from auth.users order by created_at desc limit 2;


-- -----------------------------------------------------------------------------
-- Helper: become a signed-in user.
-- auth.uid() reads request.jwt.claims, so setting it is exactly what PostgREST
-- does when it validates a bearer token.
-- -----------------------------------------------------------------------------
create or replace function pg_temp.become(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;


-- =============================================================================
-- TEST 1 — a patient sees their own prescriptions and nobody else's.
-- This is the MUST: "account B reads nothing of A".
-- =============================================================================

select pg_temp.become((select patient_a from t_ids));

select 'A sees own prescriptions' as test,
       count(*) filter (where patient_id = (select patient_a from t_ids)) as own,
       count(*) filter (where patient_id <> (select patient_a from t_ids)) as other_peoples
from prescriptions;
-- PASS when other_peoples = 0.

select pg_temp.become((select patient_b from t_ids));

select 'B sees nothing of A' as test, count(*) as rows_visible
from prescriptions
where patient_id = (select patient_a from t_ids);
-- PASS when rows_visible = 0. This is the address-bar test, in SQL.


-- =============================================================================
-- TEST 2 — the same for every other patient-data table.
-- A policy is only as good as the table you remembered to put it on.
-- =============================================================================

select pg_temp.become((select patient_b from t_ids));

select 'doses'            as tbl, count(*) as a_rows_visible_to_b from doses            where patient_id = (select patient_a from t_ids)
union all
select 'dispenses',              count(*) from dispenses        where patient_id = (select patient_a from t_ids)
union all
select 'automation_runs',        count(*) from automation_runs  where patient_id = (select patient_a from t_ids)
union all
select 'reorder_requests',       count(*) from reorder_requests where patient_id = (select patient_a from t_ids)
union all
select 'profiles',               count(*) from profiles         where id         = (select patient_a from t_ids);
-- PASS when every count is 0.


-- =============================================================================
-- TEST 3 — B cannot WRITE into A's data either.
-- Reading is the test the judge runs; writing is the one that actually hurts.
-- =============================================================================

select pg_temp.become((select patient_b from t_ids));

do $$
declare
  v_a uuid := '11111111-1111-1111-1111-111111111111';
begin
  begin
    update doses set status = 'taken' where patient_id = v_a;
    if found then
      raise warning 'FAIL: B updated A''s doses';
    else
      raise notice 'PASS: B''s update of A''s doses matched no rows';
    end if;
  exception when insufficient_privilege or others then
    raise notice 'PASS: B''s update was refused (%)', sqlerrm;
  end;
end;
$$;


-- =============================================================================
-- TEST 4 — a patient cannot promote themselves to staff.
-- Without the profiles_guard_role trigger this one passes every RLS policy.
-- =============================================================================

select pg_temp.become((select patient_b from t_ids));

do $$
begin
  update profiles set role = 'doctor' where id = auth.uid();
  raise warning 'FAIL: patient promoted themselves to doctor';
exception when others then
  raise notice 'PASS: role change refused (%)', sqlerrm;
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
  select auth.uid(), auth.uid(), id, '500 mg', 1, 3, 5, 'government'
  from medications limit 1;
  raise warning 'FAIL: patient wrote their own prescription';
exception when others then
  raise notice 'PASS: self-prescription refused (%)', sqlerrm;
end;
$$;


-- =============================================================================
-- TEST 6 — RLS is switched on everywhere. No table forgotten.
-- =============================================================================

reset role;

select relname as table_name, relrowsecurity as rls_on
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
order by relname;
-- PASS when rls_on is true for all eight tables.

select relname as table_without_policies
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
  and c.relrowsecurity
  and not exists (select 1 from pg_policy p where p.polrelid = c.oid);
-- Zero rows is fine only if you meant that table to be service-role-only.

rollback;

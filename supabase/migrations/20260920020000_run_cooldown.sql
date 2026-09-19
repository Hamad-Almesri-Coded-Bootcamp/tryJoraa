-- Jur'ah — a cooldown on the action that calls a model.
-- Lane A. Closes audit finding A2.3 and the Area 03 COULD
-- ("a cooldown or a limit on the action that costs money, sends a message, or
-- calls a model" — press the button ten times fast, the app stops you and says
-- so).
--
-- WHY A TRIGGER AND NOT A CHECK IN /api/runs
--
-- `runs` is insertable directly over PostgREST by any signed-in user — the
-- `run_insert` policy allows `patient_id = auth.uid()`, which is correct. A
-- limit that lives only in the route handler is bypassed by one fetch() to
-- /rest/v1/runs. Putting it in the database means it holds wherever the insert
-- comes from: the app, curl, or n8n misconfigured.
--
-- WHY NOT AN RLS POLICY
--
-- A policy can count recent rows, but a policy that refuses returns the generic
-- "new row violates row-level security policy". The checklist test is that the
-- app "stops you AND SAYS SO", and `/api/runs` already forwards
-- `error.message` to the browser. A trigger can therefore give the user a real
-- sentence with the wait time in it; a policy cannot.
--
-- THE NUMBERS
--
-- Five runs per patient per fifteen minutes. Chosen against the actual test:
-- ten fast presses must be stopped, so the limit has to bite below ten, and it
-- bites on the sixth. Fifteen minutes rather than an hour so a rehearsal at
-- 20:00 is not still locked out at 20:30. Change both constants in one place
-- below.
--
-- Deliberately NOT applied to the service role: n8n updates runs it did not
-- insert, and a future workflow that creates runs on a schedule should not be
-- throttled by a per-patient interactive limit.

-- SECURITY INVOKER, and that is load-bearing. An earlier draft of this file
-- used SECURITY DEFINER and was wrong twice over.
--
-- First, init.sql line 4 and technical-plan §3.5 say the schema has exactly
-- three definer functions — audit_row, audit_reference_row, handle_new_user —
-- and that the reviewer flags any fourth. This would have been the fourth.
--
-- Second, and worse, it built a cross-account oracle on top of the thing the
-- eight probes exist to disprove. A BEFORE ROW trigger fires before the RLS
-- WITH CHECK is evaluated, so account B could insert with
-- `patient_id = <A's id>` and read A's agent activity off the *shape of the
-- error*: a generic RLS violation means A has fewer than five recent runs, the
-- sentence below means A has five or more.
--
-- As INVOKER the count runs under the caller's own RLS. `run_select` is
-- `patient_id = (select auth.uid())`, so B counting A's runs sees zero, falls
-- through, and is then refused by the WITH CHECK with the same generic message
-- either way. No oracle, and no privilege this function did not need.
create or replace function enforce_run_cooldown() returns trigger
language plpgsql security invoker set search_path = public
as $$
declare
  v_window   constant interval := interval '15 minutes';
  v_max      constant int      := 5;
  v_recent   int;
  v_oldest   timestamptz;
  v_wait_min int;
begin
  -- The agent is not a person pressing a button.
  --
  -- `current_user`, not `auth.role()`. auth.role() is deprecated and is absent
  -- from some projects — and if it does not resolve, this trigger raises 42883
  -- on EVERY insert into runs, which takes AU-1, AU-2, AU-6 and BE-5 down
  -- together. current_user is the role PostgREST connected as, cannot throw,
  -- and is exactly the distinction being drawn here.
  if current_user = 'service_role' then
    return new;
  end if;

  select count(*), min(started_at)
    into v_recent, v_oldest
  from runs
  where patient_id = new.patient_id
    and started_at > now() - v_window;

  if v_recent >= v_max then
    v_wait_min := greatest(1, ceil(extract(epoch from (v_oldest + v_window - now())) / 60)::int);
    -- Cast both numbers to int. `extract(epoch ...) / 60` is numeric, and
    -- interpolating it raw prints "15.0000000000000000 minutes" to the user.
    -- A judge reads this sentence; it is the deliverable, not a log line.
    raise exception
      'You have started % automations in the last % minutes. Please wait about % minute(s) before starting another.',
      v_recent, (extract(epoch from v_window) / 60)::int, v_wait_min
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

comment on function enforce_run_cooldown() is
  'Five runs per patient per fifteen minutes. Raises a message the API forwards to the user. Service role exempt.';

drop trigger if exists runs_cooldown on runs;
create trigger runs_cooldown
  before insert on runs
  for each row execute function enforce_run_cooldown();

-- The count above is per patient over a time window, so it reads
-- (patient_id, started_at) on every insert.
create index if not exists runs_patient_started_idx on runs (patient_id, started_at desc);

-- Trigger functions are not API (see 20260919121000_revoke_function_execute.sql).
revoke all on function enforce_run_cooldown() from public, anon, authenticated;

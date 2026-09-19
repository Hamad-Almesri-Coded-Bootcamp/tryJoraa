-- Jur'ah — SE-6 finding A1: generate_doses() is re-runnable from the client.
-- Lane A.
--
-- THE FINDING
--
-- `generate_doses(uuid)` is SECURITY INVOKER and stays executable by
-- `authenticated` on purpose — the insert trigger calls it in the user's own
-- session, so revoking EXECUTE would break every new prescription.
-- 20260919121000_revoke_function_execute.sql says exactly that, and it is right.
--
-- But PostgREST publishes it at /rest/v1/rpc/generate_doses, `doses` has no
-- uniqueness on (prescription_id, scheduled_at), and the function has no
-- "already generated" check. So any signed-in patient can do this to their own
-- prescription, with the anon key that ships in the browser:
--
--   for (let i = 0; i < 100; i++)
--     await supabase.rpc('generate_doses', { p_prescription: myRxId })
--
-- RLS never objects: the rows belong to the caller. Each call re-inserts the
-- whole course. A 365-day, 6-a-day prescription is 2,190 rows per call, and
-- every one fires audit_row(), so audit_log grows at the same rate. A hundred
-- calls is ~438,000 rows from one button. On the free tier that is the database
-- full; before that it is a dose calendar showing every dose a hundred times,
-- in a medication app.
--
-- THE FIX
--
-- Not a revoke — that breaks the trigger. Make the operation idempotent, which
-- is what it should always have been: a dose slot is identified by its
-- prescription and its time, so say so in the schema and let the second call be
-- a no-op.

-- ------------------------------------------------- 1. clear any duplicates ---
-- A unique constraint cannot be added over existing duplicates. If the RPC has
-- already been called more than once on this database, collapse each group to
-- ONE row before constraining.
--
-- Which row survives matters clinically: a dose the patient has already
-- answered (taken/skipped/missed) carries real information, an untouched
-- duplicate does not. So keep the answered one, and the oldest among equals.
-- This deletes only exact (prescription_id, scheduled_at) duplicates. On a
-- clean database it deletes nothing.

with ranked as (
  select
    id,
    row_number() over (
      partition by prescription_id, scheduled_at
      order by (answered_at is null), created_at, id
    ) as rn
  from doses
)
delete from doses d
using ranked r
where d.id = r.id and r.rn > 1;

-- ------------------------------------------------------ 2. the constraint ---
alter table doses
  add constraint doses_one_slot_per_prescription unique (prescription_id, scheduled_at);

-- -------------------------------------------------- 3. make the RPC honest ---
-- Same schedule, same rules, same return value — but the second call inserts
-- nothing instead of duplicating the course. The count returned is now rows
-- ACTUALLY inserted, so a re-run reports 0 and the caller can tell.

create or replace function generate_doses(p_prescription uuid) returns int
language plpgsql security invoker set search_path = public
as $$
declare
  p     prescriptions%rowtype;
  n     int := 0;
  hit   int;
  d     date;
  step  int;
  t     time;
  times time[];
begin
  select * into p from prescriptions where id = p_prescription;
  if not found or p.dosing_pattern = 'as_needed' then return 0; end if;

  times := case p.frequency_per_day
    when 1 then array['08:00']::time[]
    when 2 then array['08:00','20:00']::time[]
    when 3 then array['08:00','14:00','20:00']::time[]
    when 4 then array['08:00','12:00','16:00','20:00']::time[]
    when 5 then array['06:00','10:00','14:00','18:00','22:00']::time[]
    else        array['06:00','09:00','12:00','15:00','18:00','21:00']::time[]
  end;
  step := case p.dosing_pattern when 'daily' then 1 when 'alternate_day' then 2 else 7 end;

  d := p.start_date;
  while d < p.start_date + p.duration_days loop
    foreach t in array times loop
      insert into doses (prescription_id, scheduled_at)
      values (p.id, (d + t) at time zone 'Asia/Kuwait')
      on conflict on constraint doses_one_slot_per_prescription do nothing;
      get diagnostics hit = row_count;
      n := n + hit;
    end loop;
    d := d + step;
  end loop;
  return n;
end $$;

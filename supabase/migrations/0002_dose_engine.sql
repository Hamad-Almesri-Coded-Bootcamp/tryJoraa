-- =============================================================================
-- 0002_dose_engine.sql — tryJoraa: generate_doses()
-- Area 02 (Back end & data) · Task A2 · Night 4, handed to Night 9
--
-- The calendar screen and the agent both need concrete dose rows, not rules.
-- This file turns a prescription into rows in `doses`.
--
-- Safe to re-run: functions use CREATE OR REPLACE, the trigger is dropped first,
-- and the insert relies on doses_one_slot_per_prescription to skip duplicates.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- generate_doses(prescription_id) -> number of rows actually inserted
--
-- Rules:
--   * times_per_day slots are spread evenly across 08:00–22:00 Kuwait time.
--       1/day  -> 08:00
--       2/day  -> 08:00, 22:00
--       3/day  -> 08:00, 15:00, 22:00
--       4/day  -> 08:00, 12:40, 17:20, 22:00
--   * duration_days counts CALENDAR days from the prescription date, not dosing
--     days. A 10-day alternate-day course therefore doses on days 0,2,4,6,8 —
--     five dosing days, not ten.
--   * Re-running never duplicates: the unique constraint on
--     (prescription_id, due_at) absorbs the second attempt.
--
-- SECURITY DEFINER on purpose: the trigger below fires inside the *doctor's*
-- session when a doctor writes a prescription for a patient, but the rows it
-- inserts belong to the patient. Under the 0005 RLS policies a doctor cannot
-- write another person's dose rows, so an invoker-rights function would fail
-- every real prescription. search_path is pinned so the elevated function can
-- never be tricked into resolving a table from someone else's schema.
-- -----------------------------------------------------------------------------
create or replace function generate_doses(p_prescription_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rx          prescriptions%rowtype;
  v_start     date;
  v_step      integer;
  v_gap       interval;
  v_day       integer;
  v_slot      integer;
  v_due       timestamptz;
  v_rowcount  integer;
  v_inserted  integer := 0;
begin
  select * into rx from prescriptions where id = p_prescription_id;
  if not found then
    raise exception 'generate_doses: no prescription with id %', p_prescription_id
      using errcode = 'no_data_found';
  end if;

  if rx.times_per_day is null or rx.times_per_day < 1 or rx.times_per_day > 6 then
    raise exception
      'generate_doses: times_per_day must be between 1 and 6, got % (prescription %)',
      rx.times_per_day, rx.id
      using errcode = 'check_violation';
  end if;

  if rx.duration_days is null or rx.duration_days < 1 or rx.duration_days > 365 then
    raise exception
      'generate_doses: duration_days must be between 1 and 365, got % (prescription %)',
      rx.duration_days, rx.id
      using errcode = 'check_violation';
  end if;

  -- Day 0 is the day the prescription was written, read in Kuwait local time.
  v_start := (rx.created_at at time zone 'Asia/Kuwait')::date;

  -- alternate_days skips every second calendar day.
  v_step := case rx.pattern when 'alternate_days' then 2 else 1 end;

  -- 08:00 to 22:00 is 840 minutes. One slot a day means no gap to divide.
  v_gap := interval '840 minutes' / greatest(rx.times_per_day - 1, 1);

  for v_day in 0 .. rx.duration_days - 1 loop
    if v_day % v_step = 0 then
      for v_slot in 0 .. rx.times_per_day - 1 loop
        v_due := ((v_start + v_day)::timestamp
                   + interval '8 hours'
                   + (v_slot * v_gap)) at time zone 'Asia/Kuwait';

        insert into doses (prescription_id, patient_id, due_at)
        values (rx.id, rx.patient_id, v_due)
        on conflict on constraint doses_one_slot_per_prescription do nothing;

        get diagnostics v_rowcount = row_count;
        v_inserted := v_inserted + v_rowcount;
      end loop;
    end if;
  end loop;

  return v_inserted;
end;
$$;

comment on function generate_doses(uuid) is
  'Expands one prescription into concrete doses rows. Idempotent. Returns rows inserted.';


-- -----------------------------------------------------------------------------
-- Trigger: every new prescription gets its calendar immediately, so the app
-- never has to remember to ask.
-- -----------------------------------------------------------------------------
create or replace function trg_prescriptions_generate_doses()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform generate_doses(new.id);
  return new;
end;
$$;

drop trigger if exists prescriptions_generate_doses on prescriptions;

create trigger prescriptions_generate_doses
  after insert on prescriptions
  for each row execute function trg_prescriptions_generate_doses();

commit;


-- =============================================================================
-- Worked examples — run these against a seeded database to check the engine.
-- =============================================================================
--
-- Example 1 — 3 times a day, 10 days, alternate days.
-- This is the "Done when" test from the plan: 5 dosing days x 3 slots = 15 rows,
-- on days 0, 2, 4, 6 and 8 only.
--
--   insert into prescriptions
--     (patient_id, doctor_id, medication_id, strength, dose_amount,
--      times_per_day, duration_days, pattern, source)
--   values
--     ('<patient-uuid>', '<doctor-uuid>', '<ferrous-sulfate-uuid>',
--      '200 mg', 1, 3, 10, 'alternate_days', 'government')
--   returning id;
--
--   -- expect 15 rows, 5 distinct dates, times 08:00 / 15:00 / 22:00 Kuwait
--   select (due_at at time zone 'Asia/Kuwait')::date as day,
--          count(*) as slots
--   from doses where prescription_id = '<new-id>'
--   group by 1 order by 1;
--
--
-- Example 2 — once a day, 7 days, daily.
-- Expect 7 rows, all at 08:00 Kuwait.
--
--   insert into prescriptions
--     (patient_id, medication_id, strength, dose_amount,
--      times_per_day, duration_days, pattern, source)
--   values
--     ('<patient-uuid>', '<bisoprolol-uuid>', '5 mg', 1, 1, 7, 'daily', 'private');
--
--
-- Example 3 — re-running is a no-op.
-- The first call returns 0 because the trigger already inserted the rows.
--
--   select generate_doses('<existing-prescription-id>');   -- 0
--   select count(*) from doses where prescription_id = '<existing-prescription-id>';
--   -- unchanged
--
--
-- Example 4 — bad input is refused with a readable message, not a raw error.
--
--   select generate_doses('00000000-0000-0000-0000-000000000000');
--   -- ERROR: generate_doses: no prescription with id 00000000-...
-- =============================================================================

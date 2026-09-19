-- Jur'ah — the one migration. docs/technical-plan.md §2, §3, §5, §8.
-- Ten tables, RLS on every one, every policy `to authenticated` with
-- `(select auth.uid())`, every write policy with `with check`.
-- Exactly three security definer functions: audit_row, audit_reference_row,
-- handle_new_user.

create extension if not exists moddatetime with schema extensions;

-- =========================================================== 2.1 enums ======
create type user_role        as enum ('patient','doctor');
create type dosing_pattern   as enum ('daily','alternate_day','weekly','as_needed');
create type route_of_admin   as enum ('oral','injection','syrup','inhaler','topical');
create type strength_unit    as enum ('mg','mcg','g','ml','iu','percent');
create type rx_source        as enum ('jurah_doctor','imported','patient_entered','extracted');
create type rx_sector        as enum ('public','private');
create type dose_status      as enum ('due','taken','skipped','missed','rescheduled');
create type run_kind         as enum ('check_doses','profile_medication','screen_interactions','extract_prescription');
create type run_status       as enum ('queued','running','done','failed');
create type med_verification as enum ('verified','unverified');
create type audit_actor      as enum ('patient','doctor','agent','system');
create type audit_action     as enum ('insert','update','delete');

-- ========================================================== 2.2 tables ======

-- one signed-up person, and which side of the app they enter
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  role        user_role not null default 'patient',
  full_name   text not null,
  civil_id    text unique,                    -- patients only; invented sample values
  created_at  timestamptz not null default now()
);

-- one link between one doctor and one patient. This is what grants sight.
create table doctor_patients (
  id          uuid primary key default gen_random_uuid(),
  doctor_id   uuid not null references profiles(id) on delete cascade,
  patient_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (doctor_id, patient_id)
);

-- one medicine prescribed to one patient, from ANY clinic, hospital or sector
create table prescriptions (
  id                       uuid primary key default gen_random_uuid(),
  patient_id               uuid not null references profiles(id) on delete cascade,
  doctor_id                uuid references profiles(id),          -- NULLABLE, D21
  drug_name_generic        text not null,
  drug_name_brand          text,
  strength_value           numeric not null check (strength_value > 0),
  strength_unit            strength_unit not null,
  dose_per_administration  numeric not null check (dose_per_administration > 0),
  frequency_per_day        int not null check (frequency_per_day between 1 and 6),
  duration_days            int not null check (duration_days between 1 and 365),
  dosing_pattern           dosing_pattern not null default 'daily',
  start_date               date not null default current_date,
  food_timing              text,
  route                    route_of_admin not null default 'oral',
  indication               text,
  notes                    text,
  units_per_package        int check (units_per_package > 0),
  total_quantity_dispensed numeric check (total_quantity_dispensed > 0),
  dispense_date            date,
  brand_dispensed          text,
  source                   rx_source not null default 'patient_entered',
  source_facility          text,
  source_sector            rx_sector,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint doctor_row_has_doctor
    check (source <> 'jurah_doctor' or doctor_id is not null)
);

-- one extraction-agent output awaiting the patient's acceptance (D26)
create table prescription_drafts (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references profiles(id) on delete cascade,
  source_image text,
  extracted    jsonb not null,
  confidence   jsonb,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- one scheduled dose of one prescription at one date and time
create table doses (
  id               uuid primary key default gen_random_uuid(),
  prescription_id  uuid not null references prescriptions(id) on delete cascade,
  scheduled_at     timestamptz not null,
  original_at      timestamptz,
  status           dose_status not null default 'due',
  answered_at      timestamptz,
  created_at       timestamptz not null default now()
);

-- one medicine's reference profile, every value carrying its justification
create table medications (
  id                   uuid primary key default gen_random_uuid(),
  ingredient           text not null unique,
  is_time_critical     boolean not null default false,
  catch_up_window_h    numeric,
  min_gap_h            numeric,
  justification        jsonb not null,
  verification         med_verification not null default 'unverified',
  verified_by          uuid references profiles(id),
  verified_at          timestamptz,
  created_at           timestamptz not null default now()
);

-- one pair of ingredients that must not be taken close together
create table interactions (
  id              uuid primary key default gen_random_uuid(),
  ingredient_a    text not null,
  ingredient_b    text not null,
  min_hours_apart numeric not null check (min_hours_apart > 0),
  source          text not null,
  added_by        uuid references profiles(id),
  created_at      timestamptz not null default now(),
  unique (ingredient_a, ingredient_b)
);

-- one press of an automation
create table runs (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references profiles(id) on delete cascade,
  kind          run_kind not null,
  status        run_status not null default 'queued',
  doses_checked int,
  result        jsonb,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

-- one thing the agent refused to do
create table alerts (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references profiles(id) on delete cascade,
  prescription_id uuid references prescriptions(id) on delete cascade,
  run_id          uuid references runs(id) on delete set null,
  guardrail       text not null,
  reason          text not null,
  acknowledged_by uuid references profiles(id),
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now()
);

-- one change to clinical data: who, what, before, after (D30). Append-only.
create table audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,
  actor_role  audit_actor not null,
  run_id      uuid references runs(id) on delete set null,
  patient_id  uuid not null references profiles(id) on delete cascade,
  table_name  text not null,
  row_id      uuid not null,
  action      audit_action not null,
  before      jsonb,
  after       jsonb
);

-- ========================================================= 2.3 indexes ======
create index on profiles        (role);
create index on doctor_patients (doctor_id);
create index on doctor_patients (patient_id);
create index on prescriptions   (patient_id);
create index on prescriptions   (doctor_id);
create index on prescriptions   (source);
create index on prescription_drafts (patient_id);
create index on doses           (prescription_id);
create index on doses           (scheduled_at);
create index on doses           (status);
create index on runs            (patient_id);
create index on alerts          (patient_id);
create index on alerts          (prescription_id);
create index on alerts          (run_id);
create index on medications     (ingredient);
create index on medications     (verified_by);
create index on interactions    (ingredient_a);
create index on interactions    (ingredient_b);
create index on interactions    (added_by);
create index on audit_log       (patient_id, at desc);
create index on audit_log       (table_name, row_id);
create index on audit_log       (run_id);

-- updated_at on prescriptions, via the moddatetime extension (no new function)
create trigger set_updated_at before update on prescriptions
  for each row execute procedure extensions.moddatetime(updated_at);

-- ==================================================== 3.1 the helpers =======
create or replace function is_linked_doctor(p_patient uuid)
returns boolean
language sql stable security invoker set search_path = public
as $$
  select exists (
    select 1 from doctor_patients
    where doctor_id = (select auth.uid()) and patient_id = p_patient
  );
$$;

create or replace function is_doctor()
returns boolean
language sql stable security invoker set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid()) and role = 'doctor'
  );
$$;

-- ======================================================= 5 signup trigger ===
-- ALWAYS 'patient'. Never read a role from user metadata, or /sign-up could
-- create a doctor. seed-auth.ts promotes doctors afterwards with the service role.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles (id, role, full_name, civil_id)
  values (
    new.id,
    'patient',
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data->>'civil_id'), '')
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ================================================ 8 the schedule engine =====
-- Doses are pre-generated for the whole course on prescription insert. Runs as
-- the inserting user (security invoker), so the dose_insert policy below must
-- let the prescription's patient or its authoring doctor insert.
create or replace function generate_doses(p_prescription uuid) returns int
language plpgsql security invoker set search_path = public
as $$
declare
  p     prescriptions%rowtype;
  n     int := 0;
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
      values (p.id, (d + t) at time zone 'Asia/Kuwait');
      n := n + 1;
    end loop;
    d := d + step;
  end loop;
  return n;
end $$;

create or replace function generate_doses_on_insert() returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  perform generate_doses(new.id);
  return new;
end $$;

create trigger generate_doses after insert on prescriptions
  for each row execute function generate_doses_on_insert();

-- =================================================== 3.4 depletion view =====
create view depletion_forecast
with (security_invoker = true) as
select
  p.id as prescription_id,
  p.patient_id,
  p.drug_name_generic,
  p.dispense_date,
  p.dispense_date
    + ((p.total_quantity_dispensed
        / (p.dose_per_administration * p.frequency_per_day))::int) as runs_out_on
from prescriptions p
where p.dispense_date is not null
  and p.total_quantity_dispensed is not null;

-- ================================================ 3.5 the audit triggers ====
create or replace function audit_row() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_patient uuid;
  v_row     jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  v_run     uuid  := nullif(current_setting('jurah.run_id', true), '')::uuid;
  v_actor   uuid  := auth.uid();
  v_role    audit_actor;
begin
  if v_row ? 'patient_id' then
    v_patient := (v_row->>'patient_id')::uuid;
  elsif v_row ? 'prescription_id' then
    select patient_id into v_patient from prescriptions where id = (v_row->>'prescription_id')::uuid;
  end if;
  -- a dose deleted by cascade has no parent left; the prescription's own delete is audited
  if v_patient is null then return null; end if;

  v_role := case
    when v_run is not null then 'agent'::audit_actor
    when v_actor is null   then 'system'::audit_actor
    else coalesce((select case role when 'doctor' then 'doctor'::audit_actor else 'patient'::audit_actor end
                   from profiles where id = v_actor), 'system'::audit_actor)
  end;

  insert into audit_log (actor_id, actor_role, run_id, patient_id, table_name, row_id, action, before, after)
  values (v_actor, v_role, v_run, v_patient, tg_table_name, (v_row->>'id')::uuid,
          lower(tg_op)::audit_action,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return null;
end $$;

-- medications and interactions have no patient column: under a run the subject
-- is the run's patient; otherwise the acting doctor; with neither (the hand
-- seed as the service role) the row is skipped.
create or replace function audit_reference_row() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_patient uuid;
  v_row     jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  v_run     uuid  := nullif(current_setting('jurah.run_id', true), '')::uuid;
  v_actor   uuid  := auth.uid();
  v_role    audit_actor;
begin
  if v_run is not null then
    select patient_id into v_patient from runs where id = v_run;
    v_role := 'agent';
  elsif v_actor is not null then
    v_patient := v_actor;
    v_role := 'doctor';
  end if;
  if v_patient is null then return null; end if;

  insert into audit_log (actor_id, actor_role, run_id, patient_id, table_name, row_id, action, before, after)
  values (v_actor, v_role, v_run, v_patient, tg_table_name, (v_row->>'id')::uuid,
          lower(tg_op)::audit_action,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return null;
end $$;

create trigger audit after insert or update or delete on prescriptions
  for each row execute function audit_row();
create trigger audit after insert or update or delete on prescription_drafts
  for each row execute function audit_row();
create trigger audit after insert or update or delete on doses
  for each row execute function audit_row();
create trigger audit after insert or update or delete on alerts
  for each row execute function audit_row();
create trigger audit after insert or update or delete on doctor_patients
  for each row execute function audit_row();
create trigger audit after insert or update or delete on medications
  for each row execute function audit_reference_row();
create trigger audit after insert or update or delete on interactions
  for each row execute function audit_reference_row();

-- ================================================= 3 row-level security =====
alter table profiles            enable row level security;
alter table doctor_patients     enable row level security;
alter table prescriptions       enable row level security;
alter table prescription_drafts enable row level security;
alter table doses               enable row level security;
alter table medications         enable row level security;
alter table interactions        enable row level security;
alter table runs                enable row level security;
alter table alerts              enable row level security;
alter table audit_log           enable row level security;

-- profiles: my own row; a linked doctor sees their patient; a patient sees their doctor.
create policy profile_select on profiles for select to authenticated
using ( id = (select auth.uid())
        or is_linked_doctor(id)
        or exists (select 1 from doctor_patients dp
                   where dp.patient_id = (select auth.uid()) and dp.doctor_id = profiles.id) );
create policy profile_update on profiles for update to authenticated
using      ( id = (select auth.uid()) )
with check ( id = (select auth.uid()) );
-- the role column cannot be changed from the client at all
revoke update on profiles from authenticated;
grant  update (full_name, civil_id) on profiles to authenticated;

-- doctor_patients: seen by the two people it names; created and removed by the doctor.
create policy dp_select on doctor_patients for select to authenticated
using ( doctor_id = (select auth.uid()) or patient_id = (select auth.uid()) );
create policy dp_insert on doctor_patients for insert to authenticated
with check ( doctor_id = (select auth.uid()) and is_doctor() );
create policy dp_delete on doctor_patients for delete to authenticated
using ( doctor_id = (select auth.uid()) );

-- prescriptions (§3.2) — the rule everything else inherits
create policy rx_select on prescriptions for select to authenticated
using ( patient_id = (select auth.uid()) or is_linked_doctor(patient_id) );
create policy rx_insert_patient on prescriptions for insert to authenticated
with check ( patient_id = (select auth.uid()) and source <> 'jurah_doctor' );
create policy rx_insert_doctor on prescriptions for insert to authenticated
with check ( source = 'jurah_doctor'
             and doctor_id = (select auth.uid())
             and is_linked_doctor(patient_id) );
create policy rx_update_patient on prescriptions for update to authenticated
using      ( patient_id = (select auth.uid()) and source <> 'jurah_doctor' )
with check ( patient_id = (select auth.uid()) and source <> 'jurah_doctor' );
create policy rx_update_doctor on prescriptions for update to authenticated
using      ( doctor_id = (select auth.uid()) )
with check ( doctor_id = (select auth.uid()) );
create policy rx_delete_patient on prescriptions for delete to authenticated
using ( patient_id = (select auth.uid()) and source <> 'jurah_doctor' );

-- prescription_drafts: patient only — not even a linked doctor
create policy draft_select on prescription_drafts for select to authenticated
using ( patient_id = (select auth.uid()) );
create policy draft_insert on prescription_drafts for insert to authenticated
with check ( patient_id = (select auth.uid()) );
create policy draft_update on prescription_drafts for update to authenticated
using      ( patient_id = (select auth.uid()) )
with check ( patient_id = (select auth.uid()) );
create policy draft_delete on prescription_drafts for delete to authenticated
using ( patient_id = (select auth.uid()) );

-- doses (§3.3): read through the prescription; written by its patient (mark
-- taken/skipped, accept a proposal) and inserted by the schedule engine running
-- as the patient or the authoring doctor.
create policy dose_select on doses for select to authenticated
using ( exists (select 1 from prescriptions p where p.id = prescription_id
                and (p.patient_id = (select auth.uid()) or is_linked_doctor(p.patient_id))) );
create policy dose_insert on doses for insert to authenticated
with check ( exists (select 1 from prescriptions p where p.id = prescription_id
                     and (p.patient_id = (select auth.uid()) or p.doctor_id = (select auth.uid()))) );
create policy dose_update on doses for update to authenticated
using      ( exists (select 1 from prescriptions p where p.id = prescription_id
                     and p.patient_id = (select auth.uid())) )
with check ( exists (select 1 from prescriptions p where p.id = prescription_id
                     and p.patient_id = (select auth.uid())) );

-- medications: readable by every signed-in user; a doctor may add or verify;
-- nobody may update a row that is already verified (D11a).
create policy med_select on medications for select to authenticated
using ( (select auth.uid()) is not null );
create policy med_insert on medications for insert to authenticated
with check ( is_doctor()
             and (verification = 'unverified' or verified_by = (select auth.uid())) );
create policy med_update on medications for update to authenticated
using      ( is_doctor() and verification = 'unverified' )
with check ( is_doctor()
             and (verification = 'unverified' or verified_by = (select auth.uid())) );

-- interactions: readable by every signed-in user; a doctor writes a verified
-- pair in with their own id as added_by (D27). No update or delete from the client.
create policy ix_select on interactions for select to authenticated
using ( (select auth.uid()) is not null );
create policy ix_insert on interactions for insert to authenticated
with check ( is_doctor() and added_by = (select auth.uid()) );

-- runs: the patient starts one and watches it; n8n finishes it with the service role.
create policy run_select on runs for select to authenticated
using ( patient_id = (select auth.uid()) );
create policy run_insert on runs for insert to authenticated
with check ( patient_id = (select auth.uid()) );

-- alerts: read by the patient and any linked doctor; acknowledged only by a
-- linked doctor; written only by the agent through the service role.
create policy alert_select on alerts for select to authenticated
using ( patient_id = (select auth.uid()) or is_linked_doctor(patient_id) );
create policy alert_update on alerts for update to authenticated
using      ( is_linked_doctor(patient_id) )
with check ( is_linked_doctor(patient_id) and acknowledged_by = (select auth.uid()) );
revoke update on alerts from authenticated;
grant  update (acknowledged_by, acknowledged_at) on alerts to authenticated;

-- audit_log (§3.5): read like a prescription. NO insert, update or delete
-- policy — only the two trigger functions write it. Privileges revoked as well.
create policy audit_select on audit_log for select to authenticated
using ( patient_id = (select auth.uid()) or is_linked_doctor(patient_id) );
revoke insert, update, delete, truncate on audit_log from authenticated, anon;

-- anon has no policy anywhere and no business reading these tables at all
revoke all on all tables in schema public from anon;

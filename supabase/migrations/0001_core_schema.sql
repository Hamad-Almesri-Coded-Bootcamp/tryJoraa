-- =============================================================================
-- 0001_core_schema.sql — tryJoraa: core schema
-- Area 02 (Back end & data) · Task A1 · Night 4
--
-- Covers the MUSTs "app reads from the database, not code" and
-- "one sentence per table". Every table carries its one-sentence answer twice:
-- once as a comment block here, and once as a COMMENT ON TABLE so the sentence
-- is readable from the database itself when a judge asks.
--
-- Safe to re-run: enums are guarded by DO blocks, tables use IF NOT EXISTS.
-- =============================================================================

begin;

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Enums. Statuses are never free text (Task A5's type audit checks this).
-- -----------------------------------------------------------------------------

do $$ begin
  create type user_role as enum ('patient', 'doctor', 'pharmacist');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dose_status as enum ('scheduled', 'taken', 'missed', 'rescheduled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rx_pattern as enum ('daily', 'alternate_days');
exception when duplicate_object then null; end $$;

do $$ begin
  create type run_status as enum ('started', 'success', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type care_source as enum ('government', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reorder_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- Not in the original enum list, but severity is a status and the A5 audit rule
-- says statuses are enums. Keeping it text would fail our own audit.
do $$ begin
  create type interaction_severity as enum ('avoid', 'caution');
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- profiles
-- One row is one signed-in person: their name, WhatsApp number, and role
-- (patient, doctor or pharmacist).
--
-- Every other table hangs off auth.users through this table. The row is created
-- automatically on signup by handle_new_user() in 0004_auth_profiles.sql.
-- -----------------------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text        not null,
  whatsapp    text,
  role        user_role   not null default 'patient',
  created_at  timestamptz not null default now()
);

comment on table profiles is
  'One row is one signed-in person: their name, WhatsApp number, and role.';


-- -----------------------------------------------------------------------------
-- medications
-- One row is one drug: its trade name and the active ingredient inside it.
--
-- active_ingredient is stored lowercase and unabbreviated; the interaction check
-- joins on it, so a stray capital letter is a missed safety warning.
-- See docs/cleaning-log.md for the naming decisions.
-- -----------------------------------------------------------------------------
create table if not exists medications (
  id                 uuid primary key default gen_random_uuid(),
  trade_name         text        not null,
  active_ingredient  text        not null,
  created_at         timestamptz not null default now()
);

create unique index if not exists medications_trade_ingredient_key
  on medications (lower(trade_name), lower(active_ingredient));

comment on table medications is
  'One row is one drug: its trade name and the active ingredient inside it.';


-- -----------------------------------------------------------------------------
-- prescriptions
-- One row is one doctor's order: the drug, its strength, the dose, how many
-- times a day, for how many days, the pattern (daily or alternate days), food
-- timing, notes, whether it is government or private care, and the refill
-- window.
--
-- This is the hub table: doses, dispenses and reorder_requests all point back
-- here, and prescription_id is the join a judge will ask you to point at.
-- -----------------------------------------------------------------------------
create table if not exists prescriptions (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid         not null references profiles (id)    on delete cascade,
  doctor_id           uuid                  references profiles (id)    on delete set null,
  medication_id       uuid         not null references medications (id) on delete restrict,
  strength            text         not null,               -- '5 mg', '500 mg/5 ml'
  dose_amount         numeric(6,2) not null,               -- units taken per dose
  times_per_day       smallint     not null,
  duration_days       smallint     not null,
  pattern             rx_pattern   not null default 'daily',
  food_timing         text,                                -- 'before food', 'after food', null
  notes               text,
  source              care_source  not null default 'government',
  refill_allowed_until date,
  created_at          timestamptz  not null default now()
);

create index if not exists prescriptions_patient_idx on prescriptions (patient_id);
create index if not exists prescriptions_doctor_idx  on prescriptions (doctor_id);

comment on table prescriptions is
  'One row is one doctor''s order: drug, strength, dose, times per day, duration, pattern, food timing, source and refill window.';


-- -----------------------------------------------------------------------------
-- dispenses
-- One row is one pharmacy handover: the quantity dispensed and the date,
-- logged by a pharmacist.
--
-- patient_id is carried here on purpose even though it is reachable through
-- prescription_id: RLS policies in 0005 compare it to auth.uid() directly, and
-- a policy that has to join is a policy someone will get wrong.
-- -----------------------------------------------------------------------------
create table if not exists dispenses (
  id              uuid primary key default gen_random_uuid(),
  prescription_id uuid         not null references prescriptions (id) on delete cascade,
  patient_id      uuid         not null references profiles (id)      on delete cascade,
  pharmacist_id   uuid                  references profiles (id)      on delete set null,
  quantity        numeric(8,2) not null,
  amount_kwd      numeric(8,3) not null,   -- KWD carries 3 decimals (fils)
  dispensed_at    timestamptz  not null default now(),
  created_at      timestamptz  not null default now()
);

create index if not exists dispenses_patient_idx      on dispenses (patient_id);
create index if not exists dispenses_prescription_idx on dispenses (prescription_id);

comment on table dispenses is
  'One row is one pharmacy handover: the quantity dispensed and the date, logged by a pharmacist.';


-- -----------------------------------------------------------------------------
-- doses
-- One row is one calendar slot: when one dose is due and what happened to it
-- (scheduled, taken, missed, rescheduled).
--
-- Rows are generated by generate_doses() in 0002. The unique constraint on
-- (prescription_id, due_at) is what makes that function safe to re-run.
-- -----------------------------------------------------------------------------
create table if not exists doses (
  id              uuid primary key default gen_random_uuid(),
  prescription_id uuid        not null references prescriptions (id) on delete cascade,
  patient_id      uuid        not null references profiles (id)      on delete cascade,
  due_at          timestamptz not null,
  status          dose_status not null default 'scheduled',
  taken_at        timestamptz,
  created_at      timestamptz not null default now(),
  constraint doses_one_slot_per_prescription unique (prescription_id, due_at)
);

create index if not exists doses_patient_due_idx on doses (patient_id, due_at);

comment on table doses is
  'One row is one calendar slot: when one dose is due and what happened to it.';


-- -----------------------------------------------------------------------------
-- interactions
-- One row is one pair of active ingredients that must not meet, with a severity.
--
-- Stands alone — no foreign keys. It is the lookup table check_interactions()
-- joins against. The pair is stored lowercase and alphabetically ordered
-- (ingredient_a < ingredient_b) so a lookup never has to try both directions.
-- -----------------------------------------------------------------------------
create table if not exists interactions (
  id            uuid primary key default gen_random_uuid(),
  ingredient_a  text                 not null,
  ingredient_b  text                 not null,
  severity      interaction_severity not null,
  note          text                 not null,
  created_at    timestamptz          not null default now(),
  constraint interactions_pair_ordered check (ingredient_a < ingredient_b),
  constraint interactions_pair_key     unique (ingredient_a, ingredient_b)
);

comment on table interactions is
  'One row is one pair of active ingredients that must not meet, with a severity.';


-- -----------------------------------------------------------------------------
-- automation_runs
-- One row is one agent job: what started it, when it started, its status, and
-- what came out.
--
-- Written by the n8n agent through log_run() (Task D1) using the service role.
-- Each patient reads only their own rows. This table is the evidence for the
-- MUST "every automated run leaves a row".
-- -----------------------------------------------------------------------------
create table if not exists automation_runs (
  id          uuid primary key default gen_random_uuid(),
  trigger     text        not null,   -- 'daily_checkin', 'photo_check', 'reorder_sweep'
  patient_id  uuid                 references profiles (id) on delete cascade,
  status      run_status  not null default 'started',
  input       jsonb,
  output      jsonb,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists automation_runs_patient_started_idx
  on automation_runs (patient_id, started_at desc);

comment on table automation_runs is
  'One row is one agent job: what started it, when it started, its status, and what came out.';


-- -----------------------------------------------------------------------------
-- reorder_requests
-- One row is one refill request: which prescription, when, its status, and
-- whether it is government or private.
--
-- This is the full-CRUD table for the judge (Task D5): a patient creates one,
-- reads their list, updates the note on a pending one, and withdraws it.
-- -----------------------------------------------------------------------------
create table if not exists reorder_requests (
  id              uuid primary key default gen_random_uuid(),
  prescription_id uuid           not null references prescriptions (id) on delete cascade,
  patient_id      uuid           not null references profiles (id)      on delete cascade,
  status          reorder_status not null default 'pending',
  source          care_source    not null,
  note            text,
  requested_at    timestamptz    not null default now(),
  decided_at      timestamptz,
  decided_by      uuid                    references profiles (id)      on delete set null,
  created_at      timestamptz    not null default now()
);

create index if not exists reorder_requests_patient_idx on reorder_requests (patient_id, requested_at desc);

comment on table reorder_requests is
  'One row is one refill request: which prescription, when, its status, and whether it is government or private.';

commit;

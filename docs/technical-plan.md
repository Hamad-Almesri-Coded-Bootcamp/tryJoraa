# TECHNICAL PLAN — Jur'ah

This is the **how**. `PRODUCT-DECISIONS.md` is the why and `CLAUDE.md` carries
the rules; where this file and `CLAUDE.md` disagree, `CLAUDE.md` wins and this
file is wrong. Every section is written so a lane can act on it without asking
another lane a question first.

**Nothing is built yet.** The repository today contains the contract files, the
diagrams, and one script. There is no `package.json`, no `src/`, no `supabase/`.
`PROMPT-0.md` creates them; Section 1 says what that means for Saturday.

---

## 1. Stack, and what Saturday starts from

| | |
|---|---|
| Framework | Next.js App Router, TypeScript, Tailwind |
| Data | Supabase — Postgres, Auth, RLS |
| Automation | n8n Cloud, four workflows |
| Hosting | Vercel |
| Runtime | Node 22, npm |

`npm run build`, `npm run verify:rls`, `npm run verify:ui` are the three
commands. The first two gate every commit and every merge.

**Saturday's first hour is Lane A alone.** Until the migration and
`src/types/db.ts` exist, Lanes B and C build against the stubs PROMPT 0 step 9
creates, not against the real schema. That is deliberate and it is the only
reason three people can start at the same time. See `docs/diagrams/build-order.html`.

---

## 2. The schema — one migration, ten tables

Shown in full because `CLAUDE.md` requires the SQL before it is applied. Lane A
owns `supabase/**`. Column names follow D24; `strength` is a numeric value plus a
unit enum, because `'500mg'` as text breaks "a number is a number".

### 2.1 Enums

```sql
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
```

`dose_status` distinguishes **`skipped`** (the patient chose to) from
**`missed`** (the time passed with no answer). The agent acts on `missed` only.
`rescheduled` records that a dose was moved, so the original time is not lost.

### 2.2 Tables

```sql
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
  -- core
  drug_name_generic        text not null,
  drug_name_brand          text,
  strength_value           numeric not null check (strength_value > 0),
  strength_unit            strength_unit not null,
  dose_per_administration  numeric not null check (dose_per_administration > 0),
  frequency_per_day        int not null check (frequency_per_day between 1 and 6),
  duration_days            int not null check (duration_days between 1 and 365),
  dosing_pattern           dosing_pattern not null default 'daily',
  start_date               date not null default current_date,
  -- secondary
  food_timing              text,
  route                    route_of_admin not null default 'oral',
  indication               text,
  notes                    text,
  -- pharmacist-entered (D24) — on this table, not a child table
  units_per_package        int check (units_per_package > 0),
  total_quantity_dispensed numeric check (total_quantity_dispensed > 0),
  dispense_date            date,
  brand_dispensed          text,
  -- provenance (D21)
  source                   rx_source not null default 'patient_entered',
  source_facility          text,
  source_sector            rx_sector,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- a doctor-authored row must name its doctor; an imported one must not have to
  constraint doctor_row_has_doctor
    check (source <> 'jurah_doctor' or doctor_id is not null)
);

-- one extraction-agent output awaiting the patient's acceptance (D26)
create table prescription_drafts (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references profiles(id) on delete cascade,
  source_image text,                            -- storage path
  extracted    jsonb not null,                  -- same field names as prescriptions
  confidence   jsonb,                           -- per-field, from the vision model
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- one scheduled dose of one prescription at one date and time
create table doses (
  id               uuid primary key default gen_random_uuid(),
  prescription_id  uuid not null references prescriptions(id) on delete cascade,
  scheduled_at     timestamptz not null,
  original_at      timestamptz,                 -- set when rescheduled; else null
  status           dose_status not null default 'due',
  answered_at      timestamptz,
  created_at       timestamptz not null default now()
);

-- one medicine's reference profile, every value carrying its justification
create table medications (
  id                   uuid primary key default gen_random_uuid(),
  ingredient           text not null unique,
  is_time_critical     boolean not null default false,
  catch_up_window_h    numeric,                 -- null = use the G2/G3 default
  min_gap_h            numeric,
  justification        jsonb not null,          -- { field: { value, source } }
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
  source          text not null,                -- the named citation, G4
  added_by        uuid references profiles(id), -- non-null when a doctor verified it in
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
  guardrail       text not null,                 -- 'G5', 'G7', …
  reason          text not null,                 -- plain language, D16
  acknowledged_by uuid references profiles(id),
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now()
);

-- one change to clinical data: who, what, before, after (D30). Append-only.
create table audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,                              -- null for system
  actor_role  audit_actor not null,
  run_id      uuid references runs(id) on delete set null,   -- set when an agent caused it
  patient_id  uuid not null references profiles(id) on delete cascade, -- the subject; RLS scopes on this
  table_name  text not null,
  row_id      uuid not null,
  action      audit_action not null,
  before      jsonb,
  after       jsonb
);
```

### 2.3 Indexes — every column a policy filters on

```sql
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
create index on medications     (ingredient);
create index on interactions    (ingredient_a);
create index on interactions    (ingredient_b);
create index on audit_log       (patient_id, at desc);
create index on audit_log       (table_name, row_id);
create index on audit_log       (run_id);
```

### 2.4 Ten one-sentence answers — BE-3

Rehearse these out loud Saturday. A judge points at a table and asks.

| Table | One row is… |
|---|---|
| `profiles` | one signed-up person, and whether they are a patient or a doctor |
| `doctor_patients` | one doctor's permission to see one patient |
| `prescriptions` | one medicine one patient is on, and which clinic issued it |
| `prescription_drafts` | one photographed prescription the patient has not yet confirmed |
| `doses` | one scheduled dose at one time, and whether it was taken |
| `medications` | one medicine's reference facts, and who verified them |
| `interactions` | one pair of medicines that must be kept hours apart, and the source saying so |
| `runs` | one press of an automation, and what came out |
| `alerts` | one thing the agent refused to do, and whether the doctor has seen it |
| `audit_log` | one change to somebody's medical data: who made it, when, and what it was before |

---

## 3. Row-level security

The highest-stakes part of the build. Every policy says `to authenticated` and
calls auth as `(select auth.uid())`. Every write policy has a `with check`.

### 3.1 The helper

```sql
create or replace function is_linked_doctor(p_patient uuid)
returns boolean
language sql stable security invoker
as $$
  select exists (
    select 1 from doctor_patients
    where doctor_id = (select auth.uid()) and patient_id = p_patient
  );
$$;
```

### 3.2 `prescriptions` — the rule everything else inherits

```sql
alter table prescriptions enable row level security;

create policy rx_select on prescriptions for select to authenticated
using ( patient_id = (select auth.uid()) or is_linked_doctor(patient_id) );

-- the patient may add rows that did not come from a Jur'ah doctor
create policy rx_insert_patient on prescriptions for insert to authenticated
with check ( patient_id = (select auth.uid()) and source <> 'jurah_doctor' );

-- a linked doctor may write a jurah_doctor row, and must name themselves
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
```

Note what this forbids, and check each against §4: B cannot insert with
`patient_id = A` (both insert policies pin the owner); B cannot claim
`source = 'jurah_doctor'` without being a linked doctor naming themselves; a
linked doctor cannot edit a row they did not author (`rx_update_doctor` uses
`doctor_id`, not the link).

### 3.3 The inheriting tables

```sql
alter table doses enable row level security;
create policy dose_select on doses for select to authenticated
using ( exists (select 1 from prescriptions p where p.id = prescription_id
                and (p.patient_id = (select auth.uid()) or is_linked_doctor(p.patient_id))) );
-- update: the patient marks taken/skipped or accepts a proposal (D15).
create policy dose_update on doses for update to authenticated
using      ( exists (select 1 from prescriptions p where p.id = prescription_id
                     and p.patient_id = (select auth.uid())) )
with check ( exists (select 1 from prescriptions p where p.id = prescription_id
                     and p.patient_id = (select auth.uid())) );
```

`runs` and `alerts` follow the same shape on `patient_id`, with alerts
additionally selectable by a linked doctor and acknowledgeable only by one.

`prescription_drafts` is **patient-only** — not even a linked doctor reads it.
It holds unverified model output about a person.

`doctor_patients` is selectable by the two people it names, insertable by the
doctor (`doctor_id = (select auth.uid())`).

`interactions` and `medications` are readable by every authenticated user.
Writes go only through the verification path: a doctor may set
`verification = 'verified'`, and inserting an `interactions` row requires
`added_by = (select auth.uid())` and the caller's `profiles.role = 'doctor'`.
Nobody may update a row that is already verified.

### 3.4 The depletion view — `security_invoker` or it leaks

```sql
create view depletion_forecast
with (security_invoker = true) as
select
  p.id as prescription_id,
  p.patient_id,
  p.dispense_date
    + ((p.total_quantity_dispensed
        / (p.dose_per_administration * p.frequency_per_day))::int) as runs_out_on
from prescriptions p
where p.dispense_date is not null
  and p.total_quantity_dispensed is not null;
```

A view runs as its **owner** unless `security_invoker` is set, which would hand
every authenticated user every patient's rows straight through RLS. It is
invisible until a second account looks, which is why `verify-rls.ts` probes it
like a table.

### 3.5 `audit_log` — read like a prescription, written only by the trigger

```sql
alter table audit_log enable row level security;

create policy audit_select on audit_log for select to authenticated
using ( patient_id = (select auth.uid()) or is_linked_doctor(patient_id) );
-- deliberately NO insert, update or delete policy. With RLS on and no policy,
-- authenticated users cannot write. Only the trigger function below can.

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
  -- the patient the row is about: direct column, or through the prescription
  if v_row ? 'patient_id' then
    v_patient := (v_row->>'patient_id')::uuid;
  elsif v_row ? 'prescription_id' then
    select patient_id into v_patient from prescriptions where id = (v_row->>'prescription_id')::uuid;
  end if;
  -- null when a dose is deleted by cascade from its prescription (the parent row is
  -- already gone): skip it — the prescription's own delete is audited with the
  -- patient in `before`, so nothing is lost. Reference tables use the trigger below.
  if v_patient is null then return null; end if;

  v_role := case
    when v_run is not null then 'agent'
    when v_actor is null   then 'system'
    else (select case role when 'doctor' then 'doctor' else 'patient' end from profiles where id = v_actor)
  end;

  insert into audit_log (actor_id, actor_role, run_id, patient_id, table_name, row_id, action, before, after)
  values (v_actor, v_role, v_run, v_patient, tg_table_name, (v_row->>'id')::uuid,
          lower(tg_op)::audit_action,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return null;
end $$;

-- one trigger per audited table (D30)
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
```

`medications` and `interactions` have no patient column, so a second trigger,
`audit_reference_row()`, decides the subject like this: **if the write happened
under a run** (`jurah.run_id` is set — the profiler drafting from n8n, where
`auth.uid()` is null), `patient_id` is that run's patient, so the patient sees
"a profile was drafted for Metformin" in their own history; **otherwise** it is
`auth.uid()`, the doctor who verified or added the row, who reads it back under
`patient_id = (select auth.uid())`. If both are null — the hand seed running as
the service role — the row is skipped; seeded reference rows are verified by
construction and are not agent output. Lane A writes it in the same migration.

`security definer` is what lets the trigger insert where no policy allows a
user to; `set search_path = public` is what stops that being abusable. The
schema has exactly **three** `security definer` functions and the reviewer
flags any other: `audit_row()`, `audit_reference_row()`, and
`handle_new_user()` — the signup trigger on `auth.users` in §5, which must be
`security definer` because the auth schema's owner cannot otherwise write to
`public.profiles` (the standard Supabase pattern).

When an agent's tool moves a dose, the n8n Code node calls the RPC in §7.3,
which runs `set_config('jurah.run_id', <run id>, true)` first, so the audit row
names the run. That is how BE-5 and the trail agree.

---

## 4. `verify-rls.ts` — four accounts, anon key only

The service role key appears **nowhere** in this file. The script signs in as
patient A with the anon key and inserts directly, which D25 permits, and it
carries an `assertNotPrivileged()` guard that refuses to run with a privileged
key. `seed-auth.ts` creates four throwaway accounts through the admin API — two
patients, one doctor linked to patient A, one doctor linked to nobody — and is
the only script that touches the key. `.env.example` carries the four variable
pairs.

The probes, each with the anon key:

1. B cannot select, update or delete any of A's rows — on `prescriptions`,
   `doses`, `runs`, `alerts`. *(exists today)*
2. B cannot insert a prescription with `patient_id = A`. *(exists today as the
   spoof probe)*
3. B cannot insert a row claiming `source = 'jurah_doctor'`.
4. The **unlinked** doctor reads nothing of A's, on every table.
5. The **linked** doctor reads A's prescriptions but cannot update one they did
   not author.
6. B reads nothing from `depletion_forecast`.
7. B reads none of A's `audit_log` rows, and **nobody** can insert, update or
   delete an audit row directly — A tries on their own trail and is refused.

Probes 3–7 are new. Probes 2, 3 and 5 are `with check` failures rather than
`using` failures, which is the hole `CLAUDE.md` names explicitly.

The `TABLES` block at the top of the file is rewritten to D24's column names
(`drug_name_generic`, `strength_value`, `strength_unit`,
`dose_per_administration`, `frequency_per_day`, `dosing_pattern`), and the
self-prescribed test row drops `doctor_id` and sets `source = 'patient_entered'`.

**When a probe fails, fix the policy. Never the assertion.**

---

## 5. Auth and roles

- **Patient** — self-signup at `/sign-up`: name, civil ID, email, password.
  A trigger on `auth.users` inserts the `profiles` row with `role = 'patient'`.
  BE-4 is a judge watching this work first try, so it has no optional steps.
- **Doctor** — provisioned by `seed-auth.ts` through the admin API. There is
  deliberately no doctor signup screen (D4).
- Routing — `profiles.role` decides whether `/sign-in` lands on `/dashboard` or
  `/doctor`. Checked server-side in the `(app)` layout, not in the client.
- Passwords are Supabase's. We never store, log or render one (SE-3).

---

## 6. The API layer — Lane C, `src/app/api/**`

```
POST /api/runs
  body   { kind: run_kind, prescriptionId?: uuid }
  1. read the session server-side; 401 if absent
  2. validate the body with Zod; 400 with a message if it fails
  3. insert a runs row: patient_id = session user, kind, status 'queued'
  4. POST the n8n PRODUCTION webhook with the shared secret as a header
  5. return { runId }  — immediately, do not await the workflow
```

The browser never calls n8n. `N8N_WEBHOOK_SECRET` and `N8N_WEBHOOK_URL` are
server-only and never `NEXT_PUBLIC_`. A URL containing `/webhook-test/` is a bug
— CI greps for it and the pre-commit hook warns on it.

**Secrets are read inside the handler**, never at module top level, so
`npm run build` needs no secret and CI carries none but the anon key.

**Every route is the future mobile contract (D31).** It accepts the Supabase
session as a cookie *or* an `Authorization: Bearer` token, takes JSON, returns
JSON, and is listed in `docs/api.md` with its body and response the day it is
built. A component never contains logic a native client would have to copy.

The front end polls `runs` by id through Supabase (RLS already scopes it) until
`status` is `done` or `failed`, and renders `result`. That is AU-2 and AU-6.

`docs/contracts/run-result.example.json` is the shape Lane B builds against
before Lane C's workflow exists. It carries `kind`, and either the rescheduled
doses with new times and the guardrail that allowed them, or the refusal with
its reason and the medicine it names.

---

## 7. n8n — four workflows

### 7.1 Topology

```
jurah-orchestrator          webhook (production) → AI Agent node
  ├─ tool: jurah-reschedule            sub-workflow
  ├─ tool: jurah-screen-interactions   sub-workflow
  └─ tool: jurah-profile-medication    sub-workflow
```

Sub-workflow Tools are what make this multi-agent rather than one chain (D22).
A fifth, `jurah-extract-prescription`, is the Tuesday stretch.

Workflows are created, updated and activated through the n8n **API** using
`N8N_API_KEY`, never by clicking in the canvas, and the production webhook URL
is read back from the activated workflow.

### 7.2 Where the numbers are computed — G11

Every guardrail evaluation is a **Code node**, not a prompt. The agent node
decides *which* sub-workflow to call; the sub-workflow's Code node runs G1–G8
against rows it has fetched and returns a verdict. No model output is trusted as
a time, a dose or an interaction.

### 7.3 The approved tools and their limits — AU-5

| Tool | May | May not |
|---|---|---|
| `reschedule_dose(dose_id, new_time)` | after G1–G8 pass in code, write a **proposal** to the run result; on the patient's accept, update `doses.scheduled_at` and set `original_at`, under the run id so the audit row names it | touch `prescriptions`, change medicine or amount, touch another patient, write `interactions` |
| `screen_interactions(patient_id)` | read the profile and `interactions`, return matching pairs | return a pair not in `interactions`, write anything |
| `draft_medication_profile(ingredient)` | insert `medications` with `verification = 'unverified'` and a justification per value | set `verified`, overwrite a verified row |
| `extract_prescription(image)` | insert one `prescription_drafts` row for the uploader | write `prescriptions`, guess an unread field, draft for another patient |

Each tool's write goes through a Postgres function that first runs
`set_config('jurah.run_id', $run, true)`, so every audited row it touches
carries the run (§3.5).

---

## 8. The deterministic layer

**Schedule generation lives in Postgres**, as a function called on prescription
insert. One implementation, callable from the app and from an n8n Code node
alike, rather than two that drift.

**Doses are pre-generated for the whole course**, not rolled forward lazily.
D8's "find today's missed doses" needs rows to exist before the patient presses
anything, and pre-generation makes the demo deterministic.

```sql
create or replace function generate_doses(p_prescription uuid) returns int ...
-- reads dosing_pattern, frequency_per_day, duration_days, start_date
-- daily         → frequency_per_day doses every day for duration_days
-- alternate_day → same, every second day
-- weekly        → once on the start weekday
-- as_needed     → no rows; the patient logs ad hoc
```

**The catch-up decision is a pure function** with one test case per guardrail:
G2 (≤2h passes), G3 (>2h, twice daily, next dose >4h away passes; four times
daily refuses), G5 (warfarin always refuses), G6 (anti-seizure 6h window), G7
(unverified profile refuses), G4 (interaction clash refuses last). G3's **4
hours** is the number AU-4 expects a rehearsal to change; the table in
`docs/agent-guardrails.md` records the old value and the date.

**Depletion** is the view in §3.4. **Audit** is the trigger in §3.5. No model
involved in either.

---

## 9. Front end — Lane B

```
src/app/layout.tsx                    root: dir/lang, the bilingual safety line
src/app/page.tsx                      /
src/app/(auth)/sign-in/page.tsx       /sign-in
src/app/(auth)/sign-up/page.tsx       /sign-up
src/app/(app)/dashboard/page.tsx      /dashboard          ← the only trigger
src/app/(app)/prescriptions/page.tsx  /prescriptions      ← source badge per row
src/app/(app)/prescriptions/[id]/page.tsx
src/app/(app)/prescriptions/add/page.tsx                  ← D21 lives or dies here
src/app/(app)/prescriptions/drafts/[id]/page.tsx          ← stretch
src/app/(app)/history/page.tsx                            ← the patient's audit trail, D30
src/app/(app)/doctor/page.tsx
src/app/(app)/doctor/patients/add/page.tsx
src/app/(app)/doctor/patients/[id]/page.tsx               ← full cross-clinic list + audit trail
src/app/(app)/doctor/prescriptions/new/page.tsx
src/app/(app)/doctor/alerts/page.tsx
src/app/(app)/doctor/medications/page.tsx
```

- **Bilingual.** Locale detected from the browser, falling back to Arabic (D10).
  `<html lang dir>` set in the root layout. Strings in two files under
  `src/i18n/`, no library needed at this size. `verify:ui` **pins the locale
  explicitly** or the evidence screenshots differ between machines.
- **The safety line is a component in the root layout**, so no screen can be
  shipped without it. Not a toast, not a one-page footer.
- **Mobile portrait first.** Nothing scrolls sideways at 390px, nothing under
  12px, every button thumb-sized.
- **Every form answers**: success, error, or loading. Validation with Zod
  (Lane A owns `src/lib/validation/**`) on both client and server — SE-5 is a
  judge pasting 5,000 characters into a field.
- **Components render and call.** Data comes from Supabase queries or
  `/api/**`; nothing is computed in a component that a native app would have to
  copy (D31).
- The doctor's patient lookup is **exact match only** on civil ID or email. No
  partial search, and an unmatched identifier returns the same response as a
  matched-but-not-yours one, or a doctor can enumerate the patient table.
- The audit trail renders as plain sentences — "Dr Al-Sabah changed the dose of
  Metformin from 1 to 2 tablets, Sunday 14:02" — never as raw JSON.

---

## 10. `verify-ui.ts` — Lane B

Playwright against `PUBLIC_SITE_URL`, never localhost. Pinned locale, 390×844.
Signs in as the patient, walks `/`, `/sign-in`, `/dashboard`, `/prescriptions`,
screenshots each into `docs/evidence/<date>/`, asserts no horizontal overflow,
then signs in as the second account and opens the first account's prescription
by id and asserts nothing comes back. `docs/evidence/**` is gitignored.

---

## 11. Environment, CI, deploy

`.env.example` lists all of it. Server-only and lead-only:
`SUPABASE_SERVICE_ROLE_KEY`, `N8N_API_KEY`, `N8N_WEBHOOK_SECRET`. None is ever
`NEXT_PUBLIC_`, in a client component, in a commit, or in a transcript.

`.github/workflows/ci.yml` runs the `gate` job: greps for the service role key in
client paths, for `NEXT_PUBLIC_SUPABASE_SERVICE`, and for `webhook-test`; then
`npm run build`; then `npm run verify:rls`. It carries the anon key and the four
test accounts and **no service role key** — neither step needs one (§4, §6).

`.githooks/pre-commit` blocks env files and JWT-shaped strings. It is enabled per
clone with `git config core.hooksPath .githooks` — SETUP.md step 3.

Branch protection on `main`: PR required, `gate` must pass, **zero** approving
reviews (the boss cannot approve its own PR), administrators not included so a
revert can go straight to `main` when a gate turns red.

---

## 12. The security audit — SE-6

SE-6 asks for an AI security audit of our own project and two fixes made because
of it. The boss runs it, twice: **Monday evening** on whatever is on `main`, and
**Wednesday before the freeze**.

- The tool is the gstack `/cso` skill, run from the boss session on `main`.
- The report goes to `docs/security-audit.md` (boss-only): date, the findings
  verbatim, and for each one the lane that owns the fix and the commit that made
  it. Findings become tasks in the owning lane's plan file, not fixes the boss
  makes itself.
- The two fixes named in `REVIEW-CHECKLIST.md` SE-6 are copied from that file
  once they are live.

The `audit_log` table (D30) is a separate thing: it is the product's own record
of changes to patient data, and it is what a judge is shown when they ask "how
would you know if something changed that should not have?"

---

## 13. Cross-lane handoffs — the only things that can stall the week

| # | Blocks | Owner → consumer | The handoff |
|---|---|---|---|
| 1 | everything | A → all | the migration, then the boss regenerates `src/types/db.ts` |
| 2 | Lane B's result panel | C → B | `docs/contracts/run-result.example.json`, final Sunday |
| 3 | Lane C's tools | A → C | the seed: 25 medicines, 25 interaction pairs, two facilities |
| 4 | `verify:rls` probes 6 and 7 | A → A | the depletion view and the audit trigger land **with** the migration |
| 5 | AU-2 | C → B | `POST /api/runs` returning `{ runId }` |
| 6 | `/history` and the doctor's trail | A → B | `audit_log` readable through RLS; B renders sentences from `before`/`after` |

Build order and the freeze are in `docs/diagrams/build-order.html`.

---

## 14. Decided here so nobody guesses Saturday

- Doses are **pre-generated** for the whole course on prescription insert.
- `doses.status` is `due | taken | skipped | missed | rescheduled`; the agent
  acts on `missed`, never on `skipped`.
- The schedule engine is a **Postgres function**, not TypeScript.
- `verify-rls.ts` uses the **anon key only** — no service role, not even setup.
- Column names follow **D24**, and `strength` splits into value + unit.
- Pharmacist fields sit **on `prescriptions`**, not in a child table. One
  dispense per prescription is enough for this week; a `dispenses` table is
  roadmap if refills land.
- `prescription_drafts` is readable by its patient and **nobody else**.
- `audit_log` is written by the **two audit trigger functions** and nothing
  else; it has select policies only. The only other `security definer` function
  is the signup trigger `handle_new_user()`.
- Every `/api/**` route takes cookie or bearer auth and is documented in
  `docs/api.md` as it is built.

## Still open

See the end of `PRODUCT-DECISIONS.md`. Nothing technical is open that a lane
cannot decide in its own plan file.

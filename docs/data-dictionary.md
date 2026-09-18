# Data dictionary — tryJoraa

Owner: Mohammad (Area 02 — back end & data, Area 03 — security)
Source of truth: `supabase/migrations/`. If this file and a migration disagree, the migration wins.

## One sentence per table

This is the team's rehearsed answer to the judge's question *"what is one row here?"*.
The same sentence is stored on the table itself with `COMMENT ON TABLE`, so it can be read
straight out of the database:

```sql
select relname as table, obj_description(oid) as one_row_is
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;
```

| Table | One row is |
| --- | --- |
| `profiles` | one signed-in person: their name, WhatsApp number, and role (patient, doctor, pharmacist) |
| `medications` | one drug: its trade name and the active ingredient inside it |
| `prescriptions` | one doctor's order: drug, strength, dose, times per day, duration, pattern, food timing, source and refill window |
| `dispenses` | one pharmacy handover: the quantity dispensed and the date, logged by a pharmacist |
| `doses` | one calendar slot: when one dose is due and what happened to it |
| `interactions` | one pair of active ingredients that must not meet, with a severity |
| `automation_runs` | one agent job: what started it, when it started, its status, and what came out |
| `reorder_requests` | one refill request: which prescription, when, its status, and whether it is government or private |

## How the tables connect

```
profiles ──┬──> prescriptions <──  medications
           │         │
           │         ├──> doses
           │         ├──> dispenses
           │         └──> reorder_requests
           │
           └──> automation_runs

interactions   (stands alone — a lookup table the interaction check joins against)
```

`prescription_id` is the joining column. When the judge asks you to point at the join on the
calendar screen, that is the one: `doses.prescription_id → prescriptions.id`.

`patient_id` is carried directly on `doses`, `dispenses` and `reorder_requests` even though it
could be reached through `prescription_id`. That is deliberate — the RLS policies in `0005`
compare it to `auth.uid()` without a join, and a policy that has to join is a policy someone
will eventually get wrong.

## Enums

Statuses are never free text.

| Enum | Values |
| --- | --- |
| `user_role` | `patient`, `doctor`, `pharmacist` |
| `dose_status` | `scheduled`, `taken`, `missed`, `rescheduled` |
| `rx_pattern` | `daily`, `alternate_days` |
| `run_status` | `started`, `success`, `failed` |
| `care_source` | `government`, `private` |
| `reorder_status` | `pending`, `approved`, `rejected` |
| `interaction_severity` | `avoid`, `caution` |

`interaction_severity` was not in the original plan's enum list. It is a status, and the type-audit
rule says statuses are enums, so leaving it as text would have failed our own audit.

## Columns worth explaining

| Column | Type | Why |
| --- | --- | --- |
| `profiles.id` | `uuid` → `auth.users(id)` | the profile *is* the auth user, not a copy of it; no separate key to drift |
| `medications.active_ingredient` | `text`, stored lowercase | the interaction check joins on this string; a stray capital is a missed safety warning |
| `prescriptions.dose_amount` | `numeric(6,2)` | half tablets are real; a float here would drift |
| `prescriptions.duration_days` | `smallint` | counts **calendar** days, not dosing days — a 10-day alternate-day course doses on 5 of them |
| `prescriptions.refill_allowed_until` | `date` | a refill window is a calendar day, not an instant; `create_reorder()` refuses requests past it |
| `dispenses.amount_kwd` | `numeric(8,3)` | the Kuwaiti dinar carries three decimals (fils); two would round money away |
| `doses.due_at` | `timestamptz` | slots are generated in Kuwait local time and stored as absolute instants |
| `interactions.ingredient_a/b` | `text`, ordered | `check (ingredient_a < ingredient_b)` canonicalises the pair, so a lookup never has to try both directions |
| `automation_runs.input/output` | `jsonb` | the agent's payload shape changes week to week; the columns around it do not |

## Type audit

Full audit lands with Task A5 in `0003_views.sql`. The rule being audited:

- dates and times are `timestamptz` (or `date` when it is genuinely a calendar day)
- money and quantities are `numeric`, never `float`, never `text`
- statuses are enums
- nothing important is left as free text

Run this to read the types out loud:

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

## Migration order

| File | Task | What it adds |
| --- | --- | --- |
| `0001_core_schema.sql` | A1 | enums + the eight tables |
| `0002_dose_engine.sql` | A2 | `generate_doses()` + the after-insert trigger |
| `0003_views.sql` | A5 | `v_calendar` + type audit *(not written yet)* |
| `0004_auth_profiles.sql` | B1 | `handle_new_user()` trigger + backfill |
| `0005_rls.sql` | C1 | row level security on every table *(not written yet)* |
| `0006_constraints.sql` | C5 | length, range and date-sanity checks *(not written yet)* |
| `0007_rpcs.sql` | D1–D4 | `log_run`, `check_interactions`, `reschedule_doses`, `create_reorder` *(not written yet)* |

# Migrations

Schema changes only happen through files in this folder. Never click-edit the Supabase
dashboard without saving the SQL here, or teammates drift.

Files are applied in filename order. Numbers are fixed by the capstone plan, so gaps are
expected while tasks are still open — `0003_views.sql` is reserved for Task A5 and must be
written before `0004` is pushed to a fresh database.

| File | Task | Status |
| --- | --- | --- |
| `0001_core_schema.sql` | A1 — enums + eight tables | written |
| `0002_dose_engine.sql` | A2 — `generate_doses()` + trigger | written |
| `0003_views.sql` | A5 — `v_calendar` + type audit | open |
| `0004_auth_profiles.sql` | B1 — `handle_new_user()` + backfill | written |
| `0005_rls.sql` | C1 — row level security | open |
| `0006_constraints.sql` | C5 — input checks | open |
| `0007_rpcs.sql` | D1–D4 — the four RPCs | open |

Apply them with `supabase db push`, or paste them into the SQL editor in order. Every file
is safe to re-run.

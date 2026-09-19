# Migrations

Schema changes only happen through files in this folder. Never click-edit the Supabase
dashboard without saving the SQL here, or teammates drift.

Files are applied in filename order. Numbers are fixed by the capstone plan, so gaps are
expected while tasks are still open.

| File | Task | Status |
| --- | --- | --- |
| `0001_core_schema.sql` | A1 — enums + eight tables | **applied** |
| `0002_dose_engine.sql` | A2 — `generate_doses()` + trigger | **applied** |
| `0003_views.sql` | A5 — `v_calendar` + type audit | open |
| `0004_auth_profiles.sql` | B1 — `handle_new_user()` + backfill | **applied** |
| `0005_rls.sql` | C1 — row level security | **applied** |
| `0006_constraints.sql` | C5 — input checks | open |
| `0007_rpcs.sql` | D1–D4 — the four RPCs | open |
| `0008_function_grants.sql` | C1/C6 — lock down SECURITY DEFINER functions | **applied** |

Project: `tryJoraa` (`yomsnirufwgkxasufdsr`), region ap-northeast-1.

Apply with `supabase db push --project-ref yomsnirufwgkxasufdsr`, or paste into the SQL
editor in order. Every file is safe to re-run.

After any schema change, check **Dashboard → Advisors → Security**. That linter found the
hole `0008` closes.

# Lane A — data & security

Owner A. Branch `a/data`. One task at a time, each with the command or screen
that proves it. `CLAUDE.md` → Plan → build → prove.

Ticked in `REVIEW-CHECKLIST.md` already: SE-1, SE-2, SE-3.
Open and owned by A: **SE-5**, SE-6, BE-1, BE-2, BE-4, BE-5 (with C).

---

## A1 — SE-5: every input checked before it is used · Sat 19 Sep

**The finding this starts from.** `handle_new_user()` copies
`raw_user_meta_data->>'full_name'` and `->>'civil_id'` straight into `profiles`,
and every `text` column in `20260919120000_init.sql` is unbounded. Zod guards the
sign-up *form*, but the form is not the only way in — the anon key is public, so
this runs from any browser console and creates the row:

```js
supabase.auth.signUp({
  email: 'x@example.com', password: 'hunter2hunter2',
  options: { data: { full_name: 'x'.repeat(5000), civil_id: 'x'.repeat(5000) } },
})
```

SE-5 says the check happens *before the value is used*, and the database is where
it is used. Client validation is the message; the constraint is the guarantee.

| # | Task | Serves | Proves it |
|---|---|---|---|
| A1.1 | `src/lib/validation/limits.ts` — one table of field limits, imported by Zod and mirrored in SQL so the two can never drift | SE-5 | `npm run build` |
| A1.2 | Migration `..._input_limits.sql` — `char_length` CHECKs on every user-writable text column across the ten tables, plus `civil_id ~ '^\d{12}$'` | SE-5 | migration applies; 5,000-char insert raises `check_violation` |
| A1.3 | Harden `handle_new_user()` — refuse over-long or malformed metadata instead of copying it | SE-5 | the console bypass above returns an error and creates no row |
| A1.4 | `src/lib/validation/prescriptions.ts` — the schema B's form imports, limits from A1.1 | SE-5, FE-3 | `npm run build`; handed to B |
| A1.5 | `verify-rls.ts` probe 8 — the same refusals asserted over PostgREST with the anon key, so SE-5 cannot silently regress | SE-5 | `npm run verify:rls` (needs the live project) |

| A1.6 | `supabase/config.toml` + `supabase/.gitignore` — the CLI had no project file, and `.temp/` was not ignored | SE-2, unblocks the repo↔Supabase link | `supabase db push` resolves without `--project-ref` once linked |

**Status.** A1.1–A1.6 written, `npm run build`, `npm run lint` and `tsc --noEmit`
all clean, PR #3 open. A1.2/A1.3 proved on a scratch project (8/8); probe 8 is
unrun here because `verify:rls` needs the live project's four test accounts.

### The moment access lands

Owner A is a **Developer** in the Supabase org and an **outside collaborator**
on GitHub, so neither the migration nor the repo link can be done from this
lane today. Ask is with the lead: Administrator on the Supabase org holding
`frvubflbpujwuhsxweue`, and org membership on GitHub.

Confirmed reachable and correct — the CLI resolves
`db.frvubflbpujwuhsxweue.supabase.co` and fails only on the password:

```bash
npx supabase db push --project-ref frvubflbpujwuhsxweue --dry-run   # expect ONE migration
npx supabase db push --project-ref frvubflbpujwuhsxweue
npm run verify:rls                                                   # expect eight probes
```

If the dry run also lists `20260919120000_init`, the migration history table on
that project is empty — whoever set it up did not use `db push`. Repair it
rather than re-running init:

```bash
npx supabase migration repair --project-ref frvubflbpujwuhsxweue --status applied 20260919120000
npx supabase migration repair --project-ref frvubflbpujwuhsxweue --status applied 20260919121000
```

**Done when:** the 5,000-character paste is refused with a message, the app does
not freeze, and no row is created — *and* the same paste sent straight to
Supabase with the anon key is refused by the database too.

**Needs from B:** the create/edit prescription form imports
`src/lib/validation/prescriptions.ts` rather than writing its own rules.

**Note on proving A1.2/A1.3.** The live database (`frvubflbpujwuhsxweue`) is the
lead's and this session cannot reach it. The migration is proved on a scratch
Supabase project by applying `init.sql` and then this migration to an empty
database and running the rejection cases there. The lead still has to apply it
to the real project — that is a handoff, not a tick.

---

## A2 — SE-6: AI security audit + two live fixes · Mon 21 Sep

Boss runs the `/cso` skill on `main` Monday evening and owns
`docs/security-audit.md`. Findings land here as lane tasks. A pre-pass over the
data layer produced three, two of them fixed and waiting on a merge:

| # | Finding | Severity | State |
|---|---|---|---|
| A2.1 | Unbounded text + unvalidated signup metadata — 5,000 chars reach `profiles` with the anon key, no form involved | High | Fixed, `20260919235500_input_limits.sql` |
| A2.2 | `generate_doses()` is re-runnable from `/rest/v1/rpc` — no uniqueness on `(prescription_id, scheduled_at)` | High | Fixed, `20260920010000_dose_uniqueness.sql` |
| A2.3 | `POST /api/runs` has no rate limit — a signed-in user can queue unlimited agent runs, each one a model call | Medium | Open, shared with C |

**A2.2 in detail.** `generate_doses` is SECURITY INVOKER and must stay
executable by `authenticated` — the insert trigger calls it in the user's own
session, so `20260919121000_revoke_function_execute.sql` is right to leave it
alone. But PostgREST publishes it, `doses` had no uniqueness, and the function
had no already-generated check. RLS never objects because the rows belong to
the caller.

Measured on a scratch project with a 365-day, 6-a-day prescription:

| | dose rows | duplicated slots |
|---|---|---|
| after the insert trigger | 2,190 | 0 |
| after five `rpc/generate_doses` calls | **13,140** | 2,190 |
| after the fix | 2,190 | 0 |

Re-running now returns 0. The dedupe keeps the row the patient actually
answered, not merely the oldest — verified: the contested slot's survivor was
the `taken` row.

**A2.3 is not mine alone.** The cooldown belongs next to whatever calls the
model. The database half — counting recent `runs` per patient — is here when C
is ready.

## A3 — BE-5: every run leaves a row · with C

`runs` row plus every `audit_log` row carrying its `run_id` (D30). Blocked on C's
workflow calling `/api/runs`.

## A5 — SHOULD tier, back end + security

Not tickable until all 28 MUSTs are green. Done now so they are not competing
with the floor on Wednesday.

### A5.1 — Correct column types · audit complete

Read every column in `20260919120000_init.sql` against the rule: times are
`timestamptz`, calendar days are `date`, quantities are `numeric`, statuses are
enums, nothing important left as free text.

**The schema passes.** Twelve enums, every timestamp `timestamptz`, every
quantity `numeric`, `start_date`/`dispense_date` correctly `date` rather than
`timestamptz` because a refill window is a calendar day and not an instant.

Three notes, in order of how likely a judge is to press on them:

| Column | Type | Verdict |
|---|---|---|
| `profiles.civil_id` | `text` | **Correct, and be ready to say why.** A civil ID is an identifier, not a number: it can carry a leading zero, and nobody does arithmetic on it. `numeric` would silently eat the zero. |
| `alerts.guardrail` | `text` | Candidate enum — guardrails are a closed set `G1`–`G11` in `docs/agent-guardrails.md`. Left as text because C may still renumber them this week; an enum change mid-week costs a migration. Deliberate, not missed. |
| `prescriptions.food_timing` | `text` | Free text, and rightly — it holds a bilingual instruction (`قبل الفطور بنصف ساعة · 30 min before breakfast`). Not a status, so not an enum. |

### A5.2 — Full CRUD on one table from the front end · policies ready, needs B

`prescriptions` is the table, restricted to rows the patient entered
themselves. All four policies already exist in `init.sql`:

| | Policy | Condition |
|---|---|---|
| C | `rx_insert_patient` | `patient_id = auth.uid() and source <> 'jurah_doctor'` |
| R | `rx_select` | `patient_id = auth.uid() or is_linked_doctor(patient_id)` |
| U | `rx_update_patient` | same as insert, on both `using` and `with check` |
| D | `rx_delete_patient` | same, `using` |

So a patient can create, read, edit and delete their **own** entered
prescriptions, and can never touch one a doctor wrote. Calls for B, importing
`src/lib/validation/prescriptions.ts` so the form and the database agree:

```ts
await supabase.from('prescriptions').insert(parsed.data).select('id').single()
await supabase.from('prescriptions').select('*').order('created_at', { ascending: false })
await supabase.from('prescriptions').update({ notes }).eq('id', id).select('id')
await supabase.from('prescriptions').delete().eq('id', id).select('id')
```

Deleting cascades to that prescription's `doses` and leaves a `delete` row in
`audit_log`. That is intended — say so if asked.

### A5.3 — A second linked table on a real screen · already true

`/dashboard` selects `doses` and joins `prescriptions` through
`prescription_id` in one query
(`dashboard/page.tsx:44`). When the judge asks you to point at the joining
column, that is it.

### A5.4 — Demo data looks real · reviewed, one gap

`seed.sql` is strong: Kuwaiti names, real medicines with real brands
(Euthyrox/levothyroxine, Ferro-Gradumet/ferrous sulfate), real facilities
(Mubarak Al-Kabeer Hospital, Dar Al Shifa), bilingual food timing, public and
private sectors, and dates computed relative to `today` so it never looks stale.

**Gap: there are no dinars, because there is no money column anywhere in the
schema.** The SHOULD names "Kuwaiti names, dinars, real dates". Adding a cost
column is a product decision, not a lane decision — it needs a `D<n>` in
`PRODUCT-DECISIONS.md` first. Raised, not actioned.

### A5.5 — The security page · written

`docs/security.md`: blast radius in one sentence, the three biggest threats each
with the action already taken, the pages that work signed out and why each is
safe, sign-out behaviour, and a 52-word privacy line.

Finding while writing it: back-button-after-sign-out is safe **only because**
Next sends `no-store` on dynamic routes by default — measured on the live URL,
not assumed. Nobody chose it. If any authenticated page is ever made static or
given a `revalidate`, that item breaks silently. Recorded in `security.md` §4.

## A4 — BE-1, BE-2, BE-4 · needs B's screens

Data survives refresh and a private window; the app reads from the database; a
new account starts empty. All three are proved through the UI, so they wait on B.

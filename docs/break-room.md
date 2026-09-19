# Break Room — attacking our own app

Owner A. The Night 7 tricks run against Jur'ah: the Inspector, the hidden field,
the guessed address.

The test a judge runs: *show what you tried and what the app did back. At least
one attempt found something and was fixed.* Three did.

**Where each attempt was run** is stated per row, because it matters. Some were
run against the live deployment; the ones that would have written rubbish into
the shared database were reproduced against a scratch Supabase project with the
same schema, and torn down afterwards.

---

## 1 · The Inspector — what does the browser already know?

**Tried.** Opened the deployed `/sign-in`, read every script the page loads, and
pulled the Supabase project URL and the anon key straight out of the bundle.
Run against the live site.

**What the app did back.** Handed them over, immediately. They are in the
JavaScript because they have to be.

**Verdict — not a finding, and worth being able to say why.** The anon key is
public by design; it identifies the project, it does not authorise anything. The
question is not whether someone can read it, but what it reaches. We checked:
signed in as a patient, the key returns that patient's rows and nothing else;
unauthenticated, it returns **zero rows on every table**, because `anon` has no
policy anywhere and `init.sql` ends with
`revoke all on all tables in schema public from anon`.

The thing that would have made this a finding is a service-role key in the
bundle. There is none, and `verify-rls.ts` carries an `assertNotPrivileged()`
guard so a privileged key cannot be quietly swapped in and make the isolation
test pass while proving nothing.

## 2 · The guessed address — can I reach a page by typing it?

**Tried.** Requested `/dashboard` and `/prescriptions` with no session. Run
against the live site.

**What the app did back.** A redirect, not a page. Both returned a 3xx to
`/sign-in`.

**Verdict — held.** The guard is server-side, in the `(app)` layout, which calls
`getUser()` before rendering. A client-side guard would have rendered the page
and hidden it afterwards, which means the data was already on the wire.

Also checked while there: the response carries
`private, no-cache, no-store, max-age=0, must-revalidate`, which is what stops
the back button serving a signed-out user their old dashboard out of the
back-forward cache. **That is a framework default, not a decision we made** —
recorded in `security.md` §4 so nobody removes it by adding caching.

## 3 · The hidden field — what if I send fields the form never shows?

**Tried.** `signUp()` accepts an arbitrary `options.data` object which becomes
`raw_user_meta_data`. Sent two things the form cannot: a `full_name` of 5,000
characters, and a `role` of `doctor`. Reproduced on a scratch project.

**What the app did back — FINDING, now fixed.**

- The 5,000-character name **was stored**. `handle_new_user()` copied the
  metadata straight into `profiles`, and every `text` column in the schema was
  unbounded. Zod guarded the form, and the form was never involved.
- The `role` was ignored — `handle_new_user()` hard-codes `'patient'` and never
  reads a role from metadata. That one was already right, and it is the single
  most important line in the function.

**Fix.** `20260919235500_input_limits.sql`: `char_length` CHECKs on every
user-writable text column, a `civil_id` format check, numeric ceilings, and
validation inside the trigger. Re-run afterwards: refused with a named message,
no row created, while a valid signup and an ordinary prescription still work.

## 4 · The published function — what else is exposed at /rest/v1/rpc?

**Tried.** PostgREST publishes every function in `public`. Listed them and
called `generate_doses` directly, as its owner would, several times over.
Reproduced on a scratch project.

**What the app did back — FINDING, now fixed.**

RLS never objected, correctly: the rows belong to the caller. But `doses` had no
uniqueness on `(prescription_id, scheduled_at)` and the function had no
already-generated check, so every call re-inserted the entire course. Measured
on a 365-day, six-a-day prescription:

| | dose rows |
|---|---|
| after the legitimate insert trigger | 2,190 |
| after five extra RPC calls | **13,140** |

Every insert also fires `audit_row()`, so `audit_log` grew in step. In a
medication app that is a calendar showing every dose six times.

**Fix.** `20260920010000_dose_uniqueness.sql` — the unique constraint the slot
always implied, a dedupe that keeps the dose the patient actually answered, and
`on conflict do nothing` so a re-run inserts nothing and reports 0. Not a
revoke: the insert trigger calls this function in the user's own session, so
revoking `EXECUTE` would have broken every new prescription.

## 5 · The expensive button — what if I just hold it down?

**Tried.** Inserted into `runs` ten times in a row as one patient, which is what
`/api/runs` does and what any signed-in user can do directly over PostgREST.
Reproduced on a scratch project.

**What the app did back — FINDING, now fixed.**

All ten were accepted. Each run is meant to call a model, so the ceiling on cost
was however fast someone can click.

**Fix.** `20260920020000_run_cooldown.sql` — five runs per patient per fifteen
minutes, enforced by a `before insert` trigger rather than in the route handler,
because a limit in the handler is bypassed by one `fetch()` to `/rest/v1/runs`.
Re-run: presses one to five accepted, press six returned

> You have started 5 automations in the last 15 minutes. Please wait about 15
> minute(s) before starting another.

`/api/runs` already forwards `error.message`, so that sentence reaches the user.

---

## What we would try next, with more time

- The doctor's patient lookup, for enumeration: does an unmatched civil ID
  answer differently from one that exists but is not yours? `technical-plan` §9
  says it must not; not yet tested end to end.
- Prompt injection into the agent — a prescription note that reads like an
  instruction. Blocked until C's workflow is live.
- The `jurah.run_id` setting the audit triggers read to decide an actor is the
  `agent`. If a client can set that GUC through PostgREST, it could forge the
  actor on its own audit rows. Worth an hour once the agent path exists.

# Security — the page you answer from

Owner A. Four things a judge asks and every one of us should be able to answer
without opening a laptop. Short on purpose; if you cannot say it from memory it
is too long.

---

## 1. Blast radius — one sentence

> Worst case, an attacker holding one patient's password reaches that patient's
> own prescriptions, doses, runs, alerts and audit trail — and nothing belonging
> to anyone else.

The longer version, if pushed:

- A **patient** account reads only rows where `patient_id = auth.uid()`.
- A **doctor** account additionally reads the patients they are linked to
  through `doctor_patients`, and can only edit prescriptions they authored
  themselves (`rx_update_doctor` keys on `doctor_id`, not on the link).
- **`anon`** — the key that ships inside the browser — has no policy on any
  table, and `init.sql` ends with
  `revoke all on all tables in schema public from anon`. A stranger with our
  public key reads nothing.
- The only key that bypasses row level security is the **service role**, which
  exists in n8n's credential store and the lead's `.env.local`. It is in no
  commit, no CI secret and no client bundle.

What an attacker does **not** get: another patient's anything, the ability to
write themselves a prescription from a doctor, or the ability to edit the audit
trail — `audit_log` has no insert, update or delete policy, and those privileges
are revoked outright.

---

## 2. The three biggest threats, and what is already done about each

| # | Threat | What we did |
|---|---|---|
| 1 | **Someone pastes another account's record id into the address bar.** The oldest trick and the one the judge will actually try. | RLS on all ten tables, every policy `to authenticated` with an explicit `with check` on writes. Proved by `npm run verify:rls` — eight probes, four accounts, anon key only, and the script refuses to run if handed a privileged key. It gates every merge. |
| 2 | **A key reaches the repository.** Rotating is two minutes; explaining it to a judge costs the demo. | `.env*` gitignored with a committed `.env.example` of names only; a pre-commit hook blocks the pattern; `verify-rls.ts` carries `assertNotPrivileged()` so the service role cannot be smuggled in as a test key; CI never receives the service role. The judge searches history, so the hook matters more than the current tree. |
| 3 | **Hostile or oversized input.** Five thousand characters into a field, or the same write repeated a thousand times. | Zod on both client and server, and `char_length` CHECKs in Postgres so the guarantee survives the form being bypassed with the public anon key. `generate_doses` is idempotent, so an RPC called in a loop inserts nothing the second time. |

Threats 1 and 3 both have the same shape and it is worth saying out loud: **the
form is the message, the database is the guarantee.** Anything only enforced in
the browser is not enforced.

---

## 3. Pages that work signed out, and why each one is safe

| Page | Signed out | Why that is safe |
|---|---|---|
| `/` | Public | Explains what Jur'ah is. No patient data of any kind on it. SH-1 requires it be reachable without a login wall. |
| `/sign-in` | Public | A form. Wrong credentials return the same message as an unknown account, so it cannot be used to discover who is registered. |
| `/sign-up` | Public | Creates **patients only** — the role is hard-coded in `handle_new_user()` and never read from signup metadata, so nobody can register themselves as a doctor. |

Everything under `(app)` — `/dashboard`, `/prescriptions`, `/prescriptions/[id]`,
`/doctor` — calls `getUser()` server-side in the layout and redirects to
`/sign-in` when there is no session. Verified against the live URL: both routes
return a redirect, not a page, to a signed-out request.

The route guard is **server-side, not a client redirect**. A client-side guard
renders the page first and hides it afterwards, which means the data was already
on the wire.

---

## 4. Signing out really signs out

`POST /auth/sign-out` calls `supabase.auth.signOut()` on the server and 303s to
`/sign-in`. It is POST-only, so no prefetch or stray link can log anyone out.

Back-button behaviour is the part people get wrong. Every authenticated route is
dynamically rendered, and Next sends
`private, no-cache, no-store, max-age=0, must-revalidate` on those responses —
measured on the live URL, not assumed. `no-store` is what stops Chrome serving
the old dashboard out of the back-forward cache.

**Note for whoever touches caching next:** that header is a framework default,
not a decision anyone made here. If a page is ever made static or given a
`revalidate`, the back button starts showing a signed-out user their own
dashboard, and this item silently breaks. Re-measure it after any caching change.

---

## 5. A privacy line, under sixty words

> Jur'ah is a student prototype. Every record here is sample data. What you
> enter is stored in our database, visible only to you and to a doctor you are
> linked with, and is never sold or shared. Jur'ah does not give medical advice —
> always follow your doctor and your pharmacist.

(52 words.)

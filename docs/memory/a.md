# Lane A memory

One dated line per decision a later session or a teammate would otherwise guess at.
Append only. Never edit someone else's.

- 2026-09-20 — `duration_days` counts **calendar** days, not dosing days. A 10-day alternate-day course doses on 5 of them. Both readings are defensible; this is the one the schedule engine implements.
- 2026-09-20 — `civil_id` is `text`, never numeric: a civil ID can carry a leading zero and nothing does arithmetic on it.
- 2026-09-20 — Rejected a `civil_id_available()` RPC for friendlier signup errors. It would answer for anyone holding the anon key, which is an enumeration oracle over who is registered — the same thing `technical-plan` §9 forbids for the doctor's patient lookup.
- 2026-09-20 — De-duplicating doses keeps the row the patient **answered**, not the oldest. A duplicate marked `taken` carries information; its untouched twin does not.
- 2026-09-20 — `enforce_run_cooldown()` is `security invoker`, deliberately. As `definer` it was a forbidden fourth definer function AND a cross-account oracle: a BEFORE ROW trigger fires before the RLS `WITH CHECK`, so B inserting with A's `patient_id` could read A's run count off which error came back.
- 2026-09-20 — The cooldown uses `current_user = 'service_role'`, not `auth.role()`. `auth.role()` is deprecated and absent from some projects; if it fails to resolve the trigger raises 42883 on every `runs` insert and takes AU-1, AU-2, AU-6 and BE-5 down at once.
- 2026-09-20 — `verify-rls.ts` reuses A's most recent `runs` row when an insert is refused. `runs` has no delete policy by design, so the script cannot clean up after itself, and the cooldown would otherwise hard-exit the merge gate on the sixth run inside fifteen minutes.
- 2026-09-20 — Back-button-after-signout is safe only because Next sends `no-store` on dynamic routes by default. Nobody chose it. Making any authenticated page static, or adding `revalidate`, breaks that SHOULD silently.
- 2026-09-20 — Email confirmation stays ON; the team treats it as a security control. The signup failure is `SignUpForm` calling `signInWithPassword()` before the address is confirmed, not the setting.

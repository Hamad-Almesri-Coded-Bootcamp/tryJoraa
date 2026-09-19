# Lane B plan — front end, branch `b/ui`

Owner B. Every task: one line, the checklist items and decisions it serves, the
proof, the day, what it needs from another lane. Worked in order by `/work`.
Design source: `src/styles/README.md` (the import) and `src/styles/tokens.css`.
Rules win over the board; every collision is a line under Deviations.

Days: Sat 19 · Sun 20 · Mon 21 · Tue 22 · Wed 23 (freeze 22:00).

## Tasks

1. **Foundation** — `tokens.css` mapped into `@theme` in `globals.css`; IBM Plex Sans + IBM Plex Sans Arabic through `next/font`; base components from the canon (`AppBar`, `TabBar`, `SafetyLine`, `SectionLabel`, `Button`, `Field`, `ChipGroup`, `StatusPill`, `SourceBadge`, `EmptyState`, `Spinner`); the app shell in both directions; every `slate-*`/`emerald-*`/`amber-*` utility removed. Serves FE-4, SH-1, D10. Proof: `/` and `/sign-in` screenshots at 390px in ar and en; `grep -rn '#[0-9A-Fa-f]\{6\}' src --include=*.tsx --include=*.css | grep -v tokens.css` is empty. Day: Sat 19. Needs: nothing. `status: DONE` 19 Sep — build green, hex/palette/direction greps empty, `/` and `/sign-in` shots ar+en in docs/evidence/2026-09-19.
2. **Four checklist screens restyled** — `/`, `/sign-in`, `/sign-up`, `/dashboard`, `/prescriptions` from artboards 1–5 with real seeded rows; existing queries and form state machines kept; source badge on every dose and prescription; the sign-in button label follows the board (the e2e matcher changes in the same commit). Serves FE-1, FE-2, FE-4, SH-1, D19, D29. Proof: `verify:ui` screenshots of all four in ar and en. Day: Sat 19. Needs: nothing. `status: DONE` 19 Sep — all four (plus /sign-up) restyled from artboards 1–5; verify:ui 9/9 against the local build (lane evidence).
3. **verify:ui extended** — click-through `/` → sign in → `/dashboard` → `/prescriptions` by real links, back twice, no error or blank page; every built route screenshotted at 390×844 in ar and en; `scrollWidth ≤ 390` and no computed font under 12px on every shot; console collected with no mixed-content warning or uncaught error; cross-account probe kept verbatim; `/doctor/**` walked as `RLS_TEST_DOCTOR_LINKED`. Serves FE-2, FE-4, SE-4, SE-1. Proof: `npm run verify:ui` exit 0 and the evidence folder. Day: Sat 19. Needs: **a way to run the gate against this branch before merge** (see Workflow proposals). `status: DONE` 19 Sep — spec extended (click-through + back twice, ar+en shots of every built route, ≤390 scrollWidth, ≥12px, console, probe kept); 9/9 locally; the production run is the boss's.
4. **Dashboard interactions and the result panel** — Mark taken / Skip writes `doses.status` and `answered_at` as the user through the existing `dose_update` policy (enum column, button, no typed field); `RunStatus` shows queued → running → done or failed with the reason; `ProposalCard` per proposal with Accept and Not now; `RefusalCard` in plain words; the PROVISIONAL JSON block removed. Serves FE-3, FE-5, AU-2, AU-6, D15, D16. Proof: one real press on the live URL with the status changing on screen; one Mark taken that survives a refresh. Day: Sun 20. Needs: Lane C run-result contract final; the accept-a-proposal endpoint (Accept renders disabled with a "coming from Lane C" *dependency note in the PR*, never a dead button — until it lands the card shows the proposal without an Accept control). `status: DONE` 19 Sep (Accept pending the endpoint) — Mark taken press survives reload (e2e/proof-forms.spec.ts); RunStatus/ProposalCard/RefusalCard render the contract; ProposalCard offers Not now and says why Accept is not yet available.
5. **`/prescriptions/add`** — the aggregation point, artboard 7, every field in §2.2 the patient can know (generic, brand, strength value + unit, dose, frequency, duration, pattern, start date, food timing, route, indication, notes, units per package, quantity dispensed, dispense date, brand dispensed, facility, sector); `source` fixed to `patient_entered` server-side; Zod on client and server; loading / success / error. Serves FE-3, SE-5, D21, D24. Proof: a good entry lands in `/prescriptions` with its badge; an empty one and a 5,000-character one are refused with a message and no row exists (query as the user). Day: Sun 20. Needs: **the fork below**, Lane A Zod schema. `status: DONE` 19 Sep — empty → "Generic name: This field is required.", 5,000 chars → "Generic name: Too long.", no row either time; a good entry lands with its badge (e2e/proof-forms.spec.ts output in PR #2).
6. **`/prescriptions/[id]`** — artboard 6: strength and frequency card, source badge, `WeekDots` for the past seven days from `doses`, the dose list kept, `RunOutCard` from `depletion_forecast.runs_out_on` when a row exists, not-found state kept. Serves BE-2, D28, D29. Proof: change `total_quantity_dispensed` in the dashboard, refresh, the run-out date moves; screenshots ar/en. Day: Mon 21. Needs: nothing. `status: DONE` 19 Sep — detail, week dots, run-out card from depletion_forecast, dose list; ar+en shots.
7. **Doctor: `/doctor`, `/doctor/patients/add`, `/doctor/patients/[id]`** — artboards 8–10: patient list with open-alert count from `alerts`; add by civil ID or email, exact match, one identical answer for no-match and not-yours; the pitch screen with the full cross-clinic list, `FlagCard` from G4 `alerts` rows, `WeekDots` over all of that patient's doses, and that patient's audit trail as sentences; `doctor.stub` removed from both dictionaries. Serves D5, D7, D21, D30. Proof: sign in as `RLS_TEST_DOCTOR_LINKED`, open A's page, list and trail render; a wrong civil ID and an unlinked real one show the same text. Day: Mon 21. Needs: Lane A exact-match RPC; Lane A Zod add-patient schema; a G4 alert row for Fahad (Lane A seed or Lane C screening run). `status: DONE` 19 Sep (RPC pending Lane A) — /doctor, /doctor/patients/add (same no-match text for every failure), /doctor/patients/[id] with list, week, flag cards from alerts, audit trail; shots as the linked doctor.
8. **Doctor: `/doctor/prescriptions/new`, `/doctor/alerts`, `/doctor/medications`** — artboards 11–13 under the D29 paths: write a prescription for a linked patient (`source` = `jurah_doctor`, `doctor_id` = session, Zod both sides); alerts list with Acknowledge writing `acknowledged_by/at` through the column grant, acknowledged rows dimmed, `alerts.guardrail` shown only here; medications verify queue with every drafted value beside its `justification`, Approve / Correct. Serves D5, D17, AU-6, FE-3. Proof: a prescription written as the linked doctor appears on A's `/prescriptions` with the Jur'ah-doctor badge; an alert acknowledged stays acknowledged after refresh. Day: Tue 22. Needs: the fork; Lane A Zod schemas for new-prescription, verify, acknowledge. `status: DONE` 19 Sep — /doctor/prescriptions/new, /doctor/alerts (inline detail, acknowledge through the column grant), /doctor/medications (values beside justification, approve/correct); shots ar+en.
9. **`/history`** — the patient's `audit_log` as plain sentences from `table_name/action/before/after`, never JSON; `History` tab in the patient tab bar; empty state. Serves D30. Proof: mark a dose taken, open `/history`, the sentence is there with the time. Day: Tue 22. Needs: nothing (`audit_select` is in the migration). `status: DONE` 19 Sep — audit sentences from before/after, History tab, empty state; shots ar+en.
10. **README.md** per SH-3 — three lines, three names with their lanes, live URL, how to run. Serves SH-3. Proof: the repo front page. Day: Tue 22. Needs: the two teammates' names from the lead. `status: DONE` 19 Sep — live URL filled in; the two teammates' names are still placeholders until the lead gives them.
11. **STRETCH `/prescriptions/drafts/[id]`** — each extracted field beside the image with its confidence, correct, accept into `prescriptions`. Serves D26. Proof: a seeded draft accepted appears in `/prescriptions` as `extracted`. Day: Sat 19 (the lead confirmed "the whole front end" on 19 Sep). Needs: Lane C extraction writing `prescription_drafts` (and the storage bucket for `source_image`; the page shows the image when the path is a URL). `status: DONE` 19 Sep — route, accept (source `extracted`, draft stamped), discard, entry section on /prescriptions; verified with a hand-inserted draft as RLS_TEST_A, then removed.

12. **Tablet and desktop layouts** from the board's "Responsive system" section — ≥768 links in the app bar (done in task 1), two-column grids; ≥1024 dashboard two-pane (list · Check + results), `/prescriptions` table spread across facilities, `/doctor` patient table (patient, civil ID, medicines, last activity, open alerts — all from rows), `/prescriptions/[id]` two panes, forms in a 560px column. Serves the SHOULD "one design across screens" (FE-4 is judged and proven at 390px only). Proof: screenshots at 768 and 1440 in ar and en, no horizontal scroll. Day: Sat 19. Needs: nothing. `status: DONE` 19 Sep — 28 screens at 768/1440 in docs/evidence/2026-09-19/desktop, scrollWidth equal to the viewport on every one.

Wed 23: Phase 3 integration walk on the public URL, Phase 4 auditors, fix wave.
Nothing new after 22:00.

## Dependencies on other lanes

- **Lane A — Zod schemas in `src/lib/validation/`** (the playbook's Lane A prompt), fields per `docs/technical-plan.md` §2.2:
  - `prescriptionAddSchema`: `drug_name_generic` (1–120), `drug_name_brand?`, `strength_value` (>0), `strength_unit` (enum), `dose_per_administration` (>0), `frequency_per_day` (1–6), `duration_days` (1–365), `dosing_pattern` (enum), `start_date`, `food_timing?`, `route` (enum), `indication?`, `notes?` (≤500), `units_per_package?`, `total_quantity_dispensed?`, `dispense_date?`, `brand_dispensed?`, `source_facility` (1–120), `source_sector` (enum). Every text field capped so 5,000 characters is refused (SE-5).
  - `doctorAddPatientSchema`: one of `civil_id` (`^\d{12}$`) or `email`.
  - `doctorPrescriptionSchema`: the core fields above plus `patient_id` (uuid); no `source`/`doctor_id` from the client.
  - `medicationVerifySchema`: `id`, `verification`, optional corrected `is_time_critical`, `catch_up_window_h`, `min_gap_h`.
  - `alertAcknowledgeSchema`: `id`.
- **Lane A — exact-match patient lookup RPC** (`find_patient_exact(identifier text) returns uuid`), security invoker, returning null for both "no such patient" and "not linkable", so `/doctor/patients/add` never reveals whether a civil ID exists (D7). `profiles` RLS does not let a doctor read arbitrary rows, and `dp_insert` needs the patient's id.
- **Lane A or C — a G4 interaction alert for Fahad** in the seed or produced by the screening run, so the pitch screen's flag card has a row to render. It is never computed in a component.
- **Lane A — depletion "days left"** if the lead wants the board's "14 days left": a `days_left` column on `depletion_forecast`. Until then the card shows the date only.
- **Lane C — `docs/contracts/run-result.example.json` final (Sunday)** and `POST /api/runs` calling the production webhook.
- **Lane C or A — the accept-a-proposal endpoint.** Accepting must run through a run-scoped Postgres function that sets `jurah.run_id` so the audit row names the run (D30, BE-5). Today nothing sets it — `audit_row()` reads `current_setting('jurah.run_id', true)` and no function or route sets it — so this is a hard dependency, not a preference. Lane B never updates `doses.scheduled_at`.
- **Lane A — `find_patient_exact` must be `security definer`** (the reviewer confirmed what the profile policy implies: a security-invoker lookup can never see an unlinked patient, so the RPC would always return null). That makes it a fourth definer function beyond the three in technical plan §3.5 — a boss decision to record before Lane A writes it. It must return the same null for "no such patient" and "already linked to you", and only a uuid, never a row.
- **Lane A — `doses.answered_at` should be set by the database** (a default or trigger) rather than the browser clock that `DoseCard` sends today; until then the client sends `new Date()`. Also a check constraint `catch_up_window_h >= 0` and `min_gap_h >= 0` on `medications`; the action bounds them at 0–168 h meanwhile.
- **Lane A — an atomic `accept_draft(draft_id uuid, corrected jsonb)` function** (security invoker): inserts the `prescriptions` row with source `extracted` and stamps `prescription_drafts.accepted_at` in one transaction. Today `/prescriptions/drafts/[id]` does the two writes in sequence, so a failure between them could leave a prescription with the draft still open (the reviewer's finding). The page switches to `rpc('accept_draft', …)` the day it lands.
- **Lane A — `verify-rls.ts` leaves RLS_TEST_A's `profiles.full_name` set to a 5,000-character string** after its SE-5 probe, and a long trail of probe rows. The UI now wraps and clips, but the gate's screenshots of the doctor screens show that name. The probe should restore the profile it mutates (and the seed's demo accounts must never be used for it).
- **Lane A — `audit_log` readable through RLS**: met by `audit_select` in `20260919120000_init.sql`. Nothing further unless the policy changes.

## The fork — where do form writes live? (lead decides)

D31 says every operation a native client needs is a route under `src/app/api/**`
(Lane C). Adding a prescription is exactly that. Today: no Lane C CRUD route
exists; sign-up writes through the Supabase client in `SignUpForm.tsx`; the
playbook's Sunday row has B building `/prescriptions/add` with no route named.

- **(a) Lane C provides** `POST /api/prescriptions`, `POST /api/doctor/patients`,
  `POST /api/doctor/prescriptions`, `PATCH /api/alerts/[id]`,
  `PATCH /api/medications/[id]`. Lane B builds every form against those
  contracts and tasks 5, 8 and 11 are blocked until they land.
- **(b) The lead records a new D-number** allowing a server action colocated
  with its page for a validated single-table write made as the signed-in user
  through RLS. Tasks 5 and 8 are unblocked on Sunday; a native client later gets
  the routes when Lane C writes them.

Under both branches the doctor exact-match RPC is Lane A's, and Mark taken /
Skip (task 4) is exempt: a button, an enum column, RLS-scoped, no typed field.

**Working assumption (19 Sep, after the lead said "go ahead, all screens"):** the
forms are built under **(b)** — a `'use server'` action colocated with each page,
Zod on both sides, the write made as the signed-in user through RLS — so every
screen exists on Thursday. Switching a form to **(a)** is one function: replace
the action call with a fetch to Lane C's route. The Zod schemas are colocated
(`schema.ts` beside the page) until Lane A ships them in `src/lib/validation`;
then the page imports Lane A's and the colocated file is deleted. The lead has
not yet chosen; this is written here so nobody guesses.

## Deviations from the wireframe

One line each: artboard · what differs · why.

- All · every 9–11.5px value renders at 12px, every 12–12.5px at 13px (table in `src/styles/README.md`) · CLAUDE.md FE-4, and the board's own responsive note.
- All · 36px ✓/✗ squares and 40px card buttons render at 44px · FE-4, and the board's own note.
- All · the safety line carries the full bilingual text from `src/i18n`, both languages, on every screen; the board shows one truncated language · CLAUDE.md Product rules.
- All · people, medicines and facilities are the seed's (Fahad Al-Kandari, Mariam Al-Rashidi, Yousef Al-Enezi, Dr Noura Al-Sabah), not the board's (Fatimah Al-Otaibi, Abdulaziz Al-Rashidi) · BE-2, data comes from the database.
- 4a/4d · every dose card carries a source badge; the board's phone dose cards have none · D29 "source badge per dose".
- 4a · "Not now" and "Got it" dismiss the card in component state and are recorded as such here so they are never read as dead buttons · CLAUDE.md "never a button that does nothing".
- 4a · the refusal card shows `reason_ar/reason_en` only; no guardrail code · D16.
- 5a · the populated list gains an "Add prescription" button; the board only has it on the empty state · D21, FE-1.
- Patient tab bar · gains **History**; the board has no entry to `/history` · D29, D30.
- 2 · sign-in field is email, not "Civil ID or email" · auth is Supabase email + password; civil ID is a profile column.
- 2 · sign-in button reads "Sign in / تسجيل الدخول" (board) instead of "Continue / متابعة"; the e2e matcher changes in the same commit · fidelity.
- 6 · run-out card shows `runs_out_on` from `depletion_forecast` only; "14 days left" and "30 tablets per pack" are not computed in the component · D23, D31.
- 10 · the interaction flag renders G4 rows from `alerts`; it is not a component join of `prescriptions` × `interactions` · D23, CLAUDE.md "no agent asserts an interaction not in the table" applies to components too.
- 10 · the audit-trail section has no artboard and is built in the card idiom as sentences · D29, D30.
- 8a/10/12b · "Alerts 3", "1 flag", "Guardrail #7", "14 published guardrails", "Published 1 Sep 2026" are not reproduced; counts come from `alerts` rows and the code shown is `alerts.guardrail` (G1–G11) · BE-2, hardcoded data forbidden.
- 11 · `/doctor/prescribe` is built at `/doctor/prescriptions/new` · D29.
- 13 · `/doctor/drafted` is built at `/doctor/medications`, tab label "Medications" · D29, D17.
- 12b · `/doctor/alerts/[id]` has no D29 route; **not built as a route**. Proposed: an expandable detail on `/doctor/alerts` showing `alerts.guardrail` and `reason` (keeps "guardrail codes only on /doctor/alerts"). **Lead decides**; adding a route is a scope change.
- `Jurah Website.dc.html` · the desktop marketing sections (problem cards, features, "see it in action", CTA band) are not built; `/` follows artboard 1 plus its 1440 hero split. **Lead decides** whether the website board is in scope.
- — · `/history` and `/prescriptions/drafts/[id]` have no artboard; built in the design system's idiom from the canon · D29.
- Legend · `#EAEFF4` appears only inside the "no drawing" placeholder on 4c and is not a token.

## Workflow proposals

- **verify:ui cannot run against this branch before merge.** `playwright.config.ts` targets `PUBLIC_SITE_URL` (production `main`) and refuses a non-https URL; boss memory says preview deployments sit behind Vercel Authentication. So the /work loop's "verify:ui green, then commit" step is impossible for a lane on an unmerged branch — the gate can only prove `main`. Blocked task: 3 and every task after it. Options for the lead: (1) a Vercel protection-bypass secret for previews (a credential I do not have and will not invent), or (2) sanction a `VERIFY_UI_TARGET` opt-in env var that lets a lane run the same spec against `http://localhost:3000` **for lane evidence only**, with the boss's production run staying the gate. Both touch a gate, so neither is done silently.
- **Commit identity.** This session runs on the lead's machine as `Hamad-Almesri-Coded-Bootcamp`; CLAUDE.md says lane commits carry the lane owner's name. Lane B work committed here will be authored by the lead unless Owner B's machine takes over or the lead says otherwise.

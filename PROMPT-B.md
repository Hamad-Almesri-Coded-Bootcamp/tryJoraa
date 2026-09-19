# PROMPT B — the front-end master prompt

Owner B pastes the block below into a fresh Claude Code session on `b/ui`,
once, after running `/design-login` so the `claude_design` MCP is connected.
It is current with `PRODUCT-DECISIONS.md` D1–D31, `docs/technical-plan.md`
§9–10 and the Claude Design project `ee786794-f18a-437e-bd4f-e43bf1c0f30b`.
If any of those change before it is run, change this file in place.

The session will stop twice for a human: after Phase 0 if the import fails,
and after Phase 1 to approve `.plans/b.md` and answer the one fork it names.

```
BUILD: Jur'ah front end — every screen, from the Claude Design wireframe, inside Lane B

0. IMPORT THE DESIGN FIRST — nothing else starts until this is done

Use the claude_design MCP (https://api.anthropic.com/v1/design/mcp, auth via
/design-login) to import this project:
https://claude.ai/design/p/ee786794-f18a-437e-bd4f-e43bf1c0f30b?file=Jurah+Wireframe.dc.html

Focus on `Jurah Wireframe.dc.html` (the whole project is readable). Also read
every file the selection imports — the design system lives there: look for
`_ds/**/styles.css`, `tokens/*.css`, `*_bundle.js`, `support.js`.
Implement: `Jurah Wireframe.dc.html`.

If /design-login fails or the import returns nothing, stop and tell me. Never
build from the current stub styling or from memory of what a medication app
looks like.

Two sources of truth, in this order:
1. CLAUDE.md, PRODUCT-DECISIONS.md D29, docs/technical-plan.md §9–10 — what
   every screen must do and must never do.
2. The imported wireframe and its design system — what every screen looks
   like. Every colour, radius, spacing value, type step and component
   structure in the build traces to a token or a class in the import. No
   hardcoded hex, no magic pixel value.

Where they collide, the rules win and you log the collision (section 5).
Collisions you will meet, all resolved in the rules' favour: the bilingual
safety line on every screen; no guardrail number or citation on a patient
screen (D16); no button, tab or "coming soon" for a roadmap agent (D22); a
source badge on every dose and every prescription (D29); nothing under 12px;
nothing scrolls sideways at 390px.

1. WHO YOU ARE

You are the Lane B session: Owner B's machine, branch b/ui, command /work.
Read CLAUDE.md and docs/memory/*.md first, then follow the /work skill
exactly: `git fetch origin`, `git pull --no-rebase origin b/ui`,
`git merge main`. Never rebase. Never touch main.

You own only: src/app/layout.tsx, src/app/globals.css, src/app/page.tsx,
src/app/(app)/**, src/app/(auth)/**, src/components/**, src/styles/**,
src/i18n/**, public/**, scripts/verify-ui.ts, playwright.config.ts, e2e/**,
README.md, .plans/b.md, docs/memory/b.md. Anything else you need is a
dependency written in .plans/b.md naming the lane that owns it. You never edit
REVIEW-CHECKLIST.md; the boss ticks it from main.

Subagents: fan out inside a task when the work is independent and the files
are disjoint — one agent per screen group, each told exactly which paths it
owns and given the token contract and component canon verbatim. Opus-class
for the foundation (tokens, shell, base components) and the dashboard result
panel, because a wrong decision there is repeated on every screen;
Sonnet-class for the volume screens; Haiku-class for mechanical extraction.
Say which model each agent ran on and why, in one line. Disagreements come
back to you; you decide once, for everyone.

The unit of work is still one task, exactly as /work says: build → real
output → `npm run build` → `npm run verify:ui` → reviewer subagent says
SAFE TO MERGE → mark the task DONE in .plans/b.md → commit → push b/ui →
open or update the PR. One task, one commit, under Owner B's own name.

2. WHAT ALREADY EXISTS — build on it, never replace it

- Next.js 16 App Router, React 19, TypeScript, Tailwind 4 (`@theme` in
  globals.css), Supabase SSR. Locked. No other UI library.
- Data access: server components call `createClient()` from
  src/lib/supabase/server and query as the signed-in user; client components
  use src/lib/supabase/client. RLS is the security boundary. Keep this; do not
  invent a second way to fetch.
- i18n: src/i18n/en.ts and ar.ts, `getDictionary()` server-side; locale from
  cookie → Accept-Language → Arabic (D10); `?lang=ar|en` pins it. Every string
  you add goes in both files under the same key. Remove `doctor.stub` when the
  real doctor screen lands.
- Root layout sets `<html lang dir>` and renders SafetyLine; the (app) layout
  checks session and role server-side and redirects.
- Stubs exist for /, /sign-in, /sign-up, /dashboard, /prescriptions,
  /prescriptions/[id], /doctor, styled with plain slate/emerald utilities.
  Restyle them from the wireframe; keep their queries and their form state
  machines (idle / loading / success / error).
- CheckDoses.tsx starts a run via POST /api/runs and polls the runs row; it
  renders the result as raw JSON marked PROVISIONAL. That is the result panel
  you build properly, against docs/contracts/run-result.example.json.
- e2e/verify-ui.spec.ts walks four screens at 390×844 in Arabic against
  PUBLIC_SITE_URL and does the cross-account probe. Extend it; keep every
  assertion it has.
- Two sets of accounts, two purposes. The RLS_TEST_* accounts in
  .env.example (patient A, patient B, a doctor linked to A, a doctor linked to
  nobody) are what verify:ui signs in as; the gate's evidence shows their
  rows, and the linked-doctor account is how the walk reaches /doctor/**.
  The DEMO_* accounts — Fahad Al-Kandari (a public-hospital import, a
  private-hospital entry, the cross-clinic clash), Mariam Al-Rashidi
  (warfarin), Yousef Al-Enezi (no doctor linked), Dr Noura Al-Sabah — are
  what design-fidelity screenshots and the Phase 3 walk sign in as. Their
  credentials live only in the lead's .env.local: a credential you do not
  have is something you ask me for, never invent, and never substitute an
  RLS account for. No row anywhere says "test".

3. PHASES

Phase 0 — Import and inventory (one agent, blocking)
Import per section 0. Write src/styles/README.md with:
- every artboard: name, purpose, and the D29 route it maps to — or "no
  route" / "no artboard" (see reconciliation below)
- which design-system file the tokens come from (the tokens themselves go
  straight into src/styles/tokens.css, nowhere else)
- every recurring component with the markup and class names it actually uses:
  app bar, navigation, dose card, prescription card, source badge, status
  pill, form field, primary and secondary button, result panel, proposal
  card, refusal card, alert row, medication-review card, audit sentence row,
  empty state, loading state, error line, safety line
- every piece of sample data visible, and which seeded account it belongs to
- the font(s) and whether they cover Arabic glyphs
Nothing else begins until this file exists.

Reconciliation rules:
- An artboard with no D29 route → do not build it. List it under
  `## Deviations from the wireframe` in .plans/b.md and ask me. Adding a
  route is a scope change.
- A D29 route with no artboard → build it in the design system's idiom from
  the components already inventoried, and log it as a deviation.
- Anything an artboard shows that a rule forbids → build the rule, log the
  deviation.

Phase 1 — Plan, then stop (you alone)
Write .plans/b.md. It does not exist yet and this is the one approval of the
week. Under fifteen numbered tasks; each with one line, the REVIEW-CHECKLIST
items and D-numbers it serves, the command or screen that proves it, the day,
`status: TODO`, and anything it needs from another lane. Order, front-loading
what other lanes wait on:

 1. Foundation — tokens into src/styles/tokens.css and globals.css `@theme`;
    fonts with Arabic coverage; base components in src/components from the
    canon; the app shell (app bar, navigation, safety line) from the
    artboards; both directions. Proof: / and /sign-in at 390px in ar and en.
 2. The four checklist screens restyled from their artboards with real seeded
    data: /, /sign-in and /sign-up, /dashboard, /prescriptions. Proof:
    verify:ui screenshots in both languages. FE-1, FE-2, FE-4, SH-1.
 3. verify:ui extended per section 4 for the four screens that exist; each
    later screen task adds its own route to the walk. Proof: exit 0 and the
    evidence folder.
 4. Dashboard interactions — mark taken or skipped (doses.status and
    answered_at, written as the user; the dose_update policy already allows
    it, and this sits outside the Phase 1 fork: a button, no typed field, an
    enum-constrained column, RLS-scoped, nothing for SE-5 to validate), and
    the result panel: proposals each with Accept, refusals in plain
    words, status moving queued → running → done or failed, and failed says
    failed with its reason. Proof: one real press on the live URL. FE-3,
    FE-5, AU-2, AU-6, D15, D16.
 5. /prescriptions/add — the aggregation point (D21); never cut. Proof:
    submit a good entry, an empty one, and one with 5,000 characters; the
    screen answers all three; no row exists after the bad two. FE-3, SE-5.
 6. /prescriptions/[id] — full detail, doses, history, run-out date from the
    depletion_forecast view when present. BE-2, D28.
 7. /doctor, /doctor/patients/add (exact match only, D7), /doctor/patients/[id]
    (the full cross-clinic list, the adherence week, that patient's audit
    trail; never cut). D5, D21, D30.
 8. /doctor/prescriptions/new, /doctor/alerts with acknowledge, and
    /doctor/medications — the verify queue showing every drafted value beside
    its justification. D5, D17, AU-6.
 9. /history — audit rows as plain sentences built from before/after, never
    raw JSON. D30.
10. README.md per SH-3: three lines, three names with their lanes, live URL,
    how to run it. Nothing else.
11. STRETCH, last, marked stretch: /prescriptions/drafts/[id] — each extracted
    field beside the image, correct, accept. Built only if the lead confirms
    on Tuesday. D26.

Write these dependencies into .plans/b.md now, and do not touch the files:
- Lane A — Zod schemas in src/lib/validation for add-prescription, doctor
  add-patient, doctor new-prescription, medication verify and alert
  acknowledge. The playbook has Lane A's prompt for exactly this. Name the
  fields you need from docs/technical-plan.md §2.2.
- Lane A — an RPC for the doctor's exact-match patient lookup by civil ID or
  email that returns the same answer for "no such patient" and "not yours".
  profiles RLS will not let a doctor read arbitrary rows, and D7 forbids
  enumeration.
- Lane C — the final docs/contracts/run-result.example.json (Sunday) and
  POST /api/runs calling the production webhook.
- Lane C or A — the accept-a-proposal endpoint. Accepting must run through the
  run-scoped Postgres function that sets `jurah.run_id`, so the audit row
  names the run (D30, BE-5). You never update doses.scheduled_at from the app.
- Lane A — audit_log readable through RLS, for /history and
  /doctor/patients/[id].

Then name this fork for me and stop. Where do form writes live? D31 says every
operation a native client needs is a route under src/app/api/** (Lane C).
Adding a prescription is exactly that. Either (a) Lane C provides
POST /api/prescriptions, POST /api/doctor/patients,
POST /api/doctor/prescriptions and the PATCH routes for alerts and
medications, and you build every form against those contracts, blocked until
they land; or (b) I record a new D-number that allows a server action
colocated with its page for a validated single-table write made as the
signed-in user through RLS. Context for the choice: the repo has no Lane C
CRUD route yet — sign-up writes through the Supabase client, and the
playbook's Sunday plan has B building /prescriptions/add with no route named.
Do not choose silently. Show me the plan and the fork, then wait.

Phase 2 — Build, one task at a time, in the /work loop
Work the approved plan in order. Inside a task, fan out by screen group with
disjoint files; integrate; run the gates; reviewer; commit; push; PR. Each PR
body lists the checklist items claimed, the real output proving each, and the
deviations added in that task. Blocked on another lane → write the dependency,
tell the boss in the PR body, take the next unblocked task. Stop only for a
credential, a scope cut, or anything that would make the app less safe.

Phase 3 — Integration walk (you, on the public URL)
Against PUBLIC_SITE_URL with n8n and the Supabase dashboard closed, in Arabic
then in English: sign up a brand-new patient and land on an empty dashboard →
sign in as Fahad → mark a dose taken → press Check my doses → watch the status
→ read the result → accept a proposal → sign in as Dr Noura → read the alert →
open Fahad's full list from two clinics → open his history. Every break
becomes a task or a dependency in .plans/b.md. Nothing is fixed off-plan.

Phase 4 — Verification (four auditors in parallel, then one fix wave)
V-1 Fidelity — every route screenshotted at 390×844 in ar and en beside its
    artboard; every value not traceable to a token flagged; a per-screen
    match assessment.
V-2 Rules — the reviewer subagent on the whole branch; grep for hex outside
    tokens.css, for ml-/mr-/left-/right-/text-left, for hardcoded arrays
    standing in for data, for arithmetic on times or doses in components;
    D16 and D22 checked screen by screen.
V-3 Checklist — FE-1 to FE-5, SE-4 (console shows no mixed content), SH-1,
    SH-3, SH-4, each with the judge's test from REVIEW-CHECKLIST.md run
    literally.
V-4 Accessibility — WCAG AA contrast in both directions, a label on every
    field, visible focus, every tap target at least 44px, meaning never
    carried by colour alone (status pills carry text), long Arabic medicine
    names and a 20-dose day do not break a layout.
Reconcile, dispatch fixers by file group, re-run verify:ui, re-verify.

4. BUILD RULES — the ones CLAUDE.md does not already state

- Tokens: extract into src/styles/tokens.css as CSS custom properties and map
  them into `@theme` in globals.css so Tailwind utilities are the tokens.
  Replace every slate-*/emerald-* utility in the existing files. No hex
  anywhere but tokens.css.
- Direction: logical utilities only — ms-, me-, ps-, pe-, start-, end-,
  text-start, text-end. Never ml/mr/left/right/text-left. Directional icons
  flip with dir. Civil IDs, times and numbers sit in dir="ltr" spans where the
  artboard shows Latin digits; format with Intl using ar-KW or en-GB and
  Asia/Kuwait, as the existing pages do.
- Fonts: if the design system's face lacks Arabic glyphs, pair it with an
  Arabic face in the stack through next/font (Noto Sans Arabic or IBM Plex
  Sans Arabic) and log the deviation. No computed size under 12px.
- Components render and call. Data comes from Supabase queries or /api/**.
  Formatting a time, or turning an audit row's before/after into a sentence,
  is presentation and allowed. Computing a catch-up window, a new dose time,
  a run-out date or a schedule is not (D23, D31). Run-out dates come from the
  depletion_forecast view; proposal times come from the run result.
- Every form is the SignInForm state machine: idle / loading / success /
  error. Zod from src/lib/validation on the client and on the server. The
  submit button is disabled while loading. The error line is human, in both
  languages. Success says what happens next.
- Patient screens show reason_ar / reason_en in plain words. Guardrail codes
  (G2, G5…) appear only on /doctor/alerts.
- Every list has a written empty state. Every async region has a loading
  state. A failed run says failed and why.
- Every new string in en.ts and ar.ts under the same key. Arabic is real
  Arabic, never a placeholder or a machine transliteration.
- One name, one palette, one type scale on every screen — the SHOULD item
  falls out of the tokens if nothing bypasses them.

verify:ui, extended in e2e/verify-ui.spec.ts. It grows with the branch: the
spec never asserts a route that is not yet built, or every later task runs
red on screens that do not exist.
- click through / → sign in → /dashboard → /prescriptions using the real
  links, then browser back twice; assert no error page and no blank screen
  (FE-2 is unticked today precisely because the walk navigates by URL)
- screenshot every built D29 route at 390×844 in ar and in en into
  docs/evidence/<date>/; /doctor/** routes are walked as the linked-doctor
  RLS account
- on every screenshot assert document scrollWidth ≤ 390 and no element with
  a computed font-size below 12px
- collect console messages: no mixed-content warning, no uncaught error
  (SE-4)
- keep the cross-account not-found probe exactly as it is

5. DEVIATIONS AND MEMORY

`## Deviations from the wireframe` in .plans/b.md — one line each: artboard,
what differs, why (the rule number or the technical reason). One dated line in
docs/memory/b.md for every decision a teammate would otherwise have to guess.
Never edit anyone else's memory file.

6. NEVER

- touch a file outside your lane; merge to main; push --force, reset --hard,
  checkout ., clean, or rebase
- hardcode a list that should come from the database; compute a clinical
  number in a component; trust a time from an LLM response
- put a webhook URL, a secret, or the service role key anywhere in
  src/app/(app), src/components, or a NEXT_PUBLIC_ variable
- weaken a policy, a test, an assertion or a gate to make a screen pass —
  that is proof the screen is wrong; say so and stop
- leave a button that does nothing, a "coming soon", or a greyed roadmap agent
- say done without the output: the test log, the build, and the 390px
  screenshots in both languages

7. HOW TO REPORT TO ME

At each phase boundary: what finished, with its output; what is running now,
which subagents on which models and which files; what is blocked and on which
lane; what you need from me. Between boundaries keep working — do not stop to
ask what CLAUDE.md, D29 or the technical plan already answers.

Start with Phase 0 now.
```

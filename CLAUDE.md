# Jur'ah — medication schedule capstone (AIFC-Sep/Sep-26)

Demo Day: Thursday 24 September 2026, 09:00. Three people, five build days
(Saturday 19 – Wednesday 23). The grading bar is `REVIEW-CHECKLIST.md`: 28
items, all required, each written as something a judge can observe. The bar is
the floor, not the scope — we are building the whole app (`PRODUCT-DECISIONS.md`).

## Stack
Next.js App Router + TypeScript + Tailwind, Supabase (Postgres / Auth / RLS),
Vercel, n8n Cloud. npm, Node 22 (supabase-js 2.109 needs a native WebSocket; Node 20 is deprecated by it). Every screen works in Arabic (RTL) and English.
Web app first; a native app follows later and must not need a rewrite (D31).

## Commands
- `npm run dev`
- `npm run build` — must pass before any commit
- `npm run verify:rls` — account B cannot reach account A's rows. Gates every merge.
- `npm run verify:ui` — Playwright against the deployed URL: every screen at
  390px, screenshots, and the two-account read attempt in a real browser.
  Gates every merge.

## The documents — which one answers what

Read in this order when they seem to disagree; the higher one wins.

| File | Answers | Owner |
|---|---|---|
| `CLAUDE.md` | the rules — what every session may and may not do | boss |
| `PRODUCT-DECISIONS.md` | the why — every product decision, numbered D1… | lead |
| `docs/technical-plan.md` | the how — schema, policies, routes, n8n topology, handoffs | boss |
| `docs/agent-guardrails.md` | the agent's numbered rules G1–G11 and each tool's limits | C |
| `REVIEW-CHECKLIST.md` | the 28 judged items, ticked only from `main` | boss ticks |
| `SETUP.md` | a teammate's laptop, 15 minutes, once | boss |
| `docs/playbook.html` | the same rules in plain language, with copy-paste prompts per role | boss |
| `README.md` | the repo front page a judge reads: three lines, names, live URL | B |
| `PROMPT-0.md` | the one-time bootstrap the lead pastes into the boss session | lead |
| `.plans/<owner>.md` | one lane's numbered task list with a test per task | that lane |
| `docs/memory/*.md` | one dated line per decision a later session would otherwise guess | each writer |

Every document exists for one reason: three people and four Claude sessions can
build the same app without asking each other questions. If a file does not help
with that, shorten it.

---

## Plan → build → prove

No goal is worked on without a plan, and no plan is written without a test per
task. This is how every session works, every time:

1. **Plan.** Write the goal as a numbered task list in the plan file you own:
   one line each, the checklist items it serves, the command or screen that
   proves it, the day, and anything it needs from another lane.
2. **Build** one task at a time, inside your lane.
3. **Prove** it with the real output — a test log, a screenshot, a query result.
   Then commit and move to the next task.

`/work` is this loop for a lane. `/ship` is the boss's loop for `main`.
`/close` is the nightly scoring. A goal that is not in a plan file is not being
built.

## Changing the plan or the workflow

The plan is expected to change. The way it changes is fixed so nothing is lost:

- **A product decision changes** → the lead appends a new `D<n>` to
  `PRODUCT-DECISIONS.md` and adds a one-line "superseded by D<n>" note to the
  old entry. Numbers are never reused and entries are never deleted; they are
  cross-referenced from six files.
- **A lane's task list changes** → the lane edits its own `.plans/<owner>.md`
  and says so in its next pull request. Cutting a checklist item is a team
  decision, not a lane decision.
- **The workflow changes** (a skill in `.claude/skills/**`, an agent in
  `.claude/agents/**`, this file, CI) → any session may propose it by writing
  the exact change as a dependency in its plan file, naming what went wrong.
  The boss applies it on the next `/ship` and records one line in
  `docs/memory/boss.md`. Improving the loop is welcome; silently working around
  it is not.
- **Something is stale** → fix the text in place. Do not add an amendment
  section under the wrong text.

---

## Sessions — who is who

| Session | Runs on | Branch | Command |
|---|---|---|---|
| **BOSS** | the lead's machine, on a timer | owns `main` | `/ship`, then `/close` at 23:00 |
| **LANE A** | Owner A's machine | `a/data` | `/work` |
| **LANE B** | Owner B's machine | `b/ui` | `/work` |
| **LANE C** | Owner C's machine | `c/agent` | `/work` |

A lane session never merges to `main` and never touches another lane's branch.
The boss never writes a feature; it merges, verifies, repairs and reports.

---

## The autonomy contract

**Do these without asking anyone.** Write code, migrations and tests in your own
lane. Run any command in the allow list. Commit. Push your own branch. Open and
update pull requests. Install a dependency the task needs. Read anything in the
repo. Re-run a failed check after fixing its root cause.

**The boss additionally does these without asking.** Merge a pull request the
integrator cleared and CI passed. Resolve a merge conflict. Cherry-pick a commit
from one lane onto another. Revert a merge that turned a gate red, pushing the
revert straight to `main`. Regenerate `src/types/db.ts`. Merge `main` into the
three lane branches. Tick `REVIEW-CHECKLIST.md`. Create, update and activate the
n8n workflows through the n8n API. Redeploy.

**Stop and ask. Every time. All sessions.**

1. A credential you do not have. Never invent, guess or placeholder one.
2. A scope cut — dropping a feature to make Thursday is the team's call.
3. Anything that would weaken a security policy to make a feature pass. Treat
   this as proof the feature is wrong. Say so, and stop.
4. Anything that would delete or rewrite work that is already pushed.
5. After Wednesday 22:00 — the freeze. From then the boss merges nothing and
   only reverts.

**Never say a thing is done. Show the output that proves it.** Not a summary of
the output — the output.

---

## Non-negotiables

- IMPORTANT: the service role key is server-only. It never appears in a
  `NEXT_PUBLIC_*` variable, a client component, the browser bundle, a commit,
  or a chat transcript. It appears **nowhere** in `scripts/verify-rls.ts` — that
  script uses the anon key only and refuses to run with a privileged one. The
  only script that touches the key is `scripts/seed-auth.ts`, because creating
  auth users genuinely requires it.
- IMPORTANT: never disable RLS, and never write `using (true)` on a table that
  holds patient data.
- Every table: RLS enabled, at least one policy, every policy says
  `to authenticated`, and auth is called as `(select auth.uid())`.
- Every write policy needs a `with check` clause as well as `using`, or account
  B can insert rows owned by account A.
- Index every column a policy filters on.
- Every view over patient data is created `with (security_invoker = true)`.
- IMPORTANT: the agent decides *which* tool to call. It never decides *what
  time*. Every quantity that has to be right — dose arithmetic, the catch-up
  window G1–G8, the distance between two interacting medicines, the depletion
  forecast, the schedule built from a dosing pattern — runs in a Code node or in
  SQL, never in an LLM's response. The model handles language and routing only,
  and every clinically meaningful output passes the deterministic layer before a
  person sees it. `PRODUCT-DECISIONS.md` D23.
- Every agent-drafted clinical value is stored `unverified` and a human accepts
  it before it is used: the profiler's profile by a doctor, the rescheduler's
  proposal and the extraction agent's draft by the patient. Unknown always means
  refuse, never "probably fine". Fail closed.
- Every write to clinical data leaves an `audit_log` row, written by a database
  trigger, never by application code that could forget. Nobody can insert,
  update or delete an audit row directly. `PRODUCT-DECISIONS.md` D30.
- Business logic lives in Postgres functions, n8n Code nodes and `src/app/api/**`
  — never inside a React component. A future native app calls the same routes
  and the same database and needs nothing rewritten. D31.
- The browser never calls n8n. It calls `/api/runs`, which verifies the session,
  writes the `runs` row, then calls n8n with a server-held secret. `runs.kind`
  says which agent the row belongs to, so BE-5 holds per agent.
- Server code reads a secret inside the handler that uses it, never at module
  top level, so `npm run build` needs no secret at all.
- The n8n webhook URL is read back from the **activated** workflow through the
  n8n API. A URL containing `/webhook-test/` is a bug, never a fallback.
- Show the SQL of a migration before applying it.
- Every field a user types into is validated with Zod on the server before it
  is used — empty, too long, wrong type all refuse with a message (SE-5).
- Never run `git push --force`, `git reset --hard`, `git checkout .`,
  `git clean` or `git rebase`. In this repo nobody rebases: the boss merges
  `main` into the lanes.

---

## Lanes — path by path

| Path | Owner |
|---|---|
| `supabase/**` | A |
| `src/lib/supabase/**`, `src/lib/validation/**` | A |
| `scripts/verify-rls.ts`, `scripts/seed-auth.ts` | A |
| `src/types/db.ts` | **generated by the boss** — never hand-edit |
| `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` | B |
| `src/app/(app)/**`, `src/app/(auth)/**` | B |
| `src/components/**`, `src/styles/**`, `public/**`, `src/i18n/**` | B |
| `scripts/verify-ui.ts`, `playwright.config.ts`, `e2e/**` | B |
| `README.md` | B |
| `src/app/api/**` | C |
| `n8n/**` | C |
| `docs/**` — except the files named below | C |
| `.plans/a.md`, `.plans/b.md`, `.plans/c.md` | one each, private to that lane |
| `docs/memory/a.md`, `b.md`, `c.md` | one each, append-only |
| `REVIEW-CHECKLIST.md`, `docs/technical-plan.md`, `docs/playbook.html`, `docs/ship-log.md`, `docs/failures.md`, `docs/security-audit.md`, `docs/memory/boss.md` | **boss only** |
| `docs/evidence/**` | nobody — gitignored output of `verify:ui` |
| `CLAUDE.md`, `package.json`, `.github/**`, `.claude/**`, `.gitignore` | boss only; a lane that needs a change here writes it in `.plans/<owner>.md` as a dependency |

Shared checklist items have a primary owner and a consumer:

| Item | Primary | Consumer |
|---|---|---|
| BE-5 (the run row and its status) | C | A reviews the policy |
| AU-2 (the button and the status on screen) | B | C provides the endpoint |
| SE-6 (the AI security audit and its two fixes) | boss runs it | the lane that owns each fix |
| D30 (the audit trail) | A owns the table and triggers | B shows it on screen |

If a task needs a file outside your lane, do not touch it. Write it in your plan
file as a dependency, name the lane that owns it, and carry on with the next
task. The boss resolves it on the next ship run.

---

## Domain

**Jur'ah aggregates every prescription a patient holds — whichever clinic,
hospital or sector issued it — into one profile, and screens across the whole
of it.** The patient is the only party who sees all their prescriptions, so the
patient layer is where reconciliation happens. `PRODUCT-DECISIONS.md` D21.

Ten tables: `profiles`, `doctor_patients`, `prescriptions`,
`prescription_drafts`, `doses`, `medications`, `interactions`, `runs`, `alerts`,
`audit_log`. One sentence per row for each is in `docs/technical-plan.md` §2.4.

**Who may read and write a prescription** (D25):

- **Read:** the patient it belongs to, and any doctor linked to that patient
  through `doctor_patients`. Nobody else, ever.
- **Write:** the patient, for rows whose `source` is not `jurah_doctor`; the
  authoring doctor, for rows whose source is. Nobody else.
- `prescriptions.doctor_id` is **nullable** — a prescription imported from
  another clinic has no doctor in this system, and that is the normal case.
- `doses`, `runs`, `alerts` and `audit_log` inherit the read rule through the
  patient.
- `interactions` and `medications` are shared reference tables: readable by
  every authenticated user, written only through the doctor-verification path
  in D11a/D27.

**What an agent may do.** No agent writes a `prescriptions` row — ever. The
decision agent may propose moving a dose in time and nothing else. The
extraction agent writes a **draft** to `prescription_drafts` that the patient
accepts before it becomes a prescription. No agent may raise a strength, extend
a course, or change what medicine a patient is on. No agent may assert a drug
interaction that is not a row in the `interactions` table.

**The agents.** Seven on the architecture, four running on Thursday, per D22:
orchestrator, rescheduling, interaction screening and profiler ship; extraction
is a Tuesday stretch; adherence outreach and travel check are roadmap. A roadmap
agent never appears as a dead button or a "coming soon" — it is spoken in the
pitch and written in `PRODUCT-DECISIONS.md`, nowhere else. `runs` never holds a
row for an agent that does not run.

---

## Product rules

- Every screen carries the bilingual safety line. Not a toast, not a footer on
  one page — every screen:
  "Student prototype. All data here is sample data. Jur'ah does not give
  medical advice — always follow your doctor and your pharmacist."
  «نموذج طلابي. جميع البيانات هنا بيانات تجريبية. «جرعة» لا تقدّم استشارة طبية —
  اتبع دائماً تعليمات طبيبك والصيدلاني.»
- All data is sample data. Never imply clinical accuracy anywhere in the UI.
- Demo data uses Kuwaiti names, real-looking dates, real medicine names. No row
  anywhere says "test".
- Every form answers: success, error, or loading. Never a frozen screen.
- Mobile portrait first. Nothing scrolls sideways at 390px, nothing under 12px.

---

## Memory

Read `docs/memory/*.md` when you need a decision made in an earlier session.
When you make a decision a future session or a teammate would otherwise have to
guess at, append one line to **your own** memory file — `docs/memory/a.md`,
`b.md` or `c.md`, or `boss.md` if you are the boss. One line, dated, never
deleted. Never edit someone else's.

# PROMPT 0 — the bootstrap

The one prompt the lead pastes into the boss session, once, in this folder.
About ninety minutes, mostly unattended. It is current with
`PRODUCT-DECISIONS.md` D1–D31 and `docs/technical-plan.md`; if either changes
before it is run, change this file too — do not add an amendment underneath.

Before you paste it:

1. **Accounts.** GitHub, Supabase, Vercel, n8n Cloud. In n8n: Settings → API →
   create an API key.
2. **Tools.** Node 22, `gh auth login`, Claude Code installed.
3. **Plugin.**
   ```bash
   claude plugin marketplace add anthropics/claude-plugins-official
   claude plugin install supabase@claude-plugins-official --scope project
   claude
   ```

Do **not** create a Next.js project or any tables by hand.

---

```
You are setting up a five-day team capstone and you are the boss session: you
own main for the rest of the week. Work autonomously. Stop only for a credential
or a decision that is genuinely mine.

CONTEXT
Read every document in this folder before you do anything, in this order:
CLAUDE.md, PRODUCT-DECISIONS.md, docs/technical-plan.md, docs/agent-guardrails.md,
REVIEW-CHECKLIST.md, SETUP.md, .env.example, .claude/settings.json,
.claude/agents/*.md, .claude/skills/*/SKILL.md, .github/workflows/ci.yml,
.githooks/pre-commit, scripts/verify-rls.ts.

CLAUDE.md carries the rules. PRODUCT-DECISIONS.md is the why. docs/technical-plan.md
is the how and contains the exact SQL for steps 3, 4 and 5 — use it, do not
redesign it. REVIEW-CHECKLIST.md is the grading bar: 28 items, all required.

Product: Jur'ah. A patient holds prescriptions from many clinics and sectors in
one profile. A doctor linked to the patient sees the whole list. A patient sees
today's doses and marks them taken or skipped. An agent decides whether a missed
dose can safely be caught up, proposes a new time the patient accepts, and
refuses when it cannot, alerting the doctor instead. Every change to clinical
data is recorded in an append-only audit trail.

Three people, five build days, Demo Day Thursday 24 September 2026 at 09:00.
Stack: Next.js App Router + TypeScript + Tailwind, Supabase, Vercel, n8n Cloud.

DO THESE IN ORDER. Print one line after each step saying what you did.

1. Project. create-next-app refuses a folder that already holds files it does
   not recognise, and this folder holds CLAUDE.md, docs/ and scripts/. So:
   scaffold in a sibling temp folder (TypeScript, Tailwind, App Router, ESLint,
   src/ directory, no import alias prompt — pass the flags so it asks nothing),
   then copy everything it generated into this folder without overwriting any
   file already here, and delete the temp folder. Install
   @supabase/supabase-js, @supabase/ssr and zod, and tsx, dotenv and
   @playwright/test as dev dependencies. Add these scripts:
   "verify:rls": "tsx scripts/verify-rls.ts" and "verify:ui": "playwright test".
   Merge create-next-app's .gitignore into the one already here; the result must
   still cover .env*, .gstack/, docs/evidence/ and .logs/.

2. Git. This repository, Hamad-Almesri-Coded-Bootcamp/tryJoraa, stays PUBLIC
   (PRODUCT-DECISIONS.md D1). Do not create another. Commit, push to main. Ask me
   for my two teammates' GitHub usernames and add them as collaborators. Create
   and push the three lane branches — a/data, b/ui, c/agent — so nobody has to.
   Run `git config core.hooksPath .githooks` and `chmod +x .githooks/pre-commit`.

3. Supabase. Create a project in the region closest to Kuwait. Write ONE
   migration from docs/technical-plan.md §2: the enums, the TEN tables
   (profiles, doctor_patients, prescriptions, prescription_drafts, doses,
   medications, interactions, runs, alerts, audit_log), the indexes in §2.3,
   the generate_doses function of §8, the depletion_forecast view of §3.4 WITH
   security_invoker, and the audit trigger of §3.5 on every audited table.
   Show me the SQL before you apply it. Real column types: a date is a date, a
   number is a number, a status is an enum. prescriptions.doctor_id is nullable.

4. Row-level security. The highest-stakes part of the build. Apply the policies
   in docs/technical-plan.md §3 exactly: every table has RLS enabled; every
   policy says `to authenticated` and calls auth as `(select auth.uid())`; every
   write policy has a `with check`. A prescription is readable by its patient and
   any doctor linked through doctor_patients, writable by the patient for
   non-jurah_doctor rows and by the authoring doctor for jurah_doctor rows.
   doses, runs, alerts and audit_log inherit through the patient.
   prescription_drafts is patient-only. audit_log has select policies and NO
   write policy — only the trigger writes it. interactions and medications are
   readable by every authenticated user and written only through the doctor
   verification path. Index every column a policy filters on. Show me the policy
   SQL before applying it.

5. Test accounts and the isolation script. Write scripts/seed-auth.ts: through
   the Supabase admin API it creates FOUR throwaway accounts — patient A,
   patient B, a doctor linked to A through doctor_patients, and a doctor linked
   to nobody — and writes their credentials into .env.local under the names in
   .env.example. This is the ONLY script that touches the service role key.

   Then update scripts/verify-rls.ts to docs/technical-plan.md §4. It uses the
   anon key only — no service role key anywhere in it, not in setup, not in
   teardown — and keeps its assertNotPrivileged() guard. Rewrite its TABLES block
   to the D24 column names. It must run all seven probes: B reaches none of A's
   rows on any table; B cannot insert with patient_id = A; B cannot set
   source = 'jurah_doctor'; the unlinked doctor reads nothing of A's; the linked
   doctor reads A's prescriptions but cannot update one they did not author; B
   reads nothing from depletion_forecast; B reads none of A's audit_log rows and
   nobody can write an audit row directly. Print PASS or FAIL per probe.
   process.exit(1) on any FAIL. Run it and show me the full output. It must exit
   0. If it does not, fix the policy — never the assertion.

6. Security advisors. Run the Supabase security advisors. Fix everything they
   raise, run them again, show me a clean result.

7. Types. Generate the TypeScript types into src/types/db.ts.

8. Seed. Realistic demo data: one doctor and three patients with Kuwaiti names,
   the doctor linked to two of them; eight prescriptions across them from at
   least THREE different facilities across BOTH sectors, with real medicine names
   and strengths, the pharmacist fields filled; doses for today and the past
   week with a realistic mix of taken, skipped and missed; 25 medications and 25
   interaction pairs, each row with its named source, all verified. The demo
   patient's interaction clash must span two different clinics. No row anywhere
   says "test". The seed runs through the normal tables so the audit trail shows
   history from day one.

9. Contracts so the others are not blocked. This is what lets all three lanes
   start this afternoon; do not skip any of it. As working stubs:
   - src/lib/supabase/{client,server}.ts
   - a signed-in layout with sign-in, sign-out and a server-side session and
     role check
   - src/app/layout.tsx carrying the bilingual safety line and dir switching,
     strings in src/i18n/{ar,en}.ts
   - four routed pages rendering real seeded data, plainly styled: /, /sign-in,
     /dashboard, /prescriptions
   - POST /api/runs — verifies the session (cookie or bearer), validates the
     body with Zod, writes a runs row with its kind, returns { runId }. Do NOT
     call n8n yet; leave a marked TODO for Owner C. Read every secret inside the
     handler, never at module top level.
   - docs/contracts/run-result.example.json — the exact JSON a finished run
     writes back to the runs row, with a `kind` field: the proposed doses with
     their new times and the guardrail that allowed them, or the refusal with
     its reason and the medicine it names. Mark it PROVISIONAL at the top.
     Owner C finalises it first thing Sunday.
   - docs/api.md listing POST /api/runs with its body and response
   - playwright.config.ts + scripts/verify-ui.ts running against
     PUBLIC_SITE_URL, not localhost: pinned locale, 390×844, sign in as the
     patient, walk the four screens, screenshot each into docs/evidence/<date>/,
     assert no horizontal overflow, then sign in as the second account and open
     the first account's prescription by id and assert nothing comes back.
   These are deliberately unfinished. They exist so B and C can start today.

10. n8n. Using N8N_API_KEY in .env.local and the n8n public API, create the
    orchestrator workflow "jurah-orchestrator" from n8n/orchestrator.json: a
    webhook trigger that checks the shared secret header, responds immediately,
    and writes the runs row to status 'done' with a placeholder result.
    Activate it. Read the PRODUCTION webhook URL back from the activated
    workflow and write it to .env.local as N8N_WEBHOOK_URL. If the URL you read
    back contains /webhook-test/, stop and tell me — that is the failure mode
    that loses the automation section on stage. The three specialist
    sub-workflows are Owner C's; leave their names in docs/technical-plan.md §7.

11. Vercel. Deploy from main, set the environment variables, give me the live
    HTTPS URL, and write it into .env.local as PUBLIC_SITE_URL. Confirm the
    landing page opens in a private window with no sign-in.

12. CI and branch protection. Set the repo secrets ci.yml needs with `gh secret
    set` — the Supabase URL and anon key and the four test-account pairs; NOT
    the service role key, CI does not use it. Push the workflow and confirm a
    run goes green. Then protect main:
      - require a pull request before merging
      - require the `gate` status check to pass
      - require ZERO approving reviews — you must be able to merge without a
        human, and GitHub will not let you approve your own pull request
      - do NOT include administrators — I am an admin and you run as me, and
        you need to push a revert straight to main when a gate goes red. That
        emergency path is the reason it is safe to let you merge at all.
    Read the protection back with `gh api` and show me it applied.

13. The loop. Print the exact cron line for my machine that runs /ship every 45
    minutes between 08:00 and 23:00, logging to .logs/ship.log, and the line
    that runs /close at 23:00, and tell me how to install them. Then run /ship
    once, now, to prove the loop works end to end.

14. Hand-off. Print as one copyable block: the live URL, the repo URL, the exact
    .env.local contents my two teammates need (anon key yes, service role key
    NO, n8n API key NO, webhook secret NO), and the one sentence each of them
    types to start work. Append your decisions to docs/memory/boss.md, one line
    each.

GATES — not negotiable
- Never print, log or commit a service role key. It lives in .env.local on my
  machine and in n8n. Nowhere else, ever.
- Never weaken a policy to make something pass. If RLS blocks a feature, the
  feature is wrong.
- `npm run build` passes before every commit. `npm run verify:rls` exits 0
  before anything reaches main.
- Show me SQL before you apply it. Every time.

WHEN YOU FINISH
Print: the live URL, how many of the 28 are now genuinely satisfied and which,
and the single biggest risk you noticed while building.
```

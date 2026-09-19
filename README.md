# Jur'ah · جرعة

**Jur'ah keeps every prescription a patient holds, from any clinic or hospital, in one profile.**
The patient sees today's doses and marks them taken or skipped. When a dose is missed, an agent
checks whether it can safely be caught up, proposes a new time the patient accepts, or refuses and
tells the doctor. Every change is written to an append-only audit trail.

Student prototype built in five days for the AIFC capstone (CODED, September 2026). All data is
sample data. Jur'ah does not give medical advice — always follow your doctor and your pharmacist.

## The team

| Person | Lane | Owns |
|---|---|---|
| Hamad Almesri | Lead · boss session | `main`, merges, gates, checklist |
| _name_ | A · data and security | database, row-level security, isolation test, validation, seed |
| _name_ | B · front end and ship | every screen in Arabic and English, mobile first, Playwright check, this README |
| _name_ | C · agent and demo | `/api/runs`, the n8n workflows, the numbered guardrails, rehearsals |

## Live

- App: _public URL, written here on Saturday_
- Demo Day: Thursday 24 September 2026, 09:00

## Stack

Next.js App Router · TypeScript · Tailwind · Supabase (Postgres, Auth, RLS) · Vercel · n8n Cloud

## Run it locally

```bash
gh repo clone Hamad-Almesri-Coded-Bootcamp/tryJoraa
cd tryJoraa
git config core.hooksPath .githooks
npm install
cp .env.example .env.local     # the lead sends the values
npm run dev
```

`npm run build`, `npm run verify:rls` and `npm run verify:ui` are the three checks. The first two
gate every merge. Full setup: [`SETUP.md`](SETUP.md).

## Read next

| File | What it answers |
|---|---|
| [`docs/playbook.html`](docs/playbook.html) | how the team works, in plain language, with copy-paste prompts per role |
| [`CLAUDE.md`](CLAUDE.md) | the rules every session follows |
| [`PRODUCT-DECISIONS.md`](PRODUCT-DECISIONS.md) | why we decided what we decided, D1–D31 |
| [`docs/technical-plan.md`](docs/technical-plan.md) | schema, policies, routes, n8n topology |
| [`docs/agent-guardrails.md`](docs/agent-guardrails.md) | the agent's numbered rules and each tool's limits |
| [`REVIEW-CHECKLIST.md`](REVIEW-CHECKLIST.md) | the 28 judged items |
| [`docs/diagrams/index.html`](docs/diagrams/index.html) | the plan in nine diagrams |

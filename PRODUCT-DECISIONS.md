# PRODUCT-DECISIONS — what we decided, and why

Lead-owned. This file is the *why* behind `CLAUDE.md`; `CLAUDE.md` carries the
rule and wins when the two disagree. `docs/technical-plan.md` is the *how*.

`REVIEW-CHECKLIST.md` is the judges' **minimum bar**, not our scope. We are
building a full working app and then proving the 28 items fall out of it.

**How this file changes.** A new decision gets the next number and is appended.
An old decision that is replaced keeps its number and its reasoning and gets a
one-line note naming the successor. Nothing is deleted or renumbered — the
numbers are cross-referenced from six other files.

---

## D1 · Repository — decided

Keep the existing repo, `Hamad-Almesri-Coded-Bootcamp/tryJoraa`, and keep it
**public**. Checklist SE-2 ("open the repo and search it") and SH-3 ("open the
repo, read the front page") both require a judge to open the repository, and
GitHub allows branch protection on public repositories on the free plan, which
the `/ship` loop depends on.

## D2 · Product name — decided

**Jur'ah / جرعة** — Arabic for "dose". The repository keeps the name `tryJoraa`;
the product is Jur'ah everywhere a person can see it.

## D3 · The scenario — superseded by D21; the tone rules stand

Jur'ah is *designed as if* deployed inside a Ministry of Health system, where
doctors already exist in a registry and are provisioned, not signed up. D21
moved where the truth lives (the patient's profile, not one ministry system);
the deployment context is still the pitch.

**Pitch, never chrome.** No ministry branding, no logo, no screen that could be
mistaken for a real government system, no claim that any data is real. We say
"designed for a ministry deployment", never "this is the ministry's system".

## D4 · Roles — decided

Two roles, both with **real, working logins**. `profiles.role` decides which
side of the app a person enters.

- **Doctor — provisioned, never self-signup.** Created by the seed script
  through the admin API, exactly how an identity sync would. There is
  deliberately no "register as a doctor" screen.
- **Patient — self-signup, and it must work first try.** BE-4 is a judge
  watching a brand-new account being created and landing on an empty dashboard.

On stage we hold three logins: the seeded doctor, a seeded patient with a week
of history, and a brand-new patient created live in front of the judge.

## D5 · What a doctor can do — decided (all four)

1. See their patient list.
2. Read the alerts the agent raised, and acknowledge them.
3. Write a new prescription in the app.
4. See a patient's adherence history for the past week.

Item 3 gives us full create/read/update/delete on one table from the front end
(a SHOULD item). Item 2 is what makes the agent's refusal land somewhere visible.

## D6 · How a doctor learns about a refusal — decided

**In-app alerts inbox, plus an email sent by n8n.** The inbox satisfies AU-6
(the outcome is visible inside our product with n8n and the database closed).
The email makes the automation visibly reach outside the app.

The inbox must work on its own, so a failed email never breaks the demo. The
email provider needs a credential from the lead; never invent or placeholder one.
Who receives the alert when a prescription has no doctor is settled in D24.

## D7 · How a patient becomes visible to a doctor — superseded by D21; the lookup rules stand

**The doctor adds the patient by civil ID or email**, then prescribes. The link
is a row in `doctor_patients`; patients carry a civil ID collected at signup.

Still binding: lookup is **exact match only**. No partial search, no "list all
patients", no response that confirms an unmatched identifier exists — an
unmatched ID must return the same answer as a matched-but-not-yours one. A doctor
must not be able to enumerate the patient table. Civil IDs are invented sample
values. What D21 changed: the linked doctor then sees the patient's **whole**
aggregated list, not only their own rows.

---

## D8 · What the agent checks — decided

**Two conditions, both must pass.** Is the missed dose still inside its
catch-up window, and does moving it put it too close to a medicine it interacts
with? If either fails, the agent refuses and alerts the doctor.

This is what makes `interactions` do real work, and it gives AU-3 a genuine
decision point that fits on a whiteboard:

```
TRIGGER   the patient presses "Check my doses"
  1. find today's missed doses
  2. for each one:  inside the window?      no  -> REFUSE (too late)
                    clashes with a drug?    yes -> REFUSE + alert the doctor
                    otherwise                   -> PROPOSE a new time (D15)
  3. write the outcome to the runs row
```

## D9 · The alert email — decided

n8n sends it. Owner C chooses the provider when that step is built; the lead
supplies the credential. **WhatsApp is a stretch goal**, attempted only if
Tuesday has room. The in-app inbox never depends on the email.

## D10 · Default language — decided

**Detect from the browser, fall back to Arabic.** Both languages work on every
screen and the visitor can switch. `verify:ui` pins the language explicitly, or
the evidence screenshots differ between machines.

## D11 · Two agents, not one — adopted, refined by D11a and D22

A **profiler agent** builds a structured profile of each medication; a separate
**decision agent** uses those parameters to judge a missed dose. This is the
honest answer to "why is this an agent, not an automation".

Two rules came with it and both stand: the profiler is **grounded, not
recalled** — every value carries a source, and a medicine it cannot source is
`unknown`, which the decision agent treats as **refuse**; and the profile is
**stored**, not regenerated per run, so the demo is deterministic and BE-5 has
a row to point at. The count of agents is now D22's.

## D11a · The profiler's grounding — decided

Three tiers, in order. The agent is never the last word.

1. **Look in the database first.** A verified profile is used as is.
2. **If absent, the profiler drafts one** — main information, key parameters,
   interactions and cautions — with a **justification beside every value**.
   Stored `unverified`.
3. **A doctor verifies it before it is used in any decision.** Until then the
   decision agent treats the medicine as unknown and **refuses**.

This gives AU-4's guardrail, AU-5's tool limit and the "one human checkpoint"
SHOULD item at once, and survives a judge naming a medicine that does not exist:
they get a clearly unverified draft and a refusal, never a confident dosing rule.

Build cost: the `medications` table with a verification status and a
justification column, the `/doctor/medications` review screen (D17), and a
policy that only a doctor may set a profile to verified.

## D12 · Seeding the reference table — decided

We hand-seed the medicines and interaction pairs, each with its named source.
Hand-seeded rows count as verified. Agent-drafted rows do not, until a doctor
says so.

## D13 · When the profiler runs — decided

**Both.** When a doctor writes a prescription, so the profile exists before any
dose is missed and the Check button stays fast; and on demand if a Check run
meets a medicine with no profile. Either way, an unverified profile still
refuses. Building a profile is not the same as trusting it.

## D14 · The catch-up rule — decided, and sourced

Guardrails G1–G8 in `docs/agent-guardrails.md`, each with its source. In order:
unverified refuses; time-critical refuses; a medicine with its own published
window uses that window; otherwise 2 hours is the default; past 2 hours the
dosing frequency decides; an interaction clash refuses last.

The anchor is **2 hours** (NHS Specialist Pharmacy Service). Our own number is
the **4 hours** in G3 — the guidance says "a few hours" and we made it concrete.
That is the value AU-4 expects a rehearsal to change. Dropped: "half the gap to
the next dose", because no published guidance uses it and D11a forbids an
uncitable rule.

## D15 · The agent proposes, the patient accepts — decided

When the agent decides a dose **can** be caught up it does not move it. It
proposes — *"I can move your 08:00 Metformin to 13:30 — accept?"* — and nothing
changes until the patient taps accept. That is the honest behaviour for an app
not allowed to give medical advice, and it is the patient-side human checkpoint.

Keep the asymmetry: a **refusal** needs no consent and alerts the doctor
immediately. Only a change to someone's medication waits for a human.

## D16 · The patient is told why — decided

Every outcome shows its reason in plain language and names the guardrail in
words a patient understands — *"Not moved. Warfarin is a time-critical medicine,
so we never reschedule it. Your doctor has been told."*

The guardrail number and citation do **not** appear on the patient's screen;
clinical-looking text in a student prototype is what the safety line exists to
prevent. They live in `docs/agent-guardrails.md`, on the doctor's alert detail,
and in the run record.

## D17 · Verifying a drafted profile — decided

**Its own screen, `/doctor/medications`** — a queue of medicines awaiting
review, each showing the drafted parameters and the justification for every
value. A doctor approves or corrects; only then may the decision agent use that
medicine. The best thing in the app to point at on stage.

## D18 · Size of the seeded reference — decided

**About 25 medicines, all verified, plus 25 interaction pairs**, each with a
named source. Everything in the demo is therefore already trusted, and the
drafting flow is shown live by typing a medicine deliberately not in the table.

## D19 · The front door — decided by default, easily reversed

**Today's doses, with the Check button on the same screen.** A list of
medicines with times is something any stranger recognises (FE-1), and a button
underneath inherits that context. D29 adds the source badge per dose.

## D20 · The screen map — superseded by D29

D20 listed twelve routes on the assumption that every prescription came from a
doctor inside the app. D29 is the current map (fourteen routes); D20's cut
order — cut from the bottom of the doctor list upward, never the four checklist
screens — still applies with D29's two exemptions.

---

# The reframe — D21 to D28

Decided by the lead, Saturday 19 September 2026. Where one of these disagrees
with D1–D20, **D21–D28 win**, and the older entry says so.

## D21 · The frame — patient-side aggregation. Supersedes D3 and D7.

**The patient is the only party who sees all their prescriptions, so the patient
layer is where reconciliation happens.** Jur'ah aggregates every prescription a
patient holds — whichever clinic, hospital or sector issued it — into one
profile, and everything else is computed from that profile.

The two failure points it answers:

1. **Instruction loss after the consultation.** The patient leaves with a verbal
   dosage half-remembered and a pharmacist's restatement that sometimes
   contradicts it. Jur'ah is the written reference neither conversation produced.
2. **Fragmented records.** Clinics and hospitals in Kuwait run separate systems,
   public and private; a physician often cannot see a patient's medicines from
   another clinic. An interaction that spans two clinics is caught by nobody.
   Jur'ah screens across the whole profile because the whole profile is in one place.

**What changes, concretely.**

- Every prescription carries a **source**: facility and sector (D24).
- `prescriptions.doctor_id` is **nullable**. An imported prescription has no
  doctor in this system, and that is normal.
- A linked doctor sees the patient's **whole list**, not only their own rows.
- The doctor keeps every power in D5 and stays the only one who may verify a
  medication profile or edit a prescription they authored.

**Where prescriptions come from, in order of preference:** a push from the
national e-health platform at the moment of prescribing (the pitch); an import
from another system; the patient enters it at `/prescriptions/add`; the patient
photographs it and the extraction agent drafts it (D26). The demo runs on the
last two — they need no access nobody has given us, and they prove the claim
that reconciliation does not have to wait for national systems to integrate.

## D22 · Seven agents, staged. Supersedes D11's count.

The architecture is an orchestrator routing between specialists as n8n
**Sub-workflow Tools**. That routing is what makes this multi-agent rather than
one chatbot holding tools. Five days and three people do not build seven, so the
stage is stated per agent and nobody claims on Thursday what is not running.

| # | Agent | Role | Stage |
|---|---|---|---|
| 1 | **Orchestrator** | Routes work to the specialists as Sub-workflow Tools. | **Thursday** |
| 2 | **Rescheduling (decision)** | Decides *whether to invoke* the catch-up check and phrases the outcome per D16. The check itself, G1–G8, is code. | **Thursday** |
| 3 | **Interaction screening** | Screens the whole aggregated profile against `interactions`. Grounded per D27. | **Thursday** |
| 4 | **Profiler** | Drafts a medication profile with a justification per value, for a doctor to verify. | **Thursday** |
| 5 | **Extraction** | Vision model turns a photographed or PDF prescription into a **draft** (D26). | **Stretch — Tuesday** |
| 6 | **Adherence** | Daily conversational check-in; interprets replies and invokes the rescheduler. Telegram substitutes for WhatsApp if attempted. | **Roadmap** |
| 7 | **Travel check** | Photo of a foreign medicine, brand resolved to ingredient, handed to screening. Needs an external lookup D27 forbids faking. | **Roadmap** |

**What the model actually does, said plainly:** it routes, it reads unstructured
input, and it phrases outcomes. It decides no time, dose or interaction (D23).

**Roadmap is said, never shown.** No dead button, no greyed screen, no "coming
soon". `runs` never holds a row for an agent that does not run.

**The patient's own trigger stays.** AU-1 requires the automation to start from
our front end, so "Check my doses" is never replaced by a push.

## D23 · Where the numbers are computed — deterministic code, never the LLM

**The agent decides which tool to call. It never decides what time.** Dose
arithmetic, the catch-up window of G1–G8, the distance between interacting
medicines, the depletion forecast and the schedule built from a dosing pattern
all run in a Code node or in SQL. The LLM reads unstructured input, interprets
"I took it late", chooses a specialist and phrases an outcome. Every clinically
meaningful output passes the deterministic layer before it reaches a person.
This is a non-negotiable in `CLAUDE.md` and guardrail G11.

## D24 · The data model — what lands in Saturday's migration

Everything below lands in one migration, not a second one mid-week.

**Pharmacist-entered fields** on `prescriptions`: `units_per_package`,
`total_quantity_dispensed`, `dispense_date`, `brand_dispensed`. Strength,
frequency and dispense date are non-negotiable — the schedule engine and the
depletion forecast (D28) cannot exist without them.

**Source** (D21): `source_facility`, `source_sector` (`public | private`),
`source` (`jurah_doctor | imported | patient_entered | extracted`).

**Secondary clinical fields:** `route` (oral, injection, syrup, inhaler,
topical), `indication`, `drug_name_generic` and `drug_name_brand` as separate
columns. `doctor_id` is nullable. Every column a policy filters on is indexed.

**Who gets the alert when `doctor_id` is null.** An alert goes to **every doctor
linked to that patient**. If none is linked, it is still written and shown to
the patient — "we could not reschedule this, and you have no doctor connected to
tell" — and delivered to the first doctor who links. Never silently dropped.

**Tables are ten:** `profiles`, `doctor_patients`, `prescriptions`,
`prescription_drafts` (D26), `doses`, `medications`, `interactions`, `runs`,
`alerts`, `audit_log` (D30). BE-3 asks every member for one sentence per table;
the ten sentences are in `docs/technical-plan.md` §2.4.

## D25 · Who may read and write a prescription. Supersedes the old two-people rule.

"Readable by exactly two people, its patient and the doctor who wrote it" cannot
survive aggregation — an imported prescription has no doctor, and the doctor
must see the full list.

- **Read:** the patient, and any doctor linked through `doctor_patients`.
  Nobody else, ever.
- **Write:** the patient, for rows whose `source` is not `jurah_doctor`; the
  authoring doctor, for rows whose source is. Nobody else.
- `doses`, `runs`, `alerts`, `audit_log` inherit through the patient.
- `interactions` and `medications`: readable by every authenticated user,
  written only through the D11a verification path.

**Consequence for `scripts/verify-rls.ts`:** a patient inserting their own
outside prescription is now the core feature, so the script signs in as the
patient with the anon key and inserts directly — the service role key is not
needed anywhere in it. What must be asserted, and was not before: B cannot
insert with `patient_id = A`; B cannot set `source = 'jurah_doctor'`; an
unlinked doctor reads nothing of A's; a linked doctor cannot update a
prescription they did not author. Each is a `with check` clause, which is
exactly the hole `CLAUDE.md` warns about. Full probe list: technical plan §4.

## D26 · Extraction drafts. It never writes a prescription. Scopes G8.

The extraction agent writes to **`prescription_drafts`**, never to
`prescriptions`. The patient sees each extracted field beside the image, corrects
it, and accepts; only that accept creates the prescription. **No agent writes a
`prescriptions` row.** The pattern is deliberately the same in three places:

| Agent drafts | Human accepts | Decided in |
|---|---|---|
| Profiler drafts a medication profile | A doctor verifies it | D11a, D17 |
| Rescheduler proposes a new dose time | The patient accepts it | D15 |
| Extraction drafts a prescription | The patient accepts it | D26 |

A refusal still needs no consent (D15). Only a change to someone's medication
waits for a human.

## D27 · What "grounded" means on Thursday

The principle — screening runs over an authoritative reference, never model
knowledge — is adopted without exception; the corpus is staged. **Thursday's
reference is our own seeded `interactions` and `medications`**, 25 and 25, every
row carrying a named source. RxNorm ingestion is roadmap; DrugBank licensing is
not a five-day problem.

To keep G4 literally true, a doctor verifying a drafted interaction **writes it
into `interactions`** with their own id as its source. The agent reads one table
and only one table. Nothing it cites is a model recollection at the moment of
citing.

## D28 · Depletion and refill

**Depletion forecasting ships, and it is arithmetic.** From `dispense_date`,
`total_quantity_dispensed`, dose per administration and frequency, a SQL view
computes the run-out date and warns before it. No model involved.

**The view must be `security_invoker`.** A Postgres view runs as its owner
unless created `with (security_invoker = true)`, which would hand every user
every patient's rows straight through RLS. Invisible until a second account
looks, which is why `verify-rls.ts` probes it like a table.

**In-app refill requests are roadmap.** The routing rule is recorded now so it
is not invented later: capped at the authorised duration, public prescription to
a public pharmacy, private to private.

## D29 · The screen map, updated for D21. Supersedes D20.

```
PUBLIC
  /                           landing, no login wall                 SH-1
  /sign-in                    both roles                             FE-2
  /sign-up                    patients only — name, civil ID, email  BE-4

PATIENT
  /dashboard                  today's doses · mark taken or skipped ·
                              Check my doses · the agent's proposals FE-5 AU-2
  /prescriptions              ALL my medicines, each with its source
                              badge: which clinic, public or private  FE-2 D21
  /prescriptions/[id]         one medicine, its doses and history     BE-2
  /prescriptions/add          add a prescription I was given
                              somewhere else — the aggregation point  D21
  /prescriptions/drafts/[id]  STRETCH — accept or correct an
                              extraction draft, field beside image    D26
  /history                    my audit trail: who changed what, when  D30

DOCTOR
  /doctor                     my patients                             D5
  /doctor/patients/add        add by civil ID or email, exact match   D7
  /doctor/patients/[id]       adherence for the past week, the full
                              aggregated list across every clinic,
                              and that patient's audit trail          D21 D5 D30
  /doctor/prescriptions/new   write a prescription                    D5
  /doctor/alerts              refusals raised by the agent            AU-6
  /doctor/medications         verify drafted profiles                 D17
```

Fifteen routes, fourteen of them Thursday scope; `/prescriptions/drafts/[id]`
ships only if the extraction stretch lands.

**Two that carry D21 and must not be cut:** `/prescriptions/add`, without which
no prescription can enter from outside and the aggregation claim is seeded
fiction; and the full list on `/doctor/patients/[id]`, which *is* the second
failure point being solved. If Tuesday runs short, cut from the bottom of the
doctor list upward, with those two exempt. The four checklist screens are never
at risk.

**The stranger's unaided path (FE-1):** today's doses with times, each badged
with where it came from, and a button underneath. The badges make a stranger
understand in two seconds that this app knows about more than one doctor.

---

# Added 19 September, evening — D30 and D31

## D30 · The audit trail — decided

**Every write to clinical data leaves an append-only `audit_log` row, written by
a database trigger.** Not by application code, which can forget; not by the
agent, which must not be trusted to report on itself.

One row records: when, who (`actor_id` and whether they were a patient, a
doctor, an agent run or the system), which table and row, the action, the row
before and after as JSON, the `run_id` if an agent caused it, and the patient
the row is about — so RLS can scope it exactly like `prescriptions`.

**Who reads it.** The patient reads their own trail at `/history`. A linked
doctor reads it on `/doctor/patients/[id]`. Nobody else. **Nobody writes it
directly:** the table has select policies and no insert, update or delete
policy for `authenticated` at all; the trigger function is the only writer.

**Why it is a goal and not a nice-to-have.** It is what makes the security
claims checkable rather than asserted: a judge can see every change to a
prescription, including the agent's proposals and who accepted them. It backs
BE-5 (every run leaves a row) from the other side — every row the run touched
names the run. And it is the record a real deployment would be required to keep.

**Not in scope:** an admin console, retention policies, exporting the trail.
Roadmap, said not shown.

Tables audited: `prescriptions`, `prescription_drafts`, `doses`, `medications`,
`interactions`, `alerts`, `doctor_patients`. Not `runs` (it is already a log),
not `profiles` (no clinical data), not `audit_log` itself. Schema and policy:
`docs/technical-plan.md` §2.2, §3.5.

## D31 · Web app first, native app later — decided

Thursday's product is a web app at a public URL, mobile-portrait first. A native
app (iOS and Android) follows after the capstone. The decision that matters
today is what it constrains **now**, so that the native app is a new front end
and not a rewrite:

- **Business logic never lives in a React component.** Schedules, catch-up
  decisions, depletion and audit are Postgres functions, triggers and views;
  orchestration is n8n; anything else server-side is a route under
  `src/app/api/**`. A component renders and calls.
- **`src/app/api/**` is the future mobile contract.** Every route verifies the
  Supabase session from a bearer token or cookie, takes JSON, returns JSON, and
  is documented in `docs/api.md` as it is built (Lane C).
- **Auth is Supabase's**, so the same accounts, tokens and RLS policies serve a
  native client with no server change.
- **Strings live in `src/i18n/**`**, two files, so the same translations move.
- The 390px-first rule is not only for the judge's phone; it is the layout the
  native app inherits.

Nothing about the native app is built this week. No store listing, no
Expo project, no "download the app" button.

---

## Still open

- Which of D22's Thursday four Lane C builds first. `.plans/c.md`.
- How the source badge is rendered per medicine. Lane B, `.plans/b.md`.
- The email provider for D6. Needs a credential from the lead; never invented.
- Whether the extraction stretch is attempted. The lead decides Tuesday.

# Agent guardrails — the numbered list

Owner: Lane C. Checklist items **AU-4** (a written guardrail list with numbers
on it, and one rule changed because a rehearsal broke it) and **AU-5** (an
approved tool, and what it is and is not allowed to do).

G1–G8 govern the **rescheduling agent**. G9 governs **extraction**, G10 governs
the **orchestrator**, and G11 is the rule that binds all seven agents in
`PRODUCT-DECISIONS.md` D22. Every tool and its limit is listed under *The
approved tools* below.

> **Jur'ah is a student prototype and all of its data is sample data. It does
> not give medical advice.** The rules below are derived from published general
> guidance on missed and delayed doses so that the agent's behaviour can be
> *cited* rather than invented. They are not a clinical protocol, they have not
> been reviewed by a pharmacist, and the app tells every user to follow their
> own doctor and pharmacist.

---

## Why these numbers exist

The agent decides whether a missed dose may be caught up. Every threshold it
uses is taken from published guidance and carries its source, because the rule
we set ourselves in `PRODUCT-DECISIONS.md` D11a is that **the agent never states
a clinical fact it cannot cite**.

The anchor figure comes from the NHS Specialist Pharmacy Service: *"For most
medicines, it is acceptable to take a dose up to 2 hours late."* Everything else
is an exception to that.

---

## The guardrails

**G1 · Never double dose.**
The agent may never place a catch-up dose so that two doses of the same
prescription fall closer together than that medicine's minimum gap. Published
guidance is unconditional: never take a double dose to make up for a forgotten
one unless a prescriber says so.
*Source: NHS SPS, "Advising on missed or delayed doses of medicines".*

**G2 · The 2-hour default.**
A missed dose that is **2 hours late or less** may be caught up, for any
medicine that is not time-critical (G5) and whose profile is verified (G7).
*Source: NHS SPS — "for most medicines, it is acceptable to take a dose up to
2 hours late".*

**G3 · Past 2 hours, frequency decides. ← this is the rule we expect to change**
- Taken **once or twice a day**: may still be caught up, but only if the next
  dose is **not due within 4 hours**.
- Taken **more than twice a day**: refuse. Skip it and wait for the next
  scheduled dose.

*Source: NHS SPS. The guidance says "as long as the next dose is not due within
a few hours"; we have made "a few hours" concrete as 4.*

> **Starting value set 19 September 2026: 4 hours.**
> AU-4 requires one rule to change because a rehearsal broke it. This is that
> rule — the 4 is our number, not the guidance's, and rehearsal will tell us
> whether it refuses too much or too little. Record the old value and the date
> here when it changes.
>
> | Date | Old | New | What the rehearsal showed |
> |---|---|---|---|
> | | 4h | | |

**G4 · Respect the interaction table.**
A dose may not be rescheduled to a time that puts it closer to an interacting
medicine than that pair's `min_hours_apart`. The agent may **never** assert an
interaction that is not a row in the `interactions` table.

These are real published quantities, not invented ones — for example
levothyroxine and calcium or iron are separated by 4 hours, tetracyclines and
mineral supplements by 2–4 hours, and fluoroquinolones by 2–4 hours before or
4–6 hours after such preparations.
*Sources: Patient.info, Drugs.com interaction monographs; each seeded row
carries its own source.*

**G5 · Time-critical medicines are never rescheduled automatically.**
For these the agent always refuses and alerts the doctor, whatever the clock
says. The Institute for Safe Medication Practices defines a time-critical
medicine as one where being more than **30 minutes** early or late may cause
harm, and the Royal College of Emergency Medicine teaches the group as
**MISSED**.

In scope for us: Parkinson's medicines (levodopa), insulin, anti-seizure
medicines, anticoagulants including warfarin and the DOACs, and the
narrow-therapeutic-index drugs warfarin, lithium and digoxin.
*Sources: NHS SPS "Defining time critical medicines"; RCEM MISSED.*

**G6 · Named exceptions override G2 and G3.**
Where published guidance gives a medicine its own window, that window wins:

| Medicine | Window |
|---|---|
| Anti-seizure, twice daily | within 6 hours |
| Warfarin | same day before midnight, otherwise skip |
| Parkinson's / levodopa | immediately on remembering — refer, do not reschedule |
| Methotrexate, weekly | within 2–3 days, otherwise skip |
| Insulin, immunosuppressants, cancer medicines | refer to the specialist; never auto-reschedule |

*Source: NHS SPS, "Advising on missed or delayed doses of medicines".*

**G7 · Unknown means refuse.**
If the medicine has no profile, or its profile has not been verified by a
doctor, the agent refuses and raises an alert. It never guesses and it never
treats "unknown" as "probably fine". **Fail closed.**

**G8 · The agent's authority has a hard ceiling.**
The agent may move a dose in time. It may **never** create or alter a
prescription, raise a strength, extend a course, or change what medicine a
patient is on. Those belong to the doctor alone.

**G9 · Extraction produces a draft, never a prescription.**
The extraction agent reads a photographed or PDF prescription and writes the
structured result to `prescription_drafts`. It **may never** write a row to
`prescriptions`. The patient opens the draft, sees each extracted field beside
the image it came from, corrects what is wrong, and accepts — and only that
accept creates the prescription.

A field the model could not read is written `null` and flagged for the patient.
It is never guessed, and a draft missing strength, frequency or dispense date
cannot be accepted at all, because D24 makes those three the values the schedule
engine and the depletion forecast are built on.
*Source: `PRODUCT-DECISIONS.md` D26; the same draft-then-human-accepts shape as
D11a and D15.*

**G10 · The orchestrator routes. It does not act.**
The orchestrator may invoke the named specialist sub-workflows and nothing else.
It **may not** call the dose-move function itself, write to any table other than
`runs`, or answer a clinical question directly when a specialist exists for it.
If no specialist covers the request, it refuses and says so — it never improvises
a clinical answer because routing failed.
*Source: `PRODUCT-DECISIONS.md` D22.*

**G11 · No agent computes a number.**
Every agent decides *which* tool to call. None decides *what time*. Dose
arithmetic, the catch-up windows in G2, G3 and G6, the interaction distance in
G4, the depletion forecast and the schedule built from a dosing pattern all run
in a **Code node or in SQL**. A model never emits one of these values into a
response that is then trusted.

The model's job is language and routing: reading an unstructured prescription,
interpreting "I took it late", choosing a specialist, and phrasing an outcome a
patient can understand. Every clinically meaningful output passes the
deterministic layer before it reaches a person.

This is the single most important line in this file. A guardrail that a model
evaluates in its own prose is not a guardrail.
*Source: `PRODUCT-DECISIONS.md` D23; `CLAUDE.md` non-negotiables.*

---

## The approved tools, and their limits — AU-5

AU-5 asks for the tool, what it may do, and what it may not. There are four on
Thursday, one per running agent. Each limit is written here and enforced in the
database policy the function runs under.

**1 · `reschedule_dose(dose_id, new_time)` — the rescheduling agent.**
- **May** update `doses.scheduled_at` for a dose belonging to the patient who
  started the run, after G1–G8 have passed in code.
- **May not** insert or update a row in `prescriptions`, change a dose's medicine
  or amount, touch another patient's rows, or write to `interactions`.

**2 · `screen_interactions(patient_id)` — the interaction screening agent.**
- **May** read the patient's whole aggregated profile and every row of
  `interactions`, and return the pairs that match.
- **May not** return a pair that is not a row in `interactions` (G4), write to
  any table, or read a profile that is not the one the run belongs to.

**3 · `draft_medication_profile(medicine)` — the profiler.**
- **May** insert a row into `medications` with status `unverified`, every value
  carrying its justification.
- **May not** set a row to `verified` — only a doctor may, through
  `/doctor/medications` — and may not overwrite a row that is already verified.

**4 · `extract_prescription(image)` — the extraction agent, Tuesday stretch.**
- **May** insert one row into `prescription_drafts` for the patient who uploaded
  the image.
- **May not** write to `prescriptions`, guess a field it could not read, or
  create a draft for any other patient.

**The orchestrator holds no tool of its own.** It holds the other four as n8n
Sub-workflow Tools and a write to `runs`. That is G10.

**Every tool write is audited.** Each tool's database write runs under the run's
id, so the `audit_log` row it produces names the run (`PRODUCT-DECISIONS.md`
D30, technical plan §3.5). A judge can open the trail and see exactly what the
agent changed, and that it changed nothing else.

---

## What is NOT a rule here, and why

An earlier draft considered "half the gap to the next dose" as the catch-up
window. **No published guidance uses a half-interval principle.** It was
dropped, because a rule we cannot cite is exactly what D11a forbids.

---

## Sources

- NHS Specialist Pharmacy Service — *Advising on missed or delayed doses of medicines*
  https://sps.nhs.uk/articles/advising-on-missed-or-delayed-doses-of-medicines/
- NHS Specialist Pharmacy Service — *Defining time critical medicines*
  https://sps.nhs.uk/articles/defining-time-critical-medicines/
- Royal College of Emergency Medicine / NASMeD — time critical medications (MISSED)
  https://aace.org.uk/wp-content/uploads/2026/06/AACE-TIME-CRITICAL-MISSED-MEDICATIONS-06.2026-CJ.pdf
- Patient.info — *Iron and levothyroxine interaction*
  https://patient.info/medication-interactions/iron-and-levothyroxine-interaction
- Drugs.com — interaction monographs (per-row sources recorded in the seed)
  https://www.drugs.com/drug-interactions/

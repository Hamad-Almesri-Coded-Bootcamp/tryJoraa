# Cleaning log

Owner A. Every decision made about messy data, with the reason next to it.

The test a judge runs: *pick any line, and the team explains why they chose that
over the other option.* So every row here names the option not taken. A reason
that only argues for the choice is not a reason.

---

## Identifiers

| Decision | Why, and what we did not do |
|---|---|
| `profiles.civil_id` is `text`, not a number | A Kuwaiti civil ID can begin with a zero and nobody ever does arithmetic on one. Stored as `numeric` or `bigint`, `029...` silently becomes `29...` and two different people can collide. We took the storage cost of text over a class of bug that is invisible until someone's ID is wrong. |
| Civil ID validated as exactly twelve digits, not with a checksum | The real format has a check digit. We rejected checksum validation because the demo data is invented — a correct checksum would mean generating real-looking national IDs, which we did not want in a public repo. Twelve digits catches typos without pretending to be real. |
| `civil_id` is `unique`, and a collision refuses the signup | One person, one ID. The alternative was to let duplicates in and clean up later, which in a medication app means two patients sharing a prescription list. We also rejected a "is this ID taken?" endpoint that would have made the error friendlier — it answers for anyone holding the public key, which is an enumeration oracle over who is registered. |

## Drug names

| Decision | Why, and what we did not do |
|---|---|
| Generic name and brand name are **separate columns**, not one "drug" field | `Euthyrox` and `levothyroxine` are the same medicine; a patient reads the box, a doctor reads the ingredient, and the interaction check needs the ingredient. One field would have forced every reader to parse. |
| Generic names stored **lowercase**; brands stored as printed | The interaction check joins on the ingredient string, so `Warfarin` and `warfarin` failing to match is a missed safety warning — a class of bug worth a normalisation rule. Brands keep their capitals because they are what is printed on the box the patient is holding. |
| `medications` is keyed by **ingredient**, not by product | `ingredient text not null unique`. One row for paracetamol, not one per brand of it. The alternative — a row per product — would have meant the reference facts (time-critical, catch-up window) repeated and able to disagree with themselves. |

## Times and dates

| Decision | Why, and what we did not do |
|---|---|
| `scheduled_at` is `timestamptz`; `start_date` and `dispense_date` are `date` | A dose is due at an instant and must survive a timezone change. A refill window is a calendar day — storing it as a timestamp invents a time that nobody chose and makes "expires today" ambiguous at midnight. |
| Dose times are generated in **Asia/Kuwait** and stored as absolute instants | The alternative, storing local wall-clock time, breaks the moment anyone opens the app from another timezone — and a medication schedule that shifts when you travel is worse than useless. |
| `duration_days` counts **calendar days**, not dosing days | A ten-day alternate-day course doses on five of them. Both readings are defensible; we wrote it down because a teammate reading it the other way produces a course twice as long. |

## Interactions

| Decision | Why, and what we did not do |
|---|---|
| A pair is stored once, `unique (ingredient_a, ingredient_b)` | The alternative is storing both directions and keeping them in step. Two rows that can disagree about the same pair is exactly the kind of drift that makes a safety table untrustworthy. |
| `min_hours_apart` is `numeric`, not a boolean "conflicts" | Real guidance is "separate by four hours", not "never together". A boolean would have thrown away the only part of the fact that tells a patient what to actually do. |
| Every row carries a `source` | Demo-grade reference data, not medical advice. A judge can ask where any line came from, and the honest answer has to be in the row, not in somebody's memory. |

## Duplicates and repeats

| Decision | Why, and what we did not do |
|---|---|
| `doses` is unique on `(prescription_id, scheduled_at)` | A slot is identified by its prescription and its time. Without this, `generate_doses` could be called repeatedly over PostgREST and each call re-inserted the whole course — measured at 13,140 rows from five presses. |
| When de-duplicating, keep the dose the patient **answered** | The obvious rule is "keep the oldest". We rejected it: a duplicate the patient marked *taken* carries real information and the untouched twin carries none. Keeping the oldest would silently discard the only row that meant anything. |
| Empty optional text becomes `NULL`, not `''` | Otherwise a blank form field writes an empty string into a nullable column and the audit trail later reads "changed notes from  to ", which is nonsense to anyone reading it. |

## Names shown on screen

| Decision | Why, and what we did not do |
|---|---|
| A missing `full_name` falls back to the email local part, then to `Patient` | Refusing the signup was the alternative. A one-character local part (`a@example.com`) is a legal address, and failing a valid signup to enforce a display name is the wrong trade in the one flow a judge watches. |
| `food_timing` is bilingual free text, not an enum | It holds `قبل الفطور بنصف ساعة · 30 min before breakfast`. It is an instruction to a person, not a status, and the set is not closed. Enumerating it would have forced every real instruction into the nearest wrong box. |

---
name: close
description: The nightly close for the Jur'ah capstone. Run by the boss session at 23:00, unattended. No merging — /ship does that. This is evidence, scoring and tomorrow's first task.
disable-model-invocation: true
---

Run this whole list without stopping to confirm steps. You may be running
headless at 23:00 with everyone asleep. Print the result of each step as you go.

Do not merge anything here. `/ship` owns merging. If open pull requests are
still sitting unmerged when you run this, say so in the summary — that is a
finding, not a job for this skill.

**1. Ship one more time.** Run `/ship` first if the last entry in
`docs/ship-log.md` is more than an hour old. Everything below is measured
against `main` as it stands afterwards.

**2. Prove isolation.** `npm run verify:rls` against the live project, full
output. If it exits non-zero: this is the one thing that stops the night. Find
the policy that is wrong, fix it on a branch, open a PR, and put the failing
output at the top of the summary in capital letters. Do not tick anything else.

**3. Prove the product.** `npm run verify:ui` against the public URL. It signs
in as the patient at 390px, walks the four screens, logs a dose, presses Check
my doses, waits for the run to finish, and screenshots each step. Then it signs
in as the second account and attempts to open the first account's prescription
by id. Save the screenshots under `docs/evidence/<date>/` and say what came back
on the cross-account attempt.

**4. Score it.** Read `REVIEW-CHECKLIST.md` against what is live right now. Tick
only what a judge could check on the deployed site tonight. Untick anything
today's merges broke. Then list, by name, every MUST item still open and which
lane owns it.

**5. Failures log.** Read today's commits, the reverts in `docs/ship-log.md`,
and any CI failures. Write the real ones into `docs/failures.md` as dated lines:
the error, and the change that fixed it. This is a graded item — it is worth
more when it is specific and true than when it is tidy.

**6. Memory.** Append to `docs/memory/boss.md` any decision made today that a
future session would otherwise have to guess at. One line each.

**7. Tomorrow.** For each lane, name its first task tomorrow in one sentence,
taken from `.plans/<owner>.md`. Print the three of them as a block ready to
paste into the group chat.

**8. The two-minute check.** Say which of these three human items has *not* been
done today, because none of them can be automated and all three are graded:

- every person committed under their own name today (check `git log --format='%an' --since=midnight | sort -u`)
- each person explained their own lane out loud to the other two
- Owner C drew the agent on a whiteboard from memory, no laptop

On Monday and Wednesday also confirm the SE-6 security audit ran and that
`docs/security-audit.md` names its findings and the lane owning each fix.

**Finish with four lines:**

```
<n> of 28 ticked.  Furthest behind: <area>, owned by <lane>.
Gates: verify:rls <PASS/FAIL> · verify:ui <PASS/FAIL> · deploy <Ready/Failed>
Blocked tomorrow: <who, on what>
The one thing most likely to stop us shipping on Thursday: <one sentence>
```

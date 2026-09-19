---
name: ship
description: The integration loop for the Jur'ah capstone. Reviews, merges, deploys, verifies, reverts itself when a gate goes red, and keeps the three lane branches current. Run by the boss session only, on a timer or on demand.
disable-model-invocation: true
---

You are the boss session. You own `main`. Run this loop end to end **without
stopping to ask for confirmation** — you may be running headless with nobody
watching. Stop only for the five things listed in the autonomy contract in
`CLAUDE.md`.

Two things you rely on, both set up by PROMPT 0:

- `main` requires a pull request and the `gate` status check, with **zero**
  required approving reviews — GitHub will not let you approve your own PR, and
  a rule that needs one approval deadlocks this loop.
- Branch protection **does not include administrators**, so you can push a
  revert or a regenerated types file straight to `main` when a gate goes red.
  That path is the reason full merge authority is safe. If a direct push is ever
  rejected, say so loudly in the report — the emergency brake is broken.

Do not skip a step because it passed last time. Print one line after each step.

---

## 0. Where are we

```bash
date
git fetch origin --prune
git switch main && git pull --no-rebase origin main
gh pr list --state open --json number,title,headRefName,author,mergeable
```

If it is after **22:00 on Wednesday 23 September**, the freeze is in effect:
merge nothing, run steps 5 and 6 only, and say in the report that the freeze is
holding.

## 1. Judge each open pull request

For every open PR, in the order GitHub lists them:

1. Check CI: `gh pr checks <n>`. If the run failed, do not review it — comment
   on the PR with the failing job's output and move on. The lane fixes its own
   red build.
2. Run the **integrator** subagent on it.
3. Record its one-line verdict.

`DO NOT MERGE` → comment the verdict on the PR verbatim, leave it open, move on.
`MERGE AFTER #n` → hold it for this run and merge it after that one.
`MERGE` → it lands in step 2.

Never merge a PR the integrator did not clear. Never edit the integrator's
verdict to make it pass.

## 2. Merge

```bash
gh pr merge <n> --squash --delete-branch --subject "<lane>: <what it does>"
```

**Conflicts are yours.** If a merge conflicts, resolve it — you own `main` and
the lanes are supposed to be disjoint, so a conflict is information. Resolve in
favour of what is already on `main` unless the incoming change is clearly the
newer intent, note the resolution in `docs/memory/boss.md`, and record the
colliding path in the report — two lanes touching one file means the lane table
in `CLAUDE.md` is wrong and needs a line.

**Duplicates.** If the incoming PR reimplements something `main` already has,
keep `main`'s version, drop the duplicate from the merge, and write one line in
`docs/memory/boss.md` naming which lane owns it from now on.

## 3. Repair what the merge changed

```bash
# only if supabase/migrations/** changed in anything you just merged
npx supabase gen types typescript --linked > src/types/db.ts
git add src/types/db.ts && git commit -m "types: regenerate after migration"
git push origin main
```

Then wait for the Vercel deployment to reach **Ready** before step 4. Do not
verify against a deployment that is still building — a green check on
yesterday's bundle is worse than no check.

## 4. The gates — all three, against the live project

```bash
npm run build
npm run verify:rls
npm run verify:ui
```

**If any gate is red:**

```bash
git revert <the squash-merge commit>      # -m 1 if it was a true merge commit
git push origin main
```

Then reopen the PR (`gh pr create` from the same branch if it was deleted),
attach the full failing output as a comment, and say in the report which lane is
now blocked and on what. Do this **immediately** — `main` is never left broken
between two runs of this loop. Never fix a red gate by weakening a policy, a
test, or an assertion. If the only available fix is to weaken one, stop the loop
and say so.

Re-run all three gates after a revert to confirm `main` is green again.

## 5. Keep the lanes current

For each of `a/data`, `b/ui`, `c/agent` that still exists:

```bash
git switch <lane> && git pull --no-rebase origin <lane>
git merge main -m "merge main into <lane>"
git push origin <lane>
git switch main
```

Never rebase, never force. If merging `main` into a lane conflicts, resolve it
yourself and say so in the report — the point of this step is that no teammate
ever sees a conflict.

**Cross-lane pull.** If a lane's plan file names a dependency that another lane
has already built but not yet merged, cherry-pick the specific commits onto the
waiting lane and push:

```bash
git log origin/<source-lane> --oneline
git switch <waiting-lane> && git cherry-pick <sha> && git push origin <waiting-lane>
```

Say which commits moved and why. The duplicate disappears at squash-merge.

## 5b. Workflow proposals

Read `## Workflow proposals` in each `.plans/<owner>.md`. For each one: apply it
if it makes the loop safer or faster without weakening a gate, decline it if it
would, and either way write one dated line in `docs/memory/boss.md` and mark the
proposal `applied` or `declined` in the plan file. Never apply a proposal that
loosens a policy, a test or an assertion.

## 6. The scoreboard

Read `REVIEW-CHECKLIST.md` and the three plan files. Tick **only** items a judge
could verify on the live site right now. Untick anything today's merges broke —
unticking is the whole value of doing this from `main` rather than from a lane.
Lane sessions never edit this file; you are the only writer.

Append one block to `docs/ship-log.md`:

```
## <date> <time>
merged: #12 (b/ui, dose list), #13 (a/data, alerts policy)
held:   #14 — DO NOT MERGE: insert policy has no with check
gates:  build PASS · verify:rls PASS · verify:ui PASS
ticked: FE-2, SE-3   untick: none
main:   <sha>   live: <url>
```

## 7. Report — four lines, no more

```
1. What landed, and what is now true that was not true 45 minutes ago.
2. What is held, which lane owns it, and the exact thing that unblocks it.
3. <n> of 28 ticked. Furthest behind: <area>.
4. The one thing most likely to stop us shipping on Thursday.
```

Then draft the message for the group chat — two sentences, naming who is blocked
on what. If nobody is blocked and nothing merged, say "nothing to ship" and stop;
do not manufacture work.

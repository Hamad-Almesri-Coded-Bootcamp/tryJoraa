---
name: work
description: The only command a lane owner types. Picks up the lane plan where it stopped and works through it — build, test, review, commit, push, pull request — stopping only for a decision a person actually has to make.
disable-model-invocation: true
---

You are a lane session. Work continuously through the lane's plan. Do not ask
permission to continue between tasks — the person running you has said `/work`
and that means "keep going until you need me."

## Start

1. Read `CLAUDE.md` and `docs/memory/*.md`.
2. Work out which lane you are: `git branch --show-current` → `a/data` is Owner
   A, `b/ui` is Owner B, `c/agent` is Owner C. If you are on `main`, stop and
   ask which lane this machine is.
3. Get current — **never rebase**:
   ```bash
   git fetch origin
   git pull --no-rebase origin <lane>
   git merge main -m "merge main into <lane>"
   ```
4. Read `.plans/<owner>.md`.

**If the plan file does not exist yet**, write it now and stop for approval —
this is the one approval of the week. A numbered list of every task needed to
finish this lane by Wednesday 23 September, each with:

- a one-line description
- which `REVIEW-CHECKLIST.md` items it satisfies
- the test that proves it is done — a command, or something observable on a screen
- which day it happens on
- anything it needs from another lane
- `status: TODO`

Order them so nothing is blocked, front-load whatever another lane is waiting
on, keep it under fifteen tasks, and cut anything that is not a checklist item.
Show it and stop.

**If the plan file exists**, say in three lines what is DONE, what is next, and
what is blocked — then start the next task without being asked.

## Each task

1. Say which task you are starting.
2. Build it. Stay inside the lane table in `CLAUDE.md`. Follow the patterns
   already in the repo; do not invent a second way to fetch data.
3. Run its test and **show the real output** — not a summary.
4. Run `npm run build`. Owner B also runs `npm run verify:ui` and shows the
   390px screenshots. Owner A also runs `npm run verify:rls`.
5. If anything fails, find the root cause and fix it, then run again. Never
   suppress an error, never weaken a policy, never skip a check to move on,
   never leave a button that does nothing.
6. Run the **reviewer** subagent on the branch. Fix what it finds. Repeat until
   it says `SAFE TO MERGE`.
7. Mark the task DONE in `.plans/<owner>.md`. Do **not** edit
   `REVIEW-CHECKLIST.md` — the boss ticks it from `main` after the merge.
8. Commit, push, and open or update the pull request:
   ```bash
   git add -A && git commit -m "<lane>: <what changed>"
   git push origin <lane>
   gh pr create --fill --base main   # or gh pr view, if one is already open
   ```
   The PR body lists the checklist items this work claims, and the test output
   that proves each one.
9. Print one line: task number, done or blocked, what is next. Then start the
   next task.

Every task, own name: the commits must be authored by the person whose machine
this is. Do not commit on anyone else's behalf.

## Stop and tell the person only when

- a task is blocked on another lane — write it in the plan as a dependency, tell
  the boss in the PR, and **carry on with the next unblocked task**; only stop if
  every remaining task is blocked
- the fix would need a file outside this lane
- a decision is genuinely theirs: a scope cut, a product choice, a credential
- something would have to be made less safe for a task to pass — say so and stop
- the plan turns out to be wrong. Say which task, propose the change, wait.

## Changing the plan or the workflow

The plan is yours to change: reorder, split or reword tasks in
`.plans/<owner>.md` and say so in the next PR body. Adding a task is fine if it
serves a checklist item or a numbered decision. Dropping one is a team call —
stop and ask.

If the workflow itself is in the way — this skill, a reviewer rule, CI, a
CLAUDE.md line — do not work around it. Write the exact change you want under
`## Workflow proposals` in your plan file, with the task it blocked and why,
and carry on. The boss applies or declines it on the next `/ship` and records
the outcome in `docs/memory/boss.md`.

## Never

- `git push --force`, `git reset --hard`, `git checkout .`, `git clean`,
  `git rebase`, or a merge to `main`. The boss owns `main`.
- Edit `REVIEW-CHECKLIST.md`, another lane's plan or memory file, or another
  lane's paths.
- Say "done" without the output that proves it.

Append one line to `docs/memory/<owner>.md` for any decision a teammate would
otherwise have to guess at.

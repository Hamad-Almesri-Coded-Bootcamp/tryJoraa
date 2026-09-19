# SETUP — get your laptop ready (15 minutes)

Do every step, in order. Stop and ask in the group chat if a step fails rather
than working around it — a laptop set up differently from the other two is how a
team loses an evening on Tuesday.

You will not type a git command this week after step 4.

---

## 1. Tools

```bash
node -v      # need v22 or later — https://nodejs.org if not
git --version
gh --version # GitHub CLI — https://cli.github.com if not
gh auth login
npm install -g @anthropic-ai/claude-code
claude --version
```

## 2. Tell git who you are

This matters for a graded item: **everybody's own name has to appear in the
commit list, every day.** Claude commits as whoever this machine says it is.

```bash
git config --global user.name  "<your real name>"
git config --global user.email "<the email on your GitHub account>"
```

## 3. Clone the repo and enable the commit guard

```bash
gh repo clone Hamad-Almesri-Coded-Bootcamp/tryJoraa
cd tryJoraa
git config core.hooksPath .githooks
npm install
```

The hook is not optional. A key committed to the repo — even once, even if you
delete it later — fails a MUST item, because the judge searches the **commit
history**, not just the current files.

## 4. Get on your branch

The lead already created all three. Pick yours:

```bash
git switch a/data     # Owner A — data and security
git switch b/ui       # Owner B — front end and shipping
git switch c/agent    # Owner C — agent and demo
```

That is the last git command in this document. From here the boss session keeps
your branch current and takes your work to `main`.

## 5. Environment variables

```bash
cp .env.example .env.local
```

The lead sends you the real values directly. Paste them in.

- `.env.local` is gitignored. Check with `git status` that it does **not** show
  up before your first commit.
- You are not given the service role key, the n8n API key or the webhook
  secret. You do not need them.
- Never paste these values into a pull request, a screenshot, or a shared
  transcript.
- If you think a key leaked, say so in the group chat immediately. Rotating a
  Supabase key takes two minutes. Explaining it to a judge takes the demo.

## 6. Supabase plugin for Claude Code

```bash
claude plugin marketplace add anthropics/claude-plugins-official
claude plugin install supabase@claude-plugins-official --scope project
claude
```

Then inside Claude: `/reload-plugins`. This gives Claude the Supabase RLS
guidance and the MCP server that reads our actual project instead of guessing
at the schema.

## 7. Confirm Claude loaded the project rules

Still inside Claude Code, `/context` should show `CLAUDE.md` loaded. If not,
you are in the wrong directory — `cd` into the repo root and restart.
`/permissions` should show `git push --force`, `git reset --hard`,
`git checkout .`, `git clean` and `git rebase` in the deny list.

## 8. Prove it works

```bash
npm run build
npm run verify:rls
```

`build` must pass. `verify:rls` must exit 0. If `verify:rls` fails on a fresh
clone, that is a real finding, not a setup problem — post the output in the
group chat before you write any code.

## 9. Start

```
/work
```

The first time, it writes your lane's plan — a numbered task list with a test
per task — and stops for you to approve it. That is the only approval of the
week. After that, `/work` is the whole job: it gets the latest version of
everyone's work, picks the next task, builds it, tests it, shows you the
output, reviews itself, commits under your name, pushes, and opens the pull
request. Then the next task.

It stops for four things and four only: a credential, a decision about *what*
we are building, a task blocked on someone else's lane, and anything that would
have to be made less safe to pass. The answer to the last one is always no.

If the plan needs to change — a task is wrong, a better order exists, the
workflow itself is getting in the way — say so to Claude. It edits your plan
file, or writes the proposed workflow change into it for the boss to apply.
Changing the plan is normal; working around it silently is not.

---

## What you no longer do

Pull, rebase, merge, resolve conflicts, open PRs by hand, tick the checklist, run
the nightly close. The boss session on the lead's machine does all of it every
forty-five minutes, on a timer. If Claude ever asks you to run a git command,
something is wrong — tell the lead rather than running it.

---

## Working with Claude well

**Ask for evidence, never the claim.** "It works" is not a result. The build
log, the test output, the screenshot — those are results. You do not need to
understand the code to say *"show me."*

**Say what you want built, not how.** Then let it plan before it codes. Skip the
plan only for changes you could describe in one sentence.

**`/clear` between unrelated tasks.** Claude gets worse as its context fills.
If you have corrected it twice on the same thing, stop correcting — `/clear`,
then `/work`, and add one line saying what just failed and why.

**Never accept a shortcut through a security rule.** If Claude offers to disable
a test or loosen a policy to make an error go away, say no and tell the lead.
It is instructed to refuse this itself, so if it ever offers, the session has
gone bad — `/clear` and start again.

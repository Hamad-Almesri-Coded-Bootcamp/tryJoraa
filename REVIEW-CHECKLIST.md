# REVIEW-CHECKLIST — the 28 MUST items

This is the grading bar, copied from the CODED capstone checklist, with an owner
against each line. **All 28 or the team does not pass.** Source of truth:
https://aifc-slides.vercel.app/capstone

## How to use this file

**Ticking.** Tick an item only when a judge could check it *right now* — not when
you plan to finish it tonight. Untick anything a merge breaks.

**As a review gate.** Give this to a reviewer session in a fresh context:

> Use a subagent to review the diff on this branch against REVIEW-CHECKLIST.md.
> Say which MUST items this diff moves from open to done, which ones it breaks,
> and which ones it claims but does not actually prove. Report only gaps that
> affect correctness, security or a listed item. Ignore style preferences.

**Owners.** A = data & security · B = front end & ship · C = agent & demo ·
ALL = every one of the three.

---

## Area 01 — Front end (5)

- [ ] **FE-1** · B — A stranger who has never seen your app can reach the main result without being told what to click.
  - *Test:* Hand your phone to another team. Say nothing. Watch. If you have to speak, it failed.
- [ ] **FE-2** · B — The app has at least four working screens: a home page, a way to sign in, a dashboard, and a page that lists records. Every link between them works.
  - *Test:* Click through all four in order, then press the browser back button twice. No dead link, no blank screen, no error page.
- [ ] **FE-3** · B — Every form answers the user. After a submit the screen shows success, an error, or a loading state. It never shows nothing.
  - *Test:* Submit one good entry, then one bad entry with a field left empty. Watch the screen both times. Something changes both times.
- [ ] **FE-4** · B — The app works on a phone in portrait. Nothing scrolls sideways, no text is smaller than 12 pixels, and every button can be pressed with a thumb.
  - *Test:* Open the public URL on a phone. Scroll from top to bottom on every screen. Nothing moves sideways.
- [ ] **FE-5** · B — The result the user came for is on the screen. Not in the browser console, not in a database dashboard, not in a chat window.
  - *Test:* Close the developer tools and close your backend dashboard. Do the main job end to end. The answer appears on a page in your app.

## Area 02 — Back end and data (5)

- [ ] **BE-1** · A — Data survives a refresh and a new browser.
  - *Test:* Add a record. Hard refresh. Then open the public URL in a private window, sign in, and find the same record.
- [ ] **BE-2** · A — The app reads its data from the database, not from a list typed inside the code.
  - *Test:* Change one value in a table row from the backend dashboard. Refresh the app. The screen shows the new value.
- [ ] **BE-3** · ALL — Any team member can say, in one sentence per table, what one row of that table is.
  - *Test:* The judge points at any table and asks 'what is one row here?'. The answer is one sentence and it names a real thing.
  - *Our ten answers:* `docs/technical-plan.md` §2.4. Ten tables since PRODUCT-DECISIONS.md D24 and D30. Rehearse out loud Saturday.
- [ ] **BE-4** · A — Real accounts. Two different people sign up separately and each one starts with their own empty space.
  - *Test:* Create a brand new account in front of the judge. It works on the first try, and the new dashboard is empty.
- [ ] **BE-5** · A + C — Every automated run leaves a row behind, with what started it, when it started, its status, and what came out.
  - *Test:* Run the automation once. Open the table. The new row is there with a status and a result, and the time matches.
  - *Ours:* the `runs` row, and every `audit_log` row the run touched carries its `run_id` (D30).

## Area 03 — Security (6)

- [x] **SE-1** · A — Row level security is on, and a second account cannot read the first account's rows.
  - *Test:* Two accounts, two private windows, side by side. Account B opens account A's record ID in the address bar and gets nothing back. Do it in front of the judge.
  - *Our gate:* `npm run verify:rls` must exit 0. Run it nightly and before every merge.
- [x] **SE-2** · A — No key, token or password appears anywhere in the repository, including the commit history.
  - *Test:* Open the repo and search it for key, secret, password, token and eyJ. Then open the history of any file that ever held configuration. Nothing comes back.
- [x] **SE-3** · A — Your app never stores a password itself, and no password is ever shown on any screen or in any table.
  - *Test:* Open the users table in front of the judge. There is no readable password column anywhere.
- [ ] **SE-4** · B — The public URL is HTTPS on every screen, and nothing on the page loads over plain HTTP.
  - *Test:* Look at the address bar on the landing page and on the dashboard. Then open the browser console and check there is no mixed content warning.
- [ ] **SE-5** · A — Every field the user types into is checked before it is used. Empty, far too long and wrong type entries are refused with a message.
  - *Test:* Paste five thousand characters into a text field and submit. The app refuses, it does not freeze, and no row is created.
- [ ] **SE-6** · A — The team has run an AI security audit of its own project and can show two things it changed because of the report.
  - *Test:* Open the audit output, then point at the two fixes in the code or in the app. Both are already live.
  - *Ours:* the boss runs the gstack `/cso` skill on `main` Monday evening and again Wednesday; the report and each fix's commit go in `docs/security-audit.md`.
  - *Our two fixes:* _______________________ and _______________________

## Area 04 — Automation and agents (6)

- [ ] **AU-1** · C — The automation is triggered from your own front end, not from the n8n canvas.
  - *Test:* Close n8n completely. Press the button inside your app. The workflow runs.
  - *Our trap:* this only passes on the **production** webhook URL with the workflow activated.
- [ ] **AU-2** · B + C — The front end has an automation section where a user can start the process, watch its status, and read the result.
  - *Test:* The judge finds that section without help, presses it, and watches the status change from waiting to done.
- [ ] **AU-3** · C — The process has at least three steps and one decision point, and the team can draw it without opening a laptop.
  - *Test:* Whiteboard, two minutes, no screen. Trigger, three steps, the decision, the result. Then say what sends the decision each way.
- [ ] **AU-4** · C — Your agent has a written guardrail list with numbers on it, and one rule you changed because a rehearsal broke it.
  - *Test:* Read the numbered list out loud. Then name the rule that changed and the rehearsal that forced the change.
  - *Our rule that changes:* guardrail 3, the catch-up window. Record the old value and the date.
- [ ] **AU-5** · C — The agent uses at least one approved tool, and the team can say what that tool is allowed to do and what it is not allowed to do.
  - *Test:* Point at the tool in the workflow. State its limit in one sentence. Then show where that limit is written down.
- [ ] **AU-6** · B + C — A user who never opens n8n or the database can see the outcome of the run inside the app.
  - *Test:* Run it, then find the result on a screen in your product, with the backend dashboard closed.

## Area 05 — Ship it and show it (6)

- [x] **SH-1** · B — The public URL opens for a stranger in a private window, with no login wall on the landing page.
  - *Test:* Private window, paste the URL, do not sign in. You can see what the product is and what it does.
- [x] **SH-2** · B — What is live is what is in main. The repository is current, not three days behind the demo.
  - *Test:* Change one word on a page, push it, and watch the live site change while the judge watches.
- [ ] **SH-3** · B — The repository front page says what the product does in three lines, and names the people with the part each one owned.
  - *Test:* Open the repo. Read the front page. Names, jobs, three lines about the product.
- [ ] **SH-4** · B — The live demo runs from the public URL, on the room network, on a machine that did not build it.
  - *Test:* Open the URL on a different laptop and do the main job. The address bar shows your public URL, never localhost.
- [ ] **SH-5** · C — The team has rehearsed the full demo end to end at least twice, and knows what broke in the second rehearsal.
  - *Test:* The judge asks when they rehearsed and what broke. Every member gives the same answer.
  - *What broke in rehearsal 2:* _______________________
- [ ] **SH-6** · ALL — Every one of the team can explain one part of the build in their own words, with no slides and no reading.
  - *Test:* The judge picks a member at random, points at a screen, and asks what happens when this button is pressed.

---

## Where the marks above the bar are (21 SHOULD)

Only after all 28 above are ticked. These are where the technical-execution and
completeness marks are won — full text on the checklist page.

**Front end** — empty states written · anyone can name the user in one sentence ·
error messages speak human · one name, colours and font across every screen.

**Back end** — full create/read/update/delete on one table from the front end ·
correct column types · a second linked table used on a real screen ·
demo data looks real (Kuwaiti names, dinars, real dates).

**Security** — the blast-radius sentence · the three biggest threats, each with
an action · signing out really signs out · you know which pages are open to
anyone and why that is safe.

**Automation** — why this is an agent, not an automation · one human checkpoint ·
a failed step says "failed" with a reason · the by-hand simulation notes ·
model-written text shows what it was based on.

**Ship it** — commits from more than one person on more than one day · the demo
opens with the user's problem · build failures written down with the fix ·
a screen recording on the presenting laptop for when the WiFi dies.

# Lane A — data & security

Owner A. Branch `a/data`. One task at a time, each with the command or screen
that proves it. `CLAUDE.md` → Plan → build → prove.

Ticked in `REVIEW-CHECKLIST.md` already: SE-1, SE-2, SE-3.
Open and owned by A: **SE-5**, SE-6, BE-1, BE-2, BE-4, BE-5 (with C).

---

## A1 — SE-5: every input checked before it is used · Sat 19 Sep

**The finding this starts from.** `handle_new_user()` copies
`raw_user_meta_data->>'full_name'` and `->>'civil_id'` straight into `profiles`,
and every `text` column in `20260919120000_init.sql` is unbounded. Zod guards the
sign-up *form*, but the form is not the only way in — the anon key is public, so
this runs from any browser console and creates the row:

```js
supabase.auth.signUp({
  email: 'x@example.com', password: 'hunter2hunter2',
  options: { data: { full_name: 'x'.repeat(5000), civil_id: 'x'.repeat(5000) } },
})
```

SE-5 says the check happens *before the value is used*, and the database is where
it is used. Client validation is the message; the constraint is the guarantee.

| # | Task | Serves | Proves it |
|---|---|---|---|
| A1.1 | `src/lib/validation/limits.ts` — one table of field limits, imported by Zod and mirrored in SQL so the two can never drift | SE-5 | `npm run build` |
| A1.2 | Migration `..._input_limits.sql` — `char_length` CHECKs on every user-writable text column across the ten tables, plus `civil_id ~ '^\d{12}$'` | SE-5 | migration applies; 5,000-char insert raises `check_violation` |
| A1.3 | Harden `handle_new_user()` — refuse over-long or malformed metadata instead of copying it | SE-5 | the console bypass above returns an error and creates no row |
| A1.4 | `src/lib/validation/prescriptions.ts` — the schema B's form imports, limits from A1.1 | SE-5, FE-3 | `npm run build`; handed to B |

**Done when:** the 5,000-character paste is refused with a message, the app does
not freeze, and no row is created — *and* the same paste sent straight to
Supabase with the anon key is refused by the database too.

**Needs from B:** the create/edit prescription form imports
`src/lib/validation/prescriptions.ts` rather than writing its own rules.

**Note on proving A1.2/A1.3.** The live database (`frvubflbpujwuhsxweue`) is the
lead's and this session cannot reach it. The migration is proved on a scratch
Supabase project by applying `init.sql` and then this migration to an empty
database and running the rejection cases there. The lead still has to apply it
to the real project — that is a handoff, not a tick.

---

## A2 — SE-6: AI security audit + two live fixes · Mon 21 Sep

Boss runs the `/cso` skill on `main` Monday evening. A writes up
`docs/security-audit.md` and ships two fixes. The checklist's two blanks get
filled with the commit for each.

Candidate already in hand: the `handle_new_user` metadata hole above, if A1.3
has not already closed it by then.

## A3 — BE-5: every run leaves a row · with C

`runs` row plus every `audit_log` row carrying its `run_id` (D30). Blocked on C's
workflow calling `/api/runs`.

## A4 — BE-1, BE-2, BE-4 · needs B's screens

Data survives refresh and a private window; the app reads from the database; a
new account starts empty. All three are proved through the UI, so they wait on B.

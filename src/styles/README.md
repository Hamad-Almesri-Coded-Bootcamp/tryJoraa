# Design inventory — Lane B

The import, once, read by every Lane B session and subagent before it styles
anything. Values live in `tokens.css`; this file says where they came from and
how the board's pieces map to routes and components.

## Source

Claude Design project **"Wireframe board for healthcare app"**
(`ee786794-f18a-437e-bd4f-e43bf1c0f30b`), read through the DesignSync tool on
19 Sep 2026. Files in the project:

| File | What it is | Used for |
|---|---|---|
| `Jurah Wireframe.dc.html` | 13 phone artboards at 390px with state variants, plus a "Responsive system" section at 768 and 1440 | **the source of every screen** |
| `Jurah Website.dc.html` | a desktop marketing page (hero, problem cards, features, CTA band, footer) | not built — see Deviations in `.plans/b.md` |
| `Jurah Flow Map.dc.html` | the three-lane flow map (public / patient / doctor) | navigation order and the FE-1 path; no styling |
| `support.js` | the `dc-runtime` renderer | nothing — it is a runtime, not a design system |
| `screenshots/*.png` | four PNGs of the add-patient screen | nothing |

**There is no `_ds/`, `tokens/*.css` or `*_bundle.js` in the project.** The
design system is the five-colour legend at the top of the wireframe board plus
the inline styles the artboards repeat. `tokens.css` is that legend and those
repeats, named. Every value in `tokens.css` traces to a line in the board.

## Fonts

Board: `'IBM Plex Sans','IBM Plex Sans Arabic',sans-serif`, weights 400/500/600/700,
loaded from Google Fonts. **IBM Plex Sans has no Arabic glyphs; IBM Plex Sans
Arabic is the paired face and is already in the board's stack**, so no
substitution is needed. Loaded through `next/font/google` (`IBM_Plex_Sans`,
`IBM_Plex_Sans_Arabic`, both exported by Next 16) as CSS variables
`--font-plex` and `--font-plex-arabic`; `--font-sans` in `tokens.css` chains them.

## Type scale — a systematic collision, resolved once

The board's own responsive note says "no text under 12px", yet its artboards use
9.5/10/10.5/11/11.5px several hundred times. CLAUDE.md and FE-4 floor at 12px.
The mapping is in `tokens.css` and is applied everywhere, never per screen:

| Board px | Token | Where the board uses it |
|---|---|---|
| 9–11.5 | `text-xs` 12px | pill labels, uppercase section labels, meta lines, tab labels, safety line |
| 12–12.5 | `text-sm` 13px | card body, helper text, proposal/refusal text |
| 13–14 | `text-base` 14px | field labels, buttons, card titles, app-bar title |
| 15–16 | `text-lg` 16px | empty-state titles, the Check my doses button |
| 17–18 | `text-xl` 18px | form-screen titles |
| 20 | `text-2xl` 20px | landing headline (phone) |
| 24–28 | `text-3xl` 28px | landing headline (desktop) |

Same for tap targets: the board floors at 44px in its note but draws 36px ✓/✗
squares and 40px card buttons. Everything pressable is `min-h-11` (44px);
the one primary CTA per screen is 48px.

## Artboards → D29 routes

| # | Artboard (board label) | D29 route | Status |
|---|---|---|---|
| 1 | `/` landing (AR) + 1440 hero split | `/` | build |
| 2 | `/sign-in` (EN) + loading/error/success + 1440 card | `/sign-in` | build |
| 3 | `/sign-up` (AR) + states + 1440 card | `/sign-up` | build |
| 4a–d | `/dashboard` normal · all-clear · new account · EN mirror; 768 stacked; 1440 two-pane AR+EN | `/dashboard` | build |
| 5a–c | `/prescriptions` populated · empty · EN mirror; 768 grid; 1440 table | `/prescriptions` | build |
| 6 | `/prescriptions/[id]` detail + 1440 two panes | `/prescriptions/[id]` | build |
| 7 | `/prescriptions/add` + states + 1440 form | `/prescriptions/add` | build |
| — | no artboard | `/prescriptions/drafts/[id]` (stretch) | build in idiom if confirmed Tuesday |
| — | no artboard | `/history` | build in idiom |
| 8a–b | `/doctor` populated · empty; 1440 sidebar + table | `/doctor` | build |
| 9a–b | `/doctor/patients/add` + not-found; 1440 | `/doctor/patients/add` | build |
| 10 | `/doctor/patients/[id]` "the pitch screen"; 768; 1440 EN + AR | `/doctor/patients/[id]` | build; audit-trail section has no artboard, built in idiom |
| 11 | `/doctor/prescribe` + states; 1440 | `/doctor/prescriptions/new` | build under the D29 path |
| 12a | `/doctor/alerts` list | `/doctor/alerts` | build |
| 12b | `/doctor/alerts/[id]` detail | **no D29 route** | not built as a route; proposed as an expandable detail inside `/doctor/alerts` — lead decides |
| 13 | `/doctor/drafted` + 768 + 1440 list/detail | `/doctor/medications` | build under the D29 path; tab label follows D29 |
| — | `Jurah Website.dc.html` | `/` is already artboard 1 | extra marketing sections not built — lead decides |

## Component canon

The markup pattern the board actually repeats, and the Tailwind classes (all
token-backed) the build uses for it. One component file each under
`src/components/`.

| Component | Board pattern | Build |
|---|---|---|
| **App bar** | navy bar, `padding:14px 16px`, title 14px/700 white at start; at end a language chip (10px/700, white on `white/18`, pill) and "Sign out" (11px, `white/75`, underlined). Detail screens prefix the title with `‹` (flips with dir). | `AppBar` — `bg-navy text-white px-4 py-3.5 flex items-center justify-between`; title `text-base font-bold`; chip `text-xs font-bold bg-on-navy-chip rounded-pill px-2.5 py-1`; sign-out is the existing form post |
| **Bottom tab bar** (phone) | `border-top navy/12`, 3–4 equal tabs, each `min-height:44px`, 11px; active tab navy bg + white + 600. Patient: Dashboard · Prescriptions · Sign out. Doctor: Patients · Alerts · Drafted · Sign out. | `TabBar` — `flex border-t border-line`; tab `flex-1 min-h-11 text-xs`; active `bg-navy text-white font-semibold`. Patient bar gains **History** (no board entry, D29 route); doctor "Drafted" is labelled **Medications** (D29) |
| **Top bar links** (≥768) | tab bar replaced by links in the app bar centre; 1024+ doctor gets a 180px start sidebar (Patients · Medications) | same `TabBar` component, `md:` variant renders inline in `AppBar`; `DoctorSidebar` at `lg:` |
| **Safety line** | `bg-surface`, 10px, `border-inline-start:3px navy`, `padding:8–10px 16px`, one language, truncated | existing `SafetyLine` restyled: `bg-surface text-xs text-navy border-s-[3px] border-navy px-4 py-2`, **both languages, full text from i18n** (rule wins) |
| **Section label** | 11px/700 uppercase `letter-spacing:0.04em` soft-navy, e.g. "Today's doses — Wed, 16 Sep 2026" | `SectionLabel` — `text-xs font-bold uppercase tracking-label text-navy-soft` |
| **Dose card** | white, `border 1px navy/12`, `radius 10`, `padding 10px 12px`; row: time · medicine (13px/700) over strength (11px navy/55); status pill or ✓/✗ squares at end. Not-taken variant: `border navy→red/35` + `border-inline-start:4px red`, red 10px/700 note, two 44px buttons "✓ Mark taken" (primary) "✗ Skip" (outline) | `DoseCard` — `bg-white border border-line rounded-md px-3 py-2.5`; variant `data-state=missed`: `border-red-line border-s-4 border-s-red`; buttons are `Button` primary/outline `min-h-11 flex-1`; time and strength in `dir="ltr"` spans; plus the **source badge** (D29, board omits it on phone cards) |
| **Prescription card** | white card; row: generic name 14px/700 · strength 12px muted; frequency line 11.5px muted; source badge | `PrescriptionCard` — same card shell, `text-base font-bold`, `text-sm text-ink-muted`, `SourceBadge` |
| **Source badge** | pill 10px/600 `padding 2px 8px`: **public** = navy text + 1px navy border on white; **private** = white text on soft-navy fill. Text "Facility · Sector" | existing `SourceBadge` restyled: `text-xs font-semibold rounded-pill px-2 py-0.5`; `public`: `border border-navy text-navy`; `private`: `bg-navy-soft text-white`; no sector: `border-line text-ink-muted` |
| **Status pill** | 11px navy on `surface`, pill, `padding 4px 10px`, "✓ Taken" | `StatusPill` — `text-xs bg-surface text-navy rounded-pill px-2.5 py-1`, always carries text |
| **Form field** | label 11px/600 navy over a 44px input: `border 1px navy/25`, `radius 8`, `padding 0 12px`, 13px, placeholder navy/40, white; read-only variant `bg-surface` | `Field` — `<label>` wrapping `<input>`; `text-xs font-semibold` label; input `min-h-11 border border-line-strong rounded-sm px-3 text-base placeholder:text-ink-faint` |
| **Choice chips** | route / sector as pills: selected white on soft-navy; others navy text + `navy/30` border | `ChipGroup` — radio inputs styled as pills, `min-h-11` hit area |
| **Primary button** | navy bg, white, `radius 8`, 14px/600, `min-height 44`; CTA variant 48px 15px/700 | `Button variant=primary` — `bg-navy text-white rounded-sm text-base font-semibold min-h-11 hover:bg-navy-soft disabled:opacity-60`; `size=cta` → `min-h-12 text-lg font-bold` |
| **Secondary button** | white bg, navy text, `border 1.5px navy` | `Button variant=outline` — `bg-white text-navy border-[1.5px] border-navy` |
| **Result panel** (run status) | four inline states: waiting (outline card) · running (spinner + "Checking…") · done (navy fill "✓ Checked") · failed (`border 1.5px red`, red text "Could not run, try again") | `RunStatus` — `role=status`; status → `queued|running|done|failed` from `runs.status`; failed shows the reason |
| **Proposal card** | white card `border navy/15`; tag pill "Proposal" 10px/700 navy outline; body 12.5px; two 40px buttons Accept (primary) / Not now (outline) | `ProposalCard` — reads `reason_ar/reason_en`, `proposed_at`; buttons `min-h-11`; Accept calls the accept endpoint (dependency); Not now dismisses in component state |
| **Refusal card** | white, `border red/35`, `border-inline-start 4px red`; tag pill "Refused" red outline; body 12.5px navy; one outline button "Got it" | `RefusalCard` — plain-words reason only, **no guardrail code** (D16); Got it dismisses in component state |
| **Alert row** (doctor) | refusal-card shell; text 13px "Warfarin reschedule refused — Fatimah Al-Otaibi · today 08:14"; "Acknowledge" 40px outline; acknowledged rows `opacity 0.6` with "Acknowledged" 10px | `AlertRow` — `alerts.reason`, patient name, `created_at`; expandable detail shows `alerts.guardrail` (12b, proposed) |
| **Flag card** | white, `border 2px red`, `radius 12`, `padding 14`; "⚠ Interaction flag" 12px/700 red; body 13px; 11px muted footnote | `FlagCard` — rendered from `alerts` rows with a G4 guardrail, never from a component-side join |
| **Medication-review card** | card; name 13px/700; source 11px muted; either navy-fill pill "Verified by Dr …" or outline pill "Unverified — pending review" + Approve/Reject 40px buttons; desktop detail grid `140px 1fr` of field / drafted value / justification | `MedicationReviewCard` — every `justification` field beside its value (D17); buttons `min-h-11` |
| **Audit sentence row** | no artboard | `AuditRow` — card shell, `text-sm`, sentence built from `table_name/action/before/after`, `text-xs text-ink-muted` timestamp |
| **Past-week dots** | 7 columns: day label 10px muted over 22px circle; taken = navy fill, skipped = red fill, moved = 2px navy ring; legend line | `WeekDots` — `size-dot`; each dot has `aria-label` text (meaning never colour-only) |
| **Empty state** | `padding 36–40px 20px` centred; optional 56px navy circle ✓; title 15–16px/700; body 12.5px muted; optional primary button | `EmptyState` — `text-lg font-bold`, `text-sm text-ink-muted`, `Button` |
| **Loading state** | 14px ring spinner (`2px navy/25`, top navy) + 11px text | `Spinner` + text in `role=status` |
| **Error line** | `border 1px red/40` card or plain red 10.5px text | `text-sm text-red` in `role=status`, human wording from i18n |
| **Not-found state** | not drawn; same idiom as the empty state | keeps `data-testid="not-found"` and the 'لا يوجد' text the e2e spec asserts |
| **Run-out card** | refusal shell (red inline-start); "Runs out on 3 Oct 2026" 13px/700; 11.5px red "14 days left — 30 tablets per pack" | `RunOutCard` — shows `depletion_forecast.runs_out_on` **only**; "days left" is arithmetic and is not computed here (D23) |

Layout shell (from the "Responsive system" note): phone 390–767 single column,
cards full width, bottom tab bar, page `bg-surface`, content `px-4 py-3.5 gap-2.5`;
tablet 768–1023 top bar replaces tabs, panes stack; desktop 1024+ patient
centred column `max-w-[720px]`, doctor sidebar 180px + content ≤1280px.
Directional: everything logical (`ps/pe/ms/me/start/end/border-s`), `‹` and
sidebars flip with `dir`; times, civil IDs and strengths sit in `dir="ltr"` spans.

## Sample data in the board, and what the screens actually render

The board's people and clash do **not** match the seed. Screens render seed rows;
the board's names are illustrative only.

| Board shows | Seeded account it corresponds to (`supabase/seed.sql`) |
|---|---|
| Fatimah Al-Otaibi — patient, a week of history; levothyroxine 50 mcg (Jahra Health Centre · Public), metformin 500 mg + warfarin 5 mg (Al-Amiri Hospital · Public), calcium carbonate 600 mg (Al Shifa Hospital · Private), amlodipine 5 mg (Royale Hayat · Private); clash = levothyroxine × calcium carbonate | **Fahad Al-Kandari** (`DEMO_PATIENT`): levothyroxine 100 mcg imported from Mubarak Al-Kabeer Hospital · public; ferrous sulfate 325 mg patient-entered from Dar Al Shifa Hospital · private (**the cross-clinic clash, G4**); metformin 500 mg written by Dr Noura, Al-Sabah Hospital · public; atorvastatin 20 mg imported, public |
| warfarin refusal (D15/G5 example) | **Mariam Al-Rashidi**: warfarin 5 mg (time-critical refusal), amoxicillin 500 mg private, omeprazole 20 mg by Dr Noura |
| Abdulaziz Al-Rashidi — brand-new patient, empty dashboard | the account Phase 3 signs up live; **Yousef Al-Enezi** is the seeded patient with no doctor linked (amlodipine, imported) |
| Dr. Noura Al-Sabah, linked to Fatimah | **Dr Noura Al-Sabah** (`DEMO_DOCTOR`), linked to Fahad and Mariam |
| "Alerts 3", "1 flag", "Guardrail #7", "14 published guardrails", "Published 1 Sep 2026" | counts and codes come from `alerts` rows; the repo has G1–G11 (`docs/agent-guardrails.md`), so "Guardrail #7" is not reproduced |
| dashboard date "Wed 16 Sep 2026", "it's 13:10" | today's date and the current time, formatted with Intl in Asia/Kuwait |

The RLS_TEST_* accounts are what `verify:ui` signs in as; their rows appear in
the evidence screenshots. DEMO_* credentials are the lead's; a session that does
not hold them asks, never substitutes.

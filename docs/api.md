# API — `src/app/api/**` (Lane C)

Every route is the future mobile contract (PRODUCT-DECISIONS.md D31): it
verifies the Supabase session from the **cookie or an `Authorization: Bearer
<access token>`** header, takes JSON, returns JSON, and does its work as that
user so RLS applies. Secrets are read inside the handler, never at module top
level. Add a section here the day a route is built.

## POST `/api/runs`

Starts one automation run and returns immediately. The browser never calls n8n.

**Auth** — cookie session or `Authorization: Bearer <jwt>`. Missing or invalid → `401 { "error": "Not signed in" }`.

**Body**

```json
{ "kind": "check_doses", "prescriptionId": "optional uuid" }
```

`kind` ∈ `check_doses | profile_medication | screen_interactions | extract_prescription`
(the `run_kind` enum). Validated with Zod in `src/lib/validation/runs.ts`; a
bad body → `400 { "error": "<field>: <message>" }`.

**Effect** — inserts a `runs` row `{ patient_id: <session user>, kind, status: 'queued' }`
as the signed-in user (the `run_insert` policy pins `patient_id`), then
*(Owner C, TODO in the route)* POSTs the n8n **production** webhook with the
shared secret header and does not await the workflow.

**Response** — `201 { "runId": "<uuid>" }`.

**Polling contract (AU-2 / AU-6)** — the client reads the run by id through
Supabase, which RLS already scopes to the patient:

```ts
supabase.from('runs').select('id,status,result,finished_at').eq('id', runId).single()
```

until `status` is `done` or `failed`, then renders `result`, whose shape is
`docs/contracts/run-result.example.json` (PROVISIONAL until Sunday).

## POST `/auth/sign-out`

Form post from the signed-in navigation. Clears the session cookie and
redirects `303` to `/sign-in`. Not part of the mobile contract — a native
client calls `supabase.auth.signOut()` directly.

## 2026-10-08 · fix(perf): one question per render — the Maker stops asking the database the same thing hundreds of times

**Production incident.** Owner: *"why is everything loading so long. entering the website. logging
in. opening an event, opening something. take at least 1 minute"* · *"why did i see the old event
hub maker?"*. One person in the Event Hub Maker took Supabase from ~200 requests per five minutes
to 3,000–11,000, all from our own server renders. PostgREST ran out of pooled connections
("Timed out acquiring connection", PGRST003) and plain reads came back 504 while Postgres itself
sat idle at 5–8 ms a query.

**Measured before touching anything** (one server render, a local run against a counting stand-in
for Supabase — never production; an internal-hosted event with nothing bought and no guests):

| One server render | Before | After |
|---|---|---|
| Maker page — all requests | 180 | 148 |
| Maker page — entitlement shapes (orders · basket · comp · internal host · bundles) | 37 | 4 |
| Guest page (the Maker's canvas) — all requests | 63 | 35 |
| Guest page — entitlement shapes | 32 | 4 |
| Guest pages one Maker OPEN renders (the canvas + the stages fetched ahead) | 2–4 | 1 |
| …and again after every save that reloaded the canvas | 2–4 | 1 |
| **One Maker open, all requests** | **306–432** | **183** |
| **One Maker open, entitlement requests** | **101–165** | **8** |

**Cause.** "Does this event hold X?" walked orders → each granting bundle → basket → comp →
internal host → founder seat **per product**, and nothing remembered an answer: the readers take a
Supabase client, `createAdminClient()` builds a new one per call, so React's `cache()` could never
match two askers. The Maker page asked about Event Hub Pro nine times; a guest page asked about
seven products; and the Maker fetched up to three guest pages nobody had opened, again after
every save.

**What changed**

- `lib/request-once.ts` (new) — one question, once per render, keyed by WHO asks (every
  service-role client is one authority, marked where it is built; any other client is its own),
  WHAT is asked, and ABOUT WHAT (event id, SKU). Scoped to one React render; outside a render
  (server actions, route handlers, jobs) nothing is remembered, so a gate on a write re-reads
  exactly as before.
- `lib/entitlements.ts` — in a render the per-event FACTS are read once and every product is
  answered from them: one `orders` read for the event, one `event_comp_active_skus` (the batch RPC
  that already existed for the Studio grid), one internal-host, one founder-seat, one bundle map.
  The chain's order and every answer are unchanged; outside a render the per-product queries are
  untouched. No migration.
- `lib/supabase/admin.ts` — marks the client it builds as the service role (the only place).
- **A failed read no longer picks a Maker.** The new Maker is on for an internal viewer, and
  "internal" is a `users` read that timed out and came back "no" — so the owner was shown the old
  Maker. `lib/internal-viewer-read.ts` + `viewAsFreeSwitch().measured` keep "did not answer" apart
  from "no"; `makerChoiceIsUnread` (`lib/maker-stages-studio-flag.ts`) and the launch page throw the
  house "Reconnecting…" error instead of drawing either Maker. With the flag on the read cannot
  change the answer and nothing is refused.
- **The Maker loads the stage on screen and nothing else** (`buffered-canvas-frame.tsx`,
  `editor-shell.tsx`). A stage the couple has opened stays loaded behind the canvas, so switching
  back is still instant; a stage nobody opened is no longer fetched ahead on idle, nor fetched
  again after every save. ⚠ This narrows the owner's 2026-09-28 "load everything so it runs
  smoothly": the first visit to another stage now loads it (about 0.6 s when healthy). Flagged for
  the owner — warming once per open (never per save) can come back once the pool is healthy.

**Held by** `lib/entitlements-ask-once.test.ts` (the count, by counting a stubbed client's
requests; two events / two people / the service role never share an answer; a second render never
gets the first one's; the in-render answers equal the per-product queries over a 27-scenario
matrix × 3 viewers), `lib/the-maker-choice-is-never-a-failed-read.test.ts`, and
`lib/switching-stage-or-page-never-navigates.test.ts` (a stage nobody opened is never loaded).
Fourteen sabotages, each seen red.

**Not in this PR (measured, next targets).** One Maker render still reads the same `events` row
through 32 different column lists, `event_members` 12 ways and `users` 7 ways, because the Maker
page server-renders five other pages inside itself. A single SQL function returning an event's
entitlement facts would take the remaining 4 entitlement requests per render to 1 (a migration —
its own PR).

SPEC IMPACT: None — no schema, price, copy or decision changed. One owner-visible behaviour is
narrowed (unopened stages are not fetched ahead) and is flagged in the PR for his OK.

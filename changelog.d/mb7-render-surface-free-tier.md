## 2026-09-03 · feat(mood-board): section 04 "Make it real" lands, free tier only

MB7 (see `build-sessions/MB7.md`). RULE 0 found MB2's schema already shipped and
inert (`event_render_credit_grants`/`_usage`, `event_renders`,
`moodboard_render_config`, the one SKU, and the derived part registry in
`lib/moodboard-render-parts.ts`) and MB3's shell already carrying sections 00/01
in the REAL mood board page (`app/dashboard/[eventId]/studio/mood-board/page.tsx`)
— not a separate port of the prototype's own markup, which the app never adopted
wholesale. Both are extended here, not rebuilt.

- **A new derivation module, `lib/moodboard-make-it-real.ts`** — pure, DOM- and
  Supabase-free — ports the prototype's designed/gate/brief logic onto the real
  data model: a part is "designed" once a reception zone moves off "nothing
  chosen," an attire role holds a colour, or an inspiration photo lands on one of
  its own slots (`inspirationSlotsForPart`). A render needs BOTH a deliberate
  colour and a reference photo; a part with no dedicated slot falls back to the
  "overall vibe" photo for the gate only, never for "designed." `gridParts`
  reads `RENDER_PARTS` as an argument rather than deciding eligibility itself, so
  a new zone or attire role reaches the tiles with zero edits here — proved by a
  test that walks the REAL registry, and sabotage-tested live during the build
  (swapped it for a hand-typed six-item list, confirmed red, reverted).
- **`designRevisionKey`** is built from exactly the three inputs
  `buildPrompt()` (`lib/reception-scene.ts`) takes — `receptionDesign`,
  `palette.reception`, the venue setting — so the "your render is stale" marker
  can never disagree with what the eventual render will actually see. The
  component only ever reads `tile.staleBannerText`; a source guard (also
  sabotage-tested) fails if that stops being what's rendered.
- **The tiles**: designed parts lead, topped up to a four-tile floor with
  Suggested showcase parts (backdrop / tables / bride / ceiling / tunnel /
  flowers), never twenty empty boxes. Every tile carries a FREE, forever colour
  swatch built from its own resolved hex(es) — never a credit, never expires.
  The whole-look hero spans the row. A "Render another part" chooser holds
  everything not yet shown, grouped Room / People / Places.
- **Costs are stated in credits only.** `moodboard_render_config` is the one
  source for 1/5/50; a peso figure never appears anywhere in the tiles, the
  gate, or the brief — enforced by a sabotage-tested guard.
- **The credit balance is real.** `moodboard_render_balance` — zero rows reads
  as "not permitted," never a fabricated zero, all the way to the header. The
  Buy button is real too: `MOODBOARD_RENDER_PACK` joins `V2_SKU_CODES`, and a
  new per-SKU activation hook (`grantMoodboardRenderPackCredits` in
  `lib/sku-activation.ts`) grants `credits_per_pack` into
  `event_render_credit_grants` on admin payment approval — without it the Buy
  button would place a real order that never becomes a credit, the exact
  "reads as working and silently isn't" failure this repo keeps closing.
- **The derived "what your render already knows" brief** prints `Option.label`
  and `nearestColorName()` — never a prompt phrase — reading the SAME
  `role_palette` / `reception_design` props the page already threads to the
  Palette and Reception sections, so it can never see a different board.
- **Lock, Keep photo, and the "Generate" mechanic are UI state only, and say so
  in the code** — MB7 is the free-tier SURFACE (MB7.md), not the paid pipeline.
  Clicking "Generate" never calls `moodboard_reserve_render_credits` (no
  provider exists yet to spend a credit on) — it only flips local React state
  and decrements a session-only, non-persisted copy of the credit count, and
  the tile is honestly tagged "✦ Photoreal — simulated," never claimed as a
  real image.

**Two deliberate departures from the prototype, surfaced rather than silently
resolved:**
- The prototype's per-tile "From your board" venue line was an inline
  `<select>`; the real reception editor was relocated to Seat Plan Lab before
  this session (page.tsx's own comment), so the brief shows the venue as a
  known fact with no second editing surface invented here.
- The prototype's "✓ From our library — free" cache-match button is dropped
  entirely — it simulates MB9's render cache, which does not exist yet, and
  MB7.md excludes it explicitly ("the render cache… those are MB8 and MB9").

SPEC IMPACT: None — no locked decision altered, no schema change (MB2's
migrations already cover this session). The two departures above are scoping
notes for MB8/MB9/MB10, not product decisions.

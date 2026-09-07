# MB2 — Make-it-real schema: the ledger, the renders table, the one SKU

**Goal:** the money substrate exists before any pixel of section 04 is ported.

**Model:** Opus · high effort — schema + money + RLS. A wrong ledger shape is the most expensive
mistake in the arc.
**Size:** 1 day. **Depends on:** MB0. Independent of the port — **run it early**; MB7, MB8, MB9
and MB12 all sit on it.

## Delivers

- **Migration:** per-event render-credit ledger
- **Migration:** `event_renders` — image key, design snapshot, prompt, inspirations used, credits
  debited, timestamp, a **normalised config-digest column** (MB9's cache key lives here), a
  `reusable` flag that is **false when a note was used**, per-part identity, per-box note column
- The single catalog SKU **50 renders / ₱1,000** in `platform_retail_catalog_v2` — admin-managed
- The pure **part registry** lib: ~20 parts *derived* from `RECEPTION_PARTS` minus `people`, the
  `PaletteKey` attire roles, and the inspiration place slots. Derived from shipped data, **not
  hand-listed** — a hand-list goes stale the first time a zone is added.

## The price

🛑 Read the **surviving** row, not the four corpses above it. 2026-09-03 produced five price rows
in one day. Live: **50 credits / ₱1,000** (grep `"ONE RENDER PACK ONLY"` in `DECISION_LOG.md`) and
**1 credit per part / 5 credits whole look** (grep `"20 RENDERABLE PARTS"`). Dead: ₱15/photo,
₱60/4, and the ₱200/5 pack. Never derive a price from code or from this file — the customer is
charged what `platform_retail_catalog_v2` says.

## Verify

- full db replay
- **both Ugat tests.** A renders/credits subsystem is a new *concept*, so add a `UGAT_TYPES` node
  in `apps/web/lib/ugat/graph.ts` with joints and their required `claims` — not a baseline line.
  Never weaken the check to go green.
- `node apps/web/scripts/lint-events-column-grants.mjs` if the ledger touches `events` columns
- RLS pattern from the § 5 mapping table, enabled at `CREATE TABLE` time
- unit tests on the part registry: a part appears only when derivable from shipped state

## Owner decides first

Nothing — the price is decided. Just confirm you read the last row, not the corpses.

## 2026-07-31 · fix(dashboard): count each event type against ITS categories, not the wedding ladder

A **birthday** host opened their dashboard to *"Book a vendor · 21 categories
still open"* with *"Lock your reception venue"* as the top decision, measured
against a denominator that had nothing to do with their event. Every counter on
the surface iterated `PLAN_GROUPS` — a single hardcoded **wedding** ladder
(`ceremony_venue` "Where you say I do", `bridal_car`, `rings`, `officiant`) — for
all 16 event types.

**This is wiring, not new taxonomy.** The per-type map already exists, is fully
populated, and is owner-editable: `service_categories.applicable_event_types`
(tier 2), maintained from `/admin/event-types/<type>/categories`. **72 of 73
tier-2 rows are already scoped** — `bridal_car → [wedding]`,
`ceremony_venue → [wedding, christening]`, `cake → 13 types`. The marketplace and
Shortlist have consumed it for a while; the couple's decisions board and progress
rail never did. Joined on the key the two already share: `PlanGroup.catalogTile`
IS a `service_categories.id`, and all 22 tiles PLAN_GROUPS references resolve.

**Added** `lib/plan-groups-by-event-type.ts` — `fetchPlanGroupScope()` (one extra
read, in the existing `Promise.all`) + the pure `planGroupsForEventType()`.
`countUnlockedCategories()` and `pickTodaysOneThing()` take an optional ladder,
defaulting to `PLAN_GROUPS`, so every other caller is byte-identical.

**FAIL-OPEN, deliberately.** Unknown ⇒ applies: a read error, a tile with no row,
a NULL/empty allow-list, or a plan group with no `catalogTile` (`attire`,
`music_entertainment`, `logistics` — all genuinely universal) keeps the group.
This inverts the fail-CLOSED posture used for entitlement gates, and the
asymmetry is the point: wrongly INCLUDING a category costs a slightly long
checklist, while wrongly EXCLUDING one means a couple is never reminded to book
their venue. It also matches the column's own documented semantics (an allow-list
where NULL = universal).

The empty-array case is normalised in **both** the fetcher and the pure function
— the admin toggle writes `[]` when the last type is switched off, and reading
that as "serves nothing" would empty a ladder an admin thought they were
widening. Re-checked in the pure half on purpose, so the fail-open guarantee does
not depend on which door the data arrived through. (The test caught exactly this:
a hand-built map skipped the fetcher's normalisation.)

**Test** `lib/plan-groups-by-event-type.test.ts`. Its first assertion is the one
that matters — **a wedding keeps every plan group** — because everything else
here narrows a ladder, and a narrowing bug that ate a wedding category would be
strictly worse than the defect being fixed.

⚠ `tsc` caught a type error in this test's own fixture after all 5775 unit tests
were green. `tsx --test` is not a typechecker.

SPEC IMPACT: None — no schema, price or SKU change. This reads data the owner
already curates in the admin console; further tuning is a data edit there, not a
deploy.

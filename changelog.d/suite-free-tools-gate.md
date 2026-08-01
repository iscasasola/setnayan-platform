## 2026-07-31 · fix(suite): gate the free-tools strip on event type — the third unguarded list

Found by re-opening the Suite on the vendor-free Simple Event **after** #3956 and
#3958 had both landed. It still offered:

- **Budget Planner** — while `budget` is absent from `simple_event`'s
  `enabled_surfaces`, and the nav has hidden Budget there since 2026-06-27, so
  the card contradicted its own navigation;
- **Compare vendors** — a marketplace doorway (`href → routes.explore.*`) on
  `marketplace_enabled = false`;
- **"Your wedding streamed live…"** and three more hardcoded wedding blurbs,
  rendered verbatim for all 16 event types.

**Cause:** `FREE_TOOLS` is a hardcoded array declared in the SAME FILE as the two
gates that do work, rendered raw at both consumers (the Suite search index and
the card strip). `surfaceOk` never touched it — it takes an `AddOnEntry`, and
these are a different type.

> Two correct gates and one unguarded list beside them. That is the shape of
> every defect in this sweep: the predicate was never wrong, and something was
> rendering next to it that never asked.

**Fix.** `FreeTool` gains `surface?` (same contract as `AddOnEntry.surface`) and
`requiresMarketplace?`. The latter is deliberately NOT a surface: the marketplace
is a profile *column*, not an `enabled_surfaces` entry, so folding it into
`surface` would have meant inventing a fake one. Budget declares
`surface: 'budget'`; Compare vendors declares `requiresMarketplace: true`. One
resolver (`freeToolOk`) produces one filtered `freeTools`, consumed by **both**
render sites — filtering only one would leave a tool findable by search but
absent from the page.

Derived from the profile, never from the event type's name, so a future
vendor-free type is covered without touching this file.

Four blurbs in `lib/add-ons-catalog.ts` made event-neutral ("your day" / "your
event" / "Day-of print pack").

**Guardrails** added to `lib/vendor-free-surfaces.test.ts`: the gate exists, both
tags are declared, `FREE_TOOLS` is consumed **exactly once** (by the filter), and
the catalog carries no hardcoded wedding blurb. That last one immediately caught
a fourth blurb my own case-sensitive grep had missed — `'Wedding-day print
pack…'`.

SPEC IMPACT: None — enforces the existing `marketplace_enabled` + `enabled_surfaces`
contracts on a list that was never wired to them.

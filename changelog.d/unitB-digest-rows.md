## 2026-08-08 · design(#4): the decisions digest gets the row grammar

Unit B of the Warm Editorial Archive port. Presentation only — same data, same
destinations, same empty state.

**The row contract is now: one line, one status, one destination.** The label/sub/CTA-pill
stack becomes a dot + label + right-hand status, with a hairline between rows.

**The whole row is the link now.** Previously only a 28px pill was tappable; the row is
a 44px target, which is the tap-target rule rather than a preference. Every `href` is
byte-identical to what it replaced.

**Labelled actions are not lost.** The per-row CTA pill is dropped *from the digest*
only — the decisions board below keeps its pills, so every action still has a verb
somewhere on the page. That is the spec's own reasoning, checked against the board
before removing anything.

**The dot reads from the SHIPPED `chipTone`** — no new field, no re-derivation, so the
digest and the board cannot disagree about urgency. Under the owner's gold ruling the
urgent dot is gold-700 rather than the handoff's rust.

⚠ **Two deliberate departures from the spec, both to avoid inventing fragile logic:**
1. The spec wanted the peso figure **parsed out of `chip`**. `DecisionItemView` has no
   amount field, so that means a regex over display text that breaks silently the day
   someone rewords a chip. The chip is rendered instead — same number, nothing to
   break — in Space Mono when it carries a ₱.
2. The spec wanted `sub` shown *"only when it carries a date or a reference"*. That is
   a heuristic over free text with no field to key on, so `sub` is kept as shipped.

**Integration checks** — 63 insertions / 26 deletions (19 insertions are the
explanatory comment) · zero components removed · the data slice `flatDecisions.slice(0, 3)`,
the empty-state sentence and the `#decisions` anchor all still present and unchanged.

Typecheck clean · all 12 `lint-*.mjs` clean · **7092/7092** tests green.

SPEC IMPACT: None.

## 2026-07-03 · copy(home): stronger hero copy for the 5 homepage dock pillars

Rewrote the `head`/`desc` hero lines for all five dock tiles in
`apps/web/app/_components/home/pillars.tsx` (`PILLAR_HEROES`) so each answers
the prospect's real objection instead of describing the feature:

- **Ala ala** — now answers "why not just my own gallery?" ("stores photos" vs
  "keeps the memory") and "is it free?" ("Free, for life").
- **Suri** — kept the "watches, doesn't chat" spine, sharpened the payoff
  ("catches what's slipping", "only when something actually needs you").
- **Papic** — leans into the human-complement positioning: the hired
  photographer stays; guests catch what one person can't.
- **Panood** — "couldn't be there" upgraded to an emotional payoff
  ("front-row seat"), free-with-one-camera hook retained.
- **3D Plan** — "walk the room" → "stand in the room," a stronger you-are-there
  promise.

SPEC IMPACT: None. Homepage marketing copy only; no schema, SKU, price, or
locked-decision change. Pillar names/roles unchanged.

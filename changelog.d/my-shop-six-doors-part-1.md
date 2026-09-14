## 2026-09-14 · feat(myshop): the six-door rail and door 1 (G1)

Owner approved the drawing on 2026-09-14 — *"doors 1-3 ok"* (`DECISION_LOG.md`),
drawing `prototypes/shop_page_2026-09-10.html`. His brief for the chain:
*"improving what we have"*, and the drawing's own headline is **"Nothing removed,
three things moved."**

- **`ShopRail`** — "On this page", the six doors, each named by the question a shop
  owner arrives with rather than by a subsystem. Plain fragment anchors, no client
  component: it works before hydration, with JS off, and from a bookmark.
- **Door 1 "Your shop"** — the shop-information tiles and the papers now sit in ONE
  room. Today they are separated by the service cards, and "fix my shop information
  and verification" is one errand.
- **Re-mounted, not rewritten.** `ManageTiles` and `VerifySection` are the same
  components with the same props; only their position changed.
- Doors 2–6 point at where their content already lives. Door 6 gained an `id` on the
  existing folds — naming an existing room is not building a door.

⚠ **Doors 4–6 are NOT ruled.** The owner approved 1–3 and has not seen the rest; the
rail marks only door 1 `built`, and the guard fails if another door claims otherwise.

RULE 0 findings: the file is **1,876** lines, not 1,861 as briefed; no collision with
the D1 chain (three branches touch this file, all three dead — two closed PRs, one
abandoned); the hero already shipped as `HeroCard`, and both door-1 anchors already
existed inside their child components, so the delta was smaller than briefed.

Guards: `lib/my-shop-doors-keep-every-control.test.ts` (8), derived from the drawing's
own 101-row control table rather than from the page it checks. Seven sabotages, all red.
🪤 Two defects the guard caught in its own author's work: doors 2, 3 and 6 first pointed
at anchors **nothing carried** (a fragment link to a missing id fails silently), and the
mount count was a plain substring — `<ServicesDisclosureXX` satisfied `<ServicesDisclosure`,
so the first rename sabotage stayed green. Counting is now at a tag boundary.

SPEC IMPACT: None — this builds the approved drawing; the ruling is already recorded in
`DECISION_LOG.md` (2026-09-14).

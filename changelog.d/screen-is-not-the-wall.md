## 2026-08-17 · docs(live-studio): record the owner ruling — a venue screen is NOT the Live Photo Wall

Owner, asked directly: *"is a Live Studio screen the same object as the Live Photo
Wall, or a separate kind of display?"* → **"no. they are different."** That
question had been open since **2026-07-21**. It is now closed; do not re-ask it.

**Why this needed writing down in code, not just a log row.** The Live Studio
screen pairing URL points at `/wall`, which is dead two ways, and the second one
is the one that matters:

1. the only wall route is `/wall/[eventId]`, so `/wall?code=…` is a 404; and
2. that route gates on `eventSkuActive(..., 'LIVE_WALL')` — so even if it
   accepted a code, **a Live Studio screen would only work for a couple who also
   bought the Live Photo Wall.**

The tempting repair — teach the wall route about pairing codes — IS the merge the
ruling forbids. A Live Studio screen needs its own route, gated on its own
product.

Adds two guards to `lib/panood-screens.test.ts` that fail the day somebody wires
the two together: the screen data layer must never reference the `LIVE_WALL` SKU
(comments stripped, because this change's own docblock names it while explaining
why), and the pairing path must never point into the wall route tree. Both
mutation-proved (inject a `LIVE_WALL` reference 0→1 → red; repoint the path → red).

🔒 **The new route word is deliberately NOT chosen here.** Top-level words are
minted to shops and events, so one must be added to `lib/reserved-slugs.ts` in
the same change that introduces the route (`'wall'` is reserved there twice).
That is a product decision, left open rather than guessed at.

✅ **What already ships, so nobody rebuilds it:** the durable screen row with its
routed source, the control room writing that routing, and a proper 6-char
Crockford pairing-code generator with rejection sampling. Missing is exactly
three things — a caller for the provisioning helper, a caller for the code
generator (currently zero), and the screen-side pairing route.

No behaviour changes: all three helpers have zero application callers, and the
couple-facing note stays the honest "not connected yet" rather than a fake door.

SPEC IMPACT: Recorded in DECISION_LOG.md 2026-08-17.

## 2026-08-10 · fix(preservation): the per-capture choice never reaches the sweep

A confirmed live-on-main defect: the couple's choice of which captures keep their
full resolution was written, stored, selected — and then dropped on the floor one
step before the code that acts on it.

`PapicDropItem.preserve_declined_at` was **optional**, and none of the four
production mappers in `apps/web/lib/papic-fullres-drop-core.ts` assigned it. Every
real sweep Item therefore carried `undefined`. The sweep's gate reads
`keep && !it.preserve_declined_at`, and `!undefined` is `true`, so the predicate
collapsed back into the old all-or-nothing per-event behaviour: a couple could
decline a capture and the sweep would preserve it anyway. Nothing threw, nothing
logged, CI was green — the same absence-only symptom family as the phantom column,
the phantom enum value, the phantom RPC argument and the blocked iframe.

Separately, the two **clip** selects in `apps/web/lib/papic-fullres-drop.ts`
omitted the column that the two photo selects carry, so preservation could never
have applied to **video** even once the mappers were fixed — directly against the
owner's ruling of 2026-08-10 that preservation covers "chosen photos **and
videos**".

- Assigned `preserve_declined_at` in all four mappers (`seatPhotoItem`,
  `guestPhotoItem`, `seatClipItem`, `guestClipItem`), normalising absent to `null`
  rather than `undefined`.
- Added the column to both clip selects.
- Made the field **non-optional** on `PapicDropItem`, so a future fifth mapper
  that forgets it fails to compile instead of silently disarming the control
  again. The type is the mechanism, not the paperwork.
- Added `apps/web/lib/preserve-picks-reach-the-sweep.test.ts` — an **executing**
  test that runs the production mappers over rows shaped exactly as each real
  SELECT returns them and asserts the decision flips both ways.

`apps/web/lib/preserve-picks.test.ts` is untouched and keeps every assertion,
including its deliberate ban on an opt-in `preserved_at` column. It could not
catch this: it reads the sweep as a string and regex-matches it, and it stayed
**5/5 green with the defect live** (measured). Its own failure message describes
the exact shipped state — *"or, worse, the column is undefined and the skip
silently inverts"*. A guard looking for the presence of text cannot see a bug
whose whole nature is an absent field.

No schema change: the column and its indexes already ship in
`supabase/migrations/20271125158531_preserve_picks.sql`.

Inert in production today — the `HIGH_RES_ARCHIVE` entitlement is inactive and has
never been sold, so no couple's choice was acted on wrongly. This lands before
anything sells.

SPEC IMPACT: None. No product rule, price, SKU or copy changes — this makes an
already-locked rule (owner 2026-08-10, "they can pick which one to preserve" /
"if nothing is picked, pick all") actually take effect in code. The retention
model, the compress-never-delete vocabulary and the preservation SKU's price are
all unchanged.

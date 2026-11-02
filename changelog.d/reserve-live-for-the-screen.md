## 2026-08-17 · feat(live-studio): reserve `live` for the venue-screen page (owner named it)

Owner ruled the Live Studio venue screen is a different product from the Live
Photo Wall, then named its page: **live**.

**The page does not exist yet; the word had to be taken now.** A shop's
`business_slug` is IMMUTABLE once minted, so a business called "Live" registering
first would hold `setnayan.com/live` **forever** and the page could never be built
there. Measured in prod before writing: zero events, zero shops, zero people hold
it, and it has never appeared in the slug-change log.

Reserved in the **hand-authored** half (`DB_MIRRORED_RESERVED_SLUGS`) plus
migration `20271147550834`, which mirror each other and are compared mechanically
by `vendor-business-slug-mint.db.test.ts`.
⚠ **Deliberately NOT in `ROUTE_RESERVED_SLUGS`** — that half is GENERATED from the
route folders on disk, so naming `app/live/` before it exists breaks its drift
test. My first attempt put it there; the placement is now asserted against the
real declarations.

`PANOOD_SCREEN_PAIR_PATH` moves from `/wall` (documented as wrong in #4509,
because that route gates on the LIVE_WALL SKU — a different product) to `/live`.
Still resolves to nothing, because `app/live/` is unbuilt; harmless, since the
helper has zero application callers.

## The migration verifies itself, and that earned its place twice

Replacing a 76-word array by hand is a transcription hazard: drop one word and a
real page becomes permanently claimable by a shop, with every test green. So the
migration reads the CURRENT word set from `pg_proc.prosrc`, applies the
replacement, re-reads it, and **RAISES unless the new set is exactly the old set
plus `live`**.

1. 🪤 **It caught my extraction on the first run** — the obvious pattern returned
   **7 words instead of 76** and the migration refused. Cause: the function's own
   first line is `coalesce(p_slug, '')`, and two adjacent quotes desynchronise
   naive quote-pairing, so the scanner swallowed everything up to `'about'` as one
   "word". Pattern restricted to slug-shaped contents, which cannot span spaces.
2. **Mutation-proved against prod** in a rolled-back transaction: omit `'wall'`
   and the migration aborts with *"LOST reserved word(s) {wall}"* — it refuses a
   lossy replacement instead of shipping it.

Separately proved the FILE's array is right without trusting transcription:
extracted it from the file with python and set-compared to prod — **76 → 77, none
lost, exactly `live` added.**

Exposure freeze 6/6 (so `CREATE OR REPLACE` preserved the function's ACL rather
than re-opening it to anon/authenticated — the usual trap). Mint guard 15/15,
screens + reserved-slugs 24/24, typecheck clean.

⏭ Still unbuilt, now bounded: a caller for `provisionPanoodScreensAdmin`, a caller
for `generateScreenPairingCode` (zero today), and `app/live/` itself.

SPEC IMPACT: Recorded in DECISION_LOG.md 2026-08-17.

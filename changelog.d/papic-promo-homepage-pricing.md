## 2026-07-30 · fix(papic): delete the homepage pricing payload that was still selling the retired per-day Papic

`Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` **PR-B**. The spec called this "three false claims on the highest-traffic surface" and said to port the block to the two-type sources the way `app/pricing/page.tsx` did. **The premise was half wrong, and the correction changes the fix.**

**What the audit found, verified this time:** `PricingData.groups` and `PricingData.freeChips` are **rendered nowhere.** `grep -rn "PriceRow\|PriceGroup\|freeChips\|perGuestDay"` across `apps/web` returns `pricing-data.ts` and nothing else. The 2026-07-04 overlay redesign turned the Prices popup into a summary + one line-link out to `/pricing` (`HomeOverlays.tsx:177` — "ONE line-link out to /pricing. The full tier ladder, live estimator and à-la-carte catalog live on the /pricing page"), and the only fields any consumer reads since are `aiPrice`, `aiIntroPhp` and `vendor`. So the false claims were **not on screen** — but they were built on every homepage request and published verbatim by `/api/home-pricing`, which anyone can fetch.

**And that is exactly why they survived the two-type lock.** Unrendered code has no witness. When the owner locked Papic Pool + Papic One on 2026-07-29, every surface a couple can see was updated; this payload was not, and went on emitting:

- `First <N> cameras · unlimited shots per day — Free` — a per-day meter the lock retired, with the **POOL's** free shared-seat count (`papic_tier_config.free.seats_per_event` = 3) quoted as the free allowance,
- `Papic One · unlimited shots per day — ₱50/guest·day` — a per-guest-per-day rate for a product that is now a **flat price per camera** holding a fixed shot bucket, and "unlimited" only because prod's `mini.points_per_day` is NULL and NULL reads as unlimited to every copy helper.

**So the fix is deletion, not derivation.** Porting it would have built a second derived ladder that still nobody reads — and a ladder with no reader cannot be kept honest, it can only drift, invisibly. `/pricing` already owns the real one.

- `app/_components/home/pricing-data.ts` — `groups`, `freeChips`, the `PriceModel` / `PriceRow` / `PriceGroup` types and the `priceOf` / `freeOrPrice` helpers are gone, along with the extra `readPapicTierConfig()` round-trip every homepage request was paying for. What remains is what is consumed: the Setnayan AI price (catalog-resolved, ₱499 fallback unchanged) and the vendor tier prices. The doc comment records the whole failure mode and points the next ladder at the rung tables.
- `lib/papic-tier-copy.ts` — deletes the four per-day **display** helpers whose last consumer this removes: `publicPapicLadder`, `papicCapacityShort` (whose null branch *was* the string "unlimited shots per day"), `papicCapLadderPhrase`, `papicTierSummary` ("per camera, per day"). `papicCapacityPhrase` stays — the studio's guest-camera picker is a live consumer — as do the free-seat count and the cap sentence.
- `lib/papic-seats.ts` — deletes the unreferenced `PAPIC_SEATS_PRICE_PHP = 2999`. A hardcoded peso constant sitting beside a live service key, on a SKU that is inactive and a price retired twice over, is how a dead number gets re-armed by autocomplete.

**Two CI guards moved with it, both strengthened rather than relaxed:**

- `lib/papic-copy-guardrails.test.ts` — the retired-helper tests are replaced by one that pins the homepage payload clean of Papic claims (`/papic/i`, `guest·day`, `unlimited shots`, `papic_tier_config`), matched over **comment-stripped** source so the doc comment may still name the bug it fixed. Its failure message says what to do instead: derive from `papic_pass_tiers` / `papic_one_tiers` + `papic_event_pool_config`, phrase through `papicPoolRungPhrase` / `papicOneRungPhrase`, and move the assertion to the surface that actually renders.
- `lib/panood-retirement.test.ts` — the Live Studio guard asserted the *conditional* that dropped a retired ₱/day row. With no table there is no row: it now asserts the file names no `PANOOD_SYSTEM` and quotes no `/day` rate at all. The protection went from "the condition is present" to "the fake door cannot exist".

**Verification:** `tsc --noEmit` clean · `next lint` clean (pre-existing warnings only) · `lint:retired` OK (1,939 files, 0 retired strings) · **`test:unit` 5,380/5,380 pass**. `npm run build` was not run locally — 7 GB heap vs available RAM, SIGTERM 143 (documented trap); the Vercel production-build check covers it.

**Not touched, deliberately:** `PAPIC_SEATS_SERVICE_KEY` and the seat-provisioning path (live code behind an entitlement gate — retiring the PAPIC_SEATS *gates* is PR-D) · `papicFreeCameraCount` (still the sanctioned reader the other guards point at) · the Papic studio's own "first 3 cameras are free" copy, which is a true statement about free **pool** seats and is on the spec's §1 do-not-touch list.

SPEC IMPACT: None — no price, SKU or schema change; deletes a payload no user ever saw. Corrects one claim in `Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` § 2 PR-B (the block "feeds homepage + nav pricing peek" — it feeds neither; only `/api/home-pricing`, whose consumer ignores it), applied in the corpus alongside PR-A's false-alarm finding.

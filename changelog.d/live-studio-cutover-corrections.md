## 2026-07-26 · fix(live-studio): retire PANOOD_SYSTEM + meter internal grants

Two owner-directed corrections to the Live Studio cutover. Both are money code; both are flag-dark or zero-population on landing.

---

### 1 · Retire `PANOOD_SYSTEM` — closing a ₱500 arbitrage

Wave 6 (`20271001110000_live_studio_unify_sku.sql`) added the grandfather alias `SKU_OWNERSHIP_ALIASES.LIVE_STUDIO = [PANOOD_SYSTEM, PANOOD_SYSTEM_MOBILE]` so an existing Cast buyer keeps what they bought when the unified controller lands, and **deliberately deferred** the Cast retirement to "the launch cutover" because `PANOOD_SYSTEM` was "LIVE and SELLING in prod".

**That premise was false.** Prod `orders` holds **ZERO rows** for `PANOOD_SYSTEM`, `PANOOD_SYSTEM_MOBILE`, `LIVE_STUDIO` and `LIVE_STUDIO_ROAM` (verified 2026-07-26). Nobody has ever bought any Live Studio SKU.

**What the delay actually left open.** The alias is a READ rule — it does not care whether the order that trips it is historical or thirty seconds old. So while `PANOOD_SYSTEM` stayed sellable at **₱2,500**, any new buyer collected the full **₱2,999** unified Live Studio entitlement through it: ₱500 off, available to anyone, with no code path anywhere that noticed. `PANOOD_SYSTEM_MOBILE` (₱1,500) was already `is_active=false`, so `PANOOD_SYSTEM` was the one open door.

- **`supabase/migrations/20271005180040_retire_panood_system_cast.sql`** — `is_active=FALSE` on `PANOOD_SYSTEM`. Verbatim the statement Wave 6 staged in a comment as "run at launch". Row PRESERVED (never DELETE — order rows reference service codes), guarded `is_active IS DISTINCT FROM FALSE` so a re-run is a no-op, reversible in one line.
- **The alias STAYS**, and retiring the row does not break it: ownership reads `orders` + `comp_grants` and **never consults the catalog**, so a historical Cast order, an admin comp, a founder seat and an internal host all keep resolving `LIVE_STUDIO` exactly as before. Pinned by a new test *and* by a design pin asserting `lib/entitlements.ts` never references `platform_retail_catalog_v2`.
- **`app/dashboard/[eventId]/studio/panood/page.tsx`** — the one live buy surface. Its "Upgrade to multicam" drawer would have dead-ended at checkout (`resolveServiceSellability` → `'retired'` → reject), so the buy control, its price table row, the `+ multicam from ₱X` stat caption and the `(₱X / day)` parenthetical are now gated on live sellability. Reads DB `is_active` rather than hardcoding the retirement — same idiom as the LED Background page's bundle-only guard — so it self-heals through the migration-push window and reverses itself if the owner reactivates the row. ⚠ `formatV2Sku` does **not** filter `is_active`, so the price label alone could not be the signal.
- **⚠ It hides the BUY, never the LAUNCH.** `AddOnStateCta` is both controls in one — the purchase sheet in the `'add'` state, the owner's "Open control room" chip in every other. Only `'add'` is gated, or an existing buyer would be stranded outside the room they paid for.
- **`app/_components/home/pricing-data.ts`** — `priceOf(catalog, 'PANOOD_SYSTEM', 2500)` had a hardcoded fallback, so the home pricing table would have kept printing "₱2,500/day" for a product checkout now refuses. The row is resolved straight off the catalog and **omitted when absent** (the treatment `/pricing` already gives `LIVE_BACKGROUND`).
- `/pricing`, the Studio grid, the About page and onboarding needed **no change** — all four already filter on `is_active` or resolve the tile as `tier: 'free'`, and drop the SKU by themselves. Verified, not assumed.

**Visible consequence, owner-directed:** with `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` still OFF, `LIVE_STUDIO` stays name-excluded from `fetchV2CustomerCatalog`, so **no paid live-broadcast SKU is listed or purchasable anywhere** until launch. The free single-camera livestream is untouched (no SKU gates it). The paid row returns automatically at the flag flip.

---

### 2 · `internal` grants are METERED — reversing half of Wave 7

Wave 7 (#3713) gave **every** zero-day-order unlock `reason: 'unmetered'` — unlimited broadcast days, forever. Owner reviewed and split it:

| Grant | Signal | Metering |
|---|---|---|
| **founder** | row in `founder_seats` (owner-granted, cap 10) | **UNMETERED** — the seat *is* "all services free permanently" |
| **comp** | active `comp_grants` row covering the SKU | **UNMETERED** — an admin deliberately gave it away |
| **internal** | `is_internal` (§10a staff) | **METERED** — ⭐ the correction. One event-day, like a paying customer |
| **promo** | live `promo_free_windows` covering the SKU | **METERED** — the giveaway is one event-day, not unlimited |
| **unknown** | owned via any unnamed route | **METERED** — fail-closed |

- **`lib/live-studio-window.ts`** — new `GrantKind` + `UNMETERED_GRANT_KINDS` **allowlist** + `grantIsUnmetered()` + pure `classifyGrant()`. Fail-closed by construction: `null`, `undefined` and anything absent from the allowlist answer "metered", so a caller that forgets to resolve the kind gets the paying-customer clock, never a free ₱2,999 product. A metered grant is worth exactly **one event-day**, folded from the existing `first_live_at` anchor (`foldWindowEnd(firstLiveAt, [firstLiveAt])` = anchor + 24h) — no new table, no new state. New `meteredDays` output keeps `days` honest ("what was actually purchased") while the clock is correct.
- **`lib/live-studio-window-server.ts`** — `resolveLiveStudioGrantKind()` reads the four signals through the **same four helpers `eventSkuActive` already ORs together**, so "is it owned?" and "how is it owned?" cannot disagree. Resolved **only** on the `owned && days === 0` branch and issued in parallel, so the paid path and the free path pay nothing for it.
- **⚠ The overlap trap.** A founder account is very likely *also* `is_internal` (the owner's own is). Precedence is therefore founder → comp → internal → promo → unknown, and it lives in the **pure** layer so all sixteen signal combinations are unit-testable without a database and the reader cannot quietly re-order them. Tested both directions: internal **and** founder → unmetered; internal and **not** a founder → metered.
- **Never-interrupt still outranks the paywall** for a metered grant: a staff/promo ceremony that is on air when its day lapses keeps multi-cam (`expired-broadcasting`).
- No Wave 8 / Wave 9 file touched. `resolveBroadcastWindow`'s signature is unchanged, `grantKind` is optional, and every consumer sits inside an `if (liveStudioRoamEnabled())` block (or `notFound()`s) — **flag-off = no behavior change**.

---

**Tests** — `pnpm test:unit` **3448 pass / 0 fail**; `tsc --noEmit` clean; lint clean (pre-existing warnings only); `migration:check` + `migration:doctor` clean. 21 new assertions across `lib/live-studio-window.test.ts` (metering split, 16-combination precedence sweep), new `lib/live-studio-window-server.test.ts` (the wiring, with a table-aware Supabase stub — internal-hosted event with zero orders resolves METERED end to end), new `lib/panood-retirement.test.ts` (migration shape, checkout rejects before the charge resolvers, no fake door, alias survives). **No DB tests were added**, so the "table-owner connection skips RLS and passes vacuously" trap Wave 7 hit does not apply here.

SPEC IMPACT: **Yes.** (1) `PANOOD_SYSTEM` (Live Studio Cast · ₱2,500/day) is RETIRED — corpus `Pricing.md § 00`, the CLAUDE.md SKU table and `Live_Studio_Unified_Spec_2026-07-25.md § 3` still describe it as live and sellable; the sole customer-facing paid Live Studio SKU is now `LIVE_STUDIO` ₱2,999/event, flag-dark until launch. (2) `Live_Studio_Unified_Spec_2026-07-25.md § 4f ②` documents grants as uniformly unmetered — now a four-way split (founder/comp unmetered · internal/promo/unknown metered to one event-day). Both need a `DECISION_LOG.md` row dated 2026-07-26.

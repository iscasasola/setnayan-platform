## 2026-07-26 · feat(marketplace): merit-first ranking + CAPPED paid boost + labeled Featured slots (flag-dark)

Implements `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 5 ("Ranking —
marketplace integrity — do NOT pay-to-win"), build sequence step 5.

**Why.** Today's category search floats EVERY `ad_rank > 0` vendor above the
entire review-ranked pool, with no ceiling and no quality floor. That is the
exact pay-to-win shape the owner-locked model forbids: *"organic rank = merit
for everyone incl. Free … a better free vendor is never buried; paid = a capped
boost + clearly-labeled Featured/Sponsored slots — amplifies quality, never
manufactures it."*

**⚠ SCOPE — this converts ONE of five vendor lists.** Only the couple-dashboard
category-search overlay is on the merit model. `lib/vendor-counts.ts`,
`/explore`, the 3D-plan demo and `build-3state-actions.ts` still order by the
unbounded legacy `ad_rank`. Flipping `NEXT_PUBLIC_VENDOR_RANK_BOOST_ENABLED`
makes **this surface** § 5-compliant; it does **not** make the platform
§ 5-compliant, and until the other four are converted the product contradicts
itself (merit-first in the overlay, pay-to-win in the grid the couple sees
first). Deliberately descoped rather than half-converted — four untested surface
rewrites inside one flag-dark branch is how a ranking change ships a regression
nobody can see. The limitation is pinned in
`apps/web/lib/vendor-rank-boost-callsite.test.ts` so it can't rot out of the repo.

**What landed (all behind `NEXT_PUBLIC_VENDOR_RANK_BOOST_ENABLED`, default OFF):**

- `apps/web/lib/vendor-rank-boost.ts` — new PURE module (no env, no clock, no
  I/O; `nowMs` is an argument):
  - `meritScore()` — 0–100 from match-to-need (10) · reviews (35) · completed
    bookings (20) · responsiveness (15) · proximity (20), i.e. exactly the five
    signals § 5 names. Structurally **blind to tier / ad spend / subscription** —
    the input type carries no such field. Unknown signals are NEUTRAL, never a
    penalty. Every weight is REACHABLE (pinned by a test that a maximal signal
    set scores exactly 100) — a weight nothing can score silently rescales the
    model and shrinks the paid ceiling it is calibrated against.
  - `tierBoostPoints()` / `boostedRankScore()` / `rankWithCappedBoost()` — an
    **additive** tier bonus hard-ceilinged at `MAX_TIER_BOOST_POINTS = 6`
    (Free 0 · Solo 2 · Pro 4 · Enterprise/Custom 6). Ties are broken by RAW
    merit, so money never wins a coin-flip.
  - `partitionFeatured()` — at most 2 slots, never more than 25% of the page,
    each requiring an ACTIVE non-lapsed paid tier ≥ Solo **and** admin-vetted
    verification **and** merit within `FEATURED_MERIT_FLOOR_DELTA` of the best
    merit in the same result set. Featured picks are removed from the organic
    list (one row, not two). `FEATURED_LABEL` / `FEATURED_DISCLOSURE` ship with it.
  - `composeFeaturedOrder()` — the only sanctioned way to flatten the partition
    into a render order (see the § 5 fix below).
  - `organicRespondsFast()` — the anti-purchase gate on responsiveness merit.
- `apps/web/lib/vendor-rank-boost-flag.ts` — the flag. Explicitly does NOT touch
  `VENDOR_TIER_SEARCH_GATE`, which hides Free vendors from search and
  contradicts § 5.
- `apps/web/app/dashboard/[eventId]/vendors/_actions/category-search.ts` — the
  flag-ON ladder becomes `relationship → ≤2 labeled Sponsored slots →
  merit-first + capped boost`. Featured slots deliberately sit BELOW the
  relationship tier: a vendor the couple already works with is never displaced
  by a paid placement. Merit reads only receipt-backed signals (trusted reviews,
  vetted completed events), never the sockpuppet-inflatable raw counts.
  `tier_expires_at` is read in its own narrow select (a 42703 on the shared
  select would null the WHOLE row) and fails **closed** — on error we still
  rank, but sell no slots.
- `apps/web/app/dashboard/[eventId]/vendors/_components/category-search-overlay.tsx`
  — renders the "Sponsored" chip + paid-placement disclosure on every featured
  row. It replaces (never stacks with) the legacy "Featured" chip.

### Defects found by adversarial review and fixed here

- **BLOCKER · Featured slots buried better free vendors.** The composed order is
  `[relationship, featured, organic]`, so a slot-holder renders above the whole
  organic list — while the featured quality floor was 10 points against a 6-point
  boost ceiling. A paying vendor 10 merit points WORSE than the best free vendor
  took the top of the page: a direct § 5 violation. The branch's own test asserted
  the *sub-list* order, so it shipped green.
  **Fix:** `FEATURED_MERIT_FLOOR_DELTA` is now *derived from*
  `MAX_TIER_BOOST_POINTS` (6), and any caller-supplied `meritFloorDelta` is
  **clamped** to it rather than merely defaulted — a call site cannot widen the
  band. The invariant is now stated over the COMPOSED order produced by
  `composeFeaturedOrder()`, and the call site is required (by source-scan test)
  to go through it instead of hand-splicing.
- **BLOCKER · The featured gate trusted a single display column.** Slots keyed on
  `public_visibility === 'verified'` alone — the column an admin flips to freeze
  a fraud suspension, and (until migration `20271004444950`, PR #3714) a column a
  vendor could PATCH itself. **Fix:** featuring now requires
  `verification_state === 'verified'` **AND** `public_visibility === 'verified'`,
  ANDed at the call site into a distinct `_adminVerified` field and consumed by a
  renamed `FeaturableVendor.adminVerified` (the rename is deliberate — it makes
  every call site re-decide). This is defence-in-depth on top of #3714's trigger
  guard, not a replacement for it.
- **HIGH · 15 of 100 merit points were purchasable.** `respondsFast` derives from
  `chat_threads.vendor_first_reply_at`, which `stamp_vendor_first_reply` stamps
  for ANY `sender_role='vendor'` insert — including the auto-reply bot, which is
  gated behind the PAID Vendor AI add-on. ₱1,500/28d bought 15 merit points:
  2.5× the entire declared paid ceiling, inside the score whose whole job is to
  be blind to money. **Fix:** on the flag-ON path the action reads the bot's own
  `vendor_bot_replies` ledger and routes responsiveness through
  `organicRespondsFast()`; any vendor with a logged bot reply earns ZERO
  responsiveness merit. The read **fails closed** (an error marks every candidate
  bot-assisted — denying the credit to everyone reorders nothing, granting it
  unproven is a sale). ⚠ **This is a read-side mitigation, not the durable fix.**
  The durable fix is a trigger that ignores `is_bot` inserts; that would change
  live `vendor_activity_stats` for every surface (the "Replies fast" badge, the
  compat score) and is therefore NOT flag-dark — left to its own PR.
- **MEDIUM · Deleting your facet tags was worth +5 merit.** An untagged vendor was
  "unjudgeable" → neutral half-credit, while a tagged vendor matching none of the
  couple's picks scored 0. So destroying the data the rest of search runs on paid
  83% of the entire paid ceiling. **Fix:** the neutral is now a FLOOR applied to
  the judged case too — untagged and worst-tagged score identically, and any real
  match scores strictly more. Tagging honestly can never lose.
- **MEDIUM · The over-budget down-rank silently stopped on the ON path** while the
  overlay kept nudging about it from `budgetPressure`. **Fix:** the smart-sort
  price-fit sink now runs on the ON path too, scoped to the ORGANIC rows only
  (labeled slots keep their position) and stable, so within an equal price-fit —
  which is every vendor inside budget — the merit order is preserved exactly.
  No-op when `NEXT_PUBLIC_SMART_SORT_ENABLED` is off.
- **Dead weight removed.** `MERIT_WEIGHTS.badges` (10 pts) and the
  `badgeMeritPoints()` / `MERIT_BADGE_POINTS` bridge added to `vendor-badges.ts`
  had **zero call sites** — 10% of the scale was unreachable, so "6 points out of
  100" really shipped as 6 out of 90. Rather than leave dead code claiming to be
  live, `vendor-badges.ts` is reverted to `origin/main` and the 10 points are
  folded into the two receipt-backed signals (reviews 30→35, bookings 15→20).

**Flag OFF = byte-identical.** Every new read is inside `if (rankBoost)`, the
legacy tier ladder is untouched in the `else` branch, `featuredSlot` is always
`false`, and no new query is issued. Pinned by a source-scan test that walks
*every* occurrence of each flag-gated read, not just the first.

**Tests.** `apps/web/lib/vendor-rank-boost.test.ts` — 42 cases (was 33). New:
the composed-order § 5 invariant (a planted-pair case, a sweep over every tier
pair × the merit range, an exhaustive pairwise sweep of a mixed pool, and a
call-site-override case), the floor↔ceiling clamp, the anti-tag-deletion
guarantee, the every-weight-is-reachable check, and three anti-purchase cases on
`organicRespondsFast`. `apps/web/lib/vendor-rank-boost-callsite.test.ts` — 5 NEW
source-scan guards on the shipped action (which column feeds the featured gate ·
the render order goes through `composeFeaturedOrder` · responsiveness is gated ·
the bot read fails closed · every flag-gated read stays behind the flag · the
one-of-five scope warning is present). `apps/web/lib/vendor-rank-boost-flag.test.ts`
— 3 pinning the dark-by-default contract.

**Falsification (each fix was reverted and the tests re-run, failures observed):**
featured-floor/clamp revert → **5 failed**; `adminVerified` → `verified` at the
call site → **1 failed**; `composeFeaturedOrder` → hand-splice → **1 failed**;
responsiveness gate removed at the call site → **1 failed**;
`organicRespondsFast` reduced to a pass-through → **3 failed**; match-to-need
floor removed → **3 failed**; a dead `badges: 10` weight reintroduced →
**1 failed**.

**Verified:** `pnpm run typecheck` exit **0** · `pnpm test:unit` **3465/3465
pass, 0 fail** · `pnpm run lint` exit 0 (no warnings in the touched files). No
SQL touched, so `test:db` was not run.

### Known residuals (flag-dark, for the reviewer)

- **Slots are chosen BEFORE the overlay's client filters** (`verifiedOnly` /
  `maxKm` / hard facet filter / show-farther) shrink the list, so on a heavily
  filtered page 2 slots can exceed the intended 25% share of what's finally
  visible. Every one of those rows is still labeled and still merit-floored, so
  the integrity rule holds — only the cosmetic density cap slips. Fixing it means
  moving the partition after the filters, which reshapes the whole pipeline.
- **A category with fewer than 4 vendors sells ZERO slots, silently** —
  `floor(3 × 0.25) = 0`. An Enterprise vendor paying ₱7,999+/28d in a thin
  provincial category gets nothing and is never told why. Left as-is: it fails
  SAFE (fewer ads, never more), and the alternative — a minimum slot count —
  is owner decision §4-3 in the ship-readiness report, not a patch.
- **Legacy `ad_rank` advertising is not retired.** Vendors on the old Featured
  product keep the chip on the OFF path and lose the benefit on the ON path
  (owner decision §4-4: retire, migrate, or refund).

No migration. Featured slots are bundled into the subscription tier per § 1, so
`tier_state` + `tier_expires_at` are the entitlement; no new column, no new SKU,
no catalog row. The self-grant hole this branch's reviewer found on `main`
(`verification_state` / `public_visibility` writable through PostgREST) was fixed
separately in **PR #3714**, migration `20271004444950`, which is on `main` and
this branch is rebased onto it.

SPEC IMPACT: None (implements the already-locked § 5; no spec text changes).
Owner sign-off wanted before the flag flips: (1) the boost ceiling — now ALSO the
featured quality floor, since the two are coupled — at 6 pts; (2) the Featured
slot count (2/page, 25% max share); (3) confirmation that flipping this flag on
ONE of five vendor lists is acceptable as a staged rollout.

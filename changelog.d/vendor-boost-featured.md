## 2026-07-25 · feat(marketplace): merit-first ranking + CAPPED paid boost + labeled Featured slots (flag-dark)

Implements `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 5 ("Ranking —
marketplace integrity — do NOT pay-to-win"), build sequence step 5.

**Why.** Today's category search floats EVERY `ad_rank > 0` vendor above the
entire review-ranked pool, with no ceiling and no quality floor. That is the
exact pay-to-win shape the owner-locked model forbids: *"organic rank = merit
for everyone incl. Free … a better free vendor is never buried; paid = a capped
boost + clearly-labeled Featured/Sponsored slots — amplifies quality, never
manufactures it."*

**What landed (all behind `NEXT_PUBLIC_VENDOR_RANK_BOOST_ENABLED`, default OFF):**

- `apps/web/lib/vendor-rank-boost.ts` — new PURE module (no env, no clock, no
  I/O; `nowMs` is an argument):
  - `meritScore()` — 0–100 from match-to-need · reviews · completed bookings ·
    responsiveness · proximity (+ an organic-badge bonus), i.e. exactly the
    signals § 5 names. Structurally **blind to tier / ad spend / subscription** —
    the input type carries no such field. Unknown signals are NEUTRAL, never a
    penalty, so a vendor with sparse data ranks low on evidence not punishment.
  - `tierBoostPoints()` / `boostedRankScore()` / `rankWithCappedBoost()` — an
    **additive** tier bonus hard-ceilinged at `MAX_TIER_BOOST_POINTS = 6`
    (Free 0 · Solo 2 · Pro 4 · Enterprise/Custom 6). The ceiling yields a
    provable invariant, swept in tests over every tier pair and the whole merit
    range: `meritA − meritB > 6 ⟹ A always outranks B`, so money can only
    reshuffle near-equals and can never bury a materially better Free vendor.
    Score ties are broken by RAW merit, so money never wins a coin-flip.
  - `partitionFeatured()` — at most 2 slots, and never more than 25% of the
    page, each requiring an ACTIVE non-lapsed paid tier ≥ Solo **and**
    verification **and** merit within 10 points of the best organic merit in the
    same result set. Featured picks are removed from the organic list (one row,
    not two). `FEATURED_LABEL` / `FEATURED_DISCLOSURE` ship with it.
- `apps/web/lib/vendor-rank-boost-flag.ts` — the flag. Explicitly does NOT touch
  `VENDOR_TIER_SEARCH_GATE`, which hides Free vendors from search and
  contradicts § 5.
- `apps/web/lib/vendor-badges.ts` — new `badgeMeritPoints()` +
  `MERIT_BADGE_POINTS` bridge (organic recognition → merit points, capped at
  10). Documents that a paid placement is never a `VendorBadge`.
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

**Flag OFF = byte-identical.** Every new read is inside `if (rankBoost)`, the
legacy tier ladder is untouched in the `else` branch, `featuredSlot` is always
`false`, and no new query is issued.

**Tests.** `apps/web/lib/vendor-rank-boost.test.ts` — 33 cases: the ceiling and
ladder across all 6 tiers, the non-burial invariant swept over every tier pair
and the whole merit range, merit clamping/monotonicity/neutral-unknowns, the
tier-independent-proximity-horizon regression guard, the badge bridge, and every
featured gate (tier floor, verification, quality floor incl. its inclusive
boundary, hard cap, share cap, lapse handling, exact partition with no
duplicates). `apps/web/lib/vendor-rank-boost-flag.test.ts` — 3 more pinning the
dark-by-default contract: unset reads false (so today's ladder is what runs),
ON only for the explicit opt-in values, and every other value — including
`'false'`, `'True'` and stray whitespace — stays dark, so a typo can never sell
a top-of-page slot.

**One leak found and closed during the build:** the first cut fed the vendor's
`serviceRadiusKm` in as the proximity horizon. That value is derived from
`tier_state`, so a higher tier would have quietly earned a wider — and
*uncapped* — proximity credit **inside** the merit score, defeating the point of
the ceiling. The horizon is now tier-independent, the field carries a warning,
and a test pins that a wider horizon really does score higher (which is exactly
why no tier-derived value may be passed).

**Known residual (flag-dark, for the reviewer).** Slots are chosen BEFORE the
overlay's own client filters (`verifiedOnly` / `maxKm` / hard facet filter /
show-farther) shrink the list, so on a heavily filtered page the 2 slots can
exceed the intended 25% share of what's finally visible. Every one of those rows
is still labeled, so the § 5 integrity rule ("clearly labeled, never buries a
better vendor") holds — only the cosmetic density cap slips. Fixing it properly
means moving the partition after the filters, which reshapes the whole result
pipeline; deliberately deferred rather than bolted on under the flag.

No migration — Featured slots are bundled into the subscription tier per § 1,
so `tier_state` + `tier_expires_at` are the entitlement; no new column, no new
SKU, no catalog row.

SPEC IMPACT: None (implements the already-locked § 5; no spec text changes).
Owner sign-off wanted on two tunables before the flag flips: the boost ceiling
(6 pts) and the Featured slot count (2 per page / 25% max share).

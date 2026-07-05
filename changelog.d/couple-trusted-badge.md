# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · feat(vendor): add "Couple Trusted" trust badge

New organic marketplace trust badge that celebrates vendors with a proven, well-rated review history from couples. Front-end + badge-engine logic only — no schema, no migration, no new fetchers (reuses inputs already threaded into `computeVendorBadges`).

- **`lib/vendor-badges.ts`**: `'couple_trusted'` added to the `VendorBadge` union. A verified vendor earns it when — both must hold — `review_count ≥ 10` AND `avg_rating_overall ≥ 4.7` out of 5. A simple count-floor + rating bar (owner decision 2026-07-05, after industry research): it does **NOT** depend on booking counts / completed-booking coverage. It's an **absolute** threshold (not a percentile). Badge arrays now assemble in one canonical render order — **new → verified → couple_trusted → most_booking → top_pick**. The `top_pick` / `most_booking` percentile logic is unchanged.
- **`app/explore/_components/vendor-badge-row.tsx`**: new `BADGE_META['couple_trusted']` — label **Couple Trusted**, `HeartHandshake` (lucide) icon, calm tooltip "Earned 10+ reviews from couples, averaging 4.7★ or higher.", and an **indigo** tint (`border-indigo-300/60 bg-indigo-50 text-indigo-900`) distinct from the existing terracotta/emerald/gold/rose four. Same `rounded-full … font-mono text-[9px] uppercase tracking-[0.15em]` chip styling.
- **`lib/vendor-badges.test.ts`** (new): cases (a) verified + 10 reviews + 4.7★ → earns it; (b) verified + 9 reviews + 4.9★ → not (below count floor); (c) verified + 15 reviews + 4.6★ → not (below rating bar); (d) unverified + 20 reviews + 5.0★ → not; plus the 10-review/4.7★ boundary, no-booking-dependency, stacking, and the full canonical-order assertion.
- **Not an award**: `couple_trusted` is deliberately NOT added to `SPOTLIGHT_AWARD_BADGES` or the `BADGE_TO_AWARD` vocabulary in `lib/spotlight-awards.ts` — it's an absolute, stacking trust badge, not an exclusive monthly recognition. Badges stay **organic** (real reviews only, never a paid/boost signal).

SPEC IMPACT: None — additive front-end + badge-engine change. New organic vendor trust badge ("Couple Trusted") requiring ≥ 10 reviews + 4.7★ average, verified-gated; stacks with all other badges; not a Spotlight Award. No schema, no pricing, no data-plumbing change.

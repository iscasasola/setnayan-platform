/**
 * 🔌 THE ONE ADAPTER (J4 · the supplier badge page, controller 15 Nov 2026). Everything the badge page reads from the
 * jobs running beside it — J0's ladder (`lib/badge-tiers.ts`), J2's seals, J3's card badges, J5's graphs — comes
 * through THIS file and nowhere else, so a change there is a one-line change here and no page file moves.
 *
 * J0's ladder has landed, so the five badges' keys, steps and tier names are RE-EXPORTED from `lib/badge-tiers.ts`, as
 * this file always said they would be (owner 15 Nov: "these five shop badges … are the only badges"; DECISION_LOG
 * 4b8cc3a3 · bc148e4e · 50566f42 · 219fb192). The hand-typed mirror is gone: one list, never two (walk 24 Nov, fix 5).
 * `badge-sources.test.ts` holds it a re-export.
 *
 * PURE: no I/O.
 */
export { SHOP_BADGE_KEYS, SHOP_BADGE_STEPS, TIER_KEYS, shopBadgeTier, tierName, type ShopBadgeKey, type TierKey } from '@/lib/badge-tiers';

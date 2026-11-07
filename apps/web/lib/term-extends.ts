/**
 * When a paid term should end after a purchase of `days` is activated.
 *
 * 🔑 IT EXTENDS. Remaining time is kept and the new term is added ON TOP —
 * `GREATEST(now, existing) + days` — mirroring, deliberately and exactly, what
 * `_apply_subscription_credit` does in SQL for the plan tiers. Owner 2026-08-27:
 * *"subscription will only extend their plans for an additional 28 days … or 1 year."*
 *
 * An already-lapsed term (expiry in the past, or none) starts from `nowMs`, which
 * is the same `GREATEST(now(), …)` behaviour.
 *
 * Moved here 2026-11-06 from `lib/vendor-custom-pricing.ts` (as
 * `customPlanExpiryFrom`) when the Custom supplier plan was retired — the branch
 * add-on hook in `lib/sku-activation.ts` shares it and must keep extending.
 *
 * PURE — takes its clock, returns an ISO string. Held by `a-branch-renewal-extends.test.ts`.
 */
export function extendedExpiryFrom(nowMs: number, existingExpiryMs: number | null, days: number): string {
  const base =
    existingExpiryMs !== null && Number.isFinite(existingExpiryMs) && existingExpiryMs > nowMs
      ? existingExpiryMs
      : nowMs;
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

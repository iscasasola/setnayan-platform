## 2026-07-01 · fix(vendors): gate Vendors-We-Loved on verification + revalidate couple on claim + guard re-point

Three gap-audit hardening fixes across the vendor recommendation + claim paths.

- **Public leak (FIX #4 · `apps/web/lib/vendor-recommendations.ts`):** the
  anonymous `/[slug]` wedding page's "Vendors We Loved" block filtered only on
  `public_visibility` via `isPubliclyVisible()` and never checked the SEPARATE
  `verification_state` column — so an unverified vendor's raw `business_name` +
  logo leaked publicly, violating the always-on verification gate (#2469).
  Joined `verification_state` into the `vendor_profiles` select and now require
  `verification_state === 'verified'` alongside the existing visibility check
  before a card renders. No demo carve-out (not a demo-preview surface).
- **Claim silent/stale (FIX #5 · `apps/web/lib/vendor-invite-actions.ts`
  `registerClaimedServiceToCouple`):** on the success branch the couple's
  vendors page stayed cached showing the stale manual placeholder instead of the
  upgraded real vendor. Added `event_id` to the parent select and now
  `revalidatePath('/dashboard/${eventId}/vendors', 'layout')` (guarded, best-
  effort) after the link commits. Also emit the existing `vendor_joined`
  in-app notification (not on the email allowlist → in-app/push only) to every
  couple member.
- **Re-point guard (FIX #6 · same file · `applyClaimAutoLink` step 2):** the
  non-transactional `marketplace_vendor_id` UPDATE could let a DIFFERENT second
  claimer overwrite the couple's bond (re-point their vendor) if a later step
  failed and the invite stayed 'pending'. Made the UPDATE conditional with
  `.or('marketplace_vendor_id.is.null,marketplace_vendor_id.eq.<profile>')` so it
  only sets the bond when unset (legitimate first claim) or already this profile
  (idempotent retry); a re-claim by a different profile now matches 0 rows and
  is refused.
- **Multi-category sibling reconcile (FIX #7 · same file · `applyClaimAutoLink`
  step 2b):** a couple who added one vendor under multiple categories has N
  `event_vendors` rows (shared `manual_vendor_id`); the claim bound only the one
  invited row, leaving the others as unclaimed manual contacts for the same real
  vendor. After the primary bond, now also stamps `marketplace_vendor_id` on the
  sibling rows (same `manual_vendor_id` + same event, best-effort, same null-or-
  same-profile guard, skipped when no `manual_vendor_id`) so a single real vendor
  no longer shows as one linked account + leftover placeholders.

SPEC IMPACT: None

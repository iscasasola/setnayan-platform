import { Building2 } from 'lucide-react';
import { formatCount } from '@/lib/format-number';

import { isStoreShellRequest } from '@/lib/request-platform';
import { canBuyExtraBranches, canBuyTheUltraAddOn, includedBranchesLeft, planHasBranches, tierCaps } from '@/lib/vendor-tier-caps';
import { vendorPaywallApplies } from '@/lib/vendor-feature-gate';
import { isVendorSearchGateEnabled } from '@/lib/vendor-search-gate';
import type { VendorBranchView } from '@/lib/vendor-branches';
import { PaidMark } from '@/app/_components/paid-mark';
import { BranchManager, type PayInfo } from '../../_components/branch-manager';
import { ServiceRadiusFields } from './service-radius-fields';

/**
 * WHERE YOU WORK — the HQ, how far you travel, and your branches. MOVED, NOT REWRITTEN, from `shop/page.tsx`
 * (simpler supplier dashboard step 5, 2026-10-14): it was the Branch tile's panel inside My Shop's door 1, and is
 * now the body of Your details › Where you work. Every word, read and gate below is the one it had there.
 */
export async function BranchPanel({
  city,
  branchLocations,
  tier,
  hqLat,
  hqLng,
  reachKm,
  innerRadiusKm,
  outerRadiusKm,
  branches,
  branchFeePhp,
  branchAutoRadius,
  branchPay,
  isVerified = true,
  tierMeasured = true,
  addOnBranches = 0,
}: {
  city: string | null;
  branchLocations: number;
  tier: string | null;
  hqLat: number | null;
  hqLng: number | null;
  reachKm: number;
  innerRadiusKm: number | null;
  outerRadiusKm: number | null;
  branches: VendorBranchView[];
  branchFeePhp: number | null;
  branchAutoRadius: number;
  branchPay: PayInfo;
  /** The shop is verified — an unverified shop's 0 km says why (`GetVerifiedLine`). */
  isVerified?: boolean;
  /** The plan was read. False → Where you work says so instead of drawing a plan's reach nobody read. */
  tierMeasured?: boolean;
  /** 🛒 +1 per Ultra Add-on the shop holds (owner 2026-11-19) — read by the page (`fetchAddOnExtras`); 0 when none. */
  addOnBranches?: number;
}) {
  // 📐 BRANCHES PER PLAN (owner 2026-11-04, "branches 0,0,3,10"): Pro includes 3, Ultra 6 (trimmed the same day), fee-free; only Ultra buys
  // more. Counted from the shop's own live included branches — a shop over a lowered allowance keeps them (0 left).
  const includedInUse = branches.filter((b) => b.included_in_plan && b.status !== 'cancelled').length;
  const includedLeft = includedBranchesLeft(tier, includedInUse, addOnBranches);
  const includedTotal = tierCaps(tier).branchesIncluded + Math.max(0, addOnBranches);
  // 🔒 A branch is a paid add-on (₱ per 28 days), bought AND managed in the
  // BranchManager below. The App Store / Play Store shell neither sells nor
  // runs it (guideline 3.1.1 / 3.1.3(b); lib/store-shell.ts), so the manager
  // and its Enterprise pitch are not mounted there. Web / desktop unchanged.
  const storeShell = await isStoreShellRequest();
  const hasCoords = hqLat !== null && hqLng !== null;
  const hasRing = Number.isFinite(reachKm) && reachKm > 0;
  // "Not shown in searches" is a FACT only while the searchability gate is on
  // (lib/vendor-search-gate.ts). Off — production today — a plan with no ring
  // is UNSCOPED: category-search admits it at any distance. Saying otherwise
  // told findable shops they were hidden.
  const reachHidden = !(reachKm > 0) && isVendorSearchGateEnabled();
  // The plan ask: a plan with no branches at all (Free · Verified · Plus) while the switch is on. A Pro shop at its
  // included one is told the same — more is Ultra's. An Ultra shop at its count is not asked for a plan: its way past
  // is the Ultra Add-on (+1 branch each, owner 2026-11-19), bought on the Plan page.
  const branchPaywall = vendorPaywallApplies(planHasBranches(tier) && (includedLeft > 0 || canBuyTheUltraAddOn(tier)));
  // 🛒 No single branch is sold since 2026-11-19 — the manager's paid "add one" stays off on every plan.
  const canBuyMore = canBuyExtraBranches(tier);
  const from = city ?? 'your headquarters';
  // The shipped sentence, word for word — now the ⓘ of How far you go (house rule: one line visible, the rest in ⓘ).
  // 🔓 Reach is not a plan allowance (owner 2026-11-19): `reachKm` is the verification ceiling — ∞ for a verified shop
  // (no distance limit of the plan's), 0 for an unverified one (whose card shows the locked row, not this note).
  const reachNote = hasRing
    ? `You reach about ${reachKm} km from ${from}. Couples searching farther still find you under “Show farther,” flagged “travel fee likely.”`
    : reachHidden
      ? 'Your shop isn’t shown in couples’ searches yet.'
      : 'Couples searching anywhere can find you — no plan sets a distance limit.';
  // Where the branch pin map opens: the vendor's HQ, or Metro Manila as a
  // sensible national fallback when the HQ hasn't been geocoded yet.
  const branchMapCenter =
    hqLat !== null && hqLng !== null
      ? { lat: hqLat, lng: hqLng }
      : { lat: 14.5995, lng: 120.9842 };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }}
          aria-hidden
        >
          <Building2 className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {city ?? 'Headquarters'}
          </p>
          <p className="text-xs text-ink/55">
            {branchLocations === 1
              ? 'Headquarters'
              : `1 of ${branchLocations} locations`}
          </p>
        </div>
      </div>

      {/* ── Coverage reach — the two distances the vendor declares for
           themselves (2026-07-27 · §17), under the verification ceiling only
           (owner 2026-11-19: reach is not a plan allowance). 📍 Shop › Details › Where you work
           (2026-10-29, v13): the map, the pin, the two rings and the −/＋
           steppers are ONE client part (`ServiceRadiusFields`) so the rings
           move as the distances do; the shipped sentence below is its ⓘ. */}
      <ServiceRadiusFields
        initialInnerKm={innerRadiusKm}
        initialOuterKm={outerRadiusKm}
        reachCeilingKm={reachKm}
        lat={hasCoords ? hqLat : null}
        lng={hasCoords ? hqLng : null}
        city={city}
        isVerified={isVerified}
        measured={tierMeasured}
        reachNote={reachNote}
      />

      {/* TRY-FIRST (2026-09-30): the manager mounts for every plan on the web.
          The Enterprise requirement is asked through vendorPaywallApplies —
          off, nothing is asked beyond the branch's own fee; on, the ◆ note
          shows and the Add step (branches/actions.ts) asks for the plan. */}
      {storeShell ? null : (
        <>
          {branchPaywall ? (
            <p className="flex flex-wrap items-center gap-1.5 text-xs" style={{ color: 'var(--m-slate)' }}>
              <PaidMark
                state="try"
                label="Extra branches are sold with Supplier Ultra only"
                text="ENTERPRISE"
                size="xs"
              />
              {includedTotal > 0
                ? `Your plan’s ${formatCount(includedTotal)} branches are in use. More branches are part of Supplier Ultra — plan one here; adding it asks for the plan.`
                : 'Branches come with Supplier Pro and Supplier Ultra — each gets its own team and calendar. Plan one here; adding it asks for the plan.'}
            </p>
          ) : null}
          <BranchManager
            branches={branches}
            feePhp={branchFeePhp}
            autoRadiusKm={branchAutoRadius}
            initialCenter={branchMapCenter}
            pay={branchPay}
            includedLeft={includedLeft}
            includedTotal={includedTotal}
            canBuyMore={canBuyMore}
          />
        </>
      )}
    </div>
  );
}

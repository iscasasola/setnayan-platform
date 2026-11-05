import { Building2 } from 'lucide-react';
import { formatCount } from '@/lib/format-number';

import { isStoreShellRequest } from '@/lib/request-platform';
import { TIER_LABEL, asVendorTier, canBuyExtraBranches, includedBranchesLeft, nextPlanReach, planHasBranches, reachLadderWords, tierCaps } from '@/lib/vendor-tier-caps';
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
  branchFeePhp: number;
  branchAutoRadius: number;
  branchPay: PayInfo;
  /** The shop is verified — an unverified shop's 0 km says why (`GetVerifiedLine`). */
  isVerified?: boolean;
  /** The plan was read. False → Where you work says so instead of drawing a plan's reach nobody read. */
  tierMeasured?: boolean;
}) {
  // 📐 BRANCHES PER PLAN (owner 2026-11-04, "branches 0,0,3,10"): Pro includes 3, Ultra 6 (trimmed the same day), fee-free; only Ultra buys
  // more. Counted from the shop's own live included branches — a shop over a lowered allowance keeps them (0 left).
  const includedInUse = branches.filter((b) => b.included_in_plan && b.status !== 'cancelled').length;
  const includedLeft = includedBranchesLeft(tier, includedInUse);
  const includedTotal = tierCaps(tier).branchesIncluded;
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
  const reachHidden = !hasRing && isVendorSearchGateEnabled();
  const reachPaywall = vendorPaywallApplies(false) && !storeShell;
  // The plan ask: a plan with no branches at all (Free · Verified · Solo) while the switch is on. A Pro shop at its
  // included three is told the same — more is Ultra's.
  const branchPaywall = vendorPaywallApplies(planHasBranches(tier) && (includedLeft > 0 || canBuyExtraBranches(tier)));
  // ⚖ May the paid flow sell one more? ULTRA ONLY, ALWAYS (owner 2026-11-05, "Ultra only, always") — a price rule,
  // not a try-first paywall, so the switch does not open it.
  const canBuyMore = canBuyExtraBranches(tier);
  const from = city ?? 'your headquarters';
  // The shipped sentence, word for word — now the ⓘ of How far you go (house rule: one line visible, the rest in ⓘ).
  const reachNote = hasRing
    ? `Your plan reaches about ${reachKm} km from ${from}. Couples searching farther still find you under “Show farther,” flagged “travel fee likely.”`
    : reachHidden
      ? `Your shop isn’t shown in couples’ searches yet.${reachPaywall ? ' A paid plan puts you on the map and sets your coverage radius.' : ''}`
      : 'Couples searching anywhere can find you — your plan has no distance limit.';
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

      {/* ── Coverage reach — the radius couples' Services search gates on, and
           (2026-07-27 · §17) the CEILING on the two distances the vendor
           declares for themselves. 📍 Shop › Details › Where you work
           (2026-10-29, v13): the map, the pin, the two rings and the −/＋
           steppers are ONE client part (`ServiceRadiusFields`) so the rings
           move as the distances do; the shipped sentence below is its ⓘ. */}
      <ServiceRadiusFields
        initialInnerKm={innerRadiusKm}
        initialOuterKm={outerRadiusKm}
        tierCapKm={reachKm}
        lat={hasCoords ? hqLat : null}
        lng={hasCoords ? hqLng : null}
        city={city}
        isVerified={isVerified}
        tierMeasured={tierMeasured}
        planName={TIER_LABEL[asVendorTier(tier)]}
        nextReach={nextPlanReach(tier)}
        ladder={reachLadderWords()}
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
                label="Extra branches are sold with Ultra only"
                text="ENTERPRISE"
                size="xs"
              />
              {includedTotal > 0
                ? `Your plan’s ${formatCount(includedTotal)} branches are in use. More branches are part of Ultra — plan one here; adding it asks for the plan.`
                : 'Branches come with Pro and Ultra — each gets its own team and calendar. Plan one here; adding it asks for the plan.'}
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

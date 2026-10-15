import { Building2 } from 'lucide-react';

import { isStoreShellRequest } from '@/lib/request-platform';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { vendorPaywallApplies } from '@/lib/vendor-feature-gate';
import { isVendorSearchGateEnabled } from '@/lib/vendor-search-gate';
import type { VendorBranchView } from '@/lib/vendor-branches';
import { PaidMark } from '@/app/_components/paid-mark';
import { BranchManager, type PayInfo } from '../../_components/branch-manager';
import { ReachMap } from './reach-map';
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
}) {
  const isEnterprise = isTierAtLeast(tier, 'enterprise');
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
  const branchPaywall = vendorPaywallApplies(isEnterprise);
  const from = city ?? 'your headquarters';
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
           declares for themselves just below it. */}
      {hasCoords ? (
        <div className="space-y-2">
          <ReachMap lat={hqLat} lng={hqLng} radiusKm={reachKm} />
          <p className="text-xs text-ink/55">
            {hasRing ? (
              <>
                Your plan reaches about{' '}
                <span className="font-medium text-ink">{reachKm} km</span> from{' '}
                {from}. Couples searching farther still find you under
                {' '}&ldquo;Show farther,&rdquo; flagged &ldquo;travel fee
                likely.&rdquo;
              </>
            ) : (
              reachHidden ? (
                <>
                  Your shop isn&rsquo;t shown in couples&rsquo; searches yet.
                  {reachPaywall
                    ? ' A paid plan puts you on the map and sets your coverage radius.'
                    : null}
                </>
              ) : (
                <>
                  Couples searching anywhere can find you — your plan has no
                  distance limit. Set how far you travel just below.
                </>
              )
            )}
          </p>
          <ServiceRadiusFields
            initialInnerKm={innerRadiusKm}
            initialOuterKm={outerRadiusKm}
            tierCapKm={reachKm}
          />
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
          Add your HQ address in Profile above to see how far you cover on a map.
        </p>
      )}

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
                label="Part of Enterprise — plan it here; adding asks for Enterprise"
                text="ENTERPRISE"
                size="xs"
              />
              Extra branches are part of Enterprise — each gets its own team and
              calendar. Plan one here; adding it asks for the plan.
            </p>
          ) : null}
          <BranchManager
            branches={branches}
            feePhp={branchFeePhp}
            autoRadiusKm={branchAutoRadius}
            initialCenter={branchMapCenter}
            pay={branchPay}
          />
        </>
      )}
    </div>
  );
}

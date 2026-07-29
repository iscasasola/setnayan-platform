import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPapicPassTiers } from '@/lib/papic-pass-tiers';
import { fetchPapicOneTiers } from '@/lib/papic-one';
import { papicOneRungPhrase, papicPoolRungPhrase } from '@/lib/papic-tier-copy';
import { papicGuestBuyEnabled } from '@/lib/papic-guest-buy-flag';
import { guestOneRungs, guestPoolRungs, type PapicGuestOffer } from '@/lib/papic-guest-buy';
import { PapicBuyShell } from './papic-buy-shell';

/**
 * The server half of the guest's "Add shots" doorway.
 *
 * Does the reading; the client shell does the painting. Everything on screen is
 * DERIVED — points from the admin-editable rung tables, the peso figure from
 * `platform_retail_catalog_v2`, the sentence itself from lib/papic-tier-copy.ts.
 * No number is written here, so the owner repricing a rung moves this surface
 * without anyone editing it.
 *
 * ── SELF-GATING, like its siblings ────────────────────────────────────────
 * Renders null on any of:
 *   • the flag is off (NEXT_PUBLIC_PAPIC_GUEST_BUY) — the whole feature;
 *   • no rung has a live catalog price — nothing is on sale, so offering it
 *     would be a button that can only fail;
 *   • the caller has no camera of their own (`canReloadOwnCamera` false) — the
 *     One rungs are dropped and only the shared pool is offered.
 *
 * ⚠ It never decides ENTITLEMENT. Whether this caller may actually buy — which
 * event, whose camera, is one already pending — is re-decided from the
 * credential in app/papic/buy/actions.ts. A surface that gates and an action
 * that trusts the surface is the shape that goes wrong; here the surface is
 * only ever an offer.
 */
export async function PapicGuestBuyPanel({
  seatToken,
  returnTo,
  error,
  canReloadOwnCamera = false,
}: {
  /** The claim token when this renders on a seat camera; null on the guest camera. */
  seatToken?: string | null;
  returnTo: string;
  error?: string | null;
  /**
   * Does the caller hold a camera with its own DEDICATED balance? Only such a
   * camera can be reloaded — one that shoots from the shared pool has no
   * private balance to top up, and granting it one would silently move it off
   * the pool the host is watching. Resolved by the page, which already knows
   * the seat.
   */
  canReloadOwnCamera?: boolean;
}) {
  if (!papicGuestBuyEnabled()) return null;

  const admin = createAdminClient();
  const [poolTiers, oneTiers] = await Promise.all([
    fetchPapicPassTiers(admin),
    fetchPapicOneTiers(admin),
  ]);

  const rungs = [
    ...(canReloadOwnCamera ? guestOneRungs(oneTiers) : []),
    ...guestPoolRungs(poolTiers),
  ];
  if (rungs.length === 0) return null;

  const prices = await fetchRungPrices(
    admin,
    rungs.map((r) => r.serviceCode),
  );

  const offers: PapicGuestOffer[] = rungs
    .map((r) => {
      const pricePhp = prices.get(r.serviceCode);
      if (pricePhp == null || !(pricePhp > 0)) return null;
      return {
        kind: r.kind,
        serviceCode: r.serviceCode,
        points: r.points,
        pricePhp,
        phrase:
          r.kind === 'one_reload'
            ? papicOneRungPhrase(r.points, pricePhp)
            : papicPoolRungPhrase(r.points, pricePhp),
      } satisfies PapicGuestOffer;
    })
    .filter((o): o is PapicGuestOffer => o !== null);
  if (offers.length === 0) return null;

  return (
    <PapicBuyShell
      offers={offers}
      seatToken={seatToken ?? null}
      returnTo={returnTo}
      error={error ?? null}
    />
  );
}

/**
 * Live rung prices, straight from the catalog — the single billing source.
 * `is_active` is honoured here so a rung an admin retires stops being offered
 * the moment they retire it. Degrades to an empty map rather than throwing: a
 * missing price hides the offer, which is recoverable; a thrown error would
 * take down the camera, which is not.
 */
async function fetchRungPrices(
  admin: ReturnType<typeof createAdminClient>,
  codes: readonly string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (codes.length === 0) return out;
  try {
    const { data, error } = await admin
      .from('platform_retail_catalog_v2')
      .select('service_code, retail_price_php, is_active')
      .in('service_code', codes as string[]);
    if (error || !Array.isArray(data)) return out;
    for (const row of data) {
      if ((row as { is_active?: unknown }).is_active !== true) continue;
      const n = Number((row as { retail_price_php?: unknown }).retail_price_php ?? 0);
      if (Number.isFinite(n) && n > 0) {
        out.set(String((row as { service_code?: unknown }).service_code ?? ''), n);
      }
    }
    return out;
  } catch {
    return out;
  }
}

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPapicPassTiers } from '@/lib/papic-pass-tiers';
import { fetchPapicOneTiers } from '@/lib/papic-one';
import { papicOneRungPhrase, papicPoolRungPhrase } from '@/lib/papic-tier-copy';
import { papicGuestBuyEnabled } from '@/lib/papic-guest-buy-flag';
import { eventIsOver } from '@/lib/event-is-over.server';
import { guestOneRungs, guestPoolRungs, type PapicGuestOffer } from '@/lib/papic-guest-buy';
import { isSameDayInManila, buyWaitCopy } from '@/lib/papic-buy-urgency';
import { resolveSeatDedicatedStanding } from '@/lib/papic-guest-own-camera';
import { PapicBuyShell } from './papic-buy-shell';

/**
 * The server half of the guest's "Add credits" doorway.
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
 *   • `canReloadOwnCamera` false — the One rungs are dropped and only the
 *     shared pool is offered. Both live capture surfaces now pass true; the
 *     default stays false so a new caller has to opt in deliberately.
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
  eventId = null,
  ownSeatId = null,
  released = null,
}: {
  /** The claim token when this renders on a seat camera; null on the guest camera. */
  seatToken?: string | null;
  returnTo: string;
  error?: string | null;
  /**
   * Does the caller hold a camera of their own — i.e. a SEAT? Only a seat can
   * carry a dedicated balance, so only a seat can be offered the One rungs.
   *
   * ⚠ This used to mean "a camera that ALREADY has dedicated points", which was
   * circular: nobody could buy their first private shots. Widened 2026-08-02 —
   * any camera its holder claimed may buy credits for itself.
   */
  canReloadOwnCamera?: boolean;
  /** Drives the wait the guest is promised. Omitted → the ordinary 24-hour line. */
  eventId?: string | null;
  /**
   * The caller's OWN camera, if the page already resolved one — spec § 7b's
   * "change your mind later" half. DISPLAY ONLY: never trusted for the release
   * itself, which re-resolves the same seat from the credential in
   * app/papic/buy/actions.ts. Omitted → no release offer, same as today.
   */
  ownSeatId?: string | null;
  /** `?papic_release=N` from a just-completed release, for the confirmation line. */
  released?: string | null;
}) {
  if (!papicGuestBuyEnabled()) return null;

  const admin = createAdminClient();
  const [poolTiers, oneTiers, eventDate, standing, isOver] = await Promise.all([
    fetchPapicPassTiers(admin),
    fetchPapicOneTiers(admin),
    fetchEventDate(admin, eventId),
    ownSeatId ? resolveSeatDedicatedStanding(admin, ownSeatId) : Promise.resolve(null),
    /*
      ── THE CELEBRATION IS OVER: STOP OFFERING ────────────────────────────
      Owner, 2026-08-21: **"no. it needs to be in a new event."** Papic credits
      are scoped to ONE celebration, and there is nothing left to shoot.

      🔑 THE DOORWAY, NOT THE RULE. The rule is enforced in the buy action —
      every export of a 'use server' module is POST-able whether or not any UI
      references it, so hiding this panel closes the button and not the door.
      This is here so a guest is not offered something they would then be
      refused.

      Rides in the SAME parallel batch as the three reads already here, so it
      costs no extra round trip on the surfaces that do show the panel.
    */
    eventId ? eventIsOver(admin, eventId) : Promise.resolve(false),
  ]);
  if (isOver) return null;
  // Same-day → the guest is promised the front of the queue, and /admin/payments
  // puts them there off the SAME function. Missing date → the ordinary 24-hour
  // line, because over-promising a wait we might not beat is the worse failure.
  const wait = buyWaitCopy(isSameDayInManila(eventDate));

  // A releasable balance can survive every rung going off sale (a guest may
  // hold bought credits long after the ladder changes), so an empty catalog
  // must not also hide a "give it to the celebration" she is entitled to see.
  const hasReleaseOffer = Boolean(standing && standing.releasable > 0);
  const rungs = [
    ...(canReloadOwnCamera ? guestOneRungs(oneTiers) : []),
    ...guestPoolRungs(poolTiers),
  ];
  if (rungs.length === 0 && !hasReleaseOffer) return null;

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
  if (offers.length === 0 && !hasReleaseOffer) return null;

  return (
    <PapicBuyShell
      offers={offers}
      seatToken={seatToken ?? null}
      returnTo={returnTo}
      error={error ?? null}
      wait={wait}
      standing={standing}
      released={released}
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

/**
 * The event's date, for the same-day check. Degrades to null on anything at all
 * — a missing date costs the guest the priority LINE, never the camera.
 */
async function fetchEventDate(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string | null,
): Promise<string | null> {
  if (!eventId) return null;
  try {
    const { data, error } = await admin
      .from('events')
      .select('event_date')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) return null;
    return (data?.event_date as string | null) ?? null;
  } catch {
    return null;
  }
}

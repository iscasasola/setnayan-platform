import 'server-only';

/**
 * onboarding-services-orders.ts — turn what the couple picked on the onboarding
 * services step into real apply-then-pay orders (owner 2026-08-11).
 *
 * Called from the event-commit paths, AFTER the event row and its free grants
 * exist. Mints at most THREE orders and returns where to send the couple:
 *   • the shared Papic Pool rung
 *   • one order covering EVERY extra dedicated Papic One camera
 *   • Setnayan AI
 *
 * ── SEC-4: THE BROWSER CHOOSES *WHAT*, THIS FILE DECIDES THE PESO FIGURE ────
 * The selection carries service_codes, a camera count and a yes/no — and NOTHING
 * ELSE. No amount, no points figure, no total crosses the boundary. Every figure
 * is re-resolved server-side here.
 *
 * ── ⚠ THE TWO PRODUCTS ARE PRICED BY DIFFERENT AUTHORITIES. DO NOT UNIFY. ──
 * • PAPIC (Pool + One) → the ACTIVE catalog row, read directly. `is_active` is
 *   checked HERE and not left to the shared charge resolver, which prices by
 *   service_code alone: a rung an admin retired would otherwise still quote, and
 *   the reject has to happen before an order exists. Same shape as
 *   `purchasePapicPoolTopUp` / `purchasePapicOneCamera` — this is their sibling.
 * • SETNAYAN AI → `resolveOrderChargeCentavos`, NEVER the catalog row. Its price
 *   depends on the EVENT TYPE and that override is LIVE in prod (verified
 *   2026-08-11). The flat catalog row is the WEDDING figure; most types resolve
 *   to a much smaller one. Reading the catalog for it — the obvious thing, and
 *   what the Papic branches correctly do — would overcharge every non-wedding
 *   couple on their very first order, with the order row looking perfectly
 *   well-formed. That asymmetry is the single most important thing in this file.
 *
 * ── IT MUST NEVER COST THE COUPLE THEIR EVENT ──────────────────────────────
 * By the time this runs the event is committed and the free grants are armed.
 * So every failure below is NON-FATAL and returns `paymentPath: null`: the
 * couple lands in their dashboard with a working, free Papic and no order,
 * which is recoverable in one tap from the studio. Throwing here would trade a
 * lost upsell for a lost wedding.
 *
 * ⚠ AND NOTHING IS GRANTED HERE. Orders are minted `submitted`; points appear
 * only when an admin approves the payment in /admin/payments and the matched
 * total covers what is owed. These are ordinary orders precisely so they inherit
 * that shortfall guard.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { createMoneyWriterClient } from '@/lib/supabase/admin';
import { mintPapicReferenceCode, provisionPaidCamerasAdmin } from '@/lib/papic-cameras';
import { fetchEventPapicWindow } from '@/lib/papic-limited';
import { fetchPapicPassTiers } from '@/lib/papic-pass-tiers';
import { fetchPapicOneTiers, papicOneOrderRow } from '@/lib/papic-one';
import { parseServicesStepSelection, type ServicesStepSelection } from '@/lib/onboarding-services-selection';
import { resolveOrderChargeCentavos } from '@/lib/order-charge-authority';
import { SETNAYAN_AI_SKU } from '@/lib/setnayan-ai-event-pricing';

export type OnboardingOrderResult = {
  /** Public order ids minted, for logging. Empty when nothing was bought. */
  orderPublicIds: string[];
  /**
   * Where to send the couple, or null to fall through to the dashboard. Null
   * covers BOTH "they bought nothing" and "something went wrong" — a couple who
   * is not being charged must never be parked on a payment screen.
   */
  paymentPath: string | null;
};

const NOTHING: OnboardingOrderResult = { orderPublicIds: [], paymentPath: null };

/** Live, active, and priced — or null. The single price gate for both products. */
async function priceOf(admin: SupabaseClient, serviceCode: string): Promise<number | null> {
  const { data } = await admin
    .from('platform_retail_catalog_v2')
    .select('retail_price_php, is_active')
    .eq('service_code', serviceCode)
    .maybeSingle();
  const php = Number(data?.retail_price_php ?? 0);
  if (!Number.isFinite(php) || php <= 0 || data?.is_active !== true) return null;
  return php;
}

/**
 * Mint the couple's Papic orders for a freshly-committed event.
 *
 * `rawSelection` is UNTRUSTED — it comes from the browser through the commit
 * action — and is re-parsed here rather than trusted from the caller.
 */
export async function mintOnboardingServiceOrders(
  admin: SupabaseClient,
  input: { eventId: string; userId: string; rawSelection: unknown },
): Promise<OnboardingOrderResult> {
  const selection: ServicesStepSelection = parseServicesStepSelection(input.rawSelection);
  const { eventId, userId } = input;
  if (!eventId || !userId) return NOTHING;

  const orderPublicIds: string[] = [];
  let firstReference: string | null = null;
  let aiOrdered = false;

  try {
    // ── the shared Pool rung ────────────────────────────────────────────────
    if (selection.poolRungKey) {
      // Read from the TABLE, never an allow-list here: a rung an admin
      // deactivates must stop being sellable the moment they deactivate it.
      // `isTopup` is excluded to match the picker's ladder exactly — the top-up
      // rung is a re-buy for an event that already holds a big pool, and selling
      // it here would duplicate a rung already on the ladder.
      const tiers = await fetchPapicPassTiers(admin);
      const tier = tiers.find((t) => t.serviceCode === selection.poolRungKey && !t.isTopup);
      const pricePhp = tier ? await priceOf(admin, tier.serviceCode) : null;
      if (tier && tier.points > 0 && pricePhp !== null) {
        const referenceCode = mintPapicReferenceCode();
        const { data: order, error } = await createMoneyWriterClient()
          .from('orders')
          .insert({
            event_id: eventId,
            user_id: userId,
            service_key: tier.serviceCode,
            description: `Papic Pool — adds ${tier.points} shots to the shared pool`,
            requested_total_php: pricePhp,
            reference_code: referenceCode,
            status: 'submitted',
            platform: 'web',
          })
          .select('public_id')
          .maybeSingle();
        if (!error && order) {
          orderPublicIds.push(String(order.public_id));
          firstReference = firstReference ?? referenceCode;
        } else {
          console.error('[onboarding-services-orders] pool order failed:', error?.message);
        }
      } else {
        // Not worth failing on — an admin retiring a rung between the render and
        // the commit is a legitimate race, and the couple is simply not charged.
        console.warn(
          '[onboarding-services-orders] pool rung not sellable at commit:',
          selection.poolRungKey,
        );
      }
    }

    // ── the extra dedicated cameras ─────────────────────────────────────────
    // ONE order for all of them, so a brand-new couple makes ONE bank transfer
    // against ONE reference code. That shape is only safe because migration
    // 20271128697126 made papic_grant_camera_points iterate every
    // papic_one_orders row on the order — before it, a multi-camera order
    // funded the FIRST camera and left the rest paid-for and empty.
    if (selection.oneRungKey && selection.oneExtraCameras > 0) {
      const oneTiers = await fetchPapicOneTiers(admin);
      const tier = oneTiers.find((t) => t.serviceCode === selection.oneRungKey);
      const unitPhp = tier ? await priceOf(admin, tier.serviceCode) : null;
      if (tier && tier.points > 0 && unitPhp !== null) {
        const count = selection.oneExtraCameras;
        const referenceCode = mintPapicReferenceCode();
        const { data: order, error } = await createMoneyWriterClient()
          .from('orders')
          .insert({
            event_id: eventId,
            user_id: userId,
            service_key: tier.serviceCode,
            description:
              count === 1
                ? `Papic One — one dedicated camera with ${tier.points} shots`
                : `Papic One — ${count} dedicated cameras, ${tier.points} shots each`,
            // The peso figure is COMPUTED HERE from the catalog unit price, never
            // taken from the browser's running total.
            requested_total_php: unitPhp * count,
            reference_code: referenceCode,
            status: 'submitted',
            platform: 'web',
          })
          .select('order_id, public_id')
          .maybeSingle();
        if (error || !order) {
          console.error('[onboarding-services-orders] camera order failed:', error?.message);
        } else {
          const orderId = String(order.order_id);
          const win = await fetchEventPapicWindow(admin, eventId);
          let seatIds: string[] = [];
          try {
            await provisionPaidCamerasAdmin(admin, {
              eventId,
              orderId,
              miniCount: count,
              ltdCount: 0,
              unlimitedCount: 0,
              validFrom: win.startIso,
              validUntil: win.endIso,
            });
            const { data: fresh } = await admin
              .from('paparazzi_seats')
              .select('seat_id')
              .eq('paid_order_id', orderId);
            seatIds = (fresh ?? []).map((r: { seat_id: unknown }) => String(r.seat_id));
          } catch (e) {
            console.error('[onboarding-services-orders] camera provisioning threw:', e);
          }

          // One mapping row PER CAMERA — this is what the grant function reads,
          // and what tells it how many shots each camera is owed.
          const mapErr =
            seatIds.length > 0
              ? (
                  await admin.from('papic_one_orders').insert(
                    seatIds.map((seatId) =>
                      papicOneOrderRow({
                        orderId,
                        eventId,
                        seatId,
                        serviceCode: tier.serviceCode,
                        points: tier.points,
                        isReload: false,
                      }),
                    ),
                  )
                ).error
              : { message: 'no cameras provisioned' };

          // ⚠ FAIL CLOSED ON A MISMATCH. Without one mapping row per camera the
          // approval hook cannot tell which camera the shots belong to, and a
          // paid order that grants nothing is worse than no order at all — so
          // the order is cancelled rather than left standing as a charge we
          // cannot fulfil. Same posture as purchasePapicOneCamera.
          //
          // The count check is NOT redundant with the insert error: provisioning
          // can return fewer seats than asked without throwing, and the insert
          // would then succeed for the seats that do exist — leaving a couple
          // billed for cameras nobody ever created.
          if (mapErr || seatIds.length !== count) {
            console.error('[onboarding-services-orders] camera mapping incomplete — cancelling:', {
              orderId,
              wanted: count,
              got: seatIds.length,
              error: mapErr ? String(mapErr.message ?? mapErr) : null,
            });
            await admin.from('orders').update({ status: 'cancelled' }).eq('order_id', orderId);
          } else {
            orderPublicIds.push(String(order.public_id));
            firstReference = firstReference ?? referenceCode;
          }
        }
      } else {
        console.warn(
          '[onboarding-services-orders] camera rung not sellable at commit:',
          selection.oneRungKey,
        );
      }
    }

    // ── Setnayan AI (owner 2026-08-11) ──────────────────────────────────────
    // 🚨 PRICED THROUGH THE CHARGE AUTHORITY, NEVER THROUGH `priceOf` ABOVE.
    // Setnayan AI is priced per EVENT TYPE and that override is LIVE in prod
    // (`platform_settings.setnayan_ai_per_event_pricing_enabled = true`,
    // verified 2026-08-11). The flat catalog row is the WEDDING figure; most
    // event types resolve to a much smaller one. Reading the catalog directly
    // here — the obvious thing to do, and what the two Papic branches above
    // correctly do — would overcharge every non-wedding couple by the whole
    // difference, on their very first order, with the order row itself looking
    // perfectly well-formed.
    //
    // `resolveOrderChargeCentavos` is the single authority that applies the
    // per-type override, and it re-reads the event's STORED type, so a tampered
    // payload cannot pick a cheaper tier. It also REFUSES rather than guessing
    // when it cannot resolve a price — and a refusal here simply means no AI
    // order, which is the safe half of the trade.
    if (selection.ai) {
      const charge = await resolveOrderChargeCentavos({
        serviceKey: SETNAYAN_AI_SKU,
        eventId,
      });
      if (!charge.ok) {
        console.warn('[onboarding-services-orders] AI charge refused:', charge.refusal);
      } else {
        const pricePhp = Number(charge.total) / 100;
        if (Number.isFinite(pricePhp) && pricePhp > 0) {
          const referenceCode = mintPapicReferenceCode();
          const { data: order, error } = await createMoneyWriterClient()
            .from('orders')
            .insert({
              event_id: eventId,
              user_id: userId,
              service_key: SETNAYAN_AI_SKU,
              description: 'Setnayan AI — the assisted planner for this event',
              requested_total_php: pricePhp,
              reference_code: referenceCode,
              status: 'submitted',
              platform: 'web',
            })
            .select('public_id')
            .maybeSingle();
          if (!error && order) {
            orderPublicIds.push(String(order.public_id));
            firstReference = firstReference ?? referenceCode;
            aiOrdered = true;
          } else {
            console.error('[onboarding-services-orders] AI order failed:', error?.message);
          }
        }
      }
    }
  } catch (e) {
    // Non-fatal by contract — see the docblock. The event and its free grants
    // are already committed and must survive anything that happens here.
    console.error('[onboarding-services-orders] threw (non-fatal):', e);
  }

  if (orderPublicIds.length === 0) return NOTHING;

  // Land them on their own Papic studio with the payment banner the studio's
  // buy paths already render, rather than on a new payment screen: it is the
  // same banner, on the page they will use to add more later.
  const params = new URLSearchParams({ papic_purchased: orderPublicIds[0]! });
  if (firstReference) params.set('papic_ref', firstReference);
  return {
    orderPublicIds,
    paymentPath: `/dashboard/${eventId}/studio/papic?${params.toString()}`,
  };
}

import 'server-only';

/**
 * onboarding-services-orders.ts — turn what the couple picked on the onboarding
 * services step into ONE apply-then-pay bill (owner 2026-08-11).
 *
 * Called from the event-commit paths, AFTER the event row and its free grants
 * exist. Mints a SINGLE order covering everything they chose — a Papic Pool
 * rung, N dedicated Papic One cameras, Setnayan AI — and returns where to send
 * them.
 *
 * ── WHY ONE ORDER AND NOT THREE ────────────────────────────────────────────
 * Owner: *"it will total and create a custom QR"* … *"it will also integrate the
 * approval of both at the same time once verified."*
 *
 * The QR carries the AMOUNT ONLY — GCash rejects a reference inside the code,
 * tested on real wallets 2026-07-31 — so a couple scanning one QR for the total
 * sends ONE transfer. Against three orders that transfer reconciles cleanly
 * against none of them: the shortfall guard, the duplicate detector and the
 * paste-the-bank-alert matcher all reason about one order, one amount, one
 * reference. Billing the basket as a single order leaves every one of those
 * BYTE-IDENTICAL and moves the new complexity into activation, which already
 * fans out for bundles. What each item is stays recorded in
 * `onboarding_order_items`; see lib/onboarding-order-items.ts for the three
 * readers that consult it.
 *
 * ── SEC-4: THE BROWSER CHOOSES *WHAT*, THIS FILE DECIDES THE PESO FIGURE ────
 * The selection carries service_codes, a camera count and a yes/no — and NOTHING
 * ELSE. No amount, no points figure, no total crosses the boundary. The bill's
 * total is the SUM of parts each resolved server-side here.
 *
 * ── ⚠ THE PARTS ARE PRICED BY DIFFERENT AUTHORITIES. DO NOT UNIFY. ─────────
 * • PAPIC (Pool + One) → the ACTIVE catalog row, read directly. `is_active` is
 *   checked HERE and not left to the shared charge resolver, which prices by
 *   service_code alone: a rung an admin retired would otherwise still quote, and
 *   the reject has to happen before an order exists.
 * • SETNAYAN AI → `resolveOrderChargeCentavos`, NEVER the catalog row. Its price
 *   depends on the EVENT TYPE and that override is LIVE in prod (verified
 *   2026-08-11). The flat catalog row is the WEDDING figure; most types resolve
 *   to a much smaller one. Reading the catalog for it — the obvious thing, and
 *   what the Papic parts correctly do — would overcharge every non-wedding
 *   couple on their very first bill, with the order row looking perfectly
 *   well-formed. That asymmetry is the single most important thing in this file.
 *
 * ── IT MUST NEVER COST THE COUPLE THEIR EVENT ──────────────────────────────
 * By the time this runs the event is committed and the free grants are armed. So
 * every failure is NON-FATAL and returns `paymentPath: null`: they land in their
 * dashboard with a working, free Papic and no bill, recoverable in one tap from
 * the studio. Throwing here would trade a lost upsell for a lost wedding.
 *
 * ⚠ AND NOTHING IS GRANTED HERE. The order is minted `submitted`; everything on
 * it appears only when an admin approves the payment and the matched total
 * covers what is owed. It is an ordinary order precisely so it inherits that
 * shortfall guard — one guard over one total, which is another thing three
 * separate bills would have made worse.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { createMoneyWriterClient } from '@/lib/supabase/admin';
import { mintPapicReferenceCode } from '@/lib/papic-cameras';
import { fetchEventPapicWindow } from '@/lib/papic-limited';
import { fetchPapicPassTiers } from '@/lib/papic-pass-tiers';
import { fetchPapicOneTiers, papicOneOrderRow } from '@/lib/papic-one';
import {
  parseServicesStepSelection,
  type ServicesStepSelection,
} from '@/lib/onboarding-services-selection';
import { ONBOARDING_SERVICES_SKU } from '@/lib/onboarding-order-items';
import { orderRowFor } from '@/lib/order-mint-identity';
import { resolveOrderChargeCentavos } from '@/lib/order-charge-authority';
import { SETNAYAN_AI_SKU } from '@/lib/setnayan-ai-event-pricing';

export type OnboardingOrderResult = {
  /** Public ids minted — at most one, since the basket is one bill. */
  orderPublicIds: string[];
  /**
   * Where to send the couple, or null to fall through to the dashboard. Null
   * covers BOTH "they bought nothing" and "something went wrong" — a couple who
   * is not being charged must never be parked on a payment screen.
   */
  paymentPath: string | null;
};

const NOTHING: OnboardingOrderResult = { orderPublicIds: [], paymentPath: null };

/** One line of the bill, fully resolved server-side. */
type Part = {
  serviceCode: string;
  quantity: number;
  unitPhp: number;
  /** What the line says on the payment page. */
  label: string;
};

const lineTotal = (p: Part) => p.unitPhp * p.quantity;

/** Live, active, and priced — or null. The price gate for the two Papic parts. */
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
 * Mint the couple's ONE onboarding bill for a freshly-committed event.
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

  try {
    const parts: Part[] = [];
    // ── the shared Pool rung ────────────────────────────────────────────────
    // Read from the TABLE, never an allow-list: a rung an admin deactivates must
    // stop being sellable the moment they deactivate it. `isTopup` is excluded
    // to match the picker's ladder exactly — the top-up rung is a re-buy for an
    // event that already holds a big pool, and selling it here would duplicate a
    // rung already on the ladder.
    if (selection.poolRungKey) {
      const tiers = await fetchPapicPassTiers(admin);
      const tier = tiers.find((t) => t.serviceCode === selection.poolRungKey && !t.isTopup);
      const unitPhp = tier ? await priceOf(admin, tier.serviceCode) : null;
      if (tier && tier.points > 0 && unitPhp !== null) {
        parts.push({
          serviceCode: tier.serviceCode,
          quantity: 1,
          unitPhp,
          label: `Papic — ${tier.points} shots`,
        });
      } else {
        // An admin retiring a rung between the render and the commit is a
        // legitimate race, and the couple is simply not charged for it.
        console.warn(
          '[onboarding-services-orders] pool rung not sellable at commit:',
          selection.poolRungKey,
        );
      }
    }

    // ── NO CAMERA LINE ANY MORE (owner 2026-08-11) ──────────────────────────
    //
    // A block here bought N dedicated cameras at a Papic One rung. Papic is one
    // product now: cameras are free and unlimited, and a dedicated one is made
    // in the studio by handing it shots the couple already owns.

    // ── Setnayan AI ─────────────────────────────────────────────────────────
    // Through the charge AUTHORITY — see the header. It re-reads the event's
    // STORED type, so a tampered payload cannot pick a cheaper tier, and it
    // REFUSES rather than guessing when it cannot resolve a price.
    if (selection.ai) {
      const charge = await resolveOrderChargeCentavos({
        serviceKey: SETNAYAN_AI_SKU,
        eventId,
        // 🔒 THE ONLY PLACE IN THE APP THAT MAY ASK FOR THE SIGN-UP PRICE.
        // This module runs server-side off the event-commit path and nothing in
        // a request body reaches this literal, so a browser cannot buy at the
        // discount later. Everywhere else defaults to the regular price.
        priceContext: 'onboarding',
      });
      if (!charge.ok) {
        console.warn('[onboarding-services-orders] AI charge refused:', charge.refusal);
      } else {
        const unitPhp = Number(charge.total) / 100;
        if (Number.isFinite(unitPhp) && unitPhp > 0) {
          parts.push({
            serviceCode: SETNAYAN_AI_SKU,
            quantity: 1,
            unitPhp,
            label: 'Setnayan AI — the assisted planner for this event',
          });
        }
      }
    }

    if (parts.length === 0) return NOTHING;

    // ── ONE bill ────────────────────────────────────────────────────────────
    const totalPhp = parts.reduce((sum, p) => sum + lineTotal(p), 0);
    if (!(totalPhp > 0)) return NOTHING;
    const referenceCode = mintPapicReferenceCode();

    // AUTHORIZED BY: the event-commit path that just created this event and the
    // caller's event_members ownership row. The identity columns go through
    // orderRowFor rather than being written by hand — under service_role nothing
    // downstream checks them, so a hand-stamped user_id is a hole with no second
    // line of defence (SEC-4b).
    //
    // 🪤 THIS COMMENT LIVES ABOVE THE CALL, AND SPELLS NO CODE. Two traps, both
    // hit while writing it:
    //   1. `order-price-authority` finds every order-minting module with a regex
    //      allowing only 80 characters between the table selector and the insert.
    //      Put a paragraph in that gap and this file silently drops out of FOUR
    //      security scans while every one of them still reports green.
    //   2. That regex scans the WHOLE FILE, comments included. Quoting the two
    //      calls verbatim here made the scanner match this very paragraph and
    //      report the client as `<unresolved>` — a comment describing the guard
    //      tripping the guard. Describe those calls; never spell them.
    const { data: order, error: orderErr } = await createMoneyWriterClient()
      .from('orders')
      .insert(
        orderRowFor(
          { userId, eventId, vendorProfileId: null },
          {
            service_key: ONBOARDING_SERVICES_SKU,
            description: parts.map((p) => p.label).join(' · '),
            requested_total_php: totalPhp,
            reference_code: referenceCode,
            status: 'submitted' as const,
            platform: 'web',
          },
        ),
      )
      .select('order_id, public_id')
      .maybeSingle();
    if (orderErr || !order) {
      console.error('[onboarding-services-orders] bill failed:', orderErr?.message);
      return NOTHING;
    }
    const orderId = String(order.order_id);

    /** Nothing may survive as a charge we cannot fulfil. */
    const abandon = async (why: string): Promise<OnboardingOrderResult> => {
      console.error('[onboarding-services-orders] abandoning bill:', { orderId, why });
      // 🔒 THE MONEY WRITER, not the plain admin client. Cancelling an order is
      // a money write, and `order-price-authority` enforces that every write to
      // `orders` goes through createMoneyWriterClient() — the admin client
      // degrades to the session role when the service key is absent, which
      // would turn a refusal into a silent no-op and leave a charge standing.
      await createMoneyWriterClient()
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('order_id', orderId);
      return NOTHING;
    };

    // ── what the bill covers ────────────────────────────────────────────────
    // WITHOUT THESE ROWS THE BILL PROVISIONS NOTHING. Activation fans out over
    // exactly this list, so a failure here is a paid order that grants nothing —
    // strictly worse than no order at all. Fail closed.
    const { error: itemsErr } = await admin.from('onboarding_order_items').insert(
      parts.map((p) => ({
        order_id: orderId,
        service_code: p.serviceCode,
        quantity: p.quantity,
        unit_price_php: p.unitPhp,
      })),
    );
    if (itemsErr) return abandon(`items insert failed: ${itemsErr.message}`);

    // ── NO CAMERAS TO PROVISION ─────────────────────────────────────────────
    //
    // Seat provisioning + the papic_one_orders rows stood here, wrapped in a
    // FAIL-CLOSED unwind: provisioning could partly succeed (fewer seats than
    // were paid for), so the order had to be dropped rather than left as a
    // charge nobody could fulfil.
    //
    // 🔑 THE UNWIND WENT WITH IT, and that is the point worth recording: the
    // complexity was inherent to SELLING a camera, not to Papic. With nothing
    // provisioned at commit there is no partial state to detect or undo.


    // Land them on their own Papic studio with the payment banner the studio's
    // buy paths already render, rather than on a new payment screen: it is the
    // same banner, on the page they will use to add more later.
    const params = new URLSearchParams({
      papic_purchased: String(order.public_id),
      papic_ref: referenceCode,
    });
    return {
      orderPublicIds: [String(order.public_id)],
      paymentPath: `/dashboard/${eventId}/studio/papic?${params.toString()}`,
    };
  } catch (e) {
    // Non-fatal by contract — see the docblock. The event and its free grants
    // are already committed and must survive anything that happens here.
    console.error('[onboarding-services-orders] threw (non-fatal):', e);
    return NOTHING;
  }
}

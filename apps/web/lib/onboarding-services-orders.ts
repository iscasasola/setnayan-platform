import 'server-only';
import { setupPricePhp, readOnboardingDiscountPct } from '@/lib/onboarding-discount';

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

/**
 * Live, active, and priced — or null. The price gate for the two Papic parts.
 *
 * ⚖ THE SIGN-UP PRICE IS THE PRICE HERE. Owner, 2026-08-28: *"we give them a 10%
 * discount if they purchase now. They can order later, but they will lose the
 * 10% discount."* This function IS "now" — it only ever runs while minting the
 * bill for a freshly-committed event.
 *
 * 🔑 THE CARD AND THE CHARGE MUST READ THE SAME COLUMN. A discount shown on the
 * card and not applied here is a bill that disagrees with the screen somebody
 * agreed to, which is worse than never offering it — and this file is where the
 * money is actually decided, so it re-reads the catalog rather than trusting a
 * figure that came through the browser.
 *
 * ⚠ NULL MEANS "NO SIGN-UP DISCOUNT", NEVER ZERO. Reading a NULL discount as 0
 * would pass the `php > 0` gate at exactly the wrong moment and hand the product
 * away free.
 */
async function priceOf(admin: SupabaseClient, serviceCode: string): Promise<number | null> {
  const [{ data }, { data: settings }] = await Promise.all([
    admin
      .from('platform_retail_catalog_v2')
      .select('retail_price_php, onboarding_price_php, is_active')
      .eq('service_code', serviceCode)
      .maybeSingle(),
    admin.from('platform_settings').select('onboarding_discount_pct').eq('id', 1).maybeSingle(),
  ]);
  if (data?.is_active !== true) return null;
  const retail = Number(data?.retail_price_php ?? 0);
  // 🔑 THE SAME FUNCTION THE CARD USED. The screen and the charge cannot quote
  // different figures if they cannot hold different rules.
  const php = setupPricePhp(
    retail,
    data?.onboarding_price_php == null ? null : Number(data.onboarding_price_php),
    readOnboardingDiscountPct(
      (settings as { onboarding_discount_pct?: number | string | null } | null)
        ?.onboarding_discount_pct,
    ),
  );
  if (!Number.isFinite(php) || php <= 0) return null;
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
          label: `Papic — ${tier.points} credits`,
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


    // ── WHERE A BUYER GOES NEXT — the order's OWN page ──────────────────────
    //
    // 🔴 THIS USED TO LAND THEM ON THE PAPIC STUDIO, and that is the defect the
    // owner reported on 2026-08-20: "i had a price to pay. but i there was no
    // payment. it just created." He was right, and the order existed the whole
    // time (public_id S89O-GCR6BDC4Z6 · Setnayan AI · PHP 499 · submitted).
    //
    // The studio's banner is a CONFIRMATION, not a bill. It names no amount —
    // that banner only prints a figure when `papic_amount` is in the URL, and
    // this path never set one — it gives no account to send to, and its copy
    // says "your cameras activate", which is addressed to a Papic buyer. On an
    // AI-only order it was the wrong page saying the wrong thing about a number
    // it did not show.
    //
    // 🔑 RULE 0: THE BILL PAGE ALREADY EXISTS AND IS ALREADY CANONICAL.
    // app/dashboard/[eventId]/orders/[orderId]/page.tsx renders "Total to pay",
    // the reference code with a copy button, the BDO + GCash instructions and
    // the payment-logging form with its screenshot upload. `?created=1` is its
    // own post-creation copy: "Order created. Pay the amount below and log the
    // payment so we can match it." Nothing was designed here; a destination was
    // corrected.
    //
    // 🔒 The buyer can read it: `orders_owner_read` admits `user_id = auth.uid()`
    // and this order is minted with that userId.
    //
    // ⚖ THIS MOVES THE PAPIC BUYER TOO, deliberately. The 2026-08-11 studio
    // landing was an ENGINEERING call, not an owner lock — the owner's own words
    // that day were "so this can be their paywall for the onboarding", and a
    // banner with no amount on a page that sells something else is not a paywall.
    // The studio is one tap away and is where they go once it is paid; arriving
    // there is not load-bearing, because nothing is provisioned until an admin
    // approves the payment.
    // ── AND SETTING UP IS NOT FINISHED UNTIL THE BILL IS ────────────────────
    //
    // ⚖ Owner, 2026-08-28: *"i will go here? it should be settled first. […]
    // Then the onboarding end. No option to pay later. then need to go back to
    // uncheck their papic and setnayan AI purchase."* — softened the same day by
    // the discount ruling: leaving IS allowed now, it just costs 10% more.
    //
    // 🔑 SO THE LAST STEP IS THE PAYMENT PAGE ITSELF, NOT A DASHBOARD BILL. The
    // order page is where a bill LIVES; `/pay/[reference]` is where one is
    // SETTLED — it carries the QR with the amount already in it, the account
    // number, and the proof form. Landing somebody on the ledger entry for a
    // thing they are ready to pay for right now is the same defect as the studio
    // banner this line already replaced once, one step further along.
    //
    // `setup=1` is what tells that page it is the last step of setting up rather
    // than a bill somebody came back to: it removes the way out that reads as
    // "pay later" and offers the two doors the owner named — pay it, or remove
    // the items.
    return {
      orderPublicIds: [String(order.public_id)],
      paymentPath: `/pay/${encodeURIComponent(referenceCode)}?setup=1`,
    };
  } catch (e) {
    // Non-fatal by contract — see the docblock. The event and its free grants
    // are already committed and must survive anything that happens here.
    console.error('[onboarding-services-orders] threw (non-fatal):', e);
    return NOTHING;
  }
}

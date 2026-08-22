import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { purchaseIdFromVendorSubscriptionServiceKey } from './vendor-subscription-service-key';
import { statusOf, type PayableStatus } from './payable-status';
import { readOnboardingOrderItems } from './onboarding-order-items';

export type { PayableStatus };

/**
 * lib/payable-by-reference.ts — resolve ONE reference code into the thing the
 * payer is about to pay for.
 *
 * # Why this exists
 *
 * Owner, 2026-08-21: *"we want a payment page that applies to all, with the
 * custom QR designated to the amount they want to pay."* Every purchase in the
 * product already mints an `orders` row carrying a reference code, an amount
 * and a description — so the shared page needs exactly one lookup, and every
 * buy button becomes a redirect to /pay/<reference>.
 *
 * # The read is SESSION-SCOPED on purpose
 *
 * A reference code is short, it is printed in emails, and it is the only thing
 * standing between a stranger and "who bought what, for how much". This runs on
 * the caller's own client so `orders_owner_read` decides: your own orders, and
 * orders on events you belong to. A reference that is not yours reads as
 * NOT FOUND — the same answer as a reference that does not exist, so the page
 * can never be used to test whether a code is real.
 */

export type Payable = {
  orderId: string;
  reference: string;
  /** What they are buying, in the buyer's own words. */
  title: string;
  /** Who/what it is for — the shop, or the celebration. Null when neither. */
  who: string | null;
  amountPhp: number;
  /** Small facts under the amount. Never money the payer has to add up. */
  rows: ReadonlyArray<{ label: string; value: string }>;
  status: PayableStatus;
  /** True when this order is a shop's plan, which changes the "next" line. */
  isVendorPlan: boolean;
  /**
   * The event this order belongs to, or null for the eventless vendor / per-user
   * purchases. NOT decoration: an event-scoped order must pass the couple's
   * coordinator money-consent gate before anyone logs a payment against it.
   */
  eventId: string | null;
  /**
   * Who minted the order. A person paying their OWN order is not acting on a
   * couple's behalf, so the coordinator money-consent gate must not fire on
   * them — without this, a shop paying Setnayan on a couple-scoped order (a
   * Papic Challenge sponsorship, a booking fee) is refused in the couple's
   * words on a page where no couple is involved.
   */
  ownerUserId: string | null;
  /** Where this buyer came from, so the page is not a dead end. */
  back: { label: string; href: string } | null;
};

type OrderRow = {
  order_id: string;
  user_id: string | null;
  reference_code: string;
  description: string | null;
  service_key: string | null;
  requested_total_php: number | string | null;
  confirmed_total_php: number | string | null;
  status: string;
  event_id: string | null;
  vendor_profile_id: string | null;
};

const SELECT =
  'order_id,user_id,reference_code,description,service_key,requested_total_php,confirmed_total_php,status,event_id,vendor_profile_id';

const peso = (n: number): string =>
  '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2 });


const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export async function fetchPayableByReference(
  supabase: SupabaseClient,
  reference: string,
): Promise<Payable | null> {
  const ref = reference.trim().toUpperCase();
  if (ref.length === 0 || ref.length > 64) return null;

  const { data, error } = await supabase
    .from('orders')
    .select(SELECT)
    .eq('reference_code', ref)
    .maybeSingle();
  // An RLS refusal and a genuine miss are the SAME value here (null), and both
  // must read as "not found" — see the header. An `error` is also not a reason
  // to guess: never invent a payable.
  if (error || !data) return null;

  const order = data as OrderRow;
  const isVendorPlan =
    purchaseIdFromVendorSubscriptionServiceKey(order.service_key) !== null;

  const amount = num(order.confirmed_total_php) || num(order.requested_total_php);

  // ── WHO IT IS FOR, AND WHAT IS IN IT ──────────────────────────────────────
  // Both of these were declared and never filled on the first cut, so the page
  // could itemise nothing and name nobody. That is fine for a single-line
  // purchase and wrong for the two shapes that actually exist: a basket (the
  // onboarding bill is several things at once, and collapsed into one run-on
  // headline) and an event-scoped purchase paid by a supplier, where the payer
  // needs to know WHICH celebration their money is for.
  // Every read here is best-effort: a payment page must still render when the
  // decoration cannot be fetched.
  const [who, rows] = await Promise.all([
    fetchWho(supabase, order),
    fetchRows(supabase, order.order_id),
  ]);

  return {
    orderId: order.order_id,
    reference: order.reference_code,
    title: order.description?.trim() || 'Your Setnayan order',
    who,
    amountPhp: amount,
    rows,
    status: statusOf(order.status),
    isVendorPlan,
    eventId: order.event_id ?? null,
    ownerUserId: order.user_id ?? null,
    back: backFor(order),
  };
}

/** The celebration, or the shop — whichever this order belongs to. */
async function fetchWho(
  supabase: SupabaseClient,
  order: OrderRow,
): Promise<string | null> {
  try {
    if (order.event_id) {
      const { data } = await supabase
        .from('events')
        .select('display_name')
        .eq('event_id', order.event_id)
        .maybeSingle();
      const name = (data as { display_name?: string | null } | null)?.display_name?.trim();
      return name || null;
    }
    if (order.vendor_profile_id) {
      const { data } = await supabase
        .from('vendor_profiles')
        .select('business_name')
        .eq('vendor_profile_id', order.vendor_profile_id)
        .maybeSingle();
      const name = (data as { business_name?: string | null } | null)?.business_name?.trim();
      return name || null;
    }
  } catch {
    /* decoration only — never fail a payment page over a name */
  }
  return null;
}

/**
 * The line items, when this order is a basket.
 *
 * Only the onboarding bill has them (`onboarding_order_items`); everything else
 * is a single purchase whose title already says what it is, and inventing a
 * one-row "table" for it would be noise.
 */
async function fetchRows(
  supabase: SupabaseClient,
  orderId: string,
): Promise<Array<{ label: string; value: string }>> {
  try {
    const items = await readOnboardingOrderItems(supabase, orderId);
    if (items.length === 0) return [];

    const codes = [...new Set(items.map((i) => i.serviceCode))];
    const { data: catalog } = await supabase
      .from('platform_retail_catalog_v2')
      .select('service_code,title')
      .in('service_code', codes);
    const titleFor = new Map(
      ((catalog ?? []) as Array<{ service_code?: string; title?: string }>).map((r) => [
        r.service_code ?? '',
        (r.title ?? '').trim(),
      ]),
    );

    return items.map((i) => ({
      // A raw service_code is our word, not theirs — fall back to it only when
      // the catalog cannot tell us the customer-facing name.
      label:
        (titleFor.get(i.serviceCode) || i.serviceCode) +
        (i.quantity > 1 ? ` × ${i.quantity}` : ''),
      value: peso(i.unitPricePhp * i.quantity),
    }));
  } catch {
    return [];
  }
}

/**
 * The way out. `/pay` renders a bare page with no navigation, so without this
 * every buyer who lands here from a buy button has the browser's back button
 * and nothing else.
 */
function backFor(order: OrderRow): { label: string; href: string } | null {
  if (order.event_id) {
    return { label: 'Back to your celebration', href: `/dashboard/${order.event_id}` };
  }
  if (order.vendor_profile_id) {
    return { label: 'Back to your shop', href: '/vendor-dashboard' };
  }
  return { label: 'Back to Setnayan', href: '/dashboard' };
}

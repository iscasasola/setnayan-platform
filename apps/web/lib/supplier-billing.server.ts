import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readRewardNames } from '@/lib/badge-rewards.server';
import { FALLBACK_REWARD_NAMES, type BadgeRewardKind } from '@/lib/badge-rewards';
import {
  giftStateOf,
  paymentStateOf,
  rewardRowOf,
  type GiftGivenRow,
  type PaymentReceivedRow,
  type SupplierBillingRead,
} from '@/lib/supplier-billing';

/**
 * 🧾 THE SUPPLIER'S BILLING LISTS — the reads (Build 2 #39). Shapes and words: `lib/supplier-billing.ts`.
 *
 * ONE ROUND TRIP, SEVEN REQUESTS, all in one `Promise.all`, for the shop the page already resolved:
 *
 *   SESSION client (RLS is the proof — a row these do not return is not drawn):
 *     1 · `vendor_proposal_shop_gifts` (+ its quote's status and event, embedded — `vendor_proposals_org_read`)
 *     2 · `shop_gift_stock_entries` kind 'given' — which events this shop's stock already reached
 *     3 · `shop_badge_rewards`
 *     4 · `event_vendor_payments` (`event_vendor_payments_vendor_read`: the login's bookings, every shop)
 *   ADMIN client, SCOPED BY THE SHOP THE SESSION RESOLVED (the sanctioned shape — `a-shop-cannot-read-its-own-booking`:
 *   a supplier holds no RLS on `event_vendors` or on `events`). These only NAME and SCOPE rows the session read:
 *     5 · `event_vendors` of this shop + `events(display_name, event_date)` — which payments are THIS shop's, and names
 *     6 · `vendor_proposals` of this shop that carry a gift + `events(display_name, event_date)` — the gift's client
 *     7 · the gift catalogue (`readRewardNames`) — "Papic 150", never a typed pack name
 *
 * 🔒 EVERY SESSION READ IS ALSO FILTERED BY THE SHOP (`vendor_profile_id = shop`, or the shop's booking ids). RLS alone
 * admits more: an admin reads every shop's rows, a helper sees every shop they help in, and a couple who is also a
 * supplier reads gift lines on their OWN quotes from other shops (`vendor_proposal_shop_gifts_read` arm 2). Without
 * the filter those would be listed as this shop's. Held by `tests/db/a-supplier-reads-only-its-own-billing.db.test.ts`.
 *
 * 🔑 HONEST: a refused read sets that list's `measured: false` (and logs); a refused NAME read leaves the rows and
 * names them "A client" — never a wrong name, never an empty list.
 */

/** A shop's whole history is read top-down; the page draws the newest. */
export const SUPPLIER_BILLING_ROW_LIMIT = 300;

type GiftLineRow = {
  gift_line_id: string;
  proposal_id: string;
  title: string;
  gift_kind: string;
  srp_php: number | string;
  from_badge_reward: boolean | null;
  created_at: string;
  vendor_proposals: { status: string | null; event_id: string | null } | Array<{ status: string | null; event_id: string | null }> | null;
};
type GivenRow = { event_id: string | null; proposal_id: string | null; gift_kind: string };
type RewardRow = {
  reward_id: string;
  reward_key: string;
  reward_kind: BadgeRewardKind;
  units: number;
  granted_at: string;
  revoked_at: string | null;
  used_at: string | null;
  returned_at: string | null;
};
type PaymentRow = {
  payment_id: string;
  vendor_id: string;
  event_id: string;
  amount_php: number | string;
  paid_at: string | null;
  method: string | null;
  vendor_confirmed_at: string | null;
  payment_refused_at: string | null;
  is_deposit_record: boolean | null;
};
type NamedEvent = { display_name: string | null; event_date: string | null };
type BookingRow = { vendor_id: string; event_id: string; events: NamedEvent | NamedEvent[] | null };
type QuoteRow = { proposal_id: string; event_id: string; events: NamedEvent | NamedEvent[] | null };

const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

export async function fetchSupplierBillingMeasured(
  supabase: SupabaseClient,
  /** The shop the SESSION resolved (`resolveActiveShop`) — never a value from the URL. */
  vendorProfileId: string,
  /** Injected by the tests; the page leaves it out. */
  admin: SupabaseClient = createAdminClient(),
): Promise<SupplierBillingRead> {
  const [linesRes, givenRes, rewardsRes, paymentsRes, bookingsRes, quotesRes, names] = await Promise.all([
    supabase
      .from('vendor_proposal_shop_gifts')
      .select('gift_line_id, proposal_id, title, gift_kind, srp_php, from_badge_reward, created_at, vendor_proposals(status, event_id)')
      .eq('vendor_profile_id', vendorProfileId)
      .order('created_at', { ascending: false })
      .limit(SUPPLIER_BILLING_ROW_LIMIT),
    supabase
      .from('shop_gift_stock_entries')
      .select('event_id, proposal_id, gift_kind')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('kind', 'given'),
    supabase
      .from('shop_badge_rewards')
      .select('reward_id, reward_key, reward_kind, units, granted_at, revoked_at, used_at, returned_at')
      .eq('vendor_profile_id', vendorProfileId)
      .order('granted_at', { ascending: false })
      .limit(SUPPLIER_BILLING_ROW_LIMIT),
    supabase
      .from('event_vendor_payments')
      .select('payment_id, vendor_id, event_id, amount_php, paid_at, method, vendor_confirmed_at, payment_refused_at, is_deposit_record')
      .order('paid_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(SUPPLIER_BILLING_ROW_LIMIT),
    admin
      .from('event_vendors')
      .select('vendor_id, event_id, events(display_name, event_date)')
      .eq('marketplace_vendor_id', vendorProfileId)
      .eq('voided_by_fraud', false),
    admin
      .from('vendor_proposals')
      .select('proposal_id, event_id, events(display_name, event_date), vendor_proposal_shop_gifts!inner(gift_line_id)')
      .eq('vendor_profile_id', vendorProfileId),
    readRewardNames(admin).catch(() => FALLBACK_REWARD_NAMES),
  ]);

  // ── names (a refusal names nothing; it never empties a list) ──
  const nameOf = new Map<string, NamedEvent>();
  if (quotesRes.error) logQueryError('lib/supplier-billing: quote names', quotesRes.error, {}, 'graceful_degrade');
  for (const q of (quotesRes.data ?? []) as unknown as QuoteRow[]) {
    const e = one(q.events);
    if (e) nameOf.set(q.event_id, e);
  }
  // The booking read SCOPES the payments: refused, no payment can be shown as this shop's — the list is unmeasured.
  const shopBookingIds = new Set<string>();
  if (bookingsRes.error) logQueryError('lib/supplier-billing: shop bookings', bookingsRes.error, {}, 'graceful_degrade');
  for (const b of (bookingsRes.data ?? []) as unknown as BookingRow[]) {
    shopBookingIds.add(b.vendor_id);
    const e = one(b.events);
    if (e && !nameOf.has(b.event_id)) nameOf.set(b.event_id, e);
  }

  // ── gifts given ──
  let gifts: SupplierBillingRead['gifts'] = { measured: false, rows: [] };
  if (linesRes.error || givenRes.error || !Array.isArray(linesRes.data) || !Array.isArray(givenRes.data)) {
    logQueryError('lib/supplier-billing: gifts', linesRes.error ?? givenRes.error, {}, 'graceful_degrade');
  } else {
    const given = givenRes.data as GivenRow[];
    const givenByProposal = new Set(given.map((g) => g.proposal_id).filter(Boolean) as string[]);
    const givenByEventKind = new Set(given.filter((g) => g.event_id).map((g) => `${g.event_id}:${g.gift_kind}`));
    gifts = {
      measured: true,
      rows: (linesRes.data as unknown as GiftLineRow[]).map((l): GiftGivenRow => {
        const q = one(l.vendor_proposals);
        const eventId = q?.event_id ?? null;
        const ev = eventId ? nameOf.get(eventId) : undefined;
        return {
          lineId: l.gift_line_id,
          eventId,
          client: ev?.display_name?.trim() || null,
          eventDate: ev?.event_date ?? null,
          gift: l.title,
          amountPhp: Number(l.srp_php) || 0,
          state: giftStateOf({
            proposalStatus: q?.status ?? null,
            givenToEvent: givenByProposal.has(l.proposal_id) || (!!eventId && givenByEventKind.has(`${eventId}:${l.gift_kind}`)),
          }),
          fromBadgeReward: l.from_badge_reward === true,
          createdAt: l.created_at,
        };
      }),
    };
  }

  // ── payments received ──
  let payments: SupplierBillingRead['payments'] = { measured: false, rows: [] };
  if (paymentsRes.error || !Array.isArray(paymentsRes.data) || bookingsRes.error) {
    logQueryError('lib/supplier-billing: payments', paymentsRes.error ?? bookingsRes.error, {}, 'graceful_degrade');
  } else {
    payments = {
      measured: true,
      rows: (paymentsRes.data as PaymentRow[])
        .filter((p) => shopBookingIds.has(p.vendor_id))
        .map((p): PaymentReceivedRow => {
          const ev = nameOf.get(p.event_id);
          return {
            paymentId: p.payment_id,
            eventId: p.event_id,
            client: ev?.display_name?.trim() || null,
            eventDate: ev?.event_date ?? null,
            amountPhp: Number(p.amount_php) || 0,
            paidOn: p.paid_at,
            method: p.method?.trim() || null,
            isDeposit: p.is_deposit_record === true,
            state: paymentStateOf(p),
          };
        }),
    };
  }

  // ── rewards earned ──
  let rewards: SupplierBillingRead['rewards'] = { measured: false, rows: [] };
  if (rewardsRes.error || !Array.isArray(rewardsRes.data)) {
    logQueryError('lib/supplier-billing: rewards', rewardsRes.error, {}, 'graceful_degrade');
  } else {
    rewards = { measured: true, rows: (rewardsRes.data as RewardRow[]).map((r) => rewardRowOf(r, names)) };
  }

  return { gifts, payments, rewards };
}

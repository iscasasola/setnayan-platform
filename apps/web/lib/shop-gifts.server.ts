import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import { fetchShopPapicPacks } from '@/lib/vendor-papic-grants';
import {
  freeCredits,
  judgeQuoteGifts,
  shopGiftPacksFrom,
  type ShopGiftPack,
  type ShopGiftQuoteBasis,
  type ShopGiftStock,
} from '@/lib/shop-gifts';

export type { ShopGiftQuoteBasis } from '@/lib/shop-gifts';

/**
 * SUPPLIER GIFTS — the I/O half of `lib/shop-gifts.ts`. Every read binds its `error` and answers `null` on a failure
 * ("couldn't read", never 0 — the 20 Aug disease: a failure that renders like emptiness).
 */

/** The giftable packs on the live catalogue, smallest first; null on a read failure. */
export async function fetchShopGiftPacks(client: SupabaseClient): Promise<ShopGiftPack[] | null> {
  const rows = await fetchShopPapicPacks(client);
  return rows ? shopGiftPacksFrom(rows) : null;
}

/**
 * The shop's gift stock (Papic credits): balance and what live quotes hold. `exceptEventId` leaves out one event's
 * quotes — the event a new quote is about to replace. Null on a read failure.
 */
export async function fetchShopGiftStock(
  client: SupabaseClient,
  vendorProfileId: string,
  exceptEventId: string | null = null,
): Promise<ShopGiftStock | null> {
  const { data, error } = await client.rpc('shop_gift_stock_status', {
    p_vendor_profile_id: vendorProfileId,
    p_except_event_id: exceptEventId,
  });
  if (error) {
    console.error('[supabase-error] shop-gifts: shop_gift_stock_status', error);
    return null;
  }
  const row = (Array.isArray(data) ? data : [data]).find(
    (r: { gift_kind?: string } | null) => r?.gift_kind === 'papic',
  ) as { balance?: number | string | null; held?: number | string | null } | undefined;
  const balance = Number(row?.balance ?? 0);
  const held = Number(row?.held ?? 0);
  if (!Number.isFinite(balance) || !Number.isFinite(held)) return null;
  return { balance: Math.trunc(balance), held: Math.trunc(held) };
}

/** One row of the supplier's "Bought" list, newest first. */
export type ShopGiftBoughtRow = {
  orderId: string;
  title: string;
  quantity: number;
  credits: number;
  paidPhp: number;
  createdAt: string;
  /** 'in_stock' once approved; 'checking' while the payment is being checked. */
  state: 'in_stock' | 'checking' | 'refunded';
};

/** The shop's gift purchases with where each stands. Null on a read failure. */
export async function fetchShopGiftBought(
  client: SupabaseClient,
  vendorProfileId: string,
  limit = 20,
): Promise<ShopGiftBoughtRow[] | null> {
  const [purchases, entries] = await Promise.all([
    client
      .from('shop_gift_purchases')
      .select('order_id, service_code, quantity, credits_each, unit_price_php, created_at, orders(status)')
      .eq('vendor_profile_id', vendorProfileId)
      .order('created_at', { ascending: false })
      .limit(limit),
    client
      .from('shop_gift_stock_entries')
      .select('order_id, kind')
      .eq('vendor_profile_id', vendorProfileId)
      .in('kind', ['bought', 'reversal'])
      .not('order_id', 'is', null),
  ]);
  if (purchases.error || entries.error) {
    console.error('[supabase-error] shop-gifts: bought list', purchases.error ?? entries.error);
    return null;
  }
  const kinds = new Map<string, Set<string>>();
  for (const e of (entries.data ?? []) as Array<{ order_id: string; kind: string }>) {
    const s = kinds.get(e.order_id) ?? new Set<string>();
    s.add(e.kind);
    kinds.set(e.order_id, s);
  }
  const packs = await fetchShopGiftPacks(client);
  const titleOf = new Map((packs ?? []).map((p) => [p.code, p.title]));
  return (
    (purchases.data ?? []) as Array<{
      order_id: string;
      service_code: string;
      quantity: number;
      credits_each: number;
      unit_price_php: number | string;
      created_at: string;
      orders: { status?: string | null } | Array<{ status?: string | null }> | null;
    }>
  ).flatMap((p) => {
    const k = kinds.get(p.order_id);
    const o = Array.isArray(p.orders) ? p.orders[0] : p.orders;
    // An order left unpaid (cancelled / lapsed) was never a purchase — it is not listed as "checking" forever.
    if (!k?.has('bought') && (o?.status === 'cancelled' || o?.status === 'lapsed')) return [];
    return [{
      orderId: p.order_id,
      title: titleOf.get(p.service_code) ?? p.service_code,
      quantity: p.quantity,
      credits: p.quantity * p.credits_each,
      paidPhp: Number(p.unit_price_php) * p.quantity,
      createdAt: p.created_at,
      state: (k?.has('reversal') || o?.status === 'refunded' ? 'refunded' : k?.has('bought') ? 'in_stock' : 'checking') as ShopGiftBoughtRow['state'],
    }];
  });
}


/**
 * Resolved once on the server for the thread page. Null only when there is no pack to offer at all (nothing on
 * sale, or the catalogue could not be read) — the block then says nothing rather than offer a picker that cannot
 * work. An unreadable STOCK is kept as `free: null`, so the block can say so.
 */
export async function fetchShopGiftQuoteBasis(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventId: string | null,
): Promise<ShopGiftQuoteBasis | null> {
  const [packs, schedule, stock] = await Promise.all([
    fetchShopGiftPacks(admin),
    getBookingFeeSchedule(admin),
    fetchShopGiftStock(admin, vendorProfileId, eventId),
  ]);
  if (!packs || packs.length === 0) return null;
  return { packs, schedule, free: freeCredits(stock) };
}

/** Why a quote's gifts were refused, as the supplier reads it. */
export type WriteQuoteGiftsResult = { ok: true; credits: number } | { ok: false; message: string };

/**
 * Write the gift lines of a quote being SENT. Runs between the draft insert and the flip to sent, so a refusal
 * deletes the draft like every other send failure. Re-judges with the SAME `judgeQuoteGifts` the composer drew —
 * from a fresh read of the catalogue and the stock — so a crafted payload cannot promise what the shop does not have.
 *
 * MUST be called with the service-role client, AFTER the send gate proved the caller owns this shop and thread.
 */
export async function writeQuoteShopGifts(
  admin: SupabaseClient,
  args: {
    proposalId: string;
    vendorProfileId: string;
    eventId: string | null;
    totalCentavos: number;
    codes: readonly string[];
  },
): Promise<WriteQuoteGiftsResult> {
  const codes = args.codes.filter((c) => typeof c === 'string' && c.length > 0).slice(0, 20);
  if (codes.length === 0) return { ok: true, credits: 0 };
  if (!args.eventId) return { ok: false, message: 'A gift needs the couple’s event.' };

  const basis = await fetchShopGiftQuoteBasis(admin, args.vendorProfileId, args.eventId);
  if (!basis) return { ok: false, message: 'Gifts are not on sale right now — send the quote without them.' };
  if (basis.free === null) return { ok: false, message: 'Couldn’t read your gifts right now. Please try again.' };

  const v = judgeQuoteGifts(codes, basis.packs, args.totalCentavos, basis.schedule, basis.free);
  if (v.state === 'unknown_pack') return { ok: false, message: 'One of those gifts is not on sale any more.' };
  if (v.state === 'over_limit') return { ok: false, message: 'Your gifts are over this booking’s gift limit.' };
  if (v.state === 'short') return { ok: false, message: 'Not enough in your gift stock — buy more first.' };
  if (v.state !== 'ok') return { ok: true, credits: 0 };

  const { error } = await admin.from('vendor_proposal_shop_gifts').insert(
    v.lines.map((p) => ({
      proposal_id: args.proposalId,
      vendor_profile_id: args.vendorProfileId,
      service_code: p.code,
      gift_kind: 'papic',
      credits: p.credits,
      srp_php: p.srpCentavos / 100,
      title: p.title,
    })),
  );
  if (error) {
    console.error('[supabase-error] shop-gifts: write quote gift lines', error);
    return { ok: false, message: 'Couldn’t add your gifts. Please try again.' };
  }
  return { ok: true, credits: v.credits };
}

/** The gifts on one quote, and whether they have reached the event. Null on a read failure. */
export type QuoteShopGifts = {
  lines: Array<{ title: string; credits: number }>;
  credits: number;
  /** Credits this shop has already given this event. */
  given: number;
};

/** MUST be the service-role client, after the page's own RLS read proved the viewer may see the quote. */
export async function fetchQuoteShopGifts(
  admin: SupabaseClient,
  args: { proposalId: string; vendorProfileId: string; eventId: string | null },
): Promise<QuoteShopGifts | null> {
  const [lines, given] = await Promise.all([
    admin
      .from('vendor_proposal_shop_gifts')
      .select('title, credits, created_at')
      .eq('proposal_id', args.proposalId)
      .order('created_at', { ascending: true }),
    args.eventId
      ? admin
          .from('shop_gift_stock_entries')
          .select('delta')
          .eq('vendor_profile_id', args.vendorProfileId)
          .eq('event_id', args.eventId)
          .eq('kind', 'given')
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (lines.error || given.error) {
    console.error('[supabase-error] shop-gifts: quote gifts', lines.error ?? given.error);
    return null;
  }
  const ls = ((lines.data ?? []) as Array<{ title: string; credits: number }>).map((l) => ({
    title: l.title,
    credits: l.credits,
  }));
  return {
    lines: ls,
    credits: ls.reduce((s, l) => s + l.credits, 0),
    given: ((given.data ?? []) as Array<{ delta: number }>).reduce((s, e) => s - e.delta, 0),
  };
}

/** The delivery door's answer, as the deposit-effects log records it. */
export type ShopGiftDelivery = {
  status: 'ok' | 'already' | 'short' | 'no_gift' | 'no_accepted_quote' | 'not_paid' | 'no_booking' | 'error';
  credits?: number;
  detail?: string;
};

/**
 * Give the booking's gifts to the couple's event — called when the couple's FIRST PAYMENT clears
 * (`runDepositAcknowledgedEffects`). Never throws; idempotent (the SQL gives only what the event lacks).
 */
export async function deliverShopGiftsForBooking(
  admin: SupabaseClient,
  eventVendorId: string,
): Promise<ShopGiftDelivery> {
  try {
    const { data, error } = await admin.rpc('shop_gift_deliver_for_booking', {
      p_event_vendor_id: eventVendorId,
    });
    if (error) return { status: 'error', detail: error.message };
    const r = (data ?? {}) as { status?: string; credits?: number; wanted?: number; balance?: number };
    const known = ['ok', 'already', 'short', 'no_gift', 'no_accepted_quote', 'not_paid', 'no_booking'];
    if (!r.status || !known.includes(r.status)) return { status: 'error', detail: `unknown answer ${JSON.stringify(data)}` };
    return {
      status: r.status as ShopGiftDelivery['status'],
      credits: typeof r.credits === 'number' ? r.credits : undefined,
      detail: r.status === 'short' ? `wanted ${r.wanted ?? '?'} · stock ${r.balance ?? '?'}` : undefined,
    };
  } catch (e) {
    return { status: 'error', detail: e instanceof Error ? e.message : String(e) };
  }
}

/** One row of the admin gift ledger. */
export type ShopGiftLedgerRow = {
  entryId: string;
  vendorProfileId: string;
  shopName: string | null;
  kind: 'bought' | 'given' | 'reversal';
  delta: number;
  eventId: string | null;
  eventName: string | null;
  orderReference: string | null;
  landed: boolean;
  createdAt: string;
};

/** Everything that moved, newest first, across every shop (admin). Null on a read failure. */
export async function fetchShopGiftLedger(admin: SupabaseClient, limit = 200): Promise<ShopGiftLedgerRow[] | null> {
  const { data, error } = await admin
    .from('shop_gift_stock_entries')
    .select(
      'entry_id, vendor_profile_id, kind, delta, event_id, order_id, pool_grant_id, created_at, ' +
        'vendor_profiles(business_name), events(display_name), orders(reference_code)',
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[supabase-error] shop-gifts: admin ledger', error);
    return null;
  }
  type Row = {
    entry_id: string;
    vendor_profile_id: string;
    kind: ShopGiftLedgerRow['kind'];
    delta: number;
    event_id: string | null;
    pool_grant_id: string | null;
    created_at: string;
    vendor_profiles: { business_name: string | null } | null;
    events: { display_name: string | null } | null;
    orders: { reference_code: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    entryId: r.entry_id,
    vendorProfileId: r.vendor_profile_id,
    shopName: r.vendor_profiles?.business_name ?? null,
    kind: r.kind,
    delta: r.delta,
    eventId: r.event_id,
    eventName: r.events?.display_name ?? null,
    orderReference: r.orders?.reference_code ?? null,
    landed: !!r.pool_grant_id,
    createdAt: r.created_at,
  }));
}

/** One live quote holding stock, for the admin ledger's "On quotes" list. */
export type ShopGiftHoldRow = {
  proposalId: string;
  shopName: string | null;
  eventName: string | null;
  status: string;
  credits: number;
};

/** Gift lines on quotes still live (sent · viewed · accepted), newest first (admin). Null on a read failure. */
export async function fetchShopGiftHolds(admin: SupabaseClient, limit = 100): Promise<ShopGiftHoldRow[] | null> {
  const { data, error } = await admin
    .from('vendor_proposal_shop_gifts')
    .select(
      'proposal_id, vendor_profile_id, credits, created_at, vendor_profiles(business_name), ' +
        'vendor_proposals!inner(status, event_id, events(display_name))',
    )
    .in('vendor_proposals.status', ['sent', 'viewed', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[supabase-error] shop-gifts: admin holds', error);
    return null;
  }
  type Row = {
    proposal_id: string;
    vendor_profile_id: string;
    credits: number;
    vendor_profiles: { business_name: string | null } | null;
    vendor_proposals: { status: string; event_id: string | null; events: { display_name: string | null } | null } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  // What each shop already GAVE each event — a quote whose gift has landed is no longer "on a quote, not given".
  const eventIds = [...new Set(rows.map((r) => r.vendor_proposals?.event_id).filter((e): e is string => !!e))];
  const givenBy = new Map<string, number>();
  if (eventIds.length > 0) {
    const { data: given, error: givenErr } = await admin
      .from('shop_gift_stock_entries')
      .select('vendor_profile_id, event_id, delta')
      .eq('kind', 'given')
      .in('event_id', eventIds);
    if (givenErr) {
      console.error('[supabase-error] shop-gifts: admin holds · given', givenErr);
      return null;
    }
    for (const g of (given ?? []) as Array<{ vendor_profile_id: string; event_id: string; delta: number }>) {
      const k = `${g.vendor_profile_id}:${g.event_id}`;
      givenBy.set(k, (givenBy.get(k) ?? 0) - g.delta);
    }
  }
  const byQuote = new Map<string, ShopGiftHoldRow & { key: string }>();
  for (const r of rows) {
    const h = byQuote.get(r.proposal_id) ?? {
      proposalId: r.proposal_id,
      shopName: r.vendor_profiles?.business_name ?? null,
      eventName: r.vendor_proposals?.events?.display_name ?? null,
      status: r.vendor_proposals?.status ?? '',
      credits: 0,
      key: `${r.vendor_profile_id}:${r.vendor_proposals?.event_id ?? ''}`,
    };
    h.credits += r.credits;
    byQuote.set(r.proposal_id, h);
  }
  return [...byQuote.values()].flatMap(({ key, ...h }) => {
    const left = h.credits - (givenBy.get(key) ?? 0);
    return left > 0 ? [{ ...h, credits: left }] : [];
  });
}

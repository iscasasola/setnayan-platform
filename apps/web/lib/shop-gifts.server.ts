import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';
import { getBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import { getGiftLimitPct } from '@/lib/gift-limit-settings.server';
import { eventHubOwnership } from '@/lib/couple-website-pro';
import { eventOwnsSku, eventSkuActive } from '@/lib/entitlements';
import { fetchShopPapicPacks } from '@/lib/vendor-papic-grants';
import {
  SHOP_GIFT_KINDS,
  SHOP_GIFT_UNLOCK_CODE,
  freeByKind,
  judgeQuoteGifts,
  rewardFreeByKind,
  shopGiftPacksFrom,
  type EventHolds,
  type ShopGiftKind,
  type ShopGiftPack,
  type ShopGiftQuoteBasis,
  type ShopGiftStocks,
} from '@/lib/shop-gifts';

export type { ShopGiftQuoteBasis } from '@/lib/shop-gifts';

/**
 * SUPPLIER GIFTS — the I/O half of `lib/shop-gifts.ts`. Every read binds its `error` and answers `null` on a failure
 * ("couldn't read", never 0 — the 20 Aug disease: a failure that renders like emptiness).
 */

/**
 * 💎 Event Plus and Event Pro as gift rows (slice 2) — their title, list price and gift price, READ from
 * `platform_retail_catalog_v2` (never typed). One unlock each (`credits: 1`). Only what is on sale. Null on a read
 * failure.
 *
 * 🔒 `admin` MUST be the service-role client (G6, 2026-11-10): `gift_price_php` is withheld from `anon` +
 * `authenticated` (see `fetchShopPapicPacks`), so a session client's read is refused whole (42501) and Event Plus /
 * Pro read as "unavailable". Guard: `lib/catalog-denied-columns-read-by-service-role.test.ts`.
 */
export async function fetchShopGiftUnlockRows(
  admin: SupabaseClient,
): Promise<Array<{ code: string; title: string; credits: number; pricePhp: number; giftPricePhp: number | null }> | null> {
  const codes = Object.values(SHOP_GIFT_UNLOCK_CODE);
  const { data, error } = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code, title, retail_price_php, gift_price_php, is_active, retired_at')
    .in('service_code', codes);
  if (error) {
    console.error('[supabase-error] shop-gifts: Event Plus / Pro catalogue rows', error);
    return null;
  }
  const out: Array<{ code: string; title: string; credits: number; pricePhp: number; giftPricePhp: number | null }> = [];
  for (const c of (data ?? []) as Array<{
    service_code: string;
    title: string | null;
    retail_price_php: number | string | null;
    gift_price_php: number | string | null;
    is_active: boolean | null;
    retired_at: string | null;
  }>) {
    if (c.is_active !== true || c.retired_at) continue;
    const pricePhp = Number(c.retail_price_php);
    if (!Number.isFinite(pricePhp) || pricePhp <= 0) continue;
    const gift = c.gift_price_php == null ? NaN : Number(c.gift_price_php);
    out.push({
      code: c.service_code,
      title: c.title ?? c.service_code,
      credits: 1,
      pricePhp,
      giftPricePhp: Number.isFinite(gift) && gift > 0 ? gift : null,
    });
  }
  return out;
}

/**
 * The giftable packs on the live catalogue — Papic smallest first, then Event Plus, Event Pro; null on a read failure.
 * 🔒 `admin` MUST be the service-role client — the gift price is withheld from a session (G6, see above).
 */
export async function fetchShopGiftPacks(admin: SupabaseClient): Promise<ShopGiftPack[] | null> {
  const [papic, unlocks] = await Promise.all([fetchShopPapicPacks(admin), fetchShopGiftUnlockRows(admin)]);
  return papic && unlocks ? shopGiftPacksFrom([...papic, ...unlocks]) : null;
}

/**
 * The shop's gift stock, every kind: balance and what live quotes hold (Papic in credits, Event Plus / Pro in units).
 * `exceptEventId` leaves out one event's quotes — the event a new quote is about to replace. Null on a read failure.
 */
export async function fetchShopGiftStock(
  client: SupabaseClient,
  vendorProfileId: string,
  exceptEventId: string | null = null,
): Promise<ShopGiftStocks | null> {
  const { data, error } = await client.rpc('shop_gift_stock_status', {
    p_vendor_profile_id: vendorProfileId,
    p_except_event_id: exceptEventId,
  });
  if (error) {
    console.error('[supabase-error] shop-gifts: shop_gift_stock_status', error);
    return null;
  }
  const rows = (Array.isArray(data) ? data : [data]) as Array<
    { gift_kind?: string; balance?: number | string | null; held?: number | string | null } | null
  >;
  const out = {} as Record<ShopGiftKind, { balance: number; held: number }>;
  for (const k of SHOP_GIFT_KINDS) {
    const row = rows.find((r) => r?.gift_kind === k);
    const balance = Number(row?.balance ?? 0);
    const held = Number(row?.held ?? 0);
    if (!Number.isFinite(balance) || !Number.isFinite(held)) return null;
    out[k] = { balance: Math.trunc(balance), held: Math.trunc(held) };
  }
  return out;
}

/**
 * 🏅 How much of each kind of stock is still BADGE REWARD (`shop_gift_reward_stock_status`): earned and used. Same
 * `exceptEventId` as `fetchShopGiftStock`. Null on a read failure — then no line is treated as a reward (the limit
 * applies to everything, which can only refuse, never over-give).
 */
export async function fetchShopGiftRewardStock(
  client: SupabaseClient,
  vendorProfileId: string,
  exceptEventId: string | null = null,
): Promise<Record<ShopGiftKind, { earned: number; used: number }> | null> {
  const { data, error } = await client.rpc('shop_gift_reward_stock_status', {
    p_vendor_profile_id: vendorProfileId,
    p_except_event_id: exceptEventId,
  });
  if (error) {
    console.error('[supabase-error] shop-gifts: shop_gift_reward_stock_status', error);
    return null;
  }
  const rows = (Array.isArray(data) ? data : [data]) as Array<
    { gift_kind?: string; earned?: number | string | null; used?: number | string | null } | null
  >;
  const out = {} as Record<ShopGiftKind, { earned: number; used: number }>;
  for (const k of SHOP_GIFT_KINDS) {
    const row = rows.find((r) => r?.gift_kind === k);
    const earned = Number(row?.earned ?? 0);
    const used = Number(row?.used ?? 0);
    if (!Number.isFinite(earned) || !Number.isFinite(used)) return null;
    out[k] = { earned: Math.trunc(earned), used: Math.trunc(used) };
  }
  return out;
}

/**
 * What the couple's event already holds of Event Plus / Event Pro, through the app's FULL entitlement chain (orders,
 * bundles, the onboarding basket, comps, an internal host, earlier supplier gifts). `'owned'` counts a payment still
 * being checked — the quote builder, so nobody promises Pro to a couple who is paying for it; `'active'` is approved
 * only — the delivery door. A failed read answers 'none' (logged inside the readers).
 */
export async function fetchEventGiftHolds(
  admin: SupabaseClient,
  eventId: string,
  mode: 'owned' | 'active',
): Promise<EventHolds> {
  const [hub, plus] = await Promise.all([
    eventHubOwnership(admin, eventId, mode),
    mode === 'active'
      ? eventSkuActive(admin, eventId, SHOP_GIFT_UNLOCK_CODE.event_plus)
      : eventOwnsSku(admin, eventId, SHOP_GIFT_UNLOCK_CODE.event_plus),
  ]);
  return hub.full ? 'pro' : plus ? 'plus' : 'none';
}

/** One row of the supplier's "Bought" list, newest first. */
export type ShopGiftBoughtRow = {
  orderId: string;
  title: string;
  kind: ShopGiftKind;
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
      .select('order_id, service_code, gift_kind, quantity, credits_each, unit_price_php, created_at, orders(status)')
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
  // 🔒 The titles come from the catalogue, whose gift price a session may not read (G6) — the service role reads it.
  const packs = await fetchShopGiftPacks(createAdminClient());
  const titleOf = new Map((packs ?? []).map((p) => [p.code, p.title]));
  return (
    (purchases.data ?? []) as Array<{
      order_id: string;
      service_code: string;
      gift_kind: ShopGiftKind;
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
      kind: p.gift_kind,
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
  const [packs, schedule, limitPct, stock, eventHas, reward] = await Promise.all([
    fetchShopGiftPacks(admin),
    getBookingFeeSchedule(admin),
    getGiftLimitPct(admin),
    fetchShopGiftStock(admin, vendorProfileId, eventId),
    eventId ? fetchEventGiftHolds(admin, eventId, 'owned') : Promise.resolve<EventHolds>('none'),
    fetchShopGiftRewardStock(admin, vendorProfileId, eventId),
  ]);
  if (!packs || packs.length === 0) return null;
  const free = freeByKind(stock);
  return { packs, schedule, limitPct, free, eventHas, rewardFree: rewardFreeByKind(reward, free) };
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

  const v = judgeQuoteGifts(
    codes,
    basis.packs,
    args.totalCentavos,
    basis.schedule,
    basis.limitPct,
    basis.free,
    basis.eventHas,
    basis.rewardFree ?? null,
  );
  if (v.state === 'unknown_pack') return { ok: false, message: 'One of those gifts is not on sale any more.' };
  if (v.state === 'already_has') return { ok: false, message: 'Their event already has Event Pro — take Event Plus and Event Pro off.' };
  if (v.state === 'over_limit') return { ok: false, message: 'Your gifts are over this booking’s gift limit.' };
  if (v.state === 'short') return { ok: false, message: 'Not enough in your gift stock — buy more first.' };
  if (v.state !== 'ok') return { ok: true, credits: 0 };

  // 🏅 Which lines the badge-reward stock pays — recorded, so the reward stock counts them as used. (State 'ok' means
  // every code is a known pack, so `fromReward`, kept per code, lines up with `lines`.)
  const rewardByLine = v.fromReward;
  const { error } = await admin.from('vendor_proposal_shop_gifts').insert(
    v.lines.map((p, i) => ({
      proposal_id: args.proposalId,
      vendor_profile_id: args.vendorProfileId,
      service_code: p.code,
      gift_kind: p.kind,
      credits: p.credits,
      srp_php: p.srpCentavos / 100,
      title: p.title,
      from_badge_reward: rewardByLine[i] === true,
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
  lines: Array<{ title: string; kind: ShopGiftKind; credits: number }>;
  /** Papic credits on the quote. */
  credits: number;
  /** Papic credits this shop has already given this event. */
  given: number;
  /** Event Plus / Event Pro on the quote, by title, in order. */
  unlocks: string[];
  /** Event Plus / Event Pro this shop has already given this event. */
  unlocksGiven: number;
};

/** MUST be the service-role client, after the page's own RLS read proved the viewer may see the quote. */
export async function fetchQuoteShopGifts(
  admin: SupabaseClient,
  args: { proposalId: string; vendorProfileId: string; eventId: string | null },
): Promise<QuoteShopGifts | null> {
  const [lines, given] = await Promise.all([
    admin
      .from('vendor_proposal_shop_gifts')
      .select('title, gift_kind, credits, created_at')
      .eq('proposal_id', args.proposalId)
      .order('created_at', { ascending: true }),
    args.eventId
      ? admin
          .from('shop_gift_stock_entries')
          .select('gift_kind, delta')
          .eq('vendor_profile_id', args.vendorProfileId)
          .eq('event_id', args.eventId)
          .eq('kind', 'given')
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (lines.error || given.error) {
    console.error('[supabase-error] shop-gifts: quote gifts', lines.error ?? given.error);
    return null;
  }
  const ls = ((lines.data ?? []) as Array<{ title: string; gift_kind: ShopGiftKind; credits: number }>).map((l) => ({
    title: l.title,
    kind: l.gift_kind,
    credits: l.credits,
  }));
  const gv = (given.data ?? []) as Array<{ gift_kind: ShopGiftKind; delta: number }>;
  return {
    lines: ls,
    credits: ls.reduce((s, l) => s + (l.kind === 'papic' ? l.credits : 0), 0),
    given: gv.reduce((s, e) => s - (e.gift_kind === 'papic' ? e.delta : 0), 0),
    unlocks: ls.filter((l) => l.kind !== 'papic').map((l) => l.title),
    unlocksGiven: gv.reduce((s, e) => s - (e.gift_kind !== 'papic' ? e.delta : 0), 0),
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

/**
 * 💎 Give the booking's Event Plus / Event Pro gifts to the couple's event (slice 2), beside the Papic door. What the
 * event already holds is answered here by the full entitlement chain, approved only, and handed to the SQL door —
 * which upgrades a second Event Plus to Event Pro (owner 2026-11-05) and gives nothing to an event that already has
 * Event Pro (the unit stays in the shop's stock). Never throws; idempotent.
 */
export async function deliverShopGiftUnlocksForBooking(
  admin: SupabaseClient,
  eventVendorId: string,
  eventId: string,
): Promise<ShopGiftDelivery> {
  try {
    const eventHas = await fetchEventGiftHolds(admin, eventId, 'active');
    const { data, error } = await admin.rpc('shop_gift_deliver_unlocks_for_booking', {
      p_event_vendor_id: eventVendorId,
      p_event_has: eventHas,
    });
    if (error) return { status: 'error', detail: error.message };
    const r = (data ?? {}) as {
      status?: string;
      given?: Array<{ unlocks_sku?: string }>;
      already_has?: number;
      short?: number;
    };
    const given = (r.given ?? []).map((g) => g.unlocks_sku ?? '?');
    const detail = `holds ${eventHas} · gave ${given.join(', ') || 'nothing'} · already has ${r.already_has ?? 0} · short ${r.short ?? 0}`;
    if (r.status === 'ok' || r.status === 'nothing_to_give') {
      if ((r.short ?? 0) > 0) return { status: 'short', credits: given.length, detail };
      return { status: r.status === 'ok' ? 'ok' : 'already', credits: given.length, detail };
    }
    const known = ['no_gift', 'no_accepted_quote', 'not_paid', 'no_booking'];
    if (r.status && known.includes(r.status)) return { status: r.status as ShopGiftDelivery['status'] };
    return { status: 'error', detail: `unknown answer ${JSON.stringify(data)}` };
  } catch (e) {
    return { status: 'error', detail: e instanceof Error ? e.message : String(e) };
  }
}

/** One row of the admin gift ledger. */
export type ShopGiftLedgerRow = {
  entryId: string;
  vendorProfileId: string;
  shopName: string | null;
  kind: 'bought' | 'given' | 'reversal' | 'badge_reward';
  giftKind: ShopGiftKind;
  delta: number;
  /** On a given Event Plus / Pro: what the event received (a second Plus becomes Event Pro). */
  unlocksSku: string | null;
  eventId: string | null;
  eventName: string | null;
  orderReference: string | null;
  landed: boolean;
  /** On a badge_reward row: the reward's note ("Badge reward · 50 events · Silver"). */
  note?: string | null;
  createdAt: string;
};

/** Everything that moved, newest first, across every shop (admin). Null on a read failure. */
export async function fetchShopGiftLedger(admin: SupabaseClient, limit = 200): Promise<ShopGiftLedgerRow[] | null> {
  const { data, error } = await admin
    .from('shop_gift_stock_entries')
    .select(
      'entry_id, vendor_profile_id, kind, gift_kind, delta, unlocks_sku, event_id, order_id, pool_grant_id, note, created_at, ' +
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
    gift_kind: ShopGiftKind;
    delta: number;
    unlocks_sku: string | null;
    event_id: string | null;
    pool_grant_id: string | null;
    note: string | null;
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
    giftKind: r.gift_kind,
    delta: r.delta,
    unlocksSku: r.unlocks_sku,
    eventId: r.event_id,
    eventName: r.events?.display_name ?? null,
    orderReference: r.orders?.reference_code ?? null,
    // A Papic gift has landed when it became a pool row; an unlock when it names what the event received.
    landed: r.gift_kind === 'papic' ? !!r.pool_grant_id : !!r.unlocks_sku,
    note: r.kind === 'badge_reward' ? r.note : null,
    createdAt: r.created_at,
  }));
}

/** One live quote holding stock, for the admin ledger's "On quotes" list. */
export type ShopGiftHoldRow = {
  proposalId: string;
  shopName: string | null;
  eventName: string | null;
  status: string;
  /** Papic credits still promised. */
  credits: number;
  /** Event Plus / Event Pro still promised. */
  plus: number;
  pro: number;
};

/** Gift lines on quotes still live (sent · viewed · accepted), newest first (admin). Null on a read failure. */
export async function fetchShopGiftHolds(admin: SupabaseClient, limit = 100): Promise<ShopGiftHoldRow[] | null> {
  const { data, error } = await admin
    .from('vendor_proposal_shop_gifts')
    .select(
      'proposal_id, vendor_profile_id, gift_kind, credits, created_at, vendor_profiles(business_name), ' +
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
    gift_kind: ShopGiftKind;
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
      .select('vendor_profile_id, event_id, gift_kind, delta')
      .eq('kind', 'given')
      .in('event_id', eventIds);
    if (givenErr) {
      console.error('[supabase-error] shop-gifts: admin holds · given', givenErr);
      return null;
    }
    for (const g of (given ?? []) as Array<{ vendor_profile_id: string; event_id: string; gift_kind: ShopGiftKind; delta: number }>) {
      const k = `${g.vendor_profile_id}:${g.event_id}:${g.gift_kind}`;
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
      plus: 0,
      pro: 0,
      key: `${r.vendor_profile_id}:${r.vendor_proposals?.event_id ?? ''}`,
    };
    if (r.gift_kind === 'event_plus') h.plus += r.credits;
    else if (r.gift_kind === 'event_pro') h.pro += r.credits;
    else h.credits += r.credits;
    byQuote.set(r.proposal_id, h);
  }
  return [...byQuote.values()].flatMap(({ key, ...h }) => {
    const left = {
      credits: Math.max(0, h.credits - (givenBy.get(`${key}:papic`) ?? 0)),
      plus: Math.max(0, h.plus - (givenBy.get(`${key}:event_plus`) ?? 0)),
      pro: Math.max(0, h.pro - (givenBy.get(`${key}:event_pro`) ?? 0)),
    };
    return left.credits + left.plus + left.pro > 0 ? [{ ...h, ...left }] : [];
  });
}

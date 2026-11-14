import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchShopGiftPacks } from '@/lib/shop-gifts.server';
import type { ShopGiftPack } from '@/lib/shop-gifts';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  SHOP_GIFT_CHOICES,
  SHOP_GIFT_MAX_UNITS,
  SHOP_GIFT_PLAN_TIERS,
  type RunningPlanGift,
  type ShopGiftChoice,
  type ShopGiftPlanTier,
  type ShopGiftStockKind,
  type ShopGiftView,
} from '@/lib/setnayan-shop-gift';

/**
 * 🎁 SETNAYAN GIFTS TO A SHOP — the I/O half of `lib/setnayan-shop-gift.ts` (owner 14 Nov 2026).
 *
 *   sendSetnayanShopGift   the admin's send (Admin › Gifts › the shop's comp panel) — one row, nothing granted yet
 *   readShopGifts          what is waiting to be opened, and the plan gift running now (Today)
 *   claimSetnayanShopGift  the press — `setnayan_shop_gift_claim`, exactly once (the database decides)
 *   goBackFromPlanGift     "Go back to <plan>" — `setnayan_plan_gift_go_back`
 *
 * Every function takes the SERVICE-ROLE client: the doors are granted to service_role only. The caller has already
 * proved the shop is the signed-in supplier's own and that they may run it (or that the caller is an admin).
 */

type GiftRow = {
  gift_id: string;
  gift_type: 'stock' | 'plan';
  stock_kind: ShopGiftStockKind | null;
  stock_units: number | null;
  stock_credits_each: number | null;
  plan_tier: ShopGiftPlanTier | null;
  plan_days: number;
  sent_at: string;
  claimed_at: string | null;
  claim_choice: ShopGiftChoice | null;
  plan_starts_at: string | null;
  plan_ends_at: string | null;
  held_until: string | null;
  return_tier: string | null;
  finished_at: string | null;
  finish_reason: string | null;
};

const COLS =
  'gift_id, gift_type, stock_kind, stock_units, stock_credits_each, plan_tier, plan_days, sent_at, claimed_at, claim_choice, plan_starts_at, plan_ends_at, held_until, return_tier, finished_at, finish_reason';

/** "3 × Papic 1000" — the pack's title READ from the catalogue; a pack no longer on it says its credits instead. */
export function stockLineOf(row: Pick<GiftRow, 'stock_kind' | 'stock_units' | 'stock_credits_each'>, packs: readonly ShopGiftPack[] | null): string {
  const units = row.stock_units ?? 1;
  const pack = (packs ?? []).find(
    (p) => p.kind === row.stock_kind && (row.stock_kind !== 'papic' || p.credits === row.stock_credits_each),
  );
  const title =
    pack?.title ??
    (row.stock_kind === 'papic'
      ? `Papic (${(row.stock_credits_each ?? 0).toLocaleString('en-PH')} credits)`
      : row.stock_kind === 'event_pro'
        ? 'Event Pro'
        : 'Event Plus');
  return `${units} × ${title}`;
}

export type SendShopGiftInput =
  | { vendorProfileId: string; adminUserId: string; type: 'stock'; packCode: string; units: number; note: string | null }
  | { vendorProfileId: string; adminUserId: string; type: 'plan'; tier: string; note: string | null };

export type SendShopGiftResult = { ok: true; giftId: string } | { ok: false; error: string };

/** The admin's send. Stock is named by a LIVE catalogue pack code; its kind and credits are read, never typed. */
export async function sendSetnayanShopGift(admin: SupabaseClient, input: SendShopGiftInput): Promise<SendShopGiftResult> {
  const note = input.note && input.note.trim() ? input.note.trim().slice(0, 500) : null;
  let row: Record<string, unknown>;
  if (input.type === 'stock') {
    if (!Number.isInteger(input.units) || input.units < 1 || input.units > SHOP_GIFT_MAX_UNITS) {
      return { ok: false, error: `Send between 1 and ${SHOP_GIFT_MAX_UNITS}.` };
    }
    const packs = await fetchShopGiftPacks(admin);
    if (!packs) return { ok: false, error: 'The gift catalogue could not be read. Nothing was sent.' };
    const pack = packs.find((p) => p.code === input.packCode);
    if (!pack) return { ok: false, error: 'That gift is not on the catalogue right now.' };
    row = {
      gift_type: 'stock',
      stock_kind: pack.kind,
      stock_units: input.units,
      stock_credits_each: pack.kind === 'papic' ? pack.credits : null,
    };
  } else {
    if (!(SHOP_GIFT_PLAN_TIERS as readonly string[]).includes(input.tier)) return { ok: false, error: 'Pick a plan to send.' };
    row = { gift_type: 'plan', plan_tier: input.tier };
  }
  const { data, error } = await admin
    .from('setnayan_shop_gifts')
    .insert({ ...row, vendor_profile_id: input.vendorProfileId, sent_by: input.adminUserId, note })
    .select('gift_id')
    .single();
  if (error || !data) {
    console.error('[sendSetnayanShopGift] insert refused', error?.message);
    return { ok: false, error: error?.message ?? 'Nothing was sent.' };
  }
  return { ok: true, giftId: (data as { gift_id: string }).gift_id };
}

export type ShopGiftsRead =
  | { ok: false }
  | { ok: true; waiting: ShopGiftView[]; running: RunningPlanGift | null; stayPricePhp: number | null };

/**
 * What Today shows: every gift not yet opened (with what the shop may press now, from the database), and the plan
 * gift running right now — only while the shop's plan is still the gift's write. A refused read is `{ ok: false }`,
 * never "no gifts" (the waiting line would vanish while a gift waits).
 */
export async function readShopGifts(
  admin: SupabaseClient,
  vendorProfileId: string,
  nowMs: number,
  planPrices: Readonly<Partial<Record<ShopGiftPlanTier, number>>> | null = null,
): Promise<ShopGiftsRead> {
  const [gifts, shop] = await Promise.all([
    admin
      .from('setnayan_shop_gifts')
      .select(COLS)
      .eq('vendor_profile_id', vendorProfileId)
      .or('claimed_at.is.null,and(gift_type.eq.plan,finished_at.is.null,plan_starts_at.not.is.null)')
      .order('sent_at', { ascending: true })
      .limit(20),
    admin
      .from('vendor_profiles')
      .select('tier_state, tier_expires_at, tier_source, verification_state')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
  ]);
  if (gifts.error || shop.error || !shop.data) {
    logQueryError('setnayanShopGifts.read', gifts.error ?? shop.error ?? { message: 'no shop' }, { vendorProfileId }, 'graceful_degrade');
    return { ok: false };
  }
  const rows = (gifts.data ?? []) as GiftRow[];
  const s = shop.data as { tier_state: string | null; tier_expires_at: string | null; tier_source: string | null; verification_state: string | null };
  const onPlan =
    !!s.tier_state && ['solo', 'pro', 'enterprise'].includes(s.tier_state) &&
    (!s.tier_expires_at || Date.parse(s.tier_expires_at) > nowMs);

  const waitingRows = rows.filter((r) => !r.claimed_at);
  const needPacks = waitingRows.some((r) => r.gift_type === 'stock');
  const [packs, choiceLists] = await Promise.all([
    needPacks ? fetchShopGiftPacks(admin) : Promise.resolve(null),
    Promise.all(
      waitingRows.map(async (r) => {
        const { data, error } = await admin.rpc('setnayan_shop_gift_choices', { p_gift_id: r.gift_id });
        if (error) {
          logQueryError('setnayanShopGifts.choices', error, { giftId: r.gift_id }, 'graceful_degrade');
          return null;
        }
        return ((Array.isArray(data) ? data : []) as string[]).filter((c): c is ShopGiftChoice =>
          (SHOP_GIFT_CHOICES as readonly string[]).includes(c),
        );
      }),
    ),
  ]);
  if (choiceLists.some((c) => c === null)) return { ok: false };

  const waiting: ShopGiftView[] = waitingRows.map((r, i) => ({
    giftId: r.gift_id,
    type: r.gift_type,
    stockLine: r.gift_type === 'stock' ? stockLineOf(r, packs) : undefined,
    planTier: r.plan_tier ?? undefined,
    planDays: r.plan_days,
    currentTier: onPlan ? s.tier_state : null,
    choices: choiceLists[i] ?? [],
    claimed: false,
  }));

  // The gift running now: a started plan gift whose days are on the clock, while the shop's plan is still its write
  // (a plan bought or set since then is the shop's own, and the gift's words would be wrong).
  const live = rows
    .filter(
      (r) =>
        r.gift_type === 'plan' && r.claimed_at && r.plan_tier && r.plan_starts_at && r.plan_ends_at &&
        Date.parse(r.plan_starts_at) <= nowMs && Date.parse(r.plan_ends_at) > nowMs &&
        s.tier_state === r.plan_tier &&
        (r.claim_choice === 'extend' ||
          (s.tier_source === 'admin_comp' && Date.parse(s.tier_expires_at ?? '') === Date.parse(r.plan_ends_at))),
    )
    .sort((a, b) => Date.parse(b.plan_starts_at!) - Date.parse(a.plan_starts_at!))[0];
  const running: RunningPlanGift | null = live
    ? {
        giftId: live.gift_id,
        tier: live.plan_tier!,
        startsAt: live.plan_starts_at!,
        endsAt: live.plan_ends_at!,
        returnTier: live.return_tier,
        freeTier: s.verification_state === 'verified' ? 'verified' : 'free',
        extend: live.claim_choice === 'extend',
      }
    : null;
  const stayPricePhp = running ? (planPrices?.[running.tier] ?? null) : null;
  return { ok: true, waiting, running, stayPricePhp };
}

export type ClaimShopGiftResult =
  | { status: 'claimed' | 'already'; choice: ShopGiftChoice | null; tier: string | null }
  | { status: 'bad_choice' | 'not_found' | 'failed' };

/** The press. Safe to repeat: the database grants once, and a repeat answers 'already'. */
export async function claimSetnayanShopGift(
  admin: SupabaseClient,
  args: { vendorProfileId: string; giftId: string; choice: ShopGiftChoice; actorUserId: string },
): Promise<ClaimShopGiftResult> {
  const { data, error } = await admin.rpc('setnayan_shop_gift_claim', {
    p_gift_id: args.giftId,
    p_vendor_profile_id: args.vendorProfileId,
    p_choice: args.choice,
    p_actor: args.actorUserId,
  });
  if (error) {
    console.error('[claimSetnayanShopGift] claim refused', error.message);
    return { status: 'failed' };
  }
  const res = (data ?? {}) as { status?: string; choice?: string | null };
  if (res.status === 'claimed' || res.status === 'already') {
    const { data: g } = await admin.from('setnayan_shop_gifts').select('claim_choice, plan_tier').eq('gift_id', args.giftId).maybeSingle();
    const row = (g ?? null) as { claim_choice: ShopGiftChoice | null; plan_tier: string | null } | null;
    return { status: res.status, choice: row?.claim_choice ?? (res.choice as ShopGiftChoice | null) ?? null, tier: row?.plan_tier ?? null };
  }
  if (res.status === 'bad_choice' || res.status === 'not_found') return { status: res.status };
  return { status: 'failed' };
}

/** "Go back to <plan>" — ends the running plan gift now and hands the shop its own plan back. */
export async function goBackFromPlanGift(
  admin: SupabaseClient,
  args: { vendorProfileId: string; giftId: string },
): Promise<'returned' | 'not_running' | 'failed'> {
  const { data, error } = await admin.rpc('setnayan_plan_gift_go_back', {
    p_gift_id: args.giftId,
    p_vendor_profile_id: args.vendorProfileId,
  });
  if (error) {
    console.error('[goBackFromPlanGift] refused', error.message);
    return 'failed';
  }
  const status = (data as { status?: string } | null)?.status;
  if (status === 'returned') return 'returned';
  if (status === 'not_running' || status === 'superseded' || status === 'none') return 'not_running';
  return 'failed';
}

/** The shop's Setnayan gifts for the admin panel, newest first. Null on a read failure. */
export async function readShopGiftsForAdmin(
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<Array<GiftRow & { stockLine: string | null }> | null> {
  const [{ data, error }, packs] = await Promise.all([
    admin.from('setnayan_shop_gifts').select(COLS).eq('vendor_profile_id', vendorProfileId).order('sent_at', { ascending: false }).limit(20),
    fetchShopGiftPacks(admin),
  ]);
  if (error) {
    logQueryError('setnayanShopGifts.admin', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  return ((data ?? []) as GiftRow[]).map((r) => ({ ...r, stockLine: r.gift_type === 'stock' ? stockLineOf(r, packs) : null }));
}

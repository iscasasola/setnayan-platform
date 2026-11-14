import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchShopGiftPacks } from '@/lib/shop-gifts.server';
import type { ShopGiftPack } from '@/lib/shop-gifts';
import { logQueryError } from '@/lib/supabase/error-detect';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { readPersonalInvitePlanPrices } from '@/lib/personal-invite-prices.server';
import {
  SHOP_GIFT_CHOICES,
  SHOP_GIFT_MAX_UNITS,
  SHOP_GIFT_PLAN_TIERS,
  planGiftEndingWords,
  planGiftNoticeStage,
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
 *   maybeSweepPlanGiftEndingNotices  the 7-day and 1-day "ends soon" notice + email, once per stage (fleet-wide)
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

/** How long the end-day line stays on Today after the gift ends. */
const ENDED_LINE_MS = 24 * 60 * 60 * 1000;

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
  | {
      ok: true;
      waiting: ShopGiftView[];
      running: RunningPlanGift | null;
      stayPricePhp: number | null;
      /** A plan gift that ended (its days ran out) within the last day — Today says so once, plainly. */
      endedToday: { giftId: string; tier: string; returnTier: string | null } | null;
    };

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
      .or(
        `claimed_at.is.null,and(gift_type.eq.plan,finished_at.is.null,plan_starts_at.not.is.null),and(gift_type.eq.plan,finish_reason.eq.ended,finished_at.gte.${new Date(nowMs - ENDED_LINE_MS).toISOString()})`,
      )
      .order('sent_at', { ascending: true })
      .limit(20),
    admin
      .from('vendor_profiles')
      .select('tier_state, tier_expires_at, tier_source')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
  ]);
  if (gifts.error || shop.error || !shop.data) {
    logQueryError('setnayanShopGifts.read', gifts.error ?? shop.error ?? { message: 'no shop' }, { vendorProfileId }, 'graceful_degrade');
    return { ok: false };
  }
  const rows = (gifts.data ?? []) as GiftRow[];
  const s = shop.data as { tier_state: string | null; tier_expires_at: string | null; tier_source: string | null };
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
        extend: live.claim_choice === 'extend',
      }
    : null;
  const stayPricePhp = running ? (planPrices?.[running.tier] ?? null) : null;
  const ended = rows
    .filter((r) => r.gift_type === 'plan' && r.finish_reason === 'ended' && r.plan_tier && r.finished_at)
    .sort((a, b) => Date.parse(b.finished_at!) - Date.parse(a.finished_at!))[0];
  const endedToday = ended ? { giftId: ended.gift_id, tier: ended.plan_tier!, returnTier: ended.return_tier } : null;
  return { ok: true, waiting, running, stayPricePhp, endedToday };
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

// ── 🔔 "ENDS SOON", 7 DAYS BEFORE AND AGAIN 1 DAY BEFORE ─────────────────────────────────────────────────────────────

const SWEEP_THROTTLE_MS = 5 * 60 * 1000;
let lastPlanGiftSweepMs = 0;

/**
 * 🔔 THE "ENDS SOON" NOTICE + EMAIL (owner 14 Nov 2026, DECISION_LOG "A GIFTED SUPPLIER PLAN SAYS 'ENDS SOON' 7 DAYS
 * BEFORE AND AGAIN 1 DAY BEFORE"): an in-app notice and an email 7 days before a plan gift ends and again 1 day before,
 * each with one "Stay on <plan>" button and the end date in words.
 *
 * FLEET-WIDE, the `maybeSweepVendorCreditWarnings` shape: any supplier's dashboard load sweeps every shop, because the
 * shop that needs telling is the one NOT opening its dashboard. Cron-free, so with no supplier traffic at all nothing is
 * sent — and the hand-back is login-driven too, so nothing ends unannounced through a window nobody could have warned.
 *
 * 🔒 ONCE PER STAGE: the send is claimed on the gift row (`ends_soon_7_sent_at` / `ends_soon_1_sent_at`, set only while
 * NULL), so two instances, two tabs or a retry never send a second copy. A gift first seen inside its last day gets the
 * 1-day notice only (its 7-day mark is stamped with it, unsent).
 */
export async function maybeSweepPlanGiftEndingNotices(): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - lastPlanGiftSweepMs < SWEEP_THROTTLE_MS) return;
  lastPlanGiftSweepMs = nowMs;
  try {
    const admin = createAdminClient();
    const nowIso = new Date(nowMs).toISOString();
    const horizonIso = new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from('setnayan_shop_gifts')
      .select('gift_id, vendor_profile_id, plan_tier, plan_starts_at, plan_ends_at, return_tier, claim_choice, ends_soon_7_sent_at, ends_soon_1_sent_at')
      .eq('gift_type', 'plan')
      .is('finished_at', null)
      .not('plan_starts_at', 'is', null)
      .lte('plan_starts_at', nowIso)
      .gt('plan_ends_at', nowIso)
      .lte('plan_ends_at', horizonIso)
      .or('ends_soon_7_sent_at.is.null,ends_soon_1_sent_at.is.null')
      .limit(200);
    if (error) {
      console.error('[supabase-error] setnayan-shop-gift: ends-soon sweep read', error);
      return;
    }
    const rows = (data ?? []) as Array<{
      gift_id: string;
      vendor_profile_id: string;
      plan_tier: ShopGiftPlanTier;
      plan_starts_at: string;
      plan_ends_at: string;
      return_tier: string | null;
      claim_choice: ShopGiftChoice | null;
      ends_soon_7_sent_at: string | null;
      ends_soon_1_sent_at: string | null;
    }>;
    if (rows.length === 0) return;
    const prices = await readPersonalInvitePlanPrices().catch(() => null);

    for (const r of rows) {
      const g = { startsAt: r.plan_starts_at, endsAt: r.plan_ends_at };
      const stage = planGiftNoticeStage(g, nowMs);
      if (stage === null) continue;
      const col = stage === 1 ? 'ends_soon_1_sent_at' : 'ends_soon_7_sent_at';
      if (r[col]) continue;
      // Claim this stage (and, at the 1-day stage, the 7-day mark too) — only while still unsent.
      const { data: claimed } = await admin
        .from('setnayan_shop_gifts')
        .update(stage === 1 ? { ends_soon_1_sent_at: nowIso, ends_soon_7_sent_at: r.ends_soon_7_sent_at ?? nowIso } : { ends_soon_7_sent_at: nowIso })
        .eq('gift_id', r.gift_id)
        .is(col, null)
        .select('gift_id');
      if (!claimed || claimed.length === 0) continue;

      // The shop must still be on the gift's plan (a plan bought or set since is the shop's own — nothing to say).
      const { data: shop } = await admin
        .from('vendor_profiles')
        .select('user_id, tier_state, tier_expires_at')
        .eq('vendor_profile_id', r.vendor_profile_id)
        .maybeSingle();
      const sh = (shop ?? null) as { user_id: string | null; tier_state: string | null; tier_expires_at: string | null } | null;
      if (!sh?.user_id || sh.tier_state !== r.plan_tier || Date.parse(sh.tier_expires_at ?? '') !== Date.parse(r.plan_ends_at)) continue;

      const w = planGiftEndingWords(
        { tier: r.plan_tier, returnTier: r.return_tier, extend: r.claim_choice === 'extend', endsAt: r.plan_ends_at },
        prices?.[r.plan_tier] ?? null,
      );
      await emitNotification({
        userId: sh.user_id,
        type: 'vendor_plan_gift_ending',
        title: w.title,
        body: w.body,
        relatedUrl: '/vendor-dashboard/subscription',
        email: { ctaLabel: w.stay },
      });
    }
  } catch (e) {
    // Best-effort: a missed run retries on the next eligible dashboard load. Nothing here moves a plan.
    console.error('[setnayan-shop-gift] ends-soon sweep failed', e);
  }
}

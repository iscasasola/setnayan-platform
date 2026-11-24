import 'server-only';

import { revalidatePath } from 'next/cache';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { getURLFromRedirectError } from 'next/dist/client/components/redirect';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveActiveShopId } from '@/lib/active-shop';
import { resolveVendorStandingForProfile } from '@/lib/vendor-role';
import { dutyMay, whoCanOpen, type VendorCapability, type VendorDuty } from '@/lib/vendor-duties';
import { readOneBookingMoney } from '@/lib/event-vendor-money';
import { fetchShopGiftPacks, fetchShopGiftRewardStock, fetchShopGiftStock } from '@/lib/shop-gifts.server';
import { freeByKind, rewardFreeByKind } from '@/lib/shop-gifts';
import { CLIENT_INVITE_PARAM, boughtFreeByKind, fitsStock, importIsOwnClient, needByKind, ownGiftLinesOf } from '@/lib/own-clients';
import { fetchShopVerified, giveOwnClientGift, markOwnClientRow } from '@/lib/own-clients.server';
import { fetchVendorPoolsOrNull } from '@/lib/vendor-schedule';
import { outsideClientPoolOf } from '@/lib/outside-client-pool';
import { revalidateShopPage } from '@/lib/shop-page-cache';
import { lockAgreeNotice } from '@/lib/lock-answer-notice';
import { COULD_NOT_SAVE, type StayResult } from '@/lib/save-in-place';
import { sendChatMessageCore } from '@/lib/chat-send';
import { SUP_CLIENTS } from '@/app/_actions/stay-registry/supClients';
import { SV_MESSAGES } from '@/app/_actions/stay-registry/svMessages';
import type { Door } from '@/app/_actions/stay-registry/_door';

import {
  OFFLINE_CODE_STOCK,
  SQL_INVALID,
  SUPPLIER_OFFLINE_KINDS,
  clashFromSqlAnswer,
  isUuid,
  moneyMoved,
  outcomeFromSqlAnswer,
  parseQueuedItem,
  type Clash,
  type MoneySeen,
  type SqlAnswer,
  type SupplierQueuedItem,
  type SyncOutcome,
  type SyncReply,
} from './kinds';
import { memberTagOf, newOfflineCodeSecret } from './qr';
import { isSupplierOfflineOp, type StayReply, type SupplierOfflineReply, type TeamCodes, type TeamHold, type TeamPending } from './replies';

/**
 * 📶 THE SUPPLIER OFFLINE DOOR (owner 24 Nov 2026, DECISION_LOG "The supplier dashboard works offline and catches up
 * when back online"). ONE function, reached through the ONE dispatcher every in-place save already uses
 * (`app/_actions/save-in-place.ts`, stay door `supOffline.supplierOffline`) — no new server action
 * (`scripts/lint-server-action-budget.mjs`).
 *
 * `op=sync` sends ONE queued action:
 *   1 · who — signed in, the same account that made it (a shared phone never sends another person's work), a member of
 *       the shop with the role the online screen needs (`dutyMay`). Fail closed.
 *   2 · a purchase is answered "Pay when online" before anything else — nothing is ever charged from the queue.
 *   3 · the rule of its kind (`SUPPLIER_OFFLINE_KINDS`):
 *         schedule → `supplier_offline_schedule_write` / `supplier_offline_code_use` (first save wins, typed clash);
 *         money    → the live amounts re-read (`event_vendor_money_read`, the payment row); moved ⇒ needs_reconfirm;
 *         gift     → the live gift stock (the readers Add a client itself uses); short ⇒ no_gifts_left;
 *         plain    → nothing more.
 *   4 · then the SHIPPED action runs (its stay door, `saveOwnClient`, `confirmVendorPayment`, the yes, the chat core),
 *       with its own gates — and its own answer is read, never assumed.
 *   5 · every final answer is kept (`vendor_offline_writes`): a retry after a lost reply gets the same answer, never a
 *       second write.
 */

type Ctx = {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  userId: string;
  shop: string;
  duty: VendorDuty;
};

const refusal = (op: SupplierOfflineReply['op'], why: string, retry = false) =>
  ({ op, ok: false, why, retry }) as SupplierOfflineReply;

const reply = (r: SupplierOfflineReply): StayReply<SupplierOfflineReply> => ({ stayReply: r });

const str = (fd: FormData, k: string): string => {
  const v = fd.get(k);
  return typeof v === 'string' ? v.trim() : '';
};

/** Who is asking, on which shop, with which role. A string = the refusal (and whether to ask again later). */
async function contextFor(shop: string, capability: VendorCapability): Promise<Ctx | { why: string; retry: boolean }> {
  if (!isUuid(shop)) return { why: 'That shop could not be read.', retry: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { why: 'signed_out', retry: true };
  const standing = await resolveVendorStandingForProfile(supabase, user.id, shop).catch(() => null);
  // A refused read and a missing seat both deny — and are asked again later, so nothing made offline is dropped on a
  // read that failed once.
  if (!standing) return { why: 'unread', retry: true };
  if (!dutyMay(standing.duty, capability)) return { why: `Only ${whoCanOpen(capability)} can do this.`, retry: false };
  return { supabase, admin: createAdminClient(), userId: user.id, shop, duty: standing.duty };
}

/** Display names for the members a clash names (`users.display_name`). A failed read names nobody — never a guess. */
async function memberNames(admin: SupabaseClient, ids: ReadonlyArray<string | null | undefined>): Promise<Map<string, string>> {
  const want = [...new Set(ids.filter((x): x is string => isUuid(x)))];
  const out = new Map<string, string>();
  if (want.length === 0) return out;
  const { data, error } = await admin.from('users').select('user_id, display_name').in('user_id', want);
  if (error) {
    console.error('[supabase-error] supplier-offline: member names', error.message);
    return out;
  }
  for (const u of (data ?? []) as { user_id: string; display_name: string | null }[]) {
    if (u.display_name?.trim()) out.set(u.user_id, u.display_name.trim());
  }
  return out;
}

/** A door's answer, with the member it names read from `users` — then mapped by the pure `outcomeFromSqlAnswer`. */
async function fromSql(admin: SupabaseClient, a: SqlAnswer | null): Promise<SyncOutcome> {
  const names = a?.by ? await memberNames(admin, [a.by]) : new Map<string, string>();
  return outcomeFromSqlAnswer(a, names);
}

async function clashOf(admin: SupabaseClient, a: SqlAnswer): Promise<Clash> {
  const names = a.by ? await memberNames(admin, [a.by]) : new Map<string, string>();
  return clashFromSqlAnswer(a, names);
}

function revalidateSchedule(shop: string): void {
  revalidateShopPage(shop);
  for (const p of ['/vendor-dashboard', '/vendor-dashboard/customers', '/vendor-dashboard/calendar', '/vendor-dashboard/clients']) revalidatePath(p);
}

/* ── the schedule (versioned, first save wins) ─────────────────────────────────────────────────────────────────── */

async function scheduleWrite(ctx: Ctx, item: SupplierQueuedItem): Promise<SyncOutcome> {
  const f = (k: string) => {
    const v = item.fields[k];
    return typeof v === 'string' ? v.trim() : '';
  };
  const base = {
    vendor_profile_id: item.shop,
    member_user_id: item.member,
    item_id: item.itemId,
    kind: item.kind,
    phone_time: item.phoneTime,
    made_offline: true,
  };
  // An outside client with no schedule picked, in a shop with ONE schedule, is on that schedule (the shipped rule).
  // An unread list of schedules is asked again later — never decided as "no schedule".
  let poolsUnread = false;
  const poolFor = async (posted: string): Promise<string | null> => {
    if (posted) return posted;
    const pools = await fetchVendorPoolsOrNull(ctx.admin, item.shop).catch(() => null);
    if (!pools) poolsUnread = true;
    return pools ? outsideClientPoolOf(null, pools) : null;
  };

  let rpc: 'supplier_offline_schedule_write' | 'supplier_offline_code_use' = 'supplier_offline_schedule_write';
  let p: Record<string, unknown>;
  switch (item.kind) {
    case 'schedule.client':
      p = { ...base, op: 'add_client', pool_id: await poolFor(f('pool_id')), start_date: f('start_date'), end_date: f('end_date') || f('start_date'), client_name: f('client_name'), client_contact: f('client_contact'), client_note: f('client_note'), client_time: f('client_time') };
      break;
    case 'schedule.block':
      p = { ...base, op: 'add_block', pool_id: f('scope') && f('scope') !== 'org' ? f('scope') : null, start_date: f('start_date'), end_date: f('end_date') || f('start_date'), label: f('label'), day_part: f('day_part') || 'all_day' };
      break;
    case 'schedule.edit':
      p = { ...base, op: 'edit', block_id: f('block_id'), base_version: item.baseVersion, label: f('label'), client_name: f('client_name'), client_contact: f('client_contact'), client_note: f('client_note') };
      if (f('start_date')) p.start_date = f('start_date');
      if (f('end_date')) p.end_date = f('end_date');
      if (f('client_time')) p.client_time = f('client_time');
      break;
    case 'schedule.remove':
      p = { ...base, op: 'remove', block_id: f('block_id'), base_version: item.baseVersion };
      break;
    case 'schedule.day':
      p = { ...base, op: 'day_state', pool_id: f('pool_id') || null, state_date: f('state_date'), day_state: f('day_state'), note: f('note'), base_version: item.baseVersion ?? 0 };
      break;
    default: {
      // qr.booking — the member's OWN code, of this shop.
      const codeId = f('code_id');
      if (!isUuid(codeId)) return { status: 'refused', why: SQL_INVALID.code! };
      const { data: code, error } = await ctx.admin
        .from('vendor_offline_codes')
        .select('code_id')
        .eq('code_id', codeId)
        .eq('vendor_profile_id', item.shop)
        .eq('member_user_id', item.member)
        .maybeSingle();
      if (error) {
        console.error('[supabase-error] supplier-offline: code read', error.message);
        return { status: 'retry', why: 'unread' };
      }
      if (!code) return { status: 'refused', why: SQL_INVALID.code! };
      rpc = 'supplier_offline_code_use';
      p = { code_id: codeId, via: 'supplier', item_id: item.itemId, phone_time: item.phoneTime, booked_date: f('start_date'), client_time: f('client_time'), pool_id: await poolFor(f('pool_id')), client_name: f('client_name'), client_contact: f('client_contact'), client_note: f('client_note') };
    }
  }
  if (poolsUnread) return { status: 'retry', why: 'unread' };
  const { data, error } = await ctx.admin.rpc(rpc, { p });
  if (error) {
    console.error(`[supabase-error] supplier-offline: ${rpc}`, error.message);
    return { status: 'retry', why: 'unread' };
  }
  const out = await fromSql(ctx.admin, data as SqlAnswer);
  if (out.status === 'applied') revalidateSchedule(item.shop);
  return out;
}

/* ── the ledger (every action that is not the schedule's own door) ─────────────────────────────────────────────── */

const IN_FLIGHT_MS = 2 * 60 * 1000;

async function claimItem(ctx: Ctx, item: SupplierQueuedItem): Promise<'claimed' | SyncOutcome> {
  const { error } = await ctx.admin.from('vendor_offline_writes').insert({
    item_id: item.itemId,
    vendor_profile_id: item.shop,
    member_user_id: item.member,
    kind: item.kind,
    phone_time: item.phoneTime,
  });
  if (!error) return 'claimed';
  if (error.code !== '23505') {
    console.error('[supabase-error] supplier-offline: claim item', error.message);
    return { status: 'retry', why: 'unread' };
  }
  const { data, error: readErr } = await ctx.admin
    .from('vendor_offline_writes')
    .select('outcome, received_at')
    .eq('item_id', item.itemId)
    .maybeSingle();
  if (readErr || !data) {
    if (readErr) console.error('[supabase-error] supplier-offline: read item', readErr.message);
    return { status: 'retry', why: 'unread' };
  }
  const row = data as { outcome: SyncOutcome | null; received_at: string };
  if (row.outcome) return row.outcome;
  // Being applied right now — or a pass that died mid-way. Never run twice: say we cannot tell.
  return Date.now() - Date.parse(row.received_at) < IN_FLIGHT_MS
    ? { status: 'retry', why: 'busy' }
    : { status: 'refused', why: 'We couldn’t tell whether this saved. Check it, then make it again if it is missing.' };
}

async function settleItem(ctx: Ctx, item: SupplierQueuedItem, out: SyncOutcome): Promise<void> {
  // A retry is not an answer: the claim is let go so the next pass runs it.
  const q =
    out.status === 'retry'
      ? ctx.admin.from('vendor_offline_writes').delete().eq('item_id', item.itemId).is('outcome', null)
      : ctx.admin.from('vendor_offline_writes').update({ outcome: out, settled_at: new Date().toISOString() }).eq('item_id', item.itemId);
  const { error } = await q;
  if (error) console.error('[supabase-error] supplier-offline: settle item', error.message);
}

/* ── replaying the shipped action ──────────────────────────────────────────────────────────────────────────────── */

function formOf(item: SupplierQueuedItem): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(item.fields)) {
    if (Array.isArray(v)) for (const x of v) fd.append(k, x);
    else fd.set(k, v);
  }
  return fd;
}

/** A redirect the shipped action ended in, as a URL; null = it returned. Anything else it threw is rethrown. */
async function runFor(run: (fd: FormData) => Promise<unknown>, fd: FormData): Promise<{ url: string | null; value: unknown }> {
  try {
    return { url: null, value: await run(fd) };
  } catch (e) {
    if (isRedirectError(e)) return { url: getURLFromRedirectError(e) ?? '', value: undefined };
    throw e;
  }
}

function fromStay(answer: StayResult | 'navigate'): SyncOutcome {
  if (answer === 'navigate') return { status: 'retry', why: 'signed_out' };
  return answer.ok ? { status: 'applied' } : { status: 'refused', why: answer.error };
}

const DOORS: Readonly<Record<string, Door>> = { ...SUP_CLIENTS, ...SV_MESSAGES };

async function replayDoor(door: string, item: SupplierQueuedItem): Promise<SyncOutcome> {
  const d = DOORS[door];
  if (!d) return { status: 'refused', why: COULD_NOT_SAVE };
  try {
    const { url } = await runFor(d.run, formOf(item));
    return fromStay(url === null ? { ok: true } : d.read(url));
  } catch (e) {
    return { status: 'refused', why: e instanceof Error && e.message && !/[_.]/.test(e.message) ? e.message : COULD_NOT_SAVE };
  }
}

const flagOf = (url: string | null, key: string): string | null => {
  if (!url || !url.includes('?')) return null;
  return new URLSearchParams(url.slice(url.indexOf('?') + 1).split('#')[0] ?? '').get(key);
};

/* ── money: the server decides every amount ────────────────────────────────────────────────────────────────────── */

async function liveMoney(ctx: Ctx, item: SupplierQueuedItem): Promise<MoneySeen | 'unread' | 'gone'> {
  const f = (k: string) => (typeof item.fields[k] === 'string' ? (item.fields[k] as string) : '');
  if (item.kind === 'payment.confirm') {
    const { data, error } = await ctx.admin
      .from('event_vendor_payments')
      .select('amount_php')
      .eq('payment_id', f('payment_id'))
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] supplier-offline: payment read', error.message);
      return 'unread';
    }
    if (!data) return 'gone';
    return { totalPhp: null, depositPhp: null, paymentPhp: Number((data as { amount_php: number | string }).amount_php) };
  }
  try {
    const m = await readOneBookingMoney(ctx.admin, f('event_id'), f('vendor_id'));
    if (!m.money_shown) return 'unread';
    return { totalPhp: m.total_cost_php, depositPhp: m.deposit_paid_php };
  } catch (e) {
    console.error('[supplier-offline] booking money read', e instanceof Error ? e.message : e);
    return 'unread';
  }
}

async function moneyAction(ctx: Ctx, item: SupplierQueuedItem): Promise<SyncOutcome> {
  const live = await liveMoney(ctx, item);
  if (live === 'unread') return { status: 'retry', why: 'unread' };
  if (live === 'gone') return { status: 'refused', why: 'That payment record is no longer there.' };
  // THE GUARD: an amount that moved since the phone showed it is never applied — both numbers go back to the person.
  if (moneyMoved(item.kind, item.seen, live)) return { status: 'needs_reconfirm', offline: item.seen ?? null, live };

  const fd = formOf(item);
  if (item.kind === 'payment.ask') return replayDoor('supClients.vendorAskForPayment', item);
  if (item.kind === 'payment.confirm') {
    const { confirmVendorPayment } = await import('@/app/vendor-dashboard/messages/[threadId]/pay-confirm-actions');
    await runFor(confirmVendorPayment, fd);
    // The action returns nothing on a refusal — so the row itself is read back: confirmed, or not.
    const { data, error } = await ctx.admin
      .from('event_vendor_payments')
      .select('vendor_confirmed_at')
      .eq('payment_id', String(fd.get('payment_id') ?? ''))
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] supplier-offline: payment confirm read-back', error.message);
      return { status: 'retry', why: 'unread' };
    }
    return (data as { vendor_confirmed_at: string | null } | null)?.vendor_confirmed_at
      ? { status: 'applied' }
      : { status: 'refused', why: 'That payment couldn’t be confirmed. Open it and try again.' };
  }
  const actions = await import('@/app/vendor-dashboard/clients/[eventId]/actions');
  if (item.kind === 'deposit.ack') {
    const { url } = await runFor(actions.vendorAcknowledgeDeposit, fd);
    const flag = flagOf(url, 'deposit_ack');
    if (url !== null && !flag) return { status: 'retry', why: 'signed_out' };
    return flag === 'ok' || flag === 'already' ? { status: 'applied' } : { status: 'refused', why: 'That reservation fee couldn’t be confirmed. Open it and try again.' };
  }
  // booking.accept — the yes. Its own answers that ARE the ruling's clashes are said as clashes.
  const { url } = await runFor(actions.vendorAgreeToLock, fd);
  const flag = flagOf(url, 'lock_agree');
  if (!flag) return { status: 'retry', why: 'signed_out' };
  if (flag === 'schedule_full' || flag === 'hall_taken') return { status: 'clash', clash: { why: 'booked', by: null, at: null, dates: null } };
  if (flag === 'day_closed') return { status: 'clash', clash: { why: 'closed', by: null, at: null, dates: null } };
  if (flag === 'gift_needed') return { status: 'no_gifts_left', asOf: new Date().toISOString() };
  const notice = lockAgreeNotice(flag);
  return notice?.tone === 'refused' ? { status: 'refused', why: notice.text } : { status: 'applied' };
}

/* ── gifts: from the live balance, first save wins ─────────────────────────────────────────────────────────────── */

async function clientAdd(ctx: Ctx, item: SupplierQueuedItem): Promise<SyncOutcome> {
  const gifts = item.fields.gift;
  const codes = (Array.isArray(gifts) ? gifts : typeof gifts === 'string' ? [gifts] : []).map((c) => c.trim()).filter(Boolean);
  // The SAME reads Add a client makes (`saveOwnClient`) — the live stock, never the phone's last copy.
  const packs = await fetchShopGiftPacks(ctx.admin);
  const [stock, reward] = await Promise.all([fetchShopGiftStock(ctx.supabase, ctx.shop, null), fetchShopGiftRewardStock(ctx.supabase, ctx.shop, null)]);
  const free = boughtFreeByKind(freeByKind(stock), rewardFreeByKind(reward, freeByKind(stock)));
  if (packs === null || free === null) return { status: 'retry', why: 'unread' };
  const lines = ownGiftLinesOf(codes, packs);
  if (!lines) return { status: 'refused', why: 'Pick at least one gift from your stock.' };
  if (!fitsStock(needByKind(codes, packs), free)) return { status: 'no_gifts_left', asOf: item.giftsAsOf ?? new Date().toISOString() };

  const { saveOwnClient } = await import('@/app/vendor-dashboard/invite/own-client-actions');
  const fd = formOf(item);
  fd.set('mode', 'add');
  fd.delete('buying'); // offline, nothing is bought: "Buy when online"
  const state = await saveOwnClient({ status: 'idle' }, fd);
  if (state.status === 'error') {
    return /not enough in your stock/i.test(state.message) ? { status: 'no_gifts_left', asOf: new Date().toISOString() } : { status: 'refused', why: state.message };
  }
  if (state.status !== 'added') return { status: 'refused', why: COULD_NOT_SAVE };

  // The made-offline mark, the phone's time and (an offline QR) the code — on the invite row the action just wrote.
  const token = new URL(state.url).searchParams.get(CLIENT_INVITE_PARAM);
  const codeId = typeof item.fields.code_id === 'string' && isUuid(item.fields.code_id) ? item.fields.code_id : null;
  const { data: invite, error } = await ctx.admin
    .from('vendor_client_invites')
    .update({ made_offline: true, phone_time: item.phoneTime, offline_code_id: codeId })
    .eq('token', token ?? '')
    .eq('vendor_profile_id', ctx.shop)
    .select('invite_id')
    .maybeSingle();
  if (error || !invite) {
    console.error('[supabase-error] supplier-offline: mark invite', error?.message ?? 'no row');
    return { status: 'applied', ref: null };
  }
  const inviteId = (invite as { invite_id: string }).invite_id;
  if (codeId) await joinTheClientsScan(ctx, codeId, inviteId, lines);
  revalidatePath('/vendor-dashboard/invite');
  return { status: 'applied', ref: inviteId };
}

/**
 * ONE CODE, ONE ENTRY — the client already scanned the QR and added the shop to their event before this phone synced:
 * the invite this sync made is THAT client's (joined, their event), and its gift is given now — through the shipped
 * door (`own_client_gift_give`, from bought stock, exactly once per shop and event) — exactly as the invite link would.
 */
async function joinTheClientsScan(ctx: Ctx, codeId: string, inviteId: string, lines: NonNullable<ReturnType<typeof ownGiftLinesOf>>): Promise<void> {
  const { data: code, error } = await ctx.admin
    .from('vendor_offline_codes')
    .update({ invite_id: inviteId })
    .eq('code_id', codeId)
    .eq('vendor_profile_id', ctx.shop)
    .select('claimed_event_id')
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] supplier-offline: link code to invite', error.message);
    return;
  }
  const eventId = (code as { claimed_event_id: string | null } | null)?.claimed_event_id;
  if (!eventId) return;
  const gave = await giveOwnClientGift(ctx.admin, { vendorProfileId: ctx.shop, eventId, via: 'invite', inviteId, lines, userId: null });
  if (gave.status !== 'given' && gave.status !== 'already') return;
  const { error: joinErr } = await ctx.admin
    .from('vendor_client_invites')
    .update({ status: 'joined', claimed_event_id: eventId, claimed_at: new Date().toISOString() })
    .eq('invite_id', inviteId);
  if (joinErr) console.error('[supabase-error] supplier-offline: join invite', joinErr.message);
  const verified = await fetchShopVerified(ctx.admin, ctx.shop);
  if (!importIsOwnClient(gave.facts, verified === true)) return;
  const { data: row, error: rowErr } = await ctx.admin
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', ctx.shop)
    .maybeSingle();
  if (rowErr) console.error('[supabase-error] supplier-offline: own client row', rowErr.message);
  if (row) await markOwnClientRow(ctx.admin, (row as { vendor_id: string }).vendor_id);
}

/* ── a message written offline ─────────────────────────────────────────────────────────────────────────────────── */

async function messageSend(ctx: Ctx, item: SupplierQueuedItem): Promise<SyncOutcome> {
  const threadId = typeof item.fields.thread_id === 'string' ? item.fields.thread_id : '';
  const body = typeof item.fields.body === 'string' ? item.fields.body : '';
  const res = await sendChatMessageCore(ctx.supabase, { threadId, body });
  if (res.ok) return { status: 'applied' };
  if (res.code === 'unauthenticated') return { status: 'retry', why: 'signed_out' };
  if (res.code === 'insert_failed') return { status: 'retry', why: 'unread' };
  return { status: 'refused', why: res.message };
}

/* ── op=sync ───────────────────────────────────────────────────────────────────────────────────────────────────── */

async function syncOne(raw: string): Promise<SupplierOfflineReply> {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const item = parseQueuedItem(parsed);
  if (!item) return refusal('sync', 'That saved change could not be read.');
  const done = (o: SyncOutcome): SupplierOfflineReply => ({ op: 'sync', ok: true, reply: { ...o, itemId: item.itemId, kind: item.kind } as SyncReply });

  // "Pay when online" — before any check: a purchase is never charged from the queue.
  if (SUPPLIER_OFFLINE_KINDS[item.kind].rule === 'purchase') return done({ status: 'pay_when_online' });

  const ctx = await contextFor(item.shop, SUPPLIER_OFFLINE_KINDS[item.kind].capability);
  if ('why' in ctx) {
    if (ctx.why === 'signed_out') return done({ status: 'retry', why: 'signed_out' });
    if (ctx.why === 'unread') return done({ status: 'retry', why: 'unread' });
    return done({ status: 'refused', why: ctx.why });
  }
  // A shared phone: only the account that made it ever sends it.
  if (ctx.userId !== item.member) return done({ status: 'retry', why: 'other_member' });

  const rule = SUPPLIER_OFFLINE_KINDS[item.kind].rule;
  if (rule === 'schedule') return done(await scheduleWrite(ctx, item));

  // The shipped actions act on the shop the person is standing in — never on another one.
  const active = await resolveActiveShopId(ctx.supabase, ctx.userId).catch(() => null);
  if (active !== item.shop) return done({ status: 'retry', why: active === null ? 'unread' : 'other_shop' });

  const claim = await claimItem(ctx, item);
  if (claim !== 'claimed') return done(claim);
  let out: SyncOutcome;
  try {
    if (rule === 'money') out = await moneyAction(ctx, item);
    else if (rule === 'gift') out = await clientAdd(ctx, item);
    else if (item.kind === 'message.send') out = await messageSend(ctx, item);
    else {
      const door = (SUPPLIER_OFFLINE_KINDS[item.kind] as { door?: string }).door;
      out = door ? await replayDoor(door, item) : { status: 'refused', why: COULD_NOT_SAVE };
    }
  } catch (e) {
    console.error('[supplier-offline] replay threw', e instanceof Error ? e.message : e);
    out = { status: 'retry', why: 'unread' };
  }
  await settleItem(ctx, item, out);
  return done(out);
}

/* ── the one-time codes ────────────────────────────────────────────────────────────────────────────────────────── */

const DEVICE_RE = /^[A-Za-z0-9_-]{8,64}$/;

async function refillCodes(fd: FormData): Promise<SupplierOfflineReply> {
  const device = str(fd, 'device_id');
  if (!DEVICE_RE.test(device)) return refusal('codes.refill', 'This phone could not be named.');
  const ctx = await contextFor(str(fd, 'shop'), 'clients');
  if ('why' in ctx) return refusal('codes.refill', ctx.why, ctx.retry);
  const own = () =>
    ctx.admin
      .from('vendor_offline_codes')
      .select('code_id, secret, issued_at')
      .eq('vendor_profile_id', ctx.shop)
      .eq('member_user_id', ctx.userId)
      .eq('device_id', device)
      .eq('status', 'stocked')
      .order('issued_at', { ascending: true });
  const first = await own();
  if (first.error) {
    console.error('[supabase-error] supplier-offline: code stock', first.error.message);
    return refusal('codes.refill', 'unread', true);
  }
  const short = OFFLINE_CODE_STOCK - (first.data ?? []).length;
  if (short > 0) {
    const rows = Array.from({ length: short }, () => ({
      vendor_profile_id: ctx.shop,
      member_user_id: ctx.userId,
      device_id: device,
      secret: newOfflineCodeSecret(),
    }));
    const { error } = await ctx.admin.from('vendor_offline_codes').insert(rows);
    if (error) {
      console.error('[supabase-error] supplier-offline: code refill', error.message);
      return refusal('codes.refill', 'unread', true);
    }
  }
  const all = short > 0 ? await own() : first;
  if (all.error) {
    console.error('[supabase-error] supplier-offline: code stock re-read', all.error.message);
    return refusal('codes.refill', 'unread', true);
  }
  const codes = ((all.data ?? []) as { code_id: string; secret: string; issued_at: string }[]).map((c) => ({ codeId: c.code_id, secret: c.secret, issuedAt: c.issued_at }));
  return { op: 'codes.refill', ok: true, memberTag: await memberTagOf(ctx.userId), codes, stock: OFFLINE_CODE_STOCK };
}

async function cancelCodes(fd: FormData): Promise<SupplierOfflineReply> {
  // Any teammate may cancel a member's unused codes (a lost phone).
  const ctx = await contextFor(str(fd, 'shop'), 'schedule');
  if ('why' in ctx) return refusal('codes.cancel', ctx.why, ctx.retry);
  const member = str(fd, 'member_user_id');
  if (!isUuid(member)) return refusal('codes.cancel', 'Pick whose codes to cancel.');
  const { data, error } = await ctx.admin
    .from('vendor_offline_codes')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: ctx.userId })
    .eq('vendor_profile_id', ctx.shop)
    .eq('member_user_id', member)
    .eq('status', 'stocked')
    .select('code_id');
  if (error) {
    console.error('[supabase-error] supplier-offline: cancel codes', error.message);
    return refusal('codes.cancel', COULD_NOT_SAVE, true);
  }
  return { op: 'codes.cancel', ok: true, cancelled: (data ?? []).length };
}

/* ── expo mode ─────────────────────────────────────────────────────────────────────────────────────────────────── */

async function holdOp(op: 'holds.claim' | 'holds.release' | 'holds.synced', fd: FormData): Promise<SupplierOfflineReply> {
  const ctx = await contextFor(str(fd, 'shop'), 'schedule');
  if ('why' in ctx) return refusal(op, ctx.why, ctx.retry);
  const p: Record<string, unknown> = { vendor_profile_id: ctx.shop, member_user_id: ctx.userId };
  if (op === 'holds.claim') Object.assign(p, { op: 'claim', pool_id: str(fd, 'pool_id') || null, start_date: str(fd, 'start_date'), end_date: str(fd, 'end_date') || str(fd, 'start_date') });
  else if (op === 'holds.release') Object.assign(p, { op: 'release', hold_id: str(fd, 'hold_id'), may_release_any: dutyMay(ctx.duty, 'team') });
  else p.op = 'synced';
  const { data, error } = await ctx.admin.rpc('supplier_offline_hold', { p });
  if (error) {
    console.error('[supabase-error] supplier-offline: supplier_offline_hold', error.message);
    return refusal(op, COULD_NOT_SAVE, true);
  }
  const a = (data ?? {}) as SqlAnswer;
  revalidatePath('/vendor-dashboard/customers');
  if (op === 'holds.claim') {
    if (a.status === 'applied' && a.hold_id) return { op, ok: true, holdId: a.hold_id };
    if (a.status === 'clash') return { op, ok: false, why: 'held', retry: false, clash: await clashOf(ctx.admin, a) };
    return refusal(op, SQL_INVALID[a.reason ?? 'shape'] ?? COULD_NOT_SAVE);
  }
  if (a.status === 'applied') return { op, ok: true, released: Number(a.released ?? 0) };
  return refusal(op, 'Only the person holding these dates, or someone who manages the team, can let them go.');
}

/* ── who has changes waiting ───────────────────────────────────────────────────────────────────────────────────── */

async function reportPresence(fd: FormData): Promise<SupplierOfflineReply> {
  const device = str(fd, 'device_id');
  const waiting = Math.max(0, Math.min(10000, Math.trunc(Number(str(fd, 'waiting')) || 0)));
  if (!DEVICE_RE.test(device)) return refusal('presence.report', 'This phone could not be named.');
  const ctx = await contextFor(str(fd, 'shop'), 'schedule');
  if ('why' in ctx) return refusal('presence.report', ctx.why, ctx.retry);
  const { error } = await ctx.admin.from('vendor_offline_presence').upsert(
    { vendor_profile_id: ctx.shop, member_user_id: ctx.userId, device_id: device, waiting, last_online_at: new Date().toISOString() },
    { onConflict: 'vendor_profile_id,member_user_id,device_id' },
  );
  if (error) {
    console.error('[supabase-error] supplier-offline: presence', error.message);
    return refusal('presence.report', COULD_NOT_SAVE, true);
  }
  return { op: 'presence.report', ok: true };
}

/** What every online teammate sees: who holds which dates, who has changes waiting, and unused codes per member. */
async function readTeam(fd: FormData): Promise<SupplierOfflineReply> {
  const ctx = await contextFor(str(fd, 'shop'), 'schedule');
  if ('why' in ctx) return refusal('team.read', ctx.why, ctx.retry);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const [holds, presence, codes] = await Promise.all([
    ctx.admin
      .from('vendor_offline_holds')
      .select('hold_id, member_user_id, pool_id, start_date, end_date, created_at')
      .eq('vendor_profile_id', ctx.shop)
      .is('released_at', null)
      .gte('end_date', today)
      .order('start_date'),
    ctx.admin.from('vendor_offline_presence').select('member_user_id, waiting, last_online_at').eq('vendor_profile_id', ctx.shop),
    ctx.admin.from('vendor_offline_codes').select('member_user_id').eq('vendor_profile_id', ctx.shop).eq('status', 'stocked'),
  ]);
  const failed = [holds.error, presence.error, codes.error].find(Boolean);
  if (failed) {
    console.error('[supabase-error] supplier-offline: team read', failed.message);
    return refusal('team.read', 'unread', true);
  }
  const holdRows = (holds.data ?? []) as { hold_id: string; member_user_id: string; pool_id: string | null; start_date: string; end_date: string; created_at: string }[];
  const presenceRows = (presence.data ?? []) as { member_user_id: string; waiting: number; last_online_at: string }[];
  const codeRows = (codes.data ?? []) as { member_user_id: string }[];
  const names = await memberNames(ctx.admin, [...holdRows, ...presenceRows, ...codeRows].map((r) => r.member_user_id));

  const pendingBy = new Map<string, TeamPending>();
  for (const r of presenceRows) {
    const prev = pendingBy.get(r.member_user_id);
    const waiting = (prev?.waiting ?? 0) + Number(r.waiting ?? 0);
    const last = !prev || r.last_online_at > prev.lastOnlineAt ? r.last_online_at : prev.lastOnlineAt;
    pendingBy.set(r.member_user_id, { memberUserId: r.member_user_id, name: names.get(r.member_user_id) ?? null, waiting, lastOnlineAt: last });
  }
  const codesBy = new Map<string, TeamCodes>();
  for (const r of codeRows) {
    const prev = codesBy.get(r.member_user_id);
    codesBy.set(r.member_user_id, { memberUserId: r.member_user_id, name: names.get(r.member_user_id) ?? null, unused: (prev?.unused ?? 0) + 1 });
  }
  const teamHolds: TeamHold[] = holdRows.map((h) => ({
    holdId: h.hold_id,
    memberUserId: h.member_user_id,
    name: names.get(h.member_user_id) ?? null,
    poolId: h.pool_id,
    start: h.start_date,
    end: h.end_date,
    since: h.created_at,
  }));
  return { op: 'team.read', ok: true, holds: teamHolds, pending: [...pendingBy.values()], codes: [...codesBy.values()], readAt: new Date().toISOString() };
}

/* ── the door ──────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The stay door `supOffline.supplierOffline`. Its answer rides back through `saveInPlace` as `{ ok: true, reply }`
 * (`stayReplyOf`); a refused op is in the reply too (`ok: false`, `retry`), so the phone always knows whether to keep it.
 */
export async function supplierOffline(fd: FormData): Promise<StayReply<SupplierOfflineReply>> {
  const op = str(fd, 'op');
  if (!isSupplierOfflineOp(op)) return reply(refusal('sync', COULD_NOT_SAVE));
  switch (op) {
    case 'sync':
      return reply(await syncOne(typeof fd.get('item') === 'string' ? String(fd.get('item')) : ''));
    case 'codes.refill':
      return reply(await refillCodes(fd));
    case 'codes.cancel':
      return reply(await cancelCodes(fd));
    case 'holds.claim':
    case 'holds.release':
    case 'holds.synced':
      return reply(await holdOp(op, fd));
    case 'presence.report':
      return reply(await reportPresence(fd));
    default:
      return reply(await readTeam(fd));
  }
}

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
import { agreedTotalNow, fetchChangeLinesByVendor } from '@/lib/agreed-total-and-its-changes';
import { recordedDepositPhp, type LoggedPayment } from '@/lib/paid-to-vendor';
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
  BOOKING_DUTIES,
  SQL_INVALID,
  VERSIONED_ROWS,
  SUPPLIER_OFFLINE_KINDS,
  clashFromSqlAnswer,
  isUuid,
  moneyMoved,
  outcomeFromSqlAnswer,
  parseQueuedItem,
  adaptQueuedItem,
  writtenOfflineLine,
  rowUnchanged,
  type Clash,
  type MoneySeen,
  type SqlAnswer,
  type SupplierQueuedItem,
  type SyncOutcome,
  type SyncReply,
} from './kinds';
import { DEVICE_ID_RE, isPublicKeyJwk, memberTagOf } from './qr';
import { checkOfflineQr } from './claim.server';
import { isSupplierOfflineOp, type SupplierOfflineReply, type TeamDevice, type TeamHold, type TeamSeen } from './replies';

/**
 * 📶 THE SUPPLIER OFFLINE DOOR (owner 24 Nov 2026, DECISION_LOG "The supplier dashboard works offline and catches up
 * when back online"). ONE function, reached through ONE stable route (`/api/offline/supplier-sync`, a versioned
 * payload, so a deploy never strands a phone's queue) — no new server action (`scripts/lint-server-action-budget.mjs`).
 *
 * `op=sync` sends ONE queued action:
 *   1 · who — signed in, the same account that made it (a shared phone never sends another person's work), a member of
 *       the shop with the role the online screen needs (`dutyMay`). Fail closed.
 *   2 · nothing that buys or pays is a kind at all (R15) — those buttons grey out, "Needs internet".
 *   3 · the rule of its kind (`SUPPLIER_OFFLINE_KINDS`):
 *         schedule → `supplier_offline_schedule_write` / `supplier_offline_code_use` (first save wins, typed clash);
 *         money    → the live amounts re-read (`event_vendor_money_read`, the payment row); moved ⇒ needs_reconfirm;
 *         gift     → the live gift stock (the readers Add a client itself uses); short ⇒ no_gifts_left;
 *         plain    → nothing more.
 *       …and every write that names a row is applied only if that row's `updated_at` is still what the phone saw.
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
  branchId: string | null;
};

const refusal = (op: SupplierOfflineReply['op'], why: string, retry = false) =>
  ({ op, ok: false, why, retry }) as SupplierOfflineReply;

const reply = (r: SupplierOfflineReply): SupplierOfflineReply => r;

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
  const admin = createAdminClient();
  // A paused shop takes nothing new (the shipped rule) — said once, as a final answer (review #2 item 15).
  const { data: shopRow, error: shopErr } = await admin.from('vendor_profiles').select('user_id, paused_at').eq('vendor_profile_id', shop).maybeSingle();
  if (shopErr) {
    console.error('[supabase-error] supplier-offline: shop read', shopErr.message);
    return { why: 'unread', retry: true };
  }
  if (!shopRow) return { why: 'This shop is no longer on Setnayan.', retry: false };
  if ((shopRow as { paused_at: string | null }).paused_at) return { why: 'The shop is paused, so this wasn’t saved.', retry: false };
  const standing = await resolveVendorStandingForProfile(supabase, user.id, shop).catch(() => null);
  if (!standing) {
    // No seat: proven gone (a final answer), or a read that failed (asked again later — nothing is dropped on it).
    const { data: seats, error: seatErr } = await admin.from('vendor_team_members').select('deactivated_at').eq('vendor_profile_id', shop).eq('user_id', user.id);
    if (seatErr) {
      console.error('[supabase-error] supplier-offline: seat read', seatErr.message);
      return { why: 'unread', retry: true };
    }
    const owner = (shopRow as { user_id: string | null }).user_id === user.id;
    const active = ((seats ?? []) as { deactivated_at: string | null }[]).some((r) => !r.deactivated_at);
    return owner || active ? { why: 'unread', retry: true } : { why: 'You’re no longer on this team, so this wasn’t saved.', retry: false };
  }
  if (!dutyMay(standing.duty, capability)) return { why: `Only ${whoCanOpen(capability)} can do this.`, retry: false };
  return { supabase, admin, userId: user.id, shop, duty: standing.duty, branchId: standing.branchId };
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

  // An edit or removal of something THIS phone made offline (review #2 item 10): it waits for that item's answer, takes
  // the id and version it got, and is refused — never applied — when that item was not saved.
  let parentBlock: string | null = null;
  let parentVersion: number | null = null;
  if (item.dependsOn && (item.kind === 'schedule.edit' || item.kind === 'schedule.remove')) {
    const { data: parent, error: pErr } = await ctx.admin
      .from('vendor_offline_writes')
      .select('outcome')
      .eq('vendor_profile_id', item.shop)
      .eq('item_id', item.dependsOn)
      .maybeSingle();
    if (pErr) {
      console.error('[supabase-error] supplier-offline: parent read', pErr.message);
      return { status: 'retry', why: 'unread' };
    }
    const o = (parent as { outcome: SqlAnswer | null } | null)?.outcome ?? null;
    if (!o) return { status: 'retry', why: 'waiting_parent' };
    if (o.status !== 'applied' || !o.block_id) return { status: 'refused', why: 'The change this follows wasn’t saved, so this one wasn’t either.' };
    parentBlock = o.block_id;
    parentVersion = o.version ?? 1;
  }
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
      p = { ...base, op: 'edit', block_id: parentBlock ?? f('block_id'), base_version: parentVersion ?? item.baseVersion, label: f('label'), client_name: f('client_name'), client_contact: f('client_contact'), client_note: f('client_note') };
      if (f('start_date')) p.start_date = f('start_date');
      if (f('end_date')) p.end_date = f('end_date');
      if (f('client_time')) p.client_time = f('client_time');
      break;
    case 'schedule.remove':
      p = { ...base, op: 'remove', block_id: parentBlock ?? f('block_id'), base_version: parentVersion ?? item.baseVersion };
      break;
    case 'schedule.day':
      p = { ...base, op: 'day_state', pool_id: f('pool_id') || null, state_date: f('state_date'), day_state: f('day_state'), note: f('note'), base_version: item.baseVersion ?? 0 };
      break;
    default: {
      // qr.booking — this phone's own signed QR: the SAME check the client's scan gets (an active key of this shop
      // and member, the signature over every field), then one code, one entry.
      const qr = await checkOfflineQr(ctx.admin, f('token'), item.shop);
      if (qr.status !== 'ok') {
        if (qr.status === 'unread') return { status: 'retry', why: 'unread' };
        const why = qr.status === 'stopped' ? 'QR codes from this phone were stopped. Make the client a new one.' : qr.status === 'expired' ? 'This QR code was for a date that has passed.' : SQL_INVALID.code!;
        return { status: 'refused', why };
      }
      if (qr.memberUserId !== item.member) return { status: 'refused', why: SQL_INVALID.code! };
      rpc = 'supplier_offline_code_use';
      const qf = qr.fields;
      p = { code_id: qf.codeId, device_id: qf.deviceId, via: 'supplier', item_id: item.itemId, phone_time: qf.phoneTime, booked_date: qf.date, client_time: qf.time ?? '', pool_id: await poolFor(qf.poolId ?? ''), total_php: qf.totalPhp ?? '', first_php: qf.firstPhp ?? '', service_ids: qf.services, client_name: f('client_name'), client_contact: f('client_contact'), client_note: f('client_note') };
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
    .eq('vendor_profile_id', item.shop)
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
      ? ctx.admin.from('vendor_offline_writes').delete().eq('vendor_profile_id', item.shop).eq('item_id', item.itemId).is('outcome', null)
      : ctx.admin.from('vendor_offline_writes').update({ outcome: out, settled_at: new Date().toISOString() }).eq('vendor_profile_id', item.shop).eq('item_id', item.itemId);
  const { error } = await q;
  if (error) console.error('[supabase-error] supplier-offline: settle item', error.message);
}

/* ── every row is versioned: its own updated_at ────────────────────────────────────────────────────────────────── */

/**
 * A write that names a row (`item.rowVersion`) is applied only if that row is still the one the phone saw — its
 * `updated_at` unchanged (owner, "Everything at once"). Only the tables `VERSIONED_ROWS` lists, by their keys.
 */
async function rowStillAsSeen(ctx: Ctx, item: SupplierQueuedItem): Promise<SyncOutcome | null> {
  const seen = item.rowVersion;
  if (!seen) return null;
  // One literal read per table (never `.from(<a variable>)`, which the column scan cannot check).
  const q =
    seen.table === 'event_vendors'
      ? ctx.admin.from('event_vendors').select('updated_at').eq('vendor_id', seen.id)
      : seen.table === 'vendor_client_notes'
        ? ctx.admin.from('vendor_client_notes').select('updated_at').eq('note_id', seen.id)
        : ctx.admin.from('chat_threads').select('updated_at').eq('thread_id', seen.id);
  if (VERSIONED_ROWS[seen.table] === undefined) return { status: 'refused', why: COULD_NOT_SAVE };
  const { data, error } = await q.maybeSingle();
  if (error) {
    console.error('[supabase-error] supplier-offline: row version read', error.message);
    return { status: 'retry', why: 'unread' };
  }
  if (!data) return { status: 'clash', clash: { why: 'removed', by: null, at: null, dates: null } };
  const live = (data as { updated_at: string | null }).updated_at;
  return rowUnchanged(seen, live) ? null : { status: 'clash', clash: { why: 'changed', by: null, at: live, dates: null } };
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
  // The SAME numbers the screens show: the agreed total NOW (`agreedTotalNow` — the headline plus its change lines) and
  // the reservation fee on file (`recordedDepositPhp` — the ledger's deposit row, else the legacy figure).
  try {
    const eventId = f('event_id');
    const vendorId = f('vendor_id');
    const [m, lines, pays] = await Promise.all([
      readOneBookingMoney(ctx.admin, eventId, vendorId),
      fetchChangeLinesByVendor(ctx.admin, eventId),
      ctx.admin.from('event_vendor_payments').select('amount_php, is_deposit_record').eq('vendor_id', vendorId),
    ]);
    if (!m.money_shown) return 'unread';
    if (lines.error || pays.error) {
      console.error('[supabase-error] supplier-offline: booking money read', lines.error ?? pays.error?.message);
      return 'unread';
    }
    return {
      totalPhp: agreedTotalNow(m.total_cost_php, lines.byVendor.get(vendorId) ?? []),
      depositPhp: recordedDepositPhp((pays.data ?? []) as LoggedPayment[], m.deposit_paid_php),
    };
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
    .update({ made_offline: true, phone_time: item.phoneTime })
    .eq('token', token ?? '')
    .eq('vendor_profile_id', ctx.shop)
    .select('invite_id')
    .maybeSingle();
  if (error || !invite) {
    console.error('[supabase-error] supplier-offline: mark invite', error?.message ?? 'no row');
    return { status: 'applied', ref: null };
  }
  const inviteId = (invite as { invite_id: string }).invite_id;
  const joined = codeId ? await joinTheClientsScan(ctx, codeId, inviteId, lines, typeof item.fields.client_contact === 'string' ? item.fields.client_contact : '') : null;
  revalidatePath('/vendor-dashboard/invite');
  return joined ?? { status: 'applied', ref: inviteId };
}

/**
 * ONE CODE, ONE ENTRY — the client already scanned the QR and added the shop to their event before this phone synced:
 * the invite this sync made is THAT client's (joined, their event), and its gift is given now — through the shipped
 * door (`own_client_gift_give`, from bought stock, exactly once per shop and event) — exactly as the invite link would.
 */
const digits = (v: string) => v.replace(/\D/g, '').slice(-10);
/** Is one of the event's hosts the client the supplier typed (email, or the last 10 digits of a phone)? */
async function eventHostIsTheClient(admin: SupabaseClient, eventId: string, contact: string): Promise<boolean> {
  const c = contact.trim().toLowerCase();
  if (!c) return false;
  const { data: members, error } = await admin.from('event_members').select('user_id').eq('event_id', eventId).eq('member_type', 'couple');
  if (error || !members?.length) {
    if (error) console.error('[supabase-error] supplier-offline: event hosts', error.message);
    return false;
  }
  const ids = (members as { user_id: string | null }[]).map((m) => m.user_id).filter((x): x is string => Boolean(x));
  const { data: users, error: uErr } = await admin.from('users').select('email, phone').in('user_id', ids);
  if (uErr) {
    console.error('[supabase-error] supplier-offline: host contacts', uErr.message);
    return false;
  }
  return ((users ?? []) as { email: string | null; phone?: string | null }[]).some(
    (u) => (u.email ?? '').trim().toLowerCase() === c || (digits(c).length >= 7 && digits(u.phone ?? '') === digits(c)),
  );
}

async function joinTheClientsScan(
  ctx: Ctx,
  codeId: string,
  inviteId: string,
  lines: NonNullable<ReturnType<typeof ownGiftLinesOf>>,
  contact: string,
): Promise<SyncOutcome | null> {
  const { data: code, error } = await ctx.admin
    .from('vendor_offline_code_uses')
    .update({ invite_id: inviteId })
    .eq('code_id', codeId)
    .eq('vendor_profile_id', ctx.shop)
    .select('claimed_event_id')
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] supplier-offline: link code to invite', error.message);
    return null;
  }
  // No row = the QR's date never landed (a clash): the invite stays a plain one, with no code to point at.
  if (!code) return null;
  const { error: markErr } = await ctx.admin.from('vendor_client_invites').update({ offline_code_id: codeId }).eq('invite_id', inviteId);
  if (markErr) console.error('[supabase-error] supplier-offline: invite code mark', markErr.message);
  const eventId = (code as { claimed_event_id: string | null }).claimed_event_id;
  if (!eventId) return null;
  // THE BEARER RACE (review #2 item 17): a QR can be passed on. The gift goes to the claimed event only when one of its
  // hosts is the client the supplier typed (the same email or phone); otherwise the supplier is asked first.
  if (!(await eventHostIsTheClient(ctx.admin, eventId, contact))) {
    const { data: ev } = await ctx.admin.from('events').select('display_name').eq('event_id', eventId).maybeSingle();
    return { status: 'confirm_claim', eventName: (ev as { display_name?: string | null } | null)?.display_name ?? null, inviteId };
  }
  const gave = await giveOwnClientGift(ctx.admin, { vendorProfileId: ctx.shop, eventId, via: 'invite', inviteId, lines, userId: null });
  if (gave.status !== 'given' && gave.status !== 'already') return null;
  const { error: joinErr } = await ctx.admin
    .from('vendor_client_invites')
    .update({ status: 'joined', claimed_event_id: eventId, claimed_at: new Date().toISOString() })
    .eq('invite_id', inviteId);
  if (joinErr) console.error('[supabase-error] supplier-offline: join invite', joinErr.message);
  const verified = await fetchShopVerified(ctx.admin, ctx.shop);
  if (!importIsOwnClient(gave.facts, verified === true)) return null;
  const { data: row, error: rowErr } = await ctx.admin
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', ctx.shop)
    .maybeSingle();
  if (rowErr) console.error('[supabase-error] supplier-offline: own client row', rowErr.message);
  if (row) await markOwnClientRow(ctx.admin, (row as { vendor_id: string }).vendor_id);
  return null;
}

/* ── a message written offline ─────────────────────────────────────────────────────────────────────────────────── */

async function messageSend(ctx: Ctx, item: SupplierQueuedItem): Promise<SyncOutcome> {
  const threadId = typeof item.fields.thread_id === 'string' ? item.fields.thread_id : '';
  const typed = typeof item.fields.body === 'string' ? item.fields.body : '';
  // The other side sees when it was really written (review #2 item 16) — the phone's time, said as phone time.
  const body = typed.trim() ? `${typed}\n\n${writtenOfflineLine(item.phoneTime)}` : typed;
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
  const parsedItem = parseQueuedItem(parsed);
  const item = parsedItem ? adaptQueuedItem(parsedItem) : null;
  if (!item) return refusal('sync', 'That saved change could not be read.');
  const done = (o: SyncOutcome): SupplierOfflineReply => ({ op: 'sync', ok: true, reply: { ...o, itemId: item.itemId, kind: item.kind } as SyncReply });

  const ctx = await contextFor(item.shop, SUPPLIER_OFFLINE_KINDS[item.kind].capability);
  if ('why' in ctx) {
    if (ctx.why === 'signed_out') return done({ status: 'retry', why: 'signed_out' });
    if (ctx.why === 'unread') return done({ status: 'retry', why: 'unread' });
    return done({ status: 'refused', why: ctx.why });
  }
  // A shared phone: only the account that made it ever sends it.
  if (ctx.userId !== item.member) return done({ status: 'retry', why: 'other_member' });

  const rule = SUPPLIER_OFFLINE_KINDS[item.kind].rule;
  // The SAME permission the online calendar gives (review #2 item 1): only the roles that book may book or block dates.
  if (rule === 'schedule' && !HOLD_DUTIES.includes(ctx.duty)) {
    return done({ status: 'refused', why: 'Only a Shop Manager, Branch Manager or Account Manager can book or block dates.' });
  }
  if (rule === 'schedule') return done(await scheduleWrite(ctx, item));

  // The shipped actions act on the shop the person is standing in — never on another one.
  const active = await resolveActiveShopId(ctx.supabase, ctx.userId).catch(() => null);
  if (active !== item.shop) return done({ status: 'retry', why: active === null ? 'unread' : 'other_shop' });

  const claim = await claimItem(ctx, item);
  if (claim !== 'claimed') return done(claim);
  let out: SyncOutcome;
  try {
    const stale = await rowStillAsSeen(ctx, item);
    if (stale) out = stale;
    else if (rule === 'money') out = await moneyAction(ctx, item);
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

/* ── the phone's QR key ────────────────────────────────────────────────────────────────────────────────────────── */

async function registerDevice(fd: FormData): Promise<SupplierOfflineReply> {
  const device = str(fd, 'device_id');
  let jwk: unknown = null;
  try {
    jwk = JSON.parse(str(fd, 'public_key'));
  } catch {
    jwk = null;
  }
  if (!DEVICE_ID_RE.test(device) || !isPublicKeyJwk(jwk)) return refusal('device.register', 'This phone’s key could not be read.');
  const ctx = await contextFor(str(fd, 'shop'), 'clients');
  if ('why' in ctx) return refusal('device.register', ctx.why, ctx.retry);
  const { data: held, error } = await ctx.admin
    .from('vendor_offline_devices')
    .select('vendor_profile_id, member_user_id, public_key, status')
    .eq('device_id', device)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] supplier-offline: device read', error.message);
    return refusal('device.register', 'unread', true);
  }
  const row = held as { vendor_profile_id: string; member_user_id: string; public_key: { x?: string; y?: string }; status: string } | null;
  if (row) {
    // A device id is made with its key: the same id with another key, shop or member is refused, never re-pointed.
    const same = row.vendor_profile_id === ctx.shop && row.member_user_id === ctx.userId && row.public_key?.x === jwk.x && row.public_key?.y === jwk.y;
    if (!same || row.status !== 'active') return refusal('device.register', 'This phone’s QR key was stopped. Sign in again to make a new one.');
  } else {
    // At most 5 phones per member per shop (review #2): an old one is stopped first, in Settings › Offline.
    const { count, error: cErr } = await ctx.admin
      .from('vendor_offline_devices')
      .select('device_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', ctx.shop)
      .eq('member_user_id', ctx.userId)
      .eq('status', 'active');
    if (cErr) {
      console.error('[supabase-error] supplier-offline: device count', cErr.message);
      return refusal('device.register', 'unread', true);
    }
    if ((count ?? 0) >= 5) return refusal('device.register', 'You have 5 phones set up for offline already — stop an old one first.');
    const { error: insErr } = await ctx.admin.from('vendor_offline_devices').insert({
      device_id: device,
      vendor_profile_id: ctx.shop,
      member_user_id: ctx.userId,
      public_key: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y },
    });
    if (insErr) {
      console.error('[supabase-error] supplier-offline: device register', insErr.message);
      return refusal('device.register', COULD_NOT_SAVE, true);
    }
  }
  return { op: 'device.register', ok: true, deviceId: device, memberTag: await memberTagOf(ctx.userId) };
}

/** May this person stop that member's phone? A Shop Manager — or the Branch Manager for that member's branch. */
async function mayStopFor(ctx: Ctx, member: string): Promise<boolean | null> {
  if (member === ctx.userId || ctx.duty === 'shop_manager') return true;
  if (ctx.duty !== 'branch_manager' || !ctx.branchId) return false;
  const { data, error } = await ctx.admin
    .from('vendor_team_members')
    .select('branch_id')
    .eq('vendor_profile_id', ctx.shop)
    .eq('user_id', member);
  if (error) {
    console.error('[supabase-error] supplier-offline: member branch', error.message);
    return null;
  }
  return ((data ?? []) as { branch_id: string | null }[]).some((r) => r.branch_id === ctx.branchId);
}

/** "Stop QR codes from this phone": every code from it nobody has scanned is refused from now on. */
async function stopDevice(fd: FormData): Promise<SupplierOfflineReply> {
  const device = str(fd, 'device_id');
  if (!DEVICE_ID_RE.test(device)) return refusal('device.stop', 'Pick which phone to stop.');
  const ctx = await contextFor(str(fd, 'shop'), 'schedule');
  if ('why' in ctx) return refusal('device.stop', ctx.why, ctx.retry);
  const { data: held, error } = await ctx.admin
    .from('vendor_offline_devices')
    .select('member_user_id, status')
    .eq('device_id', device)
    .eq('vendor_profile_id', ctx.shop)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] supplier-offline: device read', error.message);
    return refusal('device.stop', 'unread', true);
  }
  const row = held as { member_user_id: string; status: string } | null;
  if (!row) return refusal('device.stop', 'That phone isn’t one of this shop’s.');
  const may = await mayStopFor(ctx, row.member_user_id);
  if (may === null) return refusal('device.stop', 'unread', true);
  if (!may) return refusal('device.stop', 'Only a Shop Manager, or the Branch Manager for that branch, can stop another person’s phone.');
  if (row.status === 'stopped') return { op: 'device.stop', ok: true, stopped: false };
  const { error: upErr } = await ctx.admin
    .from('vendor_offline_devices')
    .update({ status: 'stopped', stopped_at: new Date().toISOString(), stopped_by: ctx.userId, stop_reason: row.member_user_id === ctx.userId && str(fd, 'reason') === 'signed_out' ? 'signed_out' : 'lost' })
    .eq('device_id', device)
    .eq('status', 'active');
  if (upErr) {
    console.error('[supabase-error] supplier-offline: device stop', upErr.message);
    return refusal('device.stop', COULD_NOT_SAVE, true);
  }
  revalidatePath('/vendor-dashboard/customers');
  return { op: 'device.stop', ok: true, stopped: true };
}

/* ── expo mode ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/** Who may hold dates (controller under the 20 Nov delegation, DECISION_LOG 24 Nov): any role that can book. */
export const HOLD_DUTIES: ReadonlyArray<VendorDuty> = BOOKING_DUTIES;

async function holdOp(op: 'holds.claim' | 'holds.release' | 'holds.synced', fd: FormData): Promise<SupplierOfflineReply> {
  const ctx = await contextFor(str(fd, 'shop'), 'schedule');
  if ('why' in ctx) return refusal(op, ctx.why, ctx.retry);
  const p: Record<string, unknown> = { vendor_profile_id: ctx.shop, member_user_id: ctx.userId };
  if (op === 'holds.claim') {
    if (!HOLD_DUTIES.includes(ctx.duty)) return refusal(op, 'Only a Shop Manager, Branch Manager or Account Manager can hold dates.');
    Object.assign(p, { op: 'claim', pool_id: str(fd, 'pool_id') || null, start_date: str(fd, 'start_date'), end_date: str(fd, 'end_date') || str(fd, 'start_date') });
  } else if (op === 'holds.release') {
    // A Shop Manager, or the Branch Manager for the holder's branch, can let anyone's hold go; everyone else, their own.
    const holdId = str(fd, 'hold_id');
    const { data: h, error: hErr } = await ctx.admin
      .from('vendor_offline_holds')
      .select('member_user_id')
      .eq('hold_id', isUuid(holdId) ? holdId : '00000000-0000-0000-0000-000000000000')
      .eq('vendor_profile_id', ctx.shop)
      .maybeSingle();
    if (hErr) {
      console.error('[supabase-error] supplier-offline: hold read', hErr.message);
      return refusal(op, 'unread', true);
    }
    const holder = (h as { member_user_id: string } | null)?.member_user_id ?? null;
    const anyone = holder !== null && holder !== ctx.userId && (await mayStopFor(ctx, holder)) === true;
    Object.assign(p, { op: 'release', hold_id: holdId, may_release_any: anyone });
  } else p.op = 'synced';
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

/* ── last seen (R5, corrected) ─────────────────────────────────────────────────────────────────────────────────── */

async function seenDevice(fd: FormData): Promise<SupplierOfflineReply> {
  const device = str(fd, 'device_id');
  if (!DEVICE_ID_RE.test(device)) return refusal('device.seen', 'This phone could not be named.');
  const ctx = await contextFor(str(fd, 'shop'), 'schedule');
  if ('why' in ctx) return refusal('device.seen', ctx.why, ctx.retry);
  const queued = Math.max(0, Math.min(10000, Math.trunc(Number(str(fd, 'queued')) || 0)));
  // The count this phone reported last time — handed back to THIS phone only (never a teammate, R5).
  const { data: before, error: bErr } = await ctx.admin
    .from('vendor_offline_devices')
    .select('last_queue_count')
    .eq('device_id', device)
    .eq('vendor_profile_id', ctx.shop)
    .eq('member_user_id', ctx.userId)
    .maybeSingle();
  if (bErr) console.error('[supabase-error] supplier-offline: last queue count', bErr.message);
  const { data, error } = await ctx.admin
    .from('vendor_offline_devices')
    .update({ last_seen_at: new Date().toISOString(), last_queue_count: queued })
    .eq('device_id', device)
    .eq('vendor_profile_id', ctx.shop)
    .eq('member_user_id', ctx.userId)
    .select('status')
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] supplier-offline: last seen', error.message);
    return refusal('device.seen', COULD_NOT_SAVE, true);
  }
  // A stopped phone (lost, or its member left) is told so: the screens sign it out (review #2 item 8).
  if ((data as { status?: string } | null)?.status === 'stopped') return refusal('device.seen', 'stopped');
  return { op: 'device.seen', ok: true, lastQueued: Number((before as { last_queue_count?: number } | null)?.last_queue_count ?? 0) };
}

/**
 * What every online teammate sees (Settings › Offline): who holds which dates, when each member was last seen online
 * (R5, corrected — never a count of what is on their phone), and the team's phones that can sign QR codes.
 */
async function readTeam(fd: FormData): Promise<SupplierOfflineReply> {
  const ctx = await contextFor(str(fd, 'shop'), 'schedule');
  if ('why' in ctx) return refusal('team.read', ctx.why, ctx.retry);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const [holds, devices] = await Promise.all([
    ctx.admin
      .from('vendor_offline_holds')
      .select('hold_id, member_user_id, pool_id, start_date, end_date, created_at')
      .eq('vendor_profile_id', ctx.shop)
      .is('released_at', null)
      .gte('end_date', today)
      .order('start_date'),
    ctx.admin
      .from('vendor_offline_devices')
      .select('device_id, member_user_id, status, created_at, last_seen_at')
      .eq('vendor_profile_id', ctx.shop)
      .order('created_at'),
  ]);
  const failed = [holds.error, devices.error].find(Boolean);
  if (failed) {
    console.error('[supabase-error] supplier-offline: team read', failed.message);
    return refusal('team.read', 'unread', true);
  }
  const holdRows = (holds.data ?? []) as { hold_id: string; member_user_id: string; pool_id: string | null; start_date: string; end_date: string; created_at: string }[];
  const deviceRows = (devices.data ?? []) as { device_id: string; member_user_id: string; status: 'active' | 'stopped'; created_at: string; last_seen_at: string }[];
  const names = await memberNames(ctx.admin, [...holdRows, ...deviceRows].map((r) => r.member_user_id));

  const seenBy = new Map<string, TeamSeen>();
  for (const d of deviceRows) {
    const prev = seenBy.get(d.member_user_id);
    if (!prev || d.last_seen_at > prev.lastSeenAt) seenBy.set(d.member_user_id, { memberUserId: d.member_user_id, name: names.get(d.member_user_id) ?? null, lastSeenAt: d.last_seen_at });
  }
  const mayStop = new Map<string, boolean>();
  for (const m of new Set(deviceRows.map((d) => d.member_user_id))) mayStop.set(m, (await mayStopFor(ctx, m)) === true);
  const teamDevices: TeamDevice[] = deviceRows.map((d) => ({
    deviceId: d.device_id,
    memberUserId: d.member_user_id,
    name: names.get(d.member_user_id) ?? null,
    status: d.status,
    createdAt: d.created_at,
    lastSeenAt: d.last_seen_at,
    mayStop: d.status === 'active' && mayStop.get(d.member_user_id) === true,
  }));
  const teamHolds: TeamHold[] = holdRows.map((h) => ({
    holdId: h.hold_id,
    memberUserId: h.member_user_id,
    name: names.get(h.member_user_id) ?? null,
    poolId: h.pool_id,
    start: h.start_date,
    end: h.end_date,
    since: h.created_at,
  }));
  return { op: 'team.read', ok: true, holds: teamHolds, seen: [...seenBy.values()], devices: teamDevices, readAt: new Date().toISOString() };
}

/* ── the door ──────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The door, called by ONE stable route (`app/api/offline/supplier-sync/route.ts`, a versioned JSON payload — never a
 * server action, whose id changes with every deploy). A refused op is in the reply too (`ok: false`, `retry`), so the
 * phone always knows whether to keep it.
 */
export async function supplierOffline(fd: FormData): Promise<SupplierOfflineReply> {
  const op = str(fd, 'op');
  if (!isSupplierOfflineOp(op)) return reply(refusal('sync', COULD_NOT_SAVE));
  switch (op) {
    case 'sync':
      return reply(await syncOne(typeof fd.get('item') === 'string' ? String(fd.get('item')) : ''));
    case 'device.register':
      return reply(await registerDevice(fd));
    case 'device.stop':
      return reply(await stopDevice(fd));
    case 'device.seen':
      return reply(await seenDevice(fd));
    case 'holds.claim':
    case 'holds.release':
    case 'holds.synced':
      return reply(await holdOp(op, fd));
    default:
      return reply(await readTeam(fd));
  }
}

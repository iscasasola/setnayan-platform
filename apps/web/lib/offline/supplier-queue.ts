'use client';

// 📶 The supplier dashboard's side of the offline queue (owner 2026-11-24, DECISION_LOG "The supplier dashboard works
// offline and catches up when back online"). A thin layer over the SHIPPED offline daemon (`lib/offline/db.ts` +
// `lib/offline/sync-daemon.ts`), exactly as the check-in desk's `checkin-queue.ts` is: the supplier side has no queue of
// its own — an action made with no signal is an `OfflineItem` in the daemon's `supplier` store, and it is sent by the
// daemon's `triggerSyncNow()`. Everything that talks to the server goes through the ONE door (`saveInPlace`, stay door
// `supOffline.supplierOffline`). Lazy-load it (`import()`), like the desk does, so none of this is in a first load.
//
// What the screens (the approved drawing) will call:
//   queueSupplierAction        — keep one action; it shows "Not confirmed yet" until the server accepts it
//   queuedSupplierActions      — what is still waiting ("N waiting to sync")
//   sendQueuedSupplierActions  — send now (the daemon's own pass), then tell teammates what is left, and end the
//                                member's expo holds once nothing is left
//   readSupplierOutcomes …     — the answers that need a person ("Couldn't save: <why>", the money re-confirm, …)
//   reconfirmMoney / requeueWith — the one-tap fixes
//   refillOfflineCodes · makeOfflineQr · cancelMemberCodes — the offline client QR
//   claimDates · releaseHold · readTeamOffline — expo mode and the teammates' pending line
//   wipeSupplierOfflineOnThisPhone — sign-out

import { dequeueOfflineItem, enqueueOfflineItem, listOfflineItems } from './db';
import { countSupplierCodes, replaceSupplierCodes, takeSupplierCode, wipeSupplierOffline } from './supplier-codes';
import { triggerSyncNow } from './sync-daemon';
import {
  dismissSupplierOutcome,
  forgetSupplierOutcomes,
  readSupplierOutcomes,
  setSupplierMember,
  type SupplierOutcomeNote,
} from './service-handlers/supplier-handler';
import {
  PAY_WHEN_ONLINE,
  isSupplierOfflineKind,
  type MoneySeen,
  type SupplierOfflineKind,
  type SupplierQueuedItem,
} from '@/lib/supplier-offline/kinds';
import type { SupplierOfflineOp, SupplierOfflineReply } from '@/lib/supplier-offline/replies';
import { memberTagOf, offlineQrUrl, signOfflineQr } from '@/lib/supplier-offline/qr';

export { readSupplierOutcomes, dismissSupplierOutcome, type SupplierOutcomeNote };

const DEVICE_KEY = 'sn-offline-device:v1';

/** This phone's own name for the code stock and the pending line — random, never a person's data. */
export function offlineDeviceId(): string {
  try {
    const held = window.localStorage.getItem(DEVICE_KEY);
    if (held && /^[A-Za-z0-9_-]{8,64}$/.test(held)) return held;
    const made = crypto.randomUUID().replace(/-/g, '');
    window.localStorage.setItem(DEVICE_KEY, made);
    return made;
  } catch {
    return 'device-unnamed';
  }
}

/** ONE call to the door. Null = no answer (no signal) — the caller keeps what it has. */
async function door(op: SupplierOfflineOp, fields: Record<string, string>): Promise<SupplierOfflineReply | null> {
  try {
    const { saveInPlace } = await import('@/app/_actions/save-in-place');
    const fd = new FormData();
    fd.set('op', op);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    const res = await saveInPlace('supOffline.supplierOffline', fd);
    return res.ok ? ((res.reply ?? null) as SupplierOfflineReply | null) : null;
  } catch {
    return null;
  }
}

/* ── the queue ─────────────────────────────────────────────────────────────────────────────────────────────────── */

export type QueueInput = {
  shop: string;
  member: string;
  kind: SupplierOfflineKind;
  fields: Record<string, string | string[]>;
  baseVersion?: number | null;
  seen?: MoneySeen | null;
  giftsAsOf?: string | null;
};

export type Queued = { itemId: string; phoneTime: string; line: string };

/** Keep one action on this phone. A purchase is kept too — as "Pay when online"; nothing is ever charged from here. */
export async function queueSupplierAction(input: QueueInput): Promise<Queued> {
  if (!isSupplierOfflineKind(input.kind)) throw new Error('This can’t be done offline.');
  const phoneTime = new Date().toISOString();
  const item: SupplierQueuedItem = {
    v: 1,
    itemId: crypto.randomUUID(),
    shop: input.shop,
    member: input.member,
    phoneTime,
    madeOffline: true,
    kind: input.kind,
    baseVersion: input.baseVersion ?? null,
    seen: input.seen ?? null,
    giftsAsOf: input.giftsAsOf ?? null,
    fields: input.fields,
  };
  // The shop rides in `event_id`, the daemon's scoping key (its index lists one shop's items without reading all).
  await enqueueOfflineItem('supplier', { item_id: item.itemId, event_id: input.shop, payload: item, queued_at: phoneTime });
  return { itemId: item.itemId, phoneTime, line: input.kind === 'purchase' ? PAY_WHEN_ONLINE : 'Not confirmed yet' };
}

/** This account's actions still waiting in this shop, oldest first — each drawn "Not confirmed yet". */
export async function queuedSupplierActions(member: string, shop: string): Promise<SupplierQueuedItem[]> {
  const items = await listOfflineItems('supplier', shop);
  return items
    .map((i) => i.payload as Partial<SupplierQueuedItem>)
    .filter((p): p is SupplierQueuedItem => p.v === 1 && p.member === member && p.shop === shop)
    .sort((a, b) => (a.phoneTime < b.phoneTime ? -1 : 1));
}

/** An action taken back before it was ever sent. */
export async function unqueueSupplierAction(itemId: string): Promise<void> {
  await dequeueOfflineItem('supplier', itemId);
}

/**
 * Send what this account has waiting (the daemon's own pass over every queue). Then tell the team what is left
 * ("<member>: N changes waiting, last online <time>"), and — once nothing is left — end this member's expo holds
 * (release on sync).
 */
export async function sendQueuedSupplierActions(member: string, shop: string): Promise<{ sent: number; left: number }> {
  setSupplierMember(member);
  const summary = await triggerSyncNow();
  const left = (await queuedSupplierActions(member, shop)).length;
  await door('presence.report', { shop, device_id: offlineDeviceId(), waiting: String(left) });
  if (left === 0) await door('holds.synced', { shop });
  return { sent: summary.find((s) => s.service === 'supplier')?.synced ?? 0, left };
}

/** The money re-confirm's one tap: the same action again, now with the LIVE amounts as what was shown. */
export async function reconfirmMoney(note: SupplierOutcomeNote): Promise<Queued | null> {
  if (note.reply.status !== 'needs_reconfirm') return null;
  dismissSupplierOutcome(note.member, note.item.itemId);
  return queueSupplierAction({ ...note.item, seen: note.reply.live });
}

/** A clash's one-tap fix ("pick another time"): the same action with the fields the person changed. */
export async function requeueWith(note: SupplierOutcomeNote, fields: Record<string, string | string[]>, baseVersion?: number | null): Promise<Queued> {
  dismissSupplierOutcome(note.member, note.item.itemId);
  return queueSupplierAction({ ...note.item, fields: { ...note.item.fields, ...fields }, baseVersion: baseVersion ?? note.item.baseVersion ?? null });
}

/* ── the offline client QR ─────────────────────────────────────────────────────────────────────────────────────── */

/** While online: top this phone's codes back up (the server's list replaces what the phone holds for this member). */
export async function refillOfflineCodes(shop: string, member: string): Promise<{ held: number } | null> {
  const r = await door('codes.refill', { shop, device_id: offlineDeviceId() });
  if (!r || r.op !== 'codes.refill' || !r.ok) return null;
  await replaceSupplierCodes(
    shop,
    member,
    r.codes.map((c) => ({ code_id: c.codeId, shop, member, secret: c.secret, issued_at: c.issuedAt })),
  );
  return { held: r.codes.length };
}

export async function offlineCodesLeft(shop: string, member: string): Promise<number> {
  return countSupplierCodes(shop, member);
}

export type OfflineQrInput = {
  shop: string;
  /** the shop's public address (`business_slug`) — the QR opens its invite door */
  slug: string;
  member: string;
  origin: string;
  date: string;
  time: string | null;
  poolId: string | null;
  /** the client's details stay HERE, in the queued copy — never in the QR */
  clientName: string;
  clientContact?: string;
  clientNote?: string;
  /** gift codes picked from the last known balance (Add a client's gift) */
  gifts?: string[];
  giftsAsOf?: string | null;
};

/**
 * Make an offline client QR: take one code out of this phone's stock, sign it, and queue this phone's own copy (the
 * date, and — with gifts — the client). The QR is drawn from `url`; it carries the made-offline mark and no personal
 * data. Null = no codes left on this phone (open the dashboard online once to refill).
 */
export async function makeOfflineQr(input: OfflineQrInput): Promise<{ url: string; codeId: string } | null> {
  const code = await takeSupplierCode(input.shop, input.member);
  if (!code) return null;
  const phoneTime = new Date().toISOString();
  const token = await signOfflineQr(
    { codeId: code.code_id, date: input.date, time: input.time, poolId: input.poolId, member: await memberTagOf(input.member), madeOffline: true, phoneTime },
    code.secret,
  );
  if (!token) return null;
  const client = { client_name: input.clientName, client_contact: input.clientContact ?? '', client_note: input.clientNote ?? '' };
  await queueSupplierAction({
    shop: input.shop,
    member: input.member,
    kind: 'qr.booking',
    fields: { code_id: code.code_id, start_date: input.date, client_time: input.time ?? '', pool_id: input.poolId ?? '', ...client },
  });
  if (input.gifts && input.gifts.length > 0) {
    await queueSupplierAction({
      shop: input.shop,
      member: input.member,
      kind: 'client.add',
      fields: { ...client, gift: input.gifts, code_id: code.code_id },
      giftsAsOf: input.giftsAsOf ?? null,
    });
  }
  return { url: offlineQrUrl(input.origin, input.slug, token), codeId: code.code_id };
}

/** Any teammate: cancel a member's unused codes (a lost phone). */
export async function cancelMemberCodes(shop: string, memberUserId: string): Promise<number | null> {
  const r = await door('codes.cancel', { shop, member_user_id: memberUserId });
  return r && r.op === 'codes.cancel' && r.ok ? r.cancelled : null;
}

/* ── expo mode and the team ────────────────────────────────────────────────────────────────────────────────────── */

export async function claimDates(shop: string, start: string, end: string, poolId: string | null): Promise<SupplierOfflineReply | null> {
  return door('holds.claim', { shop, start_date: start, end_date: end, pool_id: poolId ?? '' });
}

export async function releaseHold(shop: string, holdId: string): Promise<SupplierOfflineReply | null> {
  return door('holds.release', { shop, hold_id: holdId });
}

export async function readTeamOffline(shop: string): Promise<SupplierOfflineReply | null> {
  return door('team.read', { shop });
}

/* ── sign-out ──────────────────────────────────────────────────────────────────────────────────────────────────── */

/** 🧹 Signing out wipes this phone's offline copy of the supplier's work: the queue, the codes and the answers. */
export async function wipeSupplierOfflineOnThisPhone(): Promise<void> {
  setSupplierMember(null);
  forgetSupplierOutcomes();
  await wipeSupplierOffline().catch(() => undefined);
}

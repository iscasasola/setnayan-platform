'use client';

// 📶 The supplier dashboard's side of the offline queue (owner 2026-11-24, DECISION_LOG "The supplier dashboard works
// offline and catches up when back online"). A thin layer over the SHIPPED offline daemon (`lib/offline/db.ts` +
// `lib/offline/sync-daemon.ts`), exactly as the check-in desk's `checkin-queue.ts` is: the supplier side has no queue of
// its own — an action made with no signal is an `OfflineItem` in the daemon's `supplier` store, and it is sent by the
// daemon's `triggerSyncNow()`. Everything that talks to the server goes through the ONE door (`saveInPlace`, stay door
// `supOffline.supplierOffline`). Lazy-load it (`import()`), like the desk does, so none of this is in a first load.
//
// What the screens (the approved drawing) will call:
//   queueSupplierAction · queueBookingIfFree — keep one action; it shows "Not confirmed yet" until the server accepts it
//   queuedSupplierActions      — what is still waiting ("3 changes waiting to send" — on THIS phone only, R5)
//   localSlotNow               — R14: the saved copy PLUS this phone's queue (the time picker, the QR's free-time check)
//   sendQueuedSupplierActions  — send now (the daemon's own pass); then "last seen" for the team, and the member's expo
//                                holds end once nothing is left
//   readSupplierOutcomes …     — the answers that need a person ("Couldn't save: <why>", the money re-confirm, …)
//   reconfirmMoney / requeueWith — the one-tap fixes
//   ensurePhoneKey · makeOfflineQr · stopPhone — the offline client QR (no stock: the phone signs its own)
//   claimDates · releaseHold · readTeamOffline — expo mode and Settings › Offline
//   wipeSupplierOfflineOnThisPhone — sign-out

import { dequeueOfflineItem, enqueueOfflineItem, listOfflineItems } from './db';
import { phoneDeviceIds, phoneKeyId, readPhoneKey, wipeSupplierOffline, writePhoneKey } from './supplier-keys';
import { triggerSyncNow } from './sync-daemon';
import {
  dismissSupplierOutcome,
  forgetSupplierOutcomes,
  readSupplierOutcomes,
  setSupplierMember,
  type SupplierOutcomeNote,
} from './service-handlers/supplier-handler';
import {
  NOT_CONFIRMED_YET,
  isSupplierOfflineKind,
  localSlot,
  type LocalDayCopy,
  type LocalSlot,
  type MoneySeen,
  type RowVersion,
  type SupplierOfflineKind,
  type SupplierQueuedItem,
} from '@/lib/supplier-offline/kinds';
import type { SupplierOfflineOp, SupplierOfflineReply } from '@/lib/supplier-offline/replies';
import { memberTagOf, newOfflineCodeId, newPhoneKey, offlineQrUrl, signOfflineQr } from '@/lib/supplier-offline/qr';

export { readSupplierOutcomes, dismissSupplierOutcome, type SupplierOutcomeNote };

/** The cookie the sign-out route reads to stop this phone's QR keys (`app/auth/sign-out/route.ts` · held equal to
 *  `lib/supplier-offline/sign-out.server.ts` by the guard). */
export const OFFLINE_DEVICES_COOKIE = 'sn_offline_devices';

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
  rowVersion?: RowVersion | null;
  seen?: MoneySeen | null;
  giftsAsOf?: string | null;
};

export type Queued = { itemId: string; phoneTime: string; line: string };

/** Keep one action on this phone. Only a listed kind — nothing that buys or pays is one (R15, "Needs internet"). */
export async function queueSupplierAction(input: QueueInput): Promise<Queued> {
  if (!isSupplierOfflineKind(input.kind)) throw new Error('This needs internet.');
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
    rowVersion: input.rowVersion ?? null,
    seen: input.seen ?? null,
    giftsAsOf: input.giftsAsOf ?? null,
    fields: input.fields,
  };
  // The shop rides in `event_id`, the daemon's scoping key (its index lists one shop's items without reading all).
  await enqueueOfflineItem('supplier', { item_id: item.itemId, event_id: input.shop, payload: item, queued_at: phoneTime });
  return { itemId: item.itemId, phoneTime, line: NOT_CONFIRMED_YET };
}

/** This account's actions still waiting in this shop, oldest first — each drawn "Not confirmed yet". */
export async function queuedSupplierActions(member: string, shop: string): Promise<SupplierQueuedItem[]> {
  const items = await listOfflineItems('supplier', shop);
  return items
    .map((i) => i.payload as Partial<SupplierQueuedItem>)
    .filter((p): p is SupplierQueuedItem => p.v === 1 && p.member === member && p.shop === shop)
    .sort((a, b) => (a.phoneTime < b.phoneTime ? -1 : 1));
}

/** R14 — THE local availability read: the saved copy of that day PLUS this phone's queue (`localSlot`). */
export async function localSlotNow(member: string, shop: string, copy: LocalDayCopy, time: string | null): Promise<LocalSlot> {
  return localSlot(copy, await queuedSupplierActions(member, shop), time);
}

/**
 * R14 — book a client offline only into a time this phone still sees free: the copy plus everything this phone already
 * queued. A time it already booked reads "Booked · not confirmed yet" and is not taken twice.
 */
export async function queueBookingIfFree(
  input: Omit<QueueInput, 'kind'>,
  copy: LocalDayCopy,
): Promise<{ queued: Queued } | { refused: Exclude<LocalSlot, 'free'> }> {
  const time = typeof input.fields.client_time === 'string' && input.fields.client_time ? input.fields.client_time : null;
  const slot = await localSlotNow(input.member, input.shop, copy, time);
  if (slot !== 'free') return { refused: slot };
  return { queued: await queueSupplierAction({ ...input, kind: 'schedule.client' }) };
}

/** An action taken back before it was ever sent. */
export async function unqueueSupplierAction(itemId: string): Promise<void> {
  await dequeueOfflineItem('supplier', itemId);
}

/**
 * Send what this account has waiting (the daemon's own pass over every queue). Then tell the team this phone was seen
 * (R5: "last seen", never a count), and — once nothing is left — end this member's expo holds (release on sync).
 */
export async function sendQueuedSupplierActions(member: string, shop: string): Promise<{ sent: number; left: number }> {
  setSupplierMember(member);
  const summary = await triggerSyncNow();
  const left = (await queuedSupplierActions(member, shop)).length;
  const key = await readPhoneKey(shop, member).catch(() => null);
  if (key?.registered) await door('device.seen', { shop, device_id: key.deviceId });
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

/* ── the offline client QR: the phone signs its own (no stock) ─────────────────────────────────────────────────── */

function rememberDevices(ids: readonly string[]): void {
  try {
    document.cookie = `${OFFLINE_DEVICES_COOKIE}=${encodeURIComponent(ids.join(','))}; path=/; max-age=31536000; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
  } catch {
    // No cookie: the sign-out still wipes the phone; the key's row can be stopped from Settings › Offline.
  }
}

/**
 * While online (the dashboard opened with signal): make this phone's key once and register its PUBLIC half. A key the
 * server refuses for good (stopped) is replaced by a new one, registered the next time. Null = not ready yet.
 */
export async function ensurePhoneKey(shop: string, member: string): Promise<{ deviceId: string } | null> {
  let key = await readPhoneKey(shop, member);
  if (!key) {
    const made = await newPhoneKey();
    key = { id: phoneKeyId(shop, member), shop, member, deviceId: made.deviceId, privateKey: made.privateKey, publicJwk: made.publicJwk, createdAt: new Date().toISOString(), registered: false };
    await writePhoneKey(key);
  }
  if (!key.registered) {
    const r = await door('device.register', { shop, device_id: key.deviceId, public_key: JSON.stringify(key.publicJwk) });
    if (!r || r.op !== 'device.register') return null;
    if (!r.ok) {
      if (!r.retry) {
        const fresh = await newPhoneKey();
        await writePhoneKey({ ...key, deviceId: fresh.deviceId, privateKey: fresh.privateKey, publicJwk: fresh.publicJwk, createdAt: new Date().toISOString(), registered: false });
      }
      return null;
    }
    key = { ...key, registered: true };
    await writePhoneKey(key);
  }
  const deviceId = key.deviceId;
  rememberDevices(await phoneDeviceIds().catch(() => [deviceId]));
  return { deviceId };
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
  /** the amount the QR shows (whole ₱, from the phone's copy of the card), or null */
  amountPhp?: number | null;
  /** R14: the phone's copy of that day — the QR is only made into a time this phone still sees free */
  copy: LocalDayCopy;
  /** the client's details stay HERE, in the queued copy — never in the QR */
  clientName: string;
  clientContact?: string;
  clientNote?: string;
  /** gift codes picked from the last known balance (Add a client's gift) */
  gifts?: string[];
  giftsAsOf?: string | null;
};

/**
 * Make an offline client QR: a new random code id, signed by this phone's key, carrying the made-offline mark and no
 * personal data — and this phone's own copy queued (the date, and — with gifts — the client), so it counts here at once
 * (R14). Refused when the time is not free on this phone, or when the phone has no registered key yet (open the
 * dashboard online once).
 */
export async function makeOfflineQr(input: OfflineQrInput): Promise<{ url: string; codeId: string } | { refused: Exclude<LocalSlot, 'free'> | 'no_key' }> {
  const slot = await localSlotNow(input.member, input.shop, input.copy, input.time);
  if (slot !== 'free') return { refused: slot };
  const key = await readPhoneKey(input.shop, input.member);
  if (!key?.registered) return { refused: 'no_key' };
  const codeId = newOfflineCodeId();
  const token = await signOfflineQr(
    {
      codeId,
      deviceId: key.deviceId,
      shop: input.shop,
      member: await memberTagOf(input.member),
      date: input.date,
      time: input.time,
      poolId: input.poolId,
      amountPhp: input.amountPhp ?? null,
      madeOffline: true,
      phoneTime: new Date().toISOString(),
    },
    key.privateKey,
  );
  if (!token) return { refused: 'no_key' };
  const client = { client_name: input.clientName, client_contact: input.clientContact ?? '', client_note: input.clientNote ?? '' };
  await queueSupplierAction({
    shop: input.shop,
    member: input.member,
    kind: 'qr.booking',
    fields: { token, code_id: codeId, start_date: input.date, client_time: input.time ?? '', pool_id: input.poolId ?? '', ...client },
  });
  if (input.gifts && input.gifts.length > 0) {
    await queueSupplierAction({
      shop: input.shop,
      member: input.member,
      kind: 'client.add',
      fields: { ...client, gift: input.gifts, code_id: codeId },
      giftsAsOf: input.giftsAsOf ?? null,
    });
  }
  return { url: offlineQrUrl(input.origin, input.slug, token), codeId };
}

/** "Stop QR codes from this phone" (a Shop Manager, or the Branch Manager for that branch; anyone for their own). */
export async function stopPhone(shop: string, deviceId: string): Promise<boolean | null> {
  const r = await door('device.stop', { shop, device_id: deviceId });
  return r && r.op === 'device.stop' && r.ok ? r.stopped : null;
}

/* ── expo mode and the team ────────────────────────────────────────────────────────────────────────────────────── */

export async function claimDates(shop: string, start: string, end: string, poolId: string | null): Promise<SupplierOfflineReply | null> {
  return door('holds.claim', { shop, start_date: start, end_date: end, pool_id: poolId ?? '' });
}

export async function releaseHold(shop: string, holdId: string): Promise<SupplierOfflineReply | null> {
  return door('holds.release', { shop, hold_id: holdId });
}

/** Settings › Offline and the teammates' line: holds, "last seen", the team's phones. */
export async function readTeamOffline(shop: string): Promise<SupplierOfflineReply | null> {
  return door('team.read', { shop });
}

/* ── sign-out ──────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * 🧹 Signing out wipes this phone's offline copy of the supplier's work: the queue, the signing keys and the answers
 * (the sign-out route stops the keys' rows from the `sn_offline_devices` cookie; the worker wipes again on its way).
 */
export async function wipeSupplierOfflineOnThisPhone(): Promise<void> {
  setSupplierMember(null);
  forgetSupplierOutcomes();
  await wipeSupplierOffline().catch(() => undefined);
}

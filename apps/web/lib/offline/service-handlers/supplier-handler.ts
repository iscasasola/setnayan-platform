// 📶 Supplier dashboard offline handler — drains the `supplier` IndexedDB queue (owner 2026-11-24, DECISION_LOG "The
// supplier dashboard works offline and catches up when back online"). The same bus as the check-in desk (EV3): one
// engine, a second store.
//
// Each queued item is ONE supplier action, sent through the ONE door every in-place save uses (`saveInPlace`, stay door
// `supOffline.supplierOffline`, op `sync`). The server answers with a typed outcome (`lib/supplier-offline/kinds.ts`):
//   · applied                      → dequeued (the screens stop drawing it "Not confirmed yet").
//   · clash · needs_reconfirm · no_gifts_left · pay_when_online · refused
//                                  → dequeued AND kept as an OUTCOME the person sees ("Couldn't save: <why>", with the
//                                    one-tap fix); nothing fails silently, nothing is retried into a teammate's work.
//   · retry (no signal, signed out, another account, an unread live number) → stays queued; the next pass sends it.
// An action made by one account is only ever sent by that same account (`setSupplierMember`) — a shared phone never
// sends, or shows, another person's work.

import type { OfflineItem, SyncResult } from '../types';
import { isFinalOutcome, parseSyncReply, type SupplierQueuedItem, type SyncReply } from '@/lib/supplier-offline/kinds';
import type { SupplierOfflineReply } from '@/lib/supplier-offline/replies';

/** An answer that needs a person: kept on this phone until they act on it or dismiss it. */
export type SupplierOutcomeNote = {
  member: string;
  shop: string;
  /** what the phone queued — so the one-tap fix can send it again, amended */
  item: SupplierQueuedItem;
  reply: SyncReply;
  /** when this phone got the answer (ISO) */
  answeredAt: string;
};

const NOTES_KEY = 'sn-offline-supplier-outcomes:v1';
const MAX_NOTES = 200;

let activeMember: string | null = null;

/** The supplier dashboard says who is signed in; only that account's queued actions are sent. */
export function setSupplierMember(member: string | null): void {
  activeMember = member;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readAll(): SupplierOutcomeNote[] {
  const s = storage();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s.getItem(NOTES_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as SupplierOutcomeNote[]) : [];
  } catch {
    return [];
  }
}

function writeAll(notes: SupplierOutcomeNote[]): void {
  try {
    storage()?.setItem(NOTES_KEY, JSON.stringify(notes.slice(-MAX_NOTES)));
  } catch {
    // Quota / private mode: the note cannot be kept — the server's answer stands either way (`vendor_offline_writes`).
  }
}

export function recordSupplierOutcome(note: SupplierOutcomeNote): void {
  writeAll([...readAll().filter((n) => n.item.itemId !== note.item.itemId), note]);
}

/** This account's answers in this shop that need a look, oldest first. */
export function readSupplierOutcomes(member: string, shop: string): SupplierOutcomeNote[] {
  return readAll().filter((n) => n.member === member && n.shop === shop);
}

export function dismissSupplierOutcome(member: string, itemId: string): void {
  writeAll(readAll().filter((n) => !(n.member === member && n.item.itemId === itemId)));
}

/** 🧹 Sign-out: the answers leave the phone with the queue. */
export function forgetSupplierOutcomes(): void {
  try {
    storage()?.removeItem(NOTES_KEY);
  } catch {
    // nothing kept to forget
  }
}

export const SUPPLIER_OUTCOMES_KEY = NOTES_KEY;

function payloadOf(item: OfflineItem): SupplierQueuedItem | null {
  const p = item.payload as Partial<SupplierQueuedItem> | undefined;
  return p && p.v === 1 && typeof p.itemId === 'string' && typeof p.member === 'string' ? (p as SupplierQueuedItem) : null;
}

const RETRY_WORDS: Readonly<Record<string, string>> = {
  offline: 'No signal — kept on this phone.',
  signed_out: 'Waiting for you to sign in again.',
  other_member: 'Waiting for the account that made it.',
  other_shop: 'Waiting until you are back in the shop it was made in.',
  unread: 'Setnayan couldn’t check it just now — it will try again.',
  busy: 'Being saved right now — it will check again.',
};

/** The daemon gave up on an item (7 days / 50 tries): it is NOT dropped silently — an answer says so. */
export function noteGaveUp(item: OfflineItem): void {
  const p = payloadOf(item);
  if (!p) return;
  recordSupplierOutcome({
    member: p.member,
    shop: p.shop,
    item: p,
    reply: { status: 'refused', why: 'This never reached Setnayan. Check it, then make it again.', itemId: p.itemId, kind: p.kind },
    answeredAt: new Date().toISOString(),
  });
}

export async function syncOne(item: OfflineItem): Promise<SyncResult> {
  const p = payloadOf(item);
  if (!p) return { ok: false, error: 'This saved change could not be read.' };
  if (p.member !== activeMember) return { ok: false, error: RETRY_WORDS.other_member! };
  let answer: SupplierOfflineReply | null;
  try {
    // Imported on use: the daemon module is also read where a server action cannot be (its unit tests, the admin page).
    const { saveInPlace } = await import('@/app/_actions/save-in-place');
    const fd = new FormData();
    fd.set('op', 'sync');
    fd.set('item', JSON.stringify(p));
    const res = await saveInPlace('supOffline.supplierOffline', fd);
    if (!res.ok) return { ok: false, error: res.error };
    answer = (res.reply ?? null) as SupplierOfflineReply | null;
  } catch {
    return { ok: false, error: RETRY_WORDS.offline! };
  }
  if (!answer || answer.op !== 'sync') return { ok: false, error: RETRY_WORDS.unread! };
  const now = new Date().toISOString();
  if (!answer.ok) {
    if (answer.retry) return { ok: false, error: RETRY_WORDS[answer.why] ?? RETRY_WORDS.unread! };
    recordSupplierOutcome({ member: p.member, shop: p.shop, item: p, reply: { status: 'refused', why: answer.why, itemId: p.itemId, kind: p.kind }, answeredAt: now });
    return { ok: true };
  }
  const reply = parseSyncReply(answer.reply);
  // An answer this phone does not recognise keeps the item — never dropped on a misunderstanding.
  if (!reply) return { ok: false, error: RETRY_WORDS.unread! };
  if (!isFinalOutcome(reply)) return { ok: false, error: RETRY_WORDS[(reply as { why: string }).why] ?? RETRY_WORDS.unread! };
  if (reply.status !== 'applied') recordSupplierOutcome({ member: p.member, shop: p.shop, item: p, reply, answeredAt: now });
  return { ok: true };
}

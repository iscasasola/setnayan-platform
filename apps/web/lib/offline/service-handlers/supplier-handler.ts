// 📶 Supplier dashboard offline handler — drains the `supplier` IndexedDB queue (owner 2026-11-24, DECISION_LOG "The
// supplier dashboard works offline and catches up when back online"). The same bus as the check-in desk (EV3): one
// engine, a second store. Loaded ON USE by the daemon (`sync-daemon.ts`), so none of it is in a page's first load.
//
// Each queued item is ONE supplier action, sent to the ONE stable route (`/api/offline/supplier-sync`, a versioned
// payload — `lib/offline/supplier-wire.ts`). The server answers with a typed outcome (`lib/supplier-offline/kinds.ts`):
//   · applied                      → dequeued (the screens stop drawing it "Not confirmed yet").
//   · clash · needs_reconfirm · no_gifts_left · confirm_claim · refused
//                                  → dequeued AND kept as an ANSWER the person sees ("Couldn't save: <why>", with the
//                                    one-tap fix) — in IndexedDB; nothing fails silently.
//   · waiting (no signal, another account, another shop, an older payload, rate-limited) → stays queued and does NOT
//     count as a try; a real send that could not be decided (an unread live number) does.
// An action made by one account is only ever sent by that same account (`setSupplierMember`).

import type { OfflineItem, SyncResult } from '../types';
import type { SupplierQueuedItem, SyncReply } from '@/lib/supplier-offline/kinds';

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

type OutcomeStore = {
  all(): Promise<({ id: string } & Record<string, unknown>)[]>;
  put(row: { id: string } & Record<string, unknown>): Promise<void>;
  remove(id: string): Promise<void>;
};

let store: OutcomeStore | null = null;
async function outcomes(): Promise<OutcomeStore> {
  if (!store) store = (await import('../supplier-keys')).idbOutcomeStore;
  return store;
}
/** The guard runs where IndexedDB does not: it hands a stand-in. */
export function useOutcomeStoreForTest(s: OutcomeStore | null): void {
  store = s;
}

let activeMember: string | null = null;

/** The supplier dashboard says who is signed in; only that account's queued actions are sent. */
export function setSupplierMember(member: string | null): void {
  activeMember = member;
}

export async function recordSupplierOutcome(note: SupplierOutcomeNote): Promise<void> {
  await (await outcomes()).put({ id: note.item.itemId, ...note });
}

/** An answer this page can't draw as what it is (the worker files answers it only checked by status — `public/sw.js`). */
export const ANSWER_NOT_SHOWN = 'Setnayan answered, but this page can’t show it. Reload, then check this change.';

/** This account's answers in this shop that need a look, oldest first. Each is re-read here, the page's own way; one it
 *  can't read is still shown — as a refusal saying so — never dropped. */
export async function readSupplierOutcomes(member: string, shop: string): Promise<SupplierOutcomeNote[]> {
  const rows = (await (await outcomes()).all()) as unknown as SupplierOutcomeNote[];
  const { parseSyncReply } = await import('@/lib/supplier-offline/kinds');
  return rows
    .filter((n) => n.member === member && n.shop === shop)
    .map((n) => {
      const reply = parseSyncReply(n.reply);
      return reply && reply.status !== 'retry'
        ? { ...n, reply }
        : { ...n, reply: { status: 'refused' as const, why: ANSWER_NOT_SHOWN, itemId: n.item.itemId, kind: n.item.kind } };
    })
    .sort((a, b) => (a.answeredAt < b.answeredAt ? -1 : 1));
}

export async function dismissSupplierOutcome(member: string, itemId: string): Promise<void> {
  const s = await outcomes();
  const rows = (await s.all()) as unknown as SupplierOutcomeNote[];
  if (rows.some((n) => n.member === member && n.item.itemId === itemId)) await s.remove(itemId);
}

/** The queued item without a kept file's bytes — what is sent, and what an answer keeps (never the bytes). */
function withoutBytes(p: SupplierQueuedItem): SupplierQueuedItem {
  const { file: _bytes, ...rest } = p as SupplierQueuedItem & { file?: unknown };
  void _bytes;
  return rest;
}

function payloadOf(item: OfflineItem): SupplierQueuedItem | null {
  const p = item.payload as Partial<SupplierQueuedItem> | undefined;
  return p && p.v === 1 && typeof p.itemId === 'string' && typeof p.member === 'string' ? (p as SupplierQueuedItem) : null;
}

const RETRY_WORDS: Readonly<Record<string, string>> = {
  offline: 'No signal — kept on this phone.',
  signed_out: 'Waiting for you to sign in again.',
  other_member: 'Waiting for the account that made it.',
  other_shop: 'Waiting until you are back in the shop it was made in.',
  update: 'Update Setnayan to send this — reload the page.',
  unread: 'Setnayan couldn’t check it just now — it will try again.',
  busy: 'Being saved right now — it will check again.',
  waiting_parent: 'Waiting for the change it follows to be sent first.',
};
/** Nothing was really sent: these never count as a try. */
const WAITING = new Set(['offline', 'signed_out', 'other_member', 'other_shop', 'update', 'busy', 'waiting_parent']);
const wait = (why: string): SyncResult => ({ ok: false, error: RETRY_WORDS[why] ?? RETRY_WORDS.unread!, waiting: true });

/** The daemon gave up on an item (50 real tries): it is NOT dropped silently — an answer says so. */
export function noteGaveUp(item: OfflineItem): void {
  const p = payloadOf(item);
  if (!p) return;
  void recordSupplierOutcome({
    member: p.member,
    shop: p.shop,
    item: withoutBytes(p),
    reply: { status: 'refused', why: 'This never reached Setnayan. Check it, then make it again.', itemId: p.itemId, kind: p.kind },
    answeredAt: new Date().toISOString(),
  }).catch(() => undefined);
}

/* ── 📎 a file written offline (review #2: "one upload kind") ─────────────────────────────────────────────────────── */

/** What sending a kept file came to: its ref, a refusal that will not change (the chat's own words), or no luck now. */
export type FileSent = { ok: true; ref: string; name: string } | { refused: string } | { failed: string };
type FileDeps = {
  /** prepare (compress) + PUT the kept file the shipped chat way, into the sender's own folder */
  send(args: { threadId: string; member: string; file: File }): Promise<FileSent>;
  /** write the queued item back (its ref in, its bytes out) */
  save(item: OfflineItem): Promise<void>;
};
const shippedFileDeps: FileDeps = {
  async send({ threadId, member, file }) {
    const { prepareChatFile, uploadPreparedChatFile } = await import('@/lib/chat-file-prepare');
    const prepared = await prepareChatFile(file);
    if (!prepared.ok) return { refused: prepared.message };
    const up = await uploadPreparedChatFile({ threadId, userId: member, prepared: prepared.prepared });
    return up.ok ? { ok: true, ref: up.ref, name: up.name } : { failed: up.message };
  },
  async save(item) {
    const { updateOfflineItem } = await import('../db');
    await updateOfflineItem('supplier', item);
  },
};
let fileDeps: FileDeps = shippedFileDeps;
/** The guard runs where no browser compresses or uploads: it hands stand-ins. */
export function useFileDepsForTest(d: FileDeps | null): void {
  fileDeps = d ?? shippedFileDeps;
}

/**
 * A queued message that carries a file: send the file ONCE, before the message. Its ref is written onto the queued item
 * (and the bytes dropped) before anything else, so a retry never uploads it twice. `null` = go on and send the message.
 */
async function sendKeptFile(item: OfflineItem, p: SupplierQueuedItem): Promise<SyncResult | null> {
  const kept = (item.payload as { file?: Record<string, unknown> } | undefined)?.file;
  if (!kept || typeof p.fields.attachment_ref === 'string') return null;
  const { bytesBack } = await import('../stored-bytes');
  const blob = bytesBack(kept);
  const name = typeof kept.name === 'string' && kept.name ? kept.name : 'file';
  if (!blob) return { ok: false, error: 'This saved file could not be read.' };
  const threadId = typeof p.fields.thread_id === 'string' ? p.fields.thread_id : '';
  const sent = await fileDeps.send({ threadId, member: p.member, file: new File([blob], name, { type: blob.type }) });
  if ('refused' in sent) {
    // The chat would never take it (its type, or too big even compressed): an answer, with the chat's own words.
    await recordSupplierOutcome({ member: p.member, shop: p.shop, item: withoutBytes(p), reply: { status: 'refused', why: sent.refused, itemId: p.itemId, kind: p.kind }, answeredAt: new Date().toISOString() });
    return { ok: true };
  }
  if ('failed' in sent) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return wait('offline');
    return { ok: false, error: sent.failed };
  }
  const { file: _sent, ...rest } = item.payload as Record<string, unknown>;
  void _sent;
  const fields = { ...p.fields, attachment_ref: sent.ref, attachment_name: sent.name };
  await fileDeps.save({ ...item, payload: { ...rest, fields } });
  p.fields = fields;
  return null;
}

export async function syncOne(item: OfflineItem): Promise<SyncResult> {
  const p = payloadOf(item);
  if (!p) return { ok: false, error: 'This saved change could not be read.' };
  if (p.member !== activeMember) return wait('other_member');
  const filed = await sendKeptFile(item, p);
  if (filed) return filed;
  const { supplierWire } = await import('../supplier-wire');
  // The bytes never ride the sync, and an answer never keeps them: only the ref does (and the item's own fields).
  const sendable = withoutBytes(p);
  const answer = await supplierWire('sync', { item: JSON.stringify(sendable) });
  if (answer === null) return wait('offline');
  if ('update' in answer) return wait('update');
  if ('busy' in answer) return wait('busy');
  const r = answer.reply;
  if (r.op !== 'sync') return { ok: false, error: RETRY_WORDS.unread! };
  const now = new Date().toISOString();
  if (!r.ok) {
    if (r.retry) return WAITING.has(r.why) ? wait(r.why) : { ok: false, error: RETRY_WORDS[r.why] ?? RETRY_WORDS.unread! };
    await recordSupplierOutcome({ member: p.member, shop: p.shop, item: sendable, reply: { status: 'refused', why: r.why, itemId: p.itemId, kind: p.kind }, answeredAt: now });
    return { ok: true };
  }
  const { isFinalOutcome, parseSyncReply } = await import('@/lib/supplier-offline/kinds');
  const reply = parseSyncReply(r.reply);
  // An answer this phone does not recognise keeps the item — never dropped on a misunderstanding.
  if (!reply) return { ok: false, error: RETRY_WORDS.unread! };
  if (!isFinalOutcome(reply)) {
    const why = (reply as { why: string }).why;
    return WAITING.has(why) ? wait(why) : { ok: false, error: RETRY_WORDS[why] ?? RETRY_WORDS.unread! };
  }
  if (reply.status !== 'applied') await recordSupplierOutcome({ member: p.member, shop: p.shop, item: sendable, reply, answeredAt: now });
  return { ok: true };
}

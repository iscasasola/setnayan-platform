/**
 * 💬 WHICH KIND A LINE OF THE CHAT IS — the rule behind the chips in the text box (owner 19 Nov 2026, DECISION_LOG "THE
 * CLIENT PAGE IS ONE CHAT THAT HOLDS EVERYTHING"; drawing S9ScH2Ps v3, screen 5: All · Decisions · Forms · Money ·
 * Dates · Files). One picked chip shows only that kind's cards and lines; the chatter is hidden.
 *
 *   money      a quote (every version), an adjustment, a counter or a proposed plan, a dropped offer, an offered
 *              service, a payment line (asked · logged · confirmed · not received), a quote that rose or fell
 *   dates      a meeting card, a schedule change
 *   forms      a form the supplier sent
 *   decisions  a booking ask and its answer, a poll, an ask for a change, an ask for access, a guest-count change —
 *              and any message filed under a pinned decision
 *   files      a message that carries a file
 *
 * A plain message is no kind: it shows on All only. Reads a line by the exact words the database and the app write
 * (`chat-card-lines.ts`), never by guessing.
 *
 * NO IMPORTS BEYOND `chat-card-lines` (itself import-free): the stream asks this for every line, so it rides in the
 * chat's first load. 🔒 lib/chat-kinds.test.ts
 */
import { formLineTitle, streamLineKind } from './chat-card-lines';
import type { ThreadKind } from './thread-view';

export type ChatKindRow = {
  body?: string | null;
  sender_role?: string | null;
  proposal_id?: string | null;
  appointment_id?: string | null;
  amendment_id?: string | null;
  change_order_id?: string | null;
  offered_service_id?: string | null;
  vendor_offer_id?: number | string | null;
  attachment_r2_key?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  file_removed_at?: string | null;
};

/** The chips, in their order; All is the absence of a kind. */
export const KIND_CHIPS: readonly { key: 'all' | ThreadKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'decisions', label: 'Decisions' },
  { key: 'forms', label: 'Forms' },
  { key: 'money', label: 'Money' },
  { key: 'dates', label: 'Dates' },
  { key: 'files', label: 'Files' },
];

export const KIND_LABEL: Record<ThreadKind, string> = { decisions: 'Decisions', forms: 'Forms', money: 'Money', dates: 'Dates', files: 'Files' };

/**
 * A payment's own line, as the ledger trigger and the app write it (migration 20271329937802 · `chat-gap-lines.ts`):
 * "First payment logged · ₱9,000 · …", "Payment confirmed · ₱9,000", "Payment asked · ₱5,000 · due 12 Dec 2026".
 */
const PAYMENT_LINE = /^(?:First payment|Payment|Reservation|Deposit|Installment)[^·\n]{0,40}\b(?:logged|confirmed|recorded|asked|not received|sent again|proof added)\b/;

/** "Payment logged · ₱9,000 · GCash · ref 123 · proof attached · waiting…" → its short record, or null. */
export function paymentLineOf(body: string | null | undefined): { verb: 'logged' | 'confirmed' | 'asked' | 'not_received' | 'other'; amount: string | null; hasProof: boolean } | null {
  const b = (body ?? '').trim();
  if (!PAYMENT_LINE.test(b)) return null;
  const head = b.split(' · ')[0] ?? '';
  const amount = /₱\d[\d,]*(?:\.\d{2})?/.exec(b)?.[0] ?? null;
  const verb = /\blogged\b|\brecorded\b/.test(head) ? 'logged' : /\bconfirmed\b/.test(head) ? 'confirmed' : /\basked\b/.test(head) ? 'asked' : /not received/.test(head) ? 'not_received' : 'other';
  return { verb, amount, hasProof: /\bproof attached\b/.test(b) };
}

/** "Liza joined" · "Liza was added to this chat by Ana" · "Liza left this chat" (migrations 20271330575424 · 20271330723629). */
export function memberLineOf(body: string | null | undefined): { name: string; verb: 'joined' | 'left' } | null {
  const b = (body ?? '').trim();
  let m = /^(.{1,60}?) (?:joined|was added to this chat by .{1,60})$/.exec(b);
  if (m) return { name: m[1]!, verb: 'joined' };
  m = /^(.{1,60}?) left this chat$/.exec(b);
  return m ? { name: m[1]!, verb: 'left' } : null;
}

const ACCESS_LINE = /^Access asked · /;

/** The kind of one row of the chat, or null for chatter. `filed` = the message sits under a pinned decision. */
export function chatKindOf(m: ChatKindRow, filed = false): ThreadKind | null {
  if (m.proposal_id || m.amendment_id || m.change_order_id || m.vendor_offer_id != null || m.offered_service_id) return 'money';
  if (m.appointment_id) return 'dates';
  const body = m.body ?? '';
  if (m.sender_role === 'system') {
    const line = streamLineKind(body);
    if (line === 'negotiate' || line === 'rise' || line === 'fall') return 'money';
    if (line === 'schedule') return 'dates';
    if (line) return 'decisions';
    if (paymentLineOf(body)) return 'money';
    if (ACCESS_LINE.test(body.trim())) return 'decisions';
    return filed ? 'decisions' : null;
  }
  if (formLineTitle(body)) return 'forms';
  if (!m.file_removed_at && (m.attachment_r2_key || m.attachment_url || m.attachment_name)) return 'files';
  return filed ? 'decisions' : null;
}

export type KindCounts = Record<ThreadKind, number>;

export function countKinds(rows: readonly ChatKindRow[], isFiled: (row: ChatKindRow) => boolean = () => false): KindCounts {
  const out: KindCounts = { decisions: 0, forms: 0, money: 0, dates: 0, files: 0 };
  for (const r of rows) {
    const k = chatKindOf(r, isFiled(r));
    if (k) out[k] += 1;
  }
  return out;
}

/** "Showing Money · 4 cards" — the one line over a filtered chat. */
export function filterLine(kind: ThreadKind, n: number): string {
  return `Showing ${KIND_LABEL[kind]} · ${n.toLocaleString('en-PH')} ${n === 1 ? 'card' : 'cards'}`;
}

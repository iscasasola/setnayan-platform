/**
 * ＋ THE CHAT'S (+) — what a person STARTS (Supplier Build 3 · lane B; DECISION_LOG 📌 2026-11-08).
 *
 * Owner: *"the (+) will add something on their chat which they can edit and fillup"* — a (+) row drops a card into the
 * chat that both sides fill one step at a time. *"We can only have 1 (+) at a time"* — while one card is open the (+) is
 * shut and tapping it jumps to it ("Finish or close: …"); the open card pins as **Running topic**.
 *
 * What the app can detect left the (+) for good — it pins by itself (`lib/chat-pins.ts`): Answer their booking ask ·
 * Confirm a payment · Your call time · Guest count changed. Won / lost is automatic on Details. Report a problem stays
 * as the LAST row on both sides (owner 9 Nov — one door, out of the ⋯).
 *
 * Each row names the card it drops (`card`) and the shipped FULL PAGE that is its other face (`door`) — the card is the
 * simplified face, the tab the complete one ("two faces of one record"). The doors are keys of `VENDOR_THREAD_TOOLS`
 * (supplier) so the reachability guard still sees every shipped panel reached.
 */
import type { ChatTopic } from './topic-icons';

export type PlusCardKind = 'quote' | 'payment' | 'meeting' | 'form' | 'photos' | 'decision' | 'logpay' | 'file';

export type PlusRow = {
  key: PlusCardKind | 'report';
  label: string;
  line: string;
  /** The card this row drops, or null for Report a problem (it is a page, not a card). */
  card: PlusCardKind | null;
  /** The shipped tool that is this card's full face (a `VENDOR_THREAD_TOOLS` key, or a host door). */
  door: string | null;
  /** Shut until they book you — drawn greyed with the reason, never hidden. */
  shutUntilAgreement?: { reason: string };
};

/** Supplier · and a coordinator with the hosts (they are the hosts' supplier). */
export function supplierPlusRows(opts: { paid: boolean }): PlusRow[] {
  return [
    {
      key: 'quote',
      label: opts.paid ? 'Change quote' : 'Quote',
      line: opts.paid ? 'A new version · the paid one is the floor' : 'From your card, send the total',
      card: 'quote',
      door: 'build-quote',
    },
    {
      key: 'payment',
      label: 'Payment',
      line: 'Ask for the next one now',
      card: 'payment',
      door: 'ask-payment',
      shutUntilAgreement: { reason: 'Opens once they book you' },
    },
    { key: 'meeting', label: 'Meeting', line: 'Name · date · time · how', card: 'meeting', door: 'deal-or-meeting' },
    {
      key: 'form',
      label: 'Form',
      line: 'A saved question set, answered one at a time',
      card: 'form',
      door: 'questions-for-couple',
      shutUntilAgreement: { reason: 'Opens once they book you' },
    },
    { key: 'photos', label: 'Photos & files', line: 'From your portfolio, or a file from your phone', card: 'photos', door: 'share-file' },
    { key: 'decision', label: 'Decision', line: 'Pin a topic until it is settled', card: 'decision', door: null },
    { key: 'report', label: 'Report a problem', line: 'This couple or this booking', card: null, door: 'report-problem' },
  ];
}

/** Host · and a coordinator with another supplier (who drops Log a payment — it is the hosts' money). */
export function hostPlusRows(opts: { canLogPayment: boolean }): PlusRow[] {
  const rows: PlusRow[] = [
    { key: 'meeting', label: 'Meeting', line: 'Name · date · time · how', card: 'meeting', door: 'deal-or-meeting' },
  ];
  if (opts.canLogPayment) {
    rows.push({ key: 'logpay', label: 'Log a payment', line: 'Paid outside: amount · method · reference · receipt', card: 'logpay', door: 'host-payments' });
  }
  rows.push(
    { key: 'file', label: 'File', line: 'Photo, video or document', card: 'file', door: 'share-file' },
    { key: 'decision', label: 'Decision', line: 'Pin a topic until it is settled', card: 'decision', door: null },
    { key: 'report', label: 'Report a problem', line: 'This supplier or this booking', card: null, door: 'host-report' },
  );
  return rows;
}

/** The card the (+) has open in this chat — a draft being filled, or a sent one awaiting its answer. */
export type RunningTopic = {
  key: string;
  card: PlusCardKind;
  title: string;
  /** Who opened it. The (+) is shut for its OPENER; the other side sees it pinned "from …". */
  by: 'you' | 'them';
  byName?: string;
  status: 'draft' | 'sent';
  /** The DOM id the pin jumps to. */
  anchorId: string;
};

/** The (+)'s gate: shut while the reader has a card open, with the words the tap shows. */
export function plusGate(running: RunningTopic | null): { shut: false } | { shut: true; message: string } {
  if (!running || running.by !== 'you') return { shut: false };
  return { shut: true, message: `Finish or close: ${running.title}` };
}

/** The title a card carries on its pin and head. */
export const PLUS_CARD_TITLE: Record<PlusCardKind, string> = {
  quote: 'Quote',
  payment: 'Payment',
  meeting: 'Meeting',
  form: 'Form',
  photos: 'Photos & files',
  decision: 'Decision',
  logpay: 'Log a payment',
  file: 'File',
};

/** The topic each card wears — its icon is `TOPIC_ICON[topic]`, the same as its tab's. */
export const PLUS_CARD_TOPIC: Record<PlusCardKind, ChatTopic> = {
  quote: 'quote',
  payment: 'payment',
  meeting: 'schedule',
  form: 'forms',
  photos: 'files',
  decision: 'decision',
  logpay: 'payment',
  file: 'files',
};

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
 *
 * 🧭 THE (+) FOLLOWS THE MENU (owner 11 Nov 2026, DECISION_LOG "THE PICKED-CLIENT MENU AND THE CHAT (+) FOLLOW ONE
 * ORDER" — *"Rearrange it as well as we rearrange the menu. Align them both."*). Every row belongs to ONE page of the
 * picked client (`PLUS_ROW_PAGE`), and the rows are listed in the menu's order — Chat · Details · Quotation · Payment ·
 * Forms · Schedule · Files · Report — so the sheet reads as the menu's mirror, each row under its tab's word.
 * `lib/chat-plus.test.ts` derives the expected order from `PICKED_CLIENT_PAGES` itself, so the two can never drift.
 *
 * 📷 The composer's Camera (and, for the host, Photo) are rows HERE, under Files, since the same ruling — before it the
 * sheet prepended them above every list, which put two phone pickers on the supplier's (+): "Photo — from your phone"
 * and "Photos & files — from your portfolio, or a file from your phone". The owner: *"The (+) has dupes?"* They are ONE
 * row now — Photos & files, "From your phone or your portfolio" — whose phone path is the composer's own picker (photo ·
 * video · PDF, in place; owner 9 Nov "upload opens the picker, not a page"). Camera stays: taking a picture NOW is a
 * different act from choosing one.
 */
import type { PickedClientPage } from './upcoming-schedule-door';
import type { ChatTopic } from './topic-icons';

export type PlusCardKind = 'quote' | 'payment' | 'meeting' | 'form' | 'photos' | 'decision' | 'logpay' | 'file' | 'access';

/** A row that opens one of the composer's own file inputs inside the tap (a phone only opens a picker from a gesture). */
export type PlusAttach = 'camera' | 'photo' | 'file';

export type PlusRowKey = PlusCardKind | 'report' | 'camera' | 'photo';

export type PlusRow = {
  key: PlusRowKey;
  label: string;
  line: string;
  /** The card this row drops, or null for a row that is not a card (Report a problem is a page; Camera is the picker). */
  card: PlusCardKind | null;
  /** The shipped tool that is this card's full face (a `VENDOR_THREAD_TOOLS` key, or a host door). */
  door: string | null;
  /** The composer input this row clicks instead of dropping a card (`CHAT_CAMERA_INPUT_ID` · `CHAT_PHOTO_INPUT_ID`). */
  attach?: PlusAttach;
  /** Shut until they book you — drawn greyed with the reason, never hidden. */
  shutUntilAgreement?: { reason: string };
};

/**
 * The picked client's page each (+) row belongs to — the tab whose word heads the row in the sheet, and the key the
 * guard sorts by. A Decision is a chat matter (its pin lives in the chat); Ask for access is about the event's Details
 * (seat plan · schedule · guest list); every file act is Files.
 */
export const PLUS_ROW_PAGE: Record<PlusRowKey, PickedClientPage> = {
  decision: 'chat',
  access: 'details',
  quote: 'quote',
  payment: 'payments',
  logpay: 'payments',
  form: 'forms',
  meeting: 'schedule',
  camera: 'files',
  photo: 'files',
  photos: 'files',
  file: 'files',
  report: 'report',
};

/** 📷 Take a photo or a video now — the composer's camera input, the same on both sides. */
const CAMERA_ROW: PlusRow = { key: 'camera', label: 'Camera', line: 'Take a photo or a video now', card: null, door: null, attach: 'camera' };

/**
 * Supplier · and a coordinator with the hosts (they are the hosts' supplier). In the menu's order (owner 11 Nov):
 * Decision (Chat) · Ask for access (Details) · Quote (Quotation) · Payment · Form (Forms) · Meeting (Schedule) ·
 * Camera · Photos & files (Files) · Report a problem (Report — LAST, owner 9 Nov).
 */
export function supplierPlusRows(opts: { paid: boolean }): PlusRow[] {
  return [
    { key: 'decision', label: 'Decision', line: 'Pin a topic until it is settled', card: 'decision', door: null },
    // 🔗 Every supplier and the coordinator (owner 8 Nov: "suppliers also get ask for access"). The shipped ask — booked
    // on this event, so it waits for the booking like Payment and Form; the host (or the coordinator) still answers.
    {
      key: 'access',
      label: 'Ask for access',
      line: 'Seat plan, schedule, guest list… · the host decides',
      card: 'access',
      door: null,
      shutUntilAgreement: { reason: 'Opens once they book you' },
    },
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
    {
      key: 'form',
      label: 'Form',
      line: 'A saved question set, answered one at a time',
      card: 'form',
      door: 'questions-for-couple',
      shutUntilAgreement: { reason: 'Opens once they book you' },
    },
    { key: 'meeting', label: 'Meeting', line: 'Name · date · time · how', card: 'meeting', door: 'deal-or-meeting' },
    CAMERA_ROW,
    // ONE phone picker (owner 11 Nov, "dupes"): the card's "From your phone" is the composer's own input — photo, video
    // or PDF — and its Portfolio source is drawn shut with its reason until the album build.
    { key: 'photos', label: 'Photos & files', line: 'From your phone or your portfolio', card: 'photos', door: 'share-file' },
    { key: 'report', label: 'Report a problem', line: 'This couple or this booking', card: null, door: 'report-problem' },
  ];
}

/**
 * Host · and a coordinator with another supplier (who drops Log a payment — it is the hosts' money). The same relative
 * order as the supplier's (+) AND the host's own picked-supplier menu (`picked-supplier-menu.ts`, re-ordered 11 Nov to
 * mirror the supplier's): Decision (Chat) · Log a payment (Payment) · Meeting (Schedule) · Camera · Photos & files (Files) ·
 * Report a problem (Report — last).
 *
 * 📷 ONE phone picker, as on the supplier's (+) (owner 11 Nov, *"The (+) has dupes?"*, built for the supplier in #7483,
 * mirrored here the same day — *"Clients side is not fixed also"*): "Photo — a photo or a video from your phone" and
 * "File — photo, video or document" both opened the phone's picker. ONE row now: **Photos & files — "From your phone · a photo, a
 * video or a document"**, whose card opens the composer's own picker (`CHAT_ATTACHMENT_ACCEPT`: photos, videos, PDFs
 * and documents — nothing the two old rows took is lost). Camera (take one NOW) stays: a different act.
 */
export function hostPlusRows(opts: { canLogPayment: boolean }): PlusRow[] {
  const rows: PlusRow[] = [{ key: 'decision', label: 'Decision', line: 'Pin a topic until it is settled', card: 'decision', door: null }];
  if (opts.canLogPayment) {
    rows.push({ key: 'logpay', label: 'Log a payment', line: 'Paid outside: amount · method · reference · receipt', card: 'logpay', door: 'host-payments' });
  }
  rows.push(
    { key: 'meeting', label: 'Meeting', line: 'Name · date · time · how', card: 'meeting', door: 'deal-or-meeting' },
    CAMERA_ROW,
    { key: 'file', label: 'Photos & files', line: 'From your phone · a photo, a video or a document', card: 'file', door: 'share-file' },
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
  file: 'Photos & files',
  access: 'Ask for access',
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
  access: 'access',
};

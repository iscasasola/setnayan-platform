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

export type PlusCardKind = 'quote' | 'payment' | 'meeting' | 'form' | 'photos' | 'decision' | 'poll' | 'logpay' | 'file' | 'access';

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
  /** Shut by the chat's own state right now (one open poll at a time) — drawn greyed with the reason, never hidden. */
  shutNow?: { reason: string };
};

/**
 * The picked client's page each (+) row belongs to — the tab whose word heads the row in the sheet, and the key the
 * guard sorts by. A Decision is a chat matter (its pin lives in the chat); Ask for access is about the event's Details
 * (seat plan · schedule · guest list); every file act is Files.
 */
export const PLUS_ROW_PAGE: Record<PlusRowKey, PickedClientPage> = {
  decision: 'chat',
  poll: 'chat',
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

/**
 * 🗳 ONE OPEN POLL PER CHAT (owner 11 Nov 2026, DECISION_LOG "CHAT POLLS — ONE PER CHAT"): while a poll is open the Poll
 * row (and `/poll`) is drawn greyed with this reason; the database holds the same rule (`chat_polls_one_open_per_thread`).
 * A SENT poll never keeps the (+) shut — only its draft does (the 8 Nov one-(+)-card rule).
 */
export const ONE_POLL_REASON = 'One poll at a time · close the open one first';

/** The Poll row — under Chat, right after Decision, on both sides (the host's chat mirrors the supplier's, 8 Nov 🪞). */
function pollRow(pollOpen: boolean | undefined): PlusRow {
  return {
    key: 'poll',
    label: 'Poll',
    line: 'Ask both sides to pick',
    card: 'poll',
    door: null,
    ...(pollOpen ? { shutNow: { reason: ONE_POLL_REASON } } : {}),
  };
}

/** 📷 Take a photo or a video now — the composer's camera input, the same on both sides. */
const CAMERA_ROW: PlusRow = { key: 'camera', label: 'Camera', line: 'Take a photo or a video now', card: null, door: null, attach: 'camera' };

/**
 * Supplier · and a coordinator with the hosts (they are the hosts' supplier). In the menu's order (owner 11 Nov):
 * Decision (Chat) · Ask for access (Details) · Quote (Quotation) · Payment · Form (Forms) · Meeting (Schedule) ·
 * Camera · Photos & files (Files) · Report a problem (Report — LAST, owner 9 Nov).
 */
export function supplierPlusRows(opts: { paid: boolean; pollOpen?: boolean }): PlusRow[] {
  return [
    { key: 'decision', label: 'Decision', line: 'Pin a topic until it is settled', card: 'decision', door: null },
    pollRow(opts.pollOpen),
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
 * order as the supplier's (+): Decision (Chat) · Log a payment (Payment) · Meeting (Schedule) · Camera · Photo · File
 * (Files) · Report a problem (last). The rows are the ones the host already had — none added, none removed (11 Nov).
 */
export function hostPlusRows(opts: { canLogPayment: boolean; pollOpen?: boolean }): PlusRow[] {
  const rows: PlusRow[] = [
    { key: 'decision', label: 'Decision', line: 'Pin a topic until it is settled', card: 'decision', door: null },
    pollRow(opts.pollOpen),
  ];
  if (opts.canLogPayment) {
    rows.push({ key: 'logpay', label: 'Log a payment', line: 'Paid outside: amount · method · reference · receipt', card: 'logpay', door: 'host-payments' });
  }
  rows.push(
    { key: 'meeting', label: 'Meeting', line: 'Name · date · time · how', card: 'meeting', door: 'deal-or-meeting' },
    CAMERA_ROW,
    { key: 'photo', label: 'Photo', line: 'A photo or a video from your phone', card: null, door: null, attach: 'photo' },
    { key: 'file', label: 'File', line: 'Photo, video or document', card: 'file', door: 'share-file' },
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
  poll: 'Poll',
  logpay: 'Log a payment',
  file: 'File',
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
  poll: 'poll',
  logpay: 'payment',
  file: 'files',
  access: 'access',
};

// ── ⌨ SLASH SHORTCUTS (owner 11 Nov 2026, DECISION_LOG "… SLASH SHORTCUTS"; plan row M14) ──────────────────────────────
// "/" as the FIRST character raises a list above the composer: the SAME rows, words and lines as the (+) — derived from
// the rows handed in (`supplierPlusRows()` / `hostPlusRows()`), never a second list — filtered as typed. Greyed rows stay
// in the list with their reason and are never picked by Enter. Picking drops the very card the (+) row drops.

/** The word each card answers to after "/" (M14's /quote /payment /form /access /file + /meeting /decision /poll). */
export const SLASH_WORD: Record<PlusCardKind, string> = {
  decision: 'decision',
  poll: 'poll',
  access: 'access',
  quote: 'quote',
  payment: 'payment',
  logpay: 'payment',
  form: 'form',
  meeting: 'meeting',
  photos: 'file',
  file: 'file',
};

export type SlashRow = {
  key: PlusRowKey;
  word: string;
  label: string;
  line: string;
  card: PlusCardKind;
  /** Drawn greyed with this reason; Enter never picks it. */
  shut: { reason: string } | null;
};

/** What is typed after the "/" while the list is up, or null (no leading "/", or a space or line break already typed). */
export function slashQuery(text: string): string | null {
  if (!text.startsWith('/')) return null;
  const q = text.slice(1);
  return /\s/.test(q) ? null : q.toLowerCase();
}

/**
 * The slash list for these (+) rows, in the (+)'s order: every row that drops a card, with the reason a row is shut
 * (the agreement gate unless `hasAgreement`, and the row's own `shutNow`).
 */
export function slashRows(rows: readonly PlusRow[], hasAgreement: boolean): SlashRow[] {
  const out: SlashRow[] = [];
  for (const r of rows) {
    if (!r.card) continue;
    const shut = r.shutNow ?? (r.shutUntilAgreement && !hasAgreement ? r.shutUntilAgreement : null);
    out.push({ key: r.key, word: SLASH_WORD[r.card], label: r.label, line: r.line, card: r.card, shut });
  }
  return out;
}

/** Rows whose word, or a word of whose label, starts with the query ("/p" → Poll · Payment · Photos & files). */
export function filterSlash(rows: readonly SlashRow[], q: string): SlashRow[] {
  const query = q.trim().toLowerCase();
  if (!query) return [...rows];
  return rows.filter(
    (r) => r.word.startsWith(query) || r.label.toLowerCase().split(/[^a-z]+/).some((w) => w && w.startsWith(query)),
  );
}

/** Enter on the highlighted row: the card to drop, or null when that row is shut (or nothing is highlighted). */
export function slashPick(rows: readonly SlashRow[], index: number): PlusCardKind | null {
  const r = rows[index];
  return r && !r.shut ? r.card : null;
}

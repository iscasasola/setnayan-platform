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
 * 💬 SINCE 19 NOV 2026 THE SUPPLIER'S SHEET IS GROUPED BY PLAIN WORDS, NOT TABS (`PLUS_ROW_SECTION`, below): the
 * supplier's client page is one chat with no tab row. What follows is the HOST's rule, unchanged until its own build.
 *
 * 🧭 THE (+) FOLLOWS THE MENU (owner 11 Nov 2026, DECISION_LOG "THE PICKED-CLIENT MENU AND THE CHAT (+) FOLLOW ONE
 * ORDER" — *"Rearrange it as well as we rearrange the menu. Align them both."*). Every row belongs to ONE page of the
 * picked client (`PLUS_ROW_PAGE`), and the rows are listed in the menu's order — since the seven tabs (owner 18 Nov 2026)
 * Chat · Details · Book & Budget · Schedule · Files · Report — so the sheet reads as the menu's mirror, each row under its
 * tab's word. Form went under Details (Forms is a part of Details now) and Payment under Book & Budget.
 * `lib/chat-plus.test.ts` derives the expected order from `PICKED_CLIENT_PAGES` itself, so the two can never drift.
 *
 * 📷 The composer's Camera (and, for the host, Photo) are rows HERE, under Files, since the same ruling — before it the
 * sheet prepended them above every list, which put two phone pickers on the supplier's (+): "Photo — from your phone"
 * and "Photos & files — from your portfolio, or a file from your phone". The owner: *"The (+) has dupes?"* They are ONE
 * row now — Photos & files, "From your phone or your portfolio" — whose phone path is the composer's own picker (photo ·
 * video · PDF, in place; owner 9 Nov "upload opens the picker, not a page"). Camera stays: taking a picture NOW is a
 * different act from choosing one.
 *
 * 🧰 SINCE 20 NOV 2026 — UNICHAT PART B (owner, on the approved live drawing `UNICHAT-LIVE-2026-11-19.html`: *"build it
 * now, I am happy with the design"*; build plan `UNICHAT-BUILD-PLAN-2026-11-20.md`, conflicts 1 and 2 settled by that
 * approval). Three things the approved drawing changes here, each superseding the earlier ruling it names:
 *   1. SEVERAL (+) CARDS MAY BE OPEN AT ONCE (supersedes the 8 Nov "We can only have 1 (+) at a time"). A card you sent
 *      that still waits for its answer no longer shuts the (+): `plusGate` never shuts. The tool being filled lives
 *      INSIDE THE TEXT BOX (＋ turns into ←), so there is one editor at a time by construction, not by a gate.
 *   2. THE (+) HOLDS ONLY THINGS YOU SEND — no row lives in both the (+) and the ⋯ menu or the pinned strip. "Report a
 *      problem" left for the ⋯ (supersedes the 9 Nov "one door, out of the ⋯"); "See every version" left too (it is
 *      the strip's Deal box and the quote card's own row — a place to go, not a thing you send).
 *   3. A TYPED PRICE OR DAY OFFERS ITS TOOL (`typedOffer`, below) — the box says "Make this a counter, ₱38,000?".
 */
import type { PickedClientPage } from './upcoming-schedule-door';
import type { ChatTopic } from './topic-icons';
import { SHARE_ROW_LABEL, SHARE_ROW_LINE } from './chat-tool-share';

export type PlusCardKind =
  | 'quote'
  | 'payment'
  | 'meeting'
  | 'form'
  | 'photos'
  | 'decision'
  | 'poll'
  | 'logpay'
  | 'file'
  | 'access'
  // 🤝 Negotiate (Piece 1 · PR-3, approved design 12 Nov): the hosts' Ask for a change and Counter with a price, and a
  // payment plan either side proposes — each answered by the other side with Accept · Counter · Decline.
  | 'ask'
  | 'counter'
  | 'plan'
  // 🏷 Drop an offer (PR-4's card, reachable since 19 Nov 2026): the supplier drops one of the shop's own offers; the
  // hosts apply it to their quote with one tap.
  | 'offer';

/** A row that opens one of the composer's own file inputs inside the tap (a phone only opens a picker from a gesture). */
export type PlusAttach = 'camera' | 'photo' | 'file';

export type PlusRowKey = PlusCardKind | 'camera' | 'photo' | 'report' | 'versions' | 'share';
// ('offer' is a card kind, so it is a row key too. 'versions' left on 20 Nov 2026 and Report a problem moved to the ⋯
// (part G, `picked-client-more.ts`); the (+) holds only things you send.)

/**
 * 🤝 THE NEGOTIATE GROUP — FIRST IN BOTH (+) MENUS (approved design `quote-maker-polish.html`, 12 Nov: the (+) shows
 * Negotiate + the first page group). Not a page of the picked client's menu: it is the one group ABOVE the menu's
 * mirror, so the rows under it are the money moves of this chat, whichever page they belong to.
 */
export const NEGOTIATE_GROUP = 'negotiate' as const;
export type PlusGroup = PickedClientPage | typeof NEGOTIATE_GROUP;


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
  /** ＋ FINAL (21 Nov): the tile spans both columns — the first tile, and the last when it would sit alone. */
  wide?: boolean;
  /** ＋ FINAL: Every version — a place to go (the chat's versions sheet), not a card. */
  opensVersions?: boolean;
  /** ＋ FINAL: the host's tray is two jobs, headed by their own words — Ask · Share. */
  tray?: PlusTrayGroup;
  /**
   * 🧰 Share from your tools (DECISION_LOG 2026-11-23, specs dee66686): the row opens the tray's second level — the
   * picker of the tools this shop has (`lib/chat-tool-share-held.ts`) — and each pick posts its card. Not a card itself.
   */
  opensTools?: boolean;
  /** The drawing's "New" mark beside the row's name. */
  isNew?: boolean;
};

/** ＋ FINAL (owner 21 Nov, "CHAT ＋ FINAL — APPROVED"): the host's two jobs, and their words. */
export type PlusTrayGroup = 'ask' | 'share';
export const PLUS_TRAY_WORD: Record<PlusTrayGroup, string> = { ask: 'Ask', share: 'Share' };

/** ＋ FINAL: a tool that waits for booking — a normal tile, dimmed, a lock, and these words under its name. */
export const AFTER_BOOKING = 'After booking';
/** ＋ FINAL: an unverified shop — every tile locked, the fix said once at the top of the tray. */
export const PLUS_TRAY_UNVERIFIED = 'Chat tools open once your shop is verified.';
export const PLUS_TRAY_UNVERIFIED_CTA = 'Get verified';
export const PLUS_TRAY_VERIFY_HREF = '/vendor-dashboard/verify';
/** Every version over no quote yet: there is no history to open. */
export const NO_VERSIONS_YET = 'After your first quote';

/**
 * ＋ FINAL — TWO TILES PER ROW, FIXED PLACES (owner 21 Nov). The first tile is full width; so is the last when it
 * would sit alone (the drawing's own rule). Places never move with the deal: booking only lifts locks.
 */
export function withTrayWidths(rows: PlusRow[], lastToo = true): PlusRow[] {
  return rows.map((r, i) => {
    const wide = i === 0 || (lastToo && i === rows.length - 1 && (rows.length - 1) % 2 === 1);
    return wide ? { ...r, wide: true } : r;
  });
}

/**
 * The picked client's page each (+) row belongs to — the tab whose word heads the row in the sheet, and the key the
 * guard sorts by. A Decision is a chat matter (its pin lives in the chat); Ask for access is about the event's Details
 * (seat plan · schedule · guest list); every file act is Files.
 */
export const PLUS_ROW_PAGE: Record<PlusRowKey, PlusGroup> = {
  // 🤝 Negotiate — first on both sides (12 Nov). Change quote moved here from Quotation.
  quote: NEGOTIATE_GROUP,
  ask: NEGOTIATE_GROUP,
  counter: NEGOTIATE_GROUP,
  plan: NEGOTIATE_GROUP,
  offer: NEGOTIATE_GROUP,
  decision: 'chat',
  poll: 'chat',
  access: 'details',
  form: 'details',
  payment: 'quote',
  logpay: 'quote',
  meeting: 'schedule',
  camera: 'files',
  photo: 'files',
  photos: 'files',
  file: 'files',
  report: 'report',
  versions: NEGOTIATE_GROUP,
  share: 'files',
};

/**
 * 💬 THE SUPPLIER'S (+) HAS PLAIN GROUP WORDS (owner 19 Nov 2026, DECISION_LOG "THE CLIENT PAGE IS ONE CHAT THAT HOLDS
 * EVERYTHING"; drawing S9ScH2Ps v3, screen 6). The supplier's client page has no tab row any more, so a heading named
 * after a tab ("Book & Budget", "Schedule") names nothing. The groups are the chips' own words — Negotiate · Ask &
 * decide · Money · Dates · Files. Report a problem lives under the head's ⋯ (part G).
 * The HOST's (+) still mirrors the host's seven tabs (`PLUS_ROW_PAGE`) until the host's own build.
 */
export type PlusSection = 'negotiate' | 'ask' | 'money' | 'dates' | 'files' | 'report';

/** The supplier's groups, in the order their tiles are drawn. */
export const PLUS_SECTIONS: readonly PlusSection[] = ['negotiate', 'ask', 'money', 'dates', 'files', 'report'];

/** The word of each group; null = a bare line (Report a problem stands alone, last). */
export const PLUS_SECTION_WORD: Record<PlusSection, string | null> = {
  negotiate: 'Negotiate',
  ask: 'Ask & decide',
  money: 'Money',
  dates: 'Dates',
  files: 'Files',
  report: null,
};

export const PLUS_ROW_SECTION: Record<PlusRowKey, PlusSection> = {
  quote: 'negotiate',
  offer: 'negotiate',
  ask: 'negotiate',
  counter: 'negotiate',
  plan: 'negotiate',
  decision: 'ask',
  poll: 'ask',
  form: 'ask',
  access: 'ask',
  payment: 'money',
  logpay: 'money',
  meeting: 'dates',
  camera: 'files',
  photo: 'files',
  photos: 'files',
  file: 'files',
  report: 'report',
  versions: 'negotiate',
  share: 'files',
};

/**
 * 🗳 ONE OPEN POLL PER CHAT (owner 11 Nov 2026, DECISION_LOG "CHAT POLLS — ONE PER CHAT"): while a poll is open the Poll
 * row (and `/poll`) is drawn greyed with this reason; the database holds the same rule (`chat_polls_one_open_per_thread`).
 * A SENT poll never keeps the (+) shut — only its draft does (the 8 Nov one-(+)-card rule).
 */
/**
 * ⤴ The drafts that RISE FULL SCREEN instead of filling a card at the foot of the chat (DECISION_LOG 2026-11-16 CHAT-09):
 * the poll and the decision. Their card draws itself through `RiseScreen` (`ChatStepCard`'s `rise`); the openers do not
 * scroll the chat to them, and the stream hides its jump row while one is up.
 */
export const RISING_DRAFTS: ReadonlySet<PlusCardKind> = new Set<PlusCardKind>(['poll', 'decision']);

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

/** The shipped builder's own name (`VENDOR_THREAD_TOOLS` build-quote) — "Full quotation" in the Make a quote card. */
export const SEND_A_QUOTE_LABEL = 'Send a quote';

/**
 * 🧾 Before any quote, the supplier's first Negotiate row (cut 7, 2026-11-14): a CARD in the chat — pick cards, the
 * offer, Good until (filled, 14 days), a note — that lands as the shipped quote card. Its Full quotation opens the
 * builder. It was a door straight to the builder (walk 13 Nov), which left the chat for ~8 taps.
 */
export const MAKE_A_QUOTE_LABEL = 'Make a quote';

/**
 * 🔒 WHERE A CHANGE AFTER BOOKING GOES (CHAT-19, walk 16 Nov 2026) — the supplier's SHIPPED change orders: the Change
 * orders card on the picked client's Schedule (`vendorRaiseChangeOrder`, "Propose a change"). The same href the (+)'s
 * other Schedule door uses (`linkHref` 'client-schedule'), so a locked quote card names a door that exists.
 */
export function supplierChangeOrderHref(eventId: string): string {
  return `/vendor-dashboard/clients/${eventId}?tab=schedule`;
}

/** 🏷 The supplier's Negotiate row that drops one of the shop's own offers (drawing S9ScH2Ps v3, screen 6). */
export const DROP_AN_OFFER_LABEL = 'Drop an offer';

/** 📷 Take a photo or a video now — the composer's camera input, the same on both sides. */

/** 🔒 CHAT-19: a booked quote is not re-quoted — the problem and the way forward, on the shut row. */
const CAMERA_ROW: PlusRow = { key: 'camera', label: 'Camera', line: 'Take a photo or a video now', card: null, door: null, attach: 'camera' };

export const BOOKED_CHANGE_QUOTE_REASON = 'Booked at this quote · propose a change order on their Schedule';
export const BOOKED_COUNTER_REASON = 'Booked at this quote · ask for a change order in Details';

/**
 * Supplier · and a coordinator with the hosts (they are the hosts' supplier). NEGOTIATE first (12 Nov): Change quote ·
 * Propose a payment plan · See every version; then the menu's order (seven tabs, 18 Nov): Decision · Poll (Chat) · Ask
 * for access · Form (Details) · Payment (Book & Budget) · Meeting (Schedule) · Camera · Photos & files (Files). Report a
 * problem lives under ⋯ (part G); See every version left on 20 Nov 2026.
 */
export function supplierPlusRows(opts: {
  paid: boolean;
  pollOpen?: boolean;
  /**
   * 🧾 Is there a quote in this chat yet — the SAME rung the composer's 🧾 reads (`dealEntryFor` · `threadHasQuote`).
   * `false` (walk 13 Nov 2026): the first row is "Send a quote", a DOOR to the shipped builder (`#build-quote`), and
   * "See every version" is not drawn — "Change quote" over no quote dropped a card that said "No quote in this chat
   * yet" with no way forward, and pinned an empty "Running topic". Omitted = a quote exists (the earlier behaviour).
   */
  hasQuote?: boolean;
  /**
   * 🔒 CHAT-19 (walk 16 Nov 2026): they booked you at the accepted quote (`THREAD_STAGE_HAS_AGREEMENT`, the same fact
   * that opens Payment · Form · Ask for access). The shipped S5 gate (`vendor_may_requote` → 'deal_locked') refuses a
   * new version then, so "Change quote" is drawn SHUT with its reason (owner lock rule, controller audit 16 Nov: locked
   * with the problem and its way forward, never hidden). A change after booking is a change order
   * (`supplierChangeOrderHref`).
   */
  booked?: boolean;
  /**
   * 🪪 ＋ FINAL: `false` = the shop is not verified — every tile is drawn locked and the tray says the fix once (the
   * server refuses each send too, `lib/shop-plus-gate.server.ts`). `null`/omitted = unknown or verified: drawn open; the
   * server still has the final say.
   */
  verified?: boolean | null;
}): PlusRow[] {
  const noQuoteYet = opts.hasQuote === false;
  const lockedAtBooking = !noQuoteYet && opts.booked === true;
  const afterBooking = { shutUntilAgreement: { reason: AFTER_BOOKING } };
  // ✅ ＋ FINAL (owner 21 Nov, frozen drawing `chat_plus_final_v1_fable.html`): ONE tray, fixed places, in the deal's
  // order — the quote first and full width · money · time and files · questions · the tools that wait for booking ·
  // the quote's history last.
  // ⚠ KEPT, NOT REMOVED: the drawing draws neither Drop an offer nor Camera, and it lists no removal — so both stay, in
  // fixed places by the same order (an offer is a quote move; Camera sits with Photos & files), pending the controller's
  // call. Drop an offer is drawn in its place even before a quote, shut with its reason — places never move by stage.
  // ⏳ Partner card (drawn just before Every version) is not drawn until its card is built — never a
  // dead tile.
  const rows: PlusRow[] = [
    noQuoteYet
      ? // 🧾 Make a quote (cut 7, 2026-11-14): the short card in the chat — your cards, an offer, Good until 14 days.
        ({ key: 'quote', label: MAKE_A_QUOTE_LABEL, line: 'Your service cards and offers go in here', card: 'quote', door: 'build-quote' } as PlusRow)
      : ({
          key: 'quote',
          label: 'Change quote',
          line: opts.paid ? 'A new version · the paid one is the floor' : 'Your service cards and offers go in here',
          card: 'quote',
          door: 'build-quote',
          ...(lockedAtBooking ? { shutNow: { reason: BOOKED_CHANGE_QUOTE_REASON } } : {}),
        } as PlusRow),
    {
      key: 'offer',
      label: DROP_AN_OFFER_LABEL,
      line: 'They apply it with one tap',
      card: 'offer',
      door: null,
      ...(noQuoteYet ? { shutNow: { reason: NO_VERSIONS_YET } } : lockedAtBooking ? { shutNow: { reason: BOOKED_CHANGE_QUOTE_REASON } } : {}),
    },
    { key: 'plan', label: 'Payment plan', line: 'Split the total into dated parts', card: 'plan', door: null },
    { key: 'payment', label: 'Ask for a payment', line: 'Request one part of the plan', card: 'payment', door: 'ask-payment', ...afterBooking },
    { key: 'meeting', label: 'Dates & times', line: 'A meeting, a call, a time on the day', card: 'meeting', door: 'deal-or-meeting' },
    // ONE phone picker (owner 11 Nov, "dupes"): the card's "From your phone" is the composer's own input — photo, video
    // or PDF — and its Portfolio source is drawn shut with its reason until the album build.
    { key: 'photos', label: 'Photos & files', line: 'Upload pictures, plans, contracts', card: 'photos', door: 'share-file' },
    CAMERA_ROW,
    { key: 'decision', label: 'Decision', line: 'One question, one clear answer', card: 'decision', door: null },
    pollRow(opts.pollOpen),
    { key: 'form', label: 'Form', line: 'Collect details you need for the day', card: 'form', door: 'questions-for-couple', ...afterBooking },
    // ➖ "Ask for access" LEFT the ＋ (owner 21 Nov, DECISION_LOG "NO 'ASK FOR ACCESS' TILE ON THE CHAT ＋" — the row AFTER
    // "CHAT ＋ FINAL", and it names the final tray: *"this means we do not need access request on +"*). Asking lives in
    // ONE place: the "Their event" list's last row, "Ask for access to more" (lib/their-event.ts).
    // 🧰 Share from your tools (owner 23 Nov, "Yes, add it" — DECISION_LOG dee66686; drawing frame 7): the picker of the
    // planning tools this shop has. Always drawn in its place; a shop with none is told so in the picker, never hidden.
    { key: 'share', label: SHARE_ROW_LABEL, line: SHARE_ROW_LINE, card: null, door: null, opensTools: true, isNew: true },
    {
      key: 'versions',
      label: 'Every version',
      line: "The quote's full history",
      card: null,
      door: null,
      opensVersions: true,
      ...(noQuoteYet ? { shutNow: { reason: NO_VERSIONS_YET } } : {}),
    },
  ];
  return withTrayWidths(opts.verified === false ? rows.map(lockForVerification) : rows);
}

/** 🪪 An unverified shop: every tile locked. The tile shows only its lock; the tray says the fix once. */
function lockForVerification(r: PlusRow): PlusRow {
  return { ...r, shutNow: { reason: PLUS_TRAY_UNVERIFIED } };
}

/**
 * Host · and a coordinator with another supplier (who drops Log a payment — it is the hosts' money). The same relative
 * order as the supplier's (+) AND the host's own picked-supplier menu (`picked-supplier-menu.ts`, re-ordered 11 Nov to
 * mirror the supplier's; seven tabs 18 Nov): Decision (Chat) · Log a payment (Book & Budget) · Meeting (Schedule) · Camera · Photos & files (Files).
 * Report a problem lives under ⋯ (part G).
 *
 * 📷 ONE phone picker, as on the supplier's (+) (owner 11 Nov, *"The (+) has dupes?"*, built for the supplier in #7483,
 * mirrored here the same day — *"Clients side is not fixed also"*): "Photo — a photo or a video from your phone" and
 * "File — photo, video or document" both opened the phone's picker. ONE row now: **Photos & files — "From your phone · a photo, a
 * video or a document"**, whose card opens the composer's own picker (`CHAT_ATTACHMENT_ACCEPT`: photos, videos, PDFs
 * and documents — nothing the two old rows took is lost). Camera (take one NOW) stays: a different act.
 */
export function hostPlusRows(opts: {
  canLogPayment: boolean;
  pollOpen?: boolean;
  /**
   * 🔒 CHAT-19 (walk 16 Nov 2026): the supplier is booked at the accepted quote. A counter would ask for a new version
   * the supplier's own gate refuses ('deal_locked'), so "Counter with a price" is drawn SHUT with its reason (never
   * hidden); a change after booking is a change order (Details' Change orders on the picked supplier).
   */
  booked?: boolean;
}): PlusRow[] {
  // ✅ ＋ FINAL (owner 21 Nov): the host's ＋ is two jobs, ASK the shop for something and SHARE something of yours —
  // not the supplier's money-first set. Counter is the first ask and sits where the supplier's Change quote sits.
  // Controller call (DECISION_LOG, 21 Nov): Every version is NOT on the host ＋ — hosts reach it from the quote card.
  // ⏳ Event detail (the first Share tile) is not drawn until its pick step and card are built — never a dead tile.
  // ✋ NO GENERIC "Ask for a change" ROW (owner, ruling 6076): an ask STARTS FROM THE PART being changed (`AskChangeDoor`).
  const ask: PlusRow[] = [
    {
      key: 'counter',
      label: 'Counter',
      line: 'Answer their quote with your own number',
      card: 'counter',
      door: null,
      ...(opts.booked ? { shutNow: { reason: BOOKED_COUNTER_REASON } } : {}),
    },
    { key: 'plan', label: 'Payment plan', line: 'Split the total into dated parts', card: 'plan', door: null },
    { key: 'meeting', label: 'Dates & times', line: 'A meeting, a call, a time on the day', card: 'meeting', door: 'deal-or-meeting' },
    { key: 'decision', label: 'Decision', line: 'One question, one clear answer', card: 'decision', door: null },
    pollRow(opts.pollOpen),
  ];
  const share: PlusRow[] = [
    { key: 'file', label: 'Photos & files', line: 'Upload pictures, plans, contracts', card: 'file', door: 'share-file' },
    CAMERA_ROW,
  ];
  // Only hosts log their own money; a coordinator for the hosts drops it (nothing to unlock, nothing to show).
  if (opts.canLogPayment) {
    share.push({ key: 'logpay', label: 'Log a payment', line: 'Record money you have paid', card: 'logpay', door: 'host-payments', shutUntilAgreement: { reason: AFTER_BOOKING } });
  }
  return [
    ...withTrayWidths(ask, false).map((r) => ({ ...r, tray: 'ask' as const })),
    ...share.map((r) => ({ ...r, tray: 'share' as const })),
  ];
}

/**
 * 💬 A GROUP'S (+) AND "/" (owner, 12 Nov — "EVENT GROUP CHATS APPROVED AS DRAWN" (2)): Decision · Poll · Meeting ·
 * Photos & files ONLY. Quote · Payment · Form never appear in a group — the sheet's last row says where they live (each
 * supplier's own chat), drawn quiet and not pressable, so it is never a door. The database refuses a money card on a
 * group line too (`chat_messages_group_rules`, migration 20271340374819).
 *
 * ⚠ Meeting and Photos & files are drawn SHUT in a group for now, with their reason: a meeting card is booked with ONE
 * supplier (`event_appointments` names a shop) and the chat-file upload checks a supplier conversation — neither has a
 * group door yet. Never a dead Send; the row says why.
 */
export const GROUP_NOT_YET_REASON = 'Not open in group chats yet';
export const GROUP_MONEY_ROW_LABEL = 'Quote · Payment · Form';
export const GROUP_MONEY_ROW_REASON = 'In each supplier’s own chat — never in a group';

export function groupPlusRows(opts: { pollOpen?: boolean }): PlusRow[] {
  return [
    { key: 'decision', label: 'Decision', line: 'Pin a topic until it is settled', card: 'decision', door: null },
    { ...pollRow(opts.pollOpen), line: 'Everyone in the group picks' },
    { key: 'meeting', label: 'Meeting', line: 'Name · date · time · how', card: 'meeting', door: null, shutNow: { reason: GROUP_NOT_YET_REASON } },
    { key: 'file', label: 'Photos & files', line: 'A photo, a video or a document', card: 'file', door: null, shutNow: { reason: GROUP_NOT_YET_REASON } },
    // The pointer, never a door: no card, no door, always shut — its reason is where the money lives.
    { key: 'quote', label: GROUP_MONEY_ROW_LABEL, line: GROUP_MONEY_ROW_REASON, card: null, door: null, shutNow: { reason: GROUP_MONEY_ROW_REASON } },
  ];
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

/**
 * The (+)'s gate. SINCE 20 NOV 2026 IT NEVER SHUTS (owner, approving the live drawing — it supersedes the 8 Nov "one (+)
 * at a time"): several cards may be open at once, so a card you sent that still waits for its answer does not stop the
 * next one. The tool being filled sits inside the text box, where the ＋ is a ← (one editor, by construction). The
 * function and its shape stay, so every caller keeps asking in one place and a later ruling has one line to change.
 */
export function plusGate(_running: RunningTopic | null): { shut: false } | { shut: true; message: string } {
  return { shut: false };
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
  file: 'Photos & files',
  access: 'Ask for access',
  ask: 'Ask for a change',
  counter: 'Counter with a price',
  plan: 'Propose a payment plan',
  offer: 'Drop an offer',
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
  ask: 'quote',
  counter: 'payment',
  plan: 'payment',
  offer: 'quote',
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
  ask: 'ask',
  counter: 'counter',
  plan: 'plan',
  offer: 'offer',
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

/**
 * The slash list from rows as the (+) sheet DRAWS them (its `shut` already decided, the couple's Meeting gate included) —
 * the composer's list is published from here, so the two can never disagree.
 */
export function sheetSlashRows(
  rows: readonly { key: string; label: string; line: string; card?: PlusCardKind | null; shut: { reason: string } | null }[],
): SlashRow[] {
  const out: SlashRow[] = [];
  for (const r of rows) {
    if (!r.card) continue;
    out.push({ key: r.key as PlusRowKey, word: SLASH_WORD[r.card], label: r.label, line: r.line, card: r.card, shut: r.shut });
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

// ── 💬 A TYPED PRICE OR DAY OFFERS ITS TOOL (Unichat part B, 20 Nov 2026; drawing `offerFor`) ─────────────────────────────
// "Can you do ₱38,000?" → the box offers Counter (a host) or the quote (the supplier). "Fri 27 Nov" → it offers Meeting.
// The offer names a card the (+) ALREADY has for this reader, as the (+) draws it now: a row that is absent or shut is
// never offered (one rule for the (+), the "/" list and this). It only opens the tool — it never sends anything.

/** ₱ then a real amount: 1,000 or more with its commas, or four digits and up. A bare "₱50" is talk, not a price. */
const TYPED_PRICE = /₱\s?(\d{1,3}(?:,\d{3})+|\d{4,})/;
/** "Fri 27 Nov" · "Friday 27 November" · "27 Nov" — a day and a month, the way people type one here. */
const TYPED_DAY =
  /\b((?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s+\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\b/i;

export type TypedOffer = {
  card: PlusCardKind;
  /** The words before the figure: "Make this a counter," · "Set a meeting,". */
  lead: string;
  /** The figure itself, drawn bold: "₱38,000" · "Fri 27 Nov". */
  figure: string;
  /** The button — the (+) row's own label. */
  button: string;
};

/**
 * What the typed words offer, or null. `rows` is the "/" list the (+) on this chat published (`sheetSlashRows`): the
 * money card is the first of counter (the hosts never edit a price) or quote (the supplier's) that is there and open.
 * A price wins over a day when both are typed.
 */
export function typedOffer(text: string, rows: readonly SlashRow[]): TypedOffer | null {
  const open = (card: PlusCardKind) => rows.find((r) => r.card === card && !r.shut) ?? null;
  const price = TYPED_PRICE.exec(text);
  if (price) {
    const figure = `₱${Number(price[1]!.replace(/,/g, '')).toLocaleString('en-PH')}`;
    const counter = open('counter');
    if (counter) return { card: 'counter', lead: 'Make this a counter,', figure, button: counter.label };
    const quote = open('quote');
    if (quote) return { card: 'quote', lead: 'Make this a new quote,', figure, button: quote.label };
    return null;
  }
  const day = TYPED_DAY.exec(text);
  if (day) {
    const meeting = open('meeting');
    if (meeting) return { card: 'meeting', lead: 'Set a meeting,', figure: day[1]!.replace(/\s+/g, ' '), button: meeting.label };
  }
  return null;
}

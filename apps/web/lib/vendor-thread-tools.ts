/**
 * THE SUPPLIER'S TOOLS ON ONE CONVERSATION — named once, in one list.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * Owner, 2026-09-08, looking at the thread screen: *"still messy chatbox"* and
 * *"the right most can be the tools"*. Six panels used to sit BETWEEN the last
 * message and the text box, so the conversation rendered as a sliver and on a
 * phone was pushed off screen entirely.
 *
 * The panels now mount ONCE, closed, above the message stream
 * (`VENDOR_THREAD_PANELS`), and ONE list of LAUNCHERS opens them
 * (`VENDOR_THREAD_TOOLS`) — since 2026-10-14 the ＋ Tools sheet beside the
 * message field (it was the customer rail's right column).
 *
 * 🔑 THE TWO LISTS ARE HERE TOGETHER ON PURPOSE. A launcher naming a panel that
 * does not exist is silent — it scrolls to nothing and reads as a button that
 * does nothing, which is the exact failure this repo keeps producing (a refused
 * or missing thing rendered as an empty one). `lib/the-thread-tools-open-what-
 * they-name.test.ts` fails when a launcher names something the page does not
 * render, and when a panel no launcher can reach.
 *
 * 🔑 THE SHEET HOLDS ONLY LAUNCHERS. It mounts and unmounts with every open,
 * so putting the panels inside would remount `ProposalMaker` (losing what the
 * supplier typed) and duplicate every form and anchor id. The panels mount ONCE
 * in the frame's tray; a sheet row closes the sheet and reveals one.
 */

import type { ThreadStage } from './vendor-thread-stage';

/** A disclosure mounted once above the message stream. */
export type VendorThreadPanel = {
  /** DOM id of the `<details>`. Also the launcher's reveal target. */
  id: string;
  label: string;
  /** The grey half-sentence beside the label, in the disclosure's own header. */
  hint: string;
};

export const VENDOR_THREAD_PANELS: readonly VendorThreadPanel[] = [
  {
    /*
      ONE QUOTE TOOL (SUP-H · AREA-CHAT, 2026-09-19). This list carried TWO
      quote panels — `send-proposal` (a saved template, priced by its package)
      and `build-quote` (line items, freebies, crew, transport) — and the rail
      offered both as separate launchers, one of them marked primary. To a
      supplier they were one job with two doors, and the doors led to
      different tools: the client brief's "Quote" button opened the template
      form, its "New quote" button opened the builder. Both composers still
      mount, once each, INSIDE this one panel (the builder, then the template
      shortcut under it — `page.tsx` `toolNodes['build-quote']`); the id is
      kept because every deep link and `?compose=quote` name it.
    */
    id: 'build-quote',
    label: 'Send a quote',
    hint: 'From your card, a saved quote or blank',
  },
  {
    /*
      THE COUPLE'S BOOKING ASK, ANSWERED IN THE CONVERSATION (simpler supplier dashboard step 4, 2026-10-14 —
      prototype `SHEETS.tools` "Answer their booking ask"). Its body is the customer card's shipped panel
      (`LockRequestAnswer`): the fee forecast ABOVE Agree, Agree = `vendorAgreeToLock`, Turn it down with a reason.
      Mounted only while an ask is open — the page skips a panel whose body is null, and the tool is listed only then.
    */
    id: 'booking-ask',
    label: 'Answer their booking ask',
    hint: 'Agree · or turn it down',
  },
  {
    id: 'offer-service',
    label: 'Offer another service',
    hint: 'Your other cards, not yet on this thread',
  },
  {
    id: 'thread-call',
    label: 'Voice or video call',
    hint: 'Free, one to one',
  },
  {
    id: 'deal-or-meeting',
    label: 'Deal or meeting',
    hint: 'Propose a schedule or a handshake',
  },
  {
    // ⚠ NOT "How did this inquiry end?" as a standing panel. It asked how a
    // conversation ended while the supplier was still having it.
    id: 'log-outcome',
    label: 'Log the outcome',
    hint: 'Won, lost or no response — private to you',
  },
] as const;

/**
 * Reveal targets that are NOT panels — every one is an id the thread page
 * renders for its own reasons, listed here so the guard can tell a deliberate
 * target from a typo.
 *
 *   • `pending-payments`     — the empty scroll anchor above the couple's
 *                              logged-payment confirm cards. Not a disclosure;
 *                              a plain scroll still does the right thing.
 *   • `thread-call-{voice,video}` — the two Start buttons INSIDE the
 *                              `thread-call` panel. Revealing one opens the
 *                              panel around it and focuses that button, which
 *                              is how "Voice call" and "Video call" can be two
 *                              entries in the list without two call machines.
 *                              The ids exist only when the thread page passes
 *                              `buttonIdPrefix="thread-call"` to the launcher.
 */
export const VENDOR_THREAD_IN_PAGE_ANCHORS: readonly string[] = [
  'pending-payments',
  'thread-call-voice',
  'thread-call-video',
  // The guest-count surcharge cards (Apply / Hold price) — a band inside the pinned area, not a disclosure.
  'guest-count',
] as const;

/**
 * WHICH STAGES HAVE AN AGREEMENT BEHIND THEM.
 *
 * "Propose schedule" leaves for the client's Schedule tab, and that tab refuses
 * before a booking: it draws a lock row reading *"Unlocks when they book you"*.
 * The refusal was always honest — but it was only legible AFTER a supplier left
 * the conversation to find it, and the launcher beside it looked exactly as
 * available as the eight tools that do open. Owner question B2, recommendation
 * (a), matching the Lock ruling: HIDE NOTHING, SAY WHY. So the reason moves up
 * to the button and the button stops pretending.
 *
 * ⚖ `completed` IS TRUE, AND THAT IS THE WHOLE REASON THIS IS A MAP AND NOT
 * `stage === 'booked'`. `resolveThreadStage` ranks completed ABOVE booked — "a
 * finished job stays finished however the thread was later filed" — so a
 * supplier who has already worked the wedding reads as `completed`, while the
 * destination still opens for them (it asks a different question: are they on
 * the roster). Gating on `booked` alone would grey the tool out and tell them
 * it "opens once they book you" about a couple who already did. Over-greying
 * is the direction that puts a LIE on screen; under-greying is merely today.
 *
 * 🔑 EXHAUSTIVE ON PURPOSE. A new `ThreadStage` fails the typecheck here rather
 * than quietly picking a side — which is the one thing a boolean derived from
 * `!== 'booked'` could never force anybody to do.
 */
export const THREAD_STAGE_HAS_AGREEMENT: Record<ThreadStage, boolean> = {
  inquiry: false,
  quoted: false,
  cancelled: false,
  booked: true,
  completed: true,
};

export type VendorThreadToolIcon =
  | 'quote'
  | 'answer'
  | 'payment'
  | 'confirm'
  | 'schedule'
  | 'file'
  | 'offer'
  | 'voice'
  | 'deal'
  | 'guests'
  | 'outcome'
  | 'problem';

type ToolBase = {
  key: string;
  label: string;
  /**
   * The grey half-sentence under the label in the ＋ Tools sheet (prototype `SHEETS.tools`: "From your card or
   * blank", "GCash · bank", "Private to you"…). Says what the tool is for, never how it works.
   */
  line: string;
  icon: VendorThreadToolIcon;
  /** The one the supplier is most likely here to do. Exactly one. */
  primary?: true;
  /**
   * Present when what this opens is shut until the couple agrees. The sheet renders the tool GREYED AND UNPRESSABLE
   * with this sentence beneath it — never hidden, and never left looking live. The sentence lives here, in the one
   * list that names the tools, so the sheet cannot say something different from what the destination will.
   */
  shutUntilAgreement?: { reason: string };
  /**
   * Present when the tool answers something the couple sent, and there may be nothing to answer: a payment to
   * confirm, a guest-count change to re-price. Shut with this sentence while there is none (the page says which —
   * `VendorThreadToolsState`). Same rule as above: hide nothing, say why.
   */
  shutWhenNothing?: { reason: string; counts: 'paymentsToConfirm' | 'guestCountChanges' };
  /**
   * Listed ONLY while the couple's booking ask is open. Not a shut tool: with no ask there is no question, and a
   * greyed "Answer their booking ask" would read as a missed message.
   */
  onlyWhileAsked?: true;
};

/**
 * Opens something already on this page.
 *
 * `reveal` is an ORDERED list of candidates and the first one present wins,
 * because the finer target is not always rendered. "Call them" aims at the
 * Start button inside the call panel — and that button does not exist for a
 * shop whose plan has calling locked, where the panel shows an upgrade nudge
 * instead. Falling back to the panel means the supplier still reaches the
 * answer; naming one id would give them a button that does nothing.
 */
export type VendorThreadRevealTool = ToolBase & {
  reveal: readonly string[];
  link?: never;
  attach?: never;
};

/**
 * Leaves for another screen — the only kind that is still a link.
 *
 * ⚠ THE URL IS NOT BUILT HERE, DELIBERATELY. `lint-port-no-lost-controls`
 * reads a route's own files for the destinations it offers, so a href composed
 * in this shared module makes the route read as having LOST that destination —
 * and the tempting fix, regenerating the baseline, would record a removal that
 * never happened. The sheet holds the literal; this list holds the key, and the
 * guard fails if the two stop lining up.
 */
export type VendorThreadLinkTool = ToolBase & {
  reveal?: never;
  link: VendorThreadLinkTarget;
  attach?: never;
};

/**
 * Opens the composer's own file picker — the shipped attach (`ChatSendForm`'s `attachment` input), so a photo, a PDF
 * or the contract travels as an ordinary message with every limit and the compression it already has.
 */
export type VendorThreadAttachTool = ToolBase & {
  reveal?: never;
  link?: never;
  attach: true;
};

/** Every off-screen destination a tool may name. */
export type VendorThreadLinkTarget = 'client-schedule' | 'client-payments' | 'disputes';

export type VendorThreadTool = VendorThreadRevealTool | VendorThreadLinkTool | VendorThreadAttachTool;

/**
 * THE ＋ TOOLS SHEET — every tool the conversation has, in ONE list, in the order the owner approved on the
 * simpler-dashboard prototype (`prototypes/supplier_easy_dashboard_2026-10-14_fable.html` · `SHEETS.tools`; DECISION_LOG
 * 2026-10-14 ✅ APPROVE, and 🧰 "Report a problem joins the chat's ＋ tools — its own page stays").
 *
 * 2026-10-14 · it replaces the two scattered doors it grew out of: the customer rail's "Tools" column (the 2026-09-08
 * list of launchers) and the composer's 🧾 / 📞 icons. Nothing it opens moved: each row opens the SAME panel or page,
 * which posts the SAME server action it always did.
 *
 * ⚖ "Voice call" and "Video call" were two entries (2026-09-08); they are one row now, "Call them · Voice or video",
 * opening the ONE call panel where both Start buttons sit. Nothing in this list starts a call, sends money or sends a
 * message: a row opens a tool, the tool is where the act happens.
 */
export const VENDOR_THREAD_TOOLS: readonly VendorThreadTool[] = [
  {
    // The ONE quote launcher (SUP-H) — start from a card, a saved quote or blank lives inside the panel it opens.
    key: 'build-quote',
    label: 'Send a quote',
    line: 'From your card, a saved quote or blank',
    icon: 'quote',
    reveal: ['build-quote'],
    primary: true,
  },
  {
    key: 'booking-ask',
    label: 'Answer their booking ask',
    line: 'Agree · or turn it down',
    icon: 'answer',
    reveal: ['booking-ask'],
    onlyWhileAsked: true,
  },
  {
    // The ask lives on the customer card (`PaymentAsksPanel` → `vendorAskForPayment`), which refuses before a
    // booking (RLS: a confirmed booking only) — so the row says so first.
    key: 'ask-payment',
    label: 'Ask for a payment',
    line: 'GCash · bank · the amount and when',
    icon: 'payment',
    link: 'client-payments',
    shutUntilAgreement: { reason: 'Opens once they book you' },
  },
  {
    // The couple's logged payments wait in the pinned band (`confirmVendorPayment` / `refuseVendorPayment`).
    key: 'log-payment',
    label: 'Confirm a payment they sent',
    line: 'Received · or not received',
    icon: 'confirm',
    reveal: ['pending-payments'],
    shutWhenNothing: { reason: 'No payment from them to confirm yet', counts: 'paymentsToConfirm' },
  },
  { key: 'deal-or-meeting', label: 'Propose a date or meeting', line: 'Tasting · ocular · a deal', icon: 'deal', reveal: ['deal-or-meeting'] },
  {
    key: 'propose-schedule',
    label: 'Your call time',
    line: 'Your part of their day · they tap OK',
    icon: 'schedule',
    link: 'client-schedule',
    // The destination's own words, so the two cannot drift apart.
    shutUntilAgreement: { reason: 'Opens once they book you' },
  },
  { key: 'share-file', label: 'Share a file or the contract', line: 'Photo · PDF · contract', icon: 'file', attach: true },
  { key: 'offer-service', label: 'Offer another service', line: 'Your other cards', icon: 'offer', reveal: ['offer-service'] },
  { key: 'voice-call', label: 'Call them', line: 'Voice or video · free', icon: 'voice', reveal: ['thread-call-voice', 'thread-call'] },
  {
    // The surcharge cards (`acceptPaxSurcharge` / `declinePaxSurcharge`) appear when the couple's count moved.
    key: 'guest-count',
    label: 'Guest count changed',
    line: 'Re-price · or hold your price',
    icon: 'guests',
    reveal: ['guest-count'],
    shutWhenNothing: { reason: 'Their count has not changed since your quote', counts: 'guestCountChanges' },
  },
  { key: 'log-outcome', label: 'Mark won or lost', line: 'Private to you', icon: 'outcome', reveal: ['log-outcome'] },
  {
    // The shipped disputes page — owner 2026-10-14: it joins these tools, its own page stays.
    key: 'report-problem',
    label: 'Report a problem',
    line: 'This couple or this booking',
    icon: 'problem',
    link: 'disputes',
  },
] as const;

/**
 * WHAT THE PAGE KNOWS THAT DECIDES A ROW — read on the server, handed to the sheet. Each is a fact the page already
 * has in hand (no extra read): the stage, the open ask, the pending payments, the guest-count proposals.
 */
export type VendorThreadToolsState = {
  hasAgreement: boolean;
  askOpen: boolean;
  paymentsToConfirm: number;
  guestCountChanges: number;
};

export type VendorThreadToolRow =
  | { tool: VendorThreadTool; shut: null }
  | { tool: VendorThreadTool; shut: { reason: string } };

/** The sheet's rows, in order: hidden only for an ask that is not open; shut (never hidden) with the reason. */
export function vendorThreadToolRows(state: VendorThreadToolsState): VendorThreadToolRow[] {
  const rows: VendorThreadToolRow[] = [];
  for (const tool of VENDOR_THREAD_TOOLS) {
    if (tool.onlyWhileAsked && !state.askOpen) continue;
    if (tool.shutUntilAgreement && !state.hasAgreement) {
      rows.push({ tool, shut: tool.shutUntilAgreement });
      continue;
    }
    if (tool.shutWhenNothing && state[tool.shutWhenNothing.counts] === 0) {
      rows.push({ tool, shut: { reason: tool.shutWhenNothing.reason } });
      continue;
    }
    rows.push({ tool, shut: null });
  }
  return rows;
}

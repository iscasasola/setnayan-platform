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
 * (`VENDOR_THREAD_PANELS`), and the customer rail's right column is a list of
 * LAUNCHERS that open them (`VENDOR_THREAD_TOOLS`).
 *
 * 🔑 THE TWO LISTS ARE HERE TOGETHER ON PURPOSE. A launcher naming a panel that
 * does not exist is silent — it scrolls to nothing and reads as a button that
 * does nothing, which is the exact failure this repo keeps producing (a refused
 * or missing thing rendered as an empty one). `lib/the-thread-tools-open-what-
 * they-name.test.ts` fails when a launcher names something the page does not
 * render, and when a panel no launcher can reach.
 *
 * 🔑 THE RAIL RENDERS TWICE — a desktop column and a mobile sheet. That is why
 * only the cheap launchers live in it: putting the panels inside would mount
 * `ProposalMaker` and `SendProposalCard` twice and duplicate every form and
 * every anchor id on the page.
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
    id: 'send-proposal',
    label: 'Send proposal',
    hint: 'From a saved template',
  },
  {
    id: 'build-quote',
    label: 'Build a quote',
    hint: 'Line items, freebies, crew and transport',
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
  | 'proposal'
  | 'payment'
  | 'schedule'
  | 'offer'
  | 'voice'
  | 'video'
  | 'deal'
  | 'outcome';

type ToolBase = {
  key: string;
  label: string;
  icon: VendorThreadToolIcon;
  /** The one the supplier is most likely here to do. Exactly one. */
  primary?: true;
  /**
   * Present when what this opens is shut until the couple agrees. The rail
   * renders the tool GREYED AND UNPRESSABLE with this sentence beneath it —
   * never hidden, and never left looking live. The sentence lives here, in the
   * one list that names the tools, so the rail cannot say something different
   * from what the destination will.
   */
  shutUntilAgreement?: { reason: string };
};

/**
 * Opens something already on this page.
 *
 * `reveal` is an ORDERED list of candidates and the first one present wins,
 * because the finer target is not always rendered. "Video call" aims at the
 * Start button inside the call panel — and that button does not exist for a
 * shop whose plan has calling locked, where the panel shows an upgrade nudge
 * instead. Falling back to the panel means the supplier still reaches the
 * answer; naming one id would give them a button that does nothing.
 */
export type VendorThreadRevealTool = ToolBase & {
  reveal: readonly string[];
  link?: never;
};

/**
 * Leaves for another screen — the only kind that is still a link.
 *
 * ⚠ THE URL IS NOT BUILT HERE, DELIBERATELY. `lint-port-no-lost-controls`
 * reads a route's own files for the destinations it offers, so a href composed
 * in this shared module makes the route read as having LOST that destination —
 * and the tempting fix, regenerating the baseline, would record a removal that
 * never happened. The rail holds the literal; this list holds the key, and the
 * guard fails if the two stop lining up.
 */
export type VendorThreadLinkTool = ToolBase & {
  reveal?: never;
  link: VendorThreadLinkTarget;
};

/** Every off-screen destination a tool may name. */
export type VendorThreadLinkTarget = 'client-schedule';

export type VendorThreadTool = VendorThreadRevealTool | VendorThreadLinkTool;

/**
 * The rail's list, in the order the owner approved on the prototype
 * (`prototypes/supplier_inbox_2026-09-08.html` · "Tools").
 *
 * ⚖ "Voice call" and "Video call" are two entries because they are two
 * decisions to a supplier working out whether to be on camera — the owner's
 * note on the prototype. They open the SAME panel and focus different buttons;
 * neither one dials. Nothing in this list starts a call, sends money or sends a
 * message: a launcher opens a tool, the tool is where the act happens.
 */
export const VENDOR_THREAD_TOOLS: readonly VendorThreadTool[] = [
  {
    key: 'build-quote',
    label: 'Build a quote',
    icon: 'quote',
    reveal: ['build-quote'],
    primary: true,
  },
  { key: 'send-proposal', label: 'Send proposal', icon: 'proposal', reveal: ['send-proposal'] },
  { key: 'log-payment', label: 'Log payment', icon: 'payment', reveal: ['pending-payments'] },
  {
    key: 'propose-schedule',
    label: 'Propose schedule',
    icon: 'schedule',
    link: 'client-schedule',
    // The destination's own words, so the two cannot drift apart.
    shutUntilAgreement: { reason: 'Opens once they book you' },
  },
  { key: 'offer-service', label: 'Offer another service', icon: 'offer', reveal: ['offer-service'] },
  { key: 'voice-call', label: 'Voice call', icon: 'voice', reveal: ['thread-call-voice', 'thread-call'] },
  { key: 'video-call', label: 'Video call', icon: 'video', reveal: ['thread-call-video', 'thread-call'] },
  { key: 'deal-or-meeting', label: 'Deal or meeting', icon: 'deal', reveal: ['deal-or-meeting'] },
  { key: 'log-outcome', label: 'Log the outcome', icon: 'outcome', reveal: ['log-outcome'] },
] as const;

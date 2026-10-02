/**
 * who-can-reply.ts — does the Guest list's first visit ask "Who can reply?"
 *
 * ⚖ Owner 2026-09-30 (DECISION_LOG "THE FIRST VISIT TO THE GUEST LIST ASKS WHICH
 * KIND OF LIST"): *"so when we first enter the guestlist. we have settings where
 * guest based or anyone and i approve. to make it easier, we do a popup so they
 * can initially pick what type of guestlist"*. One question, two answers,
 * writing the EXISTING "Who can RSVP?" value (`events.rsvp_ask_config.whoCanRsvp`,
 * read everywhere through `readWhoCanRsvp`) — no new setting.
 *
 * 🔑 ONCE PER EVENT, BECAUSE THE ANSWER IS THE MEMORY. The pop-up asks only
 * while the key is ABSENT — live AND in the Maker's draft. Absent is what
 * `readWhoCanRsvp` reads as the default ("Only my Guest List"), so the page
 * cannot tell "chose the default" from "never asked" by reading the value; it
 * reads whether the key exists. An answer from anywhere — this pop-up, the
 * Maker's RSVP page, onboarding — ends the question for that event.
 *
 * 🔑 THE BASE IS WHAT THE DRAFT HOLDS, OR ELSE THE LIVE VALUE. The one writer
 * (`hubDraftAction` save, the Maker's door) replaces the whole
 * `rsvp_ask_config` object in the draft. Posting only `{ whoCanRsvp }` would
 * silently switch every one of the six RSVP questions back on, so the pop-up
 * posts `{ ...base, whoCanRsvp }` — the same shape `maker-rsvp-ask.tsx` posts.
 *
 * Pure, so `who-can-reply.test.ts` executes every branch.
 */

import {
  GUEST_ENTRY_RULE,
  oneQrLetsYouIn,
  readGuestsReply,
  readWhoCanRsvp,
  sanitizeRsvpAskConfig,
  type RsvpAskConfig,
  type WhoCanRsvp,
} from './rsvp-ask';

export type WhoCanReplyDraft =
  /** The draft read failed — nothing may be written over it. */
  | { read: 'refused' }
  /** No draft, or a draft that holds no `rsvp_ask_config`. */
  | { read: 'ok'; drafted: false }
  | { read: 'ok'; drafted: true; value: unknown };

/** The config the pop-up extends, or null when it must not ask. */
export function whoCanReplyBase(input: {
  /** Only a host may answer — the writer refuses anyone else. */
  isHost: boolean;
  /** False when the live read was refused: unknown is never "unanswered". */
  liveMeasured: boolean;
  live: unknown;
  draft: WhoCanReplyDraft;
}): RsvpAskConfig | null {
  if (!input.isHost || !input.liveMeasured || input.draft.read === 'refused') return null;
  const live = sanitizeRsvpAskConfig(input.live);
  if (live.whoCanRsvp !== undefined) return null;
  if (input.draft.drafted) {
    const drafted = sanitizeRsvpAskConfig(input.draft.value);
    if (drafted.whoCanRsvp !== undefined) return null;
    return drafted;
  }
  return live;
}

/**
 * ⚖ THE THREE RULES (`GUEST_ENTRY_RULE`, lib/rsvp-ask.ts) are the headings of
 * "How guests get in" below, and the words of the Guest list's first-visit
 * pop-up (which asks only the first two) — one spelling.
 */

/** The two answers the first-visit pop-up asks — named by the rule, not re-worded. */
export const WHO_CAN_REPLY_CHOICES: ReadonlyArray<{ value: WhoCanRsvp; label: string; hint: string }> = [
  { value: 'guest_list', label: GUEST_ENTRY_RULE.list, hint: 'Only people you list. Guests reply.' },
  { value: 'anyone', label: GUEST_ENTRY_RULE.accept, hint: 'Anyone with the link can ask to join. You say yes or no.' },
];

/** The whole object the pop-up posts — never the one key alone. */
export function whoCanReplyPatch(base: RsvpAskConfig, value: WhoCanRsvp): RsvpAskConfig {
  return sanitizeRsvpAskConfig({ ...base, whoCanRsvp: value });
}

/* ══ HOW GUESTS GET IN — the ONE dropdown in Your info ══════════════════════
 *
 * ⚖ Owner 2026-10-02 (DECISION_LOG "EVERY ANSWER ABOUT AN EVENT LIVES IN EVENT
 * DETAILS ('YOUR INFO') — ONE HOME, MAPPED"): "Will guests reply? / Entry" AND
 * the guest-list type chosen at onboarding live in Your info, changeable there;
 * the Guest list may show it, never set it. Onboarding stores all of it as ONE
 * object — `events.rsvp_ask_config` {guestsReply, whoCanRsvp} (setupColumns,
 * lib/onboarding/event-insert.ts) — so it is ONE dropdown here, never three
 * controls: every choice is a view over those keys plus `approveEach`
 * ("I approve each one", owner 2026-09-30 "THE RSVP IS OPTIONAL…").
 *
 * Onboarding's "Both" (personal QR + one QR) is stored exactly like "One QR for
 * everyone" — a listed guest's own QR always opens their invitation — so it is
 * not a separate choice here; the one-QR hint says so.
 */
export type GuestsGetIn = 'list' | 'requests' | 'personal' | 'one_qr' | 'one_qr_approve';

export const GUESTS_GET_IN_LABEL = 'How guests get in';

/**
 * The five stored choices, GROUPED under the three rules (owner 2026-10-02): the
 * dropdown lists each under its `group` heading, in this order, so consecutive
 * choices share one heading. `label` is the choice WITHIN its group; the closed
 * button and every read-only display say `guestsGetInLabel` — heading and choice
 * together ("List only · Guests reply"). Same five values, same stored keys.
 */
export const GUESTS_GET_IN_CHOICES: ReadonlyArray<{ value: GuestsGetIn; group: string; label: string; hint: string }> = [
  { value: 'list', group: GUEST_ENTRY_RULE.list, label: 'Guests reply', hint: 'They reply to the invitation. Each gets their own QR.' },
  { value: 'personal', group: GUEST_ENTRY_RULE.list, label: 'No reply, each gets their own QR', hint: 'Their own QR opens the Event Hub straight away.' },
  { value: 'requests', group: GUEST_ENTRY_RULE.accept, label: 'Guests reply', hint: 'They reply. Anyone with the link can ask to join — you say yes or no.' },
  {
    value: 'one_qr_approve',
    group: GUEST_ENTRY_RULE.accept,
    label: 'No reply, one QR, I approve each',
    hint: 'Anyone who scans it can ask to join. They wait until you say yes.',
  },
  {
    value: 'one_qr',
    group: GUEST_ENTRY_RULE.open,
    label: 'One QR for everyone',
    hint: 'Anyone who scans it and signs in is added as a guest. Guests you list keep their own QR too.',
  },
];

/** The choice the stored config holds — read through the shipped readers only. */
export function readGuestsGetIn(raw: unknown): GuestsGetIn {
  const who = readWhoCanRsvp(raw);
  if (readGuestsReply(raw)) return who === 'anyone' ? 'requests' : 'list';
  if (who !== 'anyone') return 'personal';
  return oneQrLetsYouIn(raw) ? 'one_qr' : 'one_qr_approve';
}

/** Heading and choice, the one phrase every place shows — "Accept · Guests reply". */
export function guestsGetInLabel(choice: GuestsGetIn): string {
  const c = GUESTS_GET_IN_CHOICES.find((x) => x.value === choice)!;
  return `${c.group} · ${c.label}`;
}

/** One choice's grouped words — for a surface that stores fewer than five (onboarding's card). */
export function guestsGetInChoice(choice: GuestsGetIn) {
  return GUESTS_GET_IN_CHOICES.find((c) => c.value === choice)!;
}

/** The dropdown's options, ready for `PickMenu`: grouped, each with its hint. */
export function guestsGetInOptions(): Array<{ key: GuestsGetIn; label: string; group: string; hint: string }> {
  return GUESTS_GET_IN_CHOICES.map((c) => ({ key: c.value, label: c.label, group: c.group, hint: c.hint }));
}

/**
 * The keys one choice sets — EVERY one of the three explicitly, so the patch
 * can be merged onto any base (the Maker's `save` merges) and never leave a
 * stale `approveEach` or `guestsReply` behind.
 */
export function guestsGetInPatch(choice: GuestsGetIn): Pick<RsvpAskConfig, 'guestsReply' | 'whoCanRsvp' | 'approveEach'> {
  switch (choice) {
    case 'list':
      return { guestsReply: true, whoCanRsvp: 'guest_list', approveEach: false };
    case 'requests':
      return { guestsReply: true, whoCanRsvp: 'anyone', approveEach: false };
    case 'personal':
      return { guestsReply: false, whoCanRsvp: 'guest_list', approveEach: false };
    case 'one_qr':
      return { guestsReply: false, whoCanRsvp: 'anyone', approveEach: false };
    case 'one_qr_approve':
      return { guestsReply: false, whoCanRsvp: 'anyone', approveEach: true };
  }
}

export function isGuestsGetIn(v: unknown): v is GuestsGetIn {
  return typeof v === 'string' && GUESTS_GET_IN_CHOICES.some((c) => c.value === v);
}

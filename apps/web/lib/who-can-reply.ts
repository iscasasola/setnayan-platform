/**
 * who-can-reply.ts — who may reply to the invitation, and how guests get in.
 *
 * ⚖ Owner 2026-10-02 (DECISION_LOG "OWNER ANSWERS ON THE TRACKER'S "DECIDE" PAGE
 * (d19–d25…", d23): **the Guests page asks no "Who can reply?" question on the first
 * visit.** The answer defaults to "Only people on my list" and is changed in Event
 * Details — the one home for it (below). The pop-up that asked it (2026-09-30) is
 * removed, not hidden: its component, its mount, and the pure rule that decided
 * whether to ask are gone.
 *
 * 🔑 THE DEFAULT NEEDS NO WRITE. `events.rsvp_ask_config` holds no `whoCanRsvp` key
 * until the host changes it, and `readWhoCanRsvp` reads an absent key as
 * "guest_list" — so `readGuestsGetIn(null)` is already 'list' ("Only people on my
 * list"), for an event that never chose and for one created before this ruling.
 * Nothing is written on the way in; a write happens only when the host picks.
 */

import { GUEST_ENTRY_RULE, oneQrLetsYouIn, readGuestsReply, readWhoCanRsvp, type RsvpAskConfig } from './rsvp-ask';

/**
 * ⚖ THE THREE RULES (`GUEST_ENTRY_RULE`, lib/rsvp-ask.ts) are the headings of
 * "How guests get in" below — one spelling.
 */

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

import { formatCount } from '@/lib/format-number';

/**
 * papic-guest-camera.ts — ONE GUEST'S CAMERA, IN THE COUPLE'S WORDS (owner 2026-10-23: *"set papic setting per guest on
 * each guest card"*; prototype `guest_card_groups_and_papic_2026-10-23.html`, frames 3–4).
 *
 * Three choices, ONE dropdown ("Their camera ▾"), each one value of the SHIPPED ceiling
 * (`papic_set_guest_spend_ceiling`, table `papic_guest_spend_ceilings`, `lib/papic-guest-allotments.ts`) — no new storage:
 *
 *   Shares with everyone  ⇄ no row (p_points NULL) — the default, needs no setup
 *   A set number          ⇄ N ≥ 1 — the most they may take, never a reserve (DECISION_LOG 2026-08-28)
 *   No camera             ⇄ 0 — "may not spend" (the table's own comment)
 *
 * ⚠ POINTS ON THE WIRE, CREDITS ON THE SCREEN (`papic-guest-allotments.ts`): this file only ever SAYS credits.
 */
export type GuestCamera = 'share' | 'set' | 'none';

/**
 * What the guest card's Papic row is handed (read on the server, `guest-papic-read.ts`):
 *   · `access` — the event's Papic, in THREE states (`eventPapicGuestAccess`): 'off' → the one line "Papic is off ·
 *     Turn on ›"; 'unknown' → the check did not answer, and the row says so (never "off").
 *   · `ceiling` — null = shares with everyone · 0 = no camera · N = a set number · undefined = unread, or not the
 *     couple's to see — then NO control is offered (a choice is never saved from a failed read).
 */
export type GuestPapicState = {
  access: 'on' | 'off' | 'unknown';
  ceiling: number | null | undefined;
  /**
   * 🚪 While Papic is off: where "Turn on ›" lands — the switch itself (`papicSwitchHref`). `null` / absent = this viewer
   * cannot turn Papic on, and the row says "Papic is off" with no door.
   */
  door?: string | null;
};

export const GUEST_CAMERA_CHOICES: readonly GuestCamera[] = ['share', 'set', 'none'];

export const GUEST_CAMERA_WORDS: Record<GuestCamera, string> = {
  share: 'Shares with everyone',
  set: 'A set number',
  none: 'No camera',
};

/** The one short line under the dropdown. */
export const GUEST_CAMERA_LINES: Record<GuestCamera, string> = {
  share: 'An equal share of what is left',
  set: 'The most they may take',
  none: 'Their QR opens the event, not a camera',
};

/** Behind the ⓘ — the details, never on the row. The 3× / 2× are the shipped `ROLE_MULTIPLIER`, not a control. */
export const GUEST_CAMERA_ABOUT =
  'Every guest’s invite QR is a camera. Shares with everyone: an equal share of your credits, worked out live — sponsors already get more (3× a ninang or ninong, 2× a cord, veil, coin or candle sponsor). A set number: the most this guest may take; it never holds credits back, and what they don’t use stays theirs. No camera: they get in, but can’t shoot. Late in your event the rest opens to everyone.';

/** "A set number" picked with no figure kept yet — the row asks for it, never a figure of its own. */
export const GUEST_CAMERA_NEEDS_NUMBER = 'Enter a number';

/** The stored ceiling → the choice. `null` (no row) shares; 0 is no camera; anything else is a set number. */
export function guestCameraOf(ceiling: number | null): GuestCamera {
  if (ceiling === null) return 'share';
  return ceiling === 0 ? 'none' : 'set';
}

/** The row's summary — "Shares with everyone" · "50 credits" · "No camera". */
export function guestCameraSummary(ceiling: number | null): string {
  if (ceiling === null) return GUEST_CAMERA_WORDS.share;
  if (ceiling === 0) return GUEST_CAMERA_WORDS.none;
  return `${formatCount(ceiling)} credit${ceiling === 1 ? '' : 's'}`;
}

/** The figure a choice posts as `allotment` ('' = un-name them, so they share). A set number needs its own N ≥ 1. */
export function guestCameraPost(camera: GuestCamera, credits?: number): string {
  if (camera === 'share') return '';
  if (camera === 'none') return '0';
  if (credits === undefined || !Number.isInteger(credits) || credits < 1) throw new Error('A set number needs a whole number of 1 or more.');
  return String(credits);
}

/** A typed credits figure: a whole number of 1 or more, else the sentence that says why. */
export function checkGuestCredits(text: string): string | null {
  const t = text.trim();
  if (t === '') return null;
  return /^\d+$/.test(t) && Number(t) >= 1 ? null : 'A whole number, 1 or more.';
}

/** What `setGuestAllotment` refused, said plainly — never its code. */
export function guestCameraRefusal(code: string): string {
  switch (code) {
    case 'not_a_couple':
      return 'Only the couple can set a guest’s camera.';
    case 'unknown_guest':
      return 'That guest is no longer on this event — refresh and try again.';
    case 'bad_number':
      return 'A whole number, 1 or more.';
    case 'too_many':
      return 'Too many guests at once — nothing was changed. Try again.';
    default:
      return 'Couldn’t save just now — nothing was changed. Try again.';
  }
}

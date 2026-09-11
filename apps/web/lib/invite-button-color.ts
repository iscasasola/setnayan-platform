/**
 * lib/invite-button-color.ts — the one button on the invite doors, in the
 * couple's own colour.
 *
 * Owner, 2026-09-11 (Q2 = A, DECISION_LOG "the seven invite-theme questions"):
 * on a PRO invite theme the single action on doors 01–03 takes the couple's own
 * button colour — `events.site_button_color`, the Event Hub Pro item already
 * named "Button color" — *"with a safety floor: it falls back to Setnayan
 * terracotta #C24E25 whenever the couple's colour cannot be read."* House keeps
 * terracotta.
 *
 * ── WHY A FLOOR AND NOT JUST THE COLOUR ─────────────────────────────────────
 * `site_button_color` is a hex string a couple TYPED into
 * /dashboard/[eventId]/website/colors. Two things can go wrong with it and they
 * fail in opposite directions:
 *
 *   1. IT IS NOT A COLOUR. Anything that is not exactly `#rrggbb` must never
 *      reach a `style`, so it is refused here rather than handed to the browser
 *      to interpret. (`rgbOfHex` below would happily accept a bare `aabbcc`,
 *      which is not a CSS colour — hence the stricter gate in front of it.)
 *   2. IT IS A COLOUR NOBODY CAN READ A LABEL ON. A mid-luminance colour — a
 *      dusty sage, a muted terracotta — can be too dark for white and too light
 *      for ink AT THE SAME TIME. Neither label clears 4.5:1, and there is no
 *      third label to try, because the label set is the owner's: white or ink.
 *      That is the case the floor exists for, and it is not exotic: it is the
 *      whole mid band.
 *
 * 🔑 THE FLOOR IS NOT "INVALID HEX". A perfectly valid #9A8F7E is exactly the
 * colour this has to catch, and a guard that only tested a malformed string
 * would pass while a guest read a button it could not read. `invite-button-
 * color.test.ts` constructs that colour by name.
 *
 * ── THE TWO LABELS ARE LITERAL HEX, NOT TOKENS, ON PURPOSE ──────────────────
 * `text-cream` / `text-ink` are Tailwind slots that FLIP under `darkMode:
 * 'class'` (globals.css: cream → #17160F, ink → #FBFAF7). The fill underneath
 * does not flip — it is the couple's one colour in either theme — so a label
 * chosen as a token would be measured against one theme and rendered in the
 * other. The class is unreachable today (no `prefers-color-scheme` rule ships),
 * which is exactly why it would have gone unnoticed. Measured, then written.
 *
 * PURE — no React, no DOM, no I/O — so the test exercises the real arithmetic
 * rather than asserting a class name exists. The contrast maths is `story-
 * light.ts`'s, imported and not re-typed: two copies of a legibility formula is
 * two mechanisms that can disagree about whether somebody can read a button.
 */
import { contrastRatio, rgbOfHex } from './story-light';

/**
 * SETNAYAN TERRACOTTA — the House button, and the floor under every Pro one.
 * #C24E25 on the page measures 4.61:1 against its white label (globals.css's
 * `.button-primary` note, which sized the fill against the label rather than
 * the other way round).
 */
export const INVITE_BUTTON_FALLBACK = '#C24E25' as const;

/** The only two labels a door button may wear (owner Q2: "white or ink"). */
const WHITE = '#FFFFFF' as const;
const INK = '#2C2A29' as const;

/** WCAG AA for normal-size text — the label on a button is normal-size text. */
const AA = 4.5;

/** Exactly `#rrggbb`. A bare `aabbcc` is not a CSS colour and is refused. */
const HEX = /^#[0-9a-fA-F]{6}$/;

export type InviteButton = {
  /** The fill — the couple's colour, or the terracotta floor. */
  background: string;
  /** White or ink, whichever reads on that fill. */
  label: string;
  /**
   * True when the couple's colour was used. False means the floor caught it —
   * either it was not a colour, or no allowed label reached 4.5:1 on it.
   */
  couples: boolean;
};

/** The House button: terracotta, white label. Never the couple's colour. */
export const HOUSE_INVITE_BUTTON: InviteButton = {
  background: INVITE_BUTTON_FALLBACK,
  label: WHITE,
  couples: false,
};

/**
 * The button a Pro invite door wears, resolved from `events.site_button_color`.
 *
 * `null` / absent / not a hex → the floor. A readable colour → that colour with
 * whichever of the two labels reads better on it. A colour neither label reads
 * on → the floor, which is the whole reason this returns a PAIR rather than a
 * colour: the label and the fill are one decision and must never be taken apart.
 */
export function resolveInviteButton(raw: unknown): InviteButton {
  if (typeof raw !== 'string') return HOUSE_INVITE_BUTTON;
  const hex = raw.trim();
  if (!HEX.test(hex)) return HOUSE_INVITE_BUTTON;
  const fill = rgbOfHex(hex);
  if (!fill) return HOUSE_INVITE_BUTTON;

  const onWhite = contrastRatio(fill, rgbOfHex(WHITE)!);
  const onInk = contrastRatio(fill, rgbOfHex(INK)!);
  const best = Math.max(onWhite, onInk);
  if (best < AA) return HOUSE_INVITE_BUTTON;

  return { background: hex, label: onWhite >= onInk ? WHITE : INK, couples: true };
}

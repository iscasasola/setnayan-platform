/**
 * lib/maker-details-selection.ts — what a tap on a stage opens in Details (part
 * 2b). Types only on the Details side, on purpose: the Maker's work area (a
 * client file) reads it, and `maker-details-items.ts` carries the prints' and
 * the event types' tables, which a client bundle has no use for.
 *
 * (Which Maker PAGE lands on which Details item — `?tool=love-story`, a scene's
 * "Open … editor" — is `movedPageItem` in `maker-details-items.ts`, run by the
 * shell's `movedSelection`: one translation, not two.)
 */
import type { DetailsItemKey } from '@/lib/maker-details-items';

/**
 * ✍ TAP A FACT ON A STAGE → THE SAME DETAILS FIELD, ON THE RIGHT (owner
 * 2026-09-28, DECISION_LOG "DETAILS IS THE ONE FILL-IN AREA; STAGES ARE LOOK
 * AND MOTION; TAP IS A SHORTCUT": *"tapping a fact on a stage opens the SAME
 * Details field on the right, never a copy; design words (the joiner, the hero
 * link, scene headings) stay on the part"*).
 *
 * What a tap on the canvas names (the bridge's `edit` message: the section's
 * key and the part tapped, `editor-bridge.tsx`) → the Details item whose
 * editor opens. A FACT is the words themselves (`body`, or the scene tapped
 * where it has no parts); a heading or a label is a DESIGN word and is not
 * here, so it keeps its own part sheet. Data, so each Details part adds its own
 * rows — "Your event" adds the hero's names and date when its items exist.
 */
export const STAGE_FACT_TAPS: ReadonlyArray<{ key: string; els: ReadonlyArray<string | null>; item: DetailsItemKey }> = [
  { key: 'w:special_message', els: ['body', null], item: 'special-message' },
  { key: 'w:our_love_story', els: ['body', null], item: 'love-story' },
  { key: 'f:story', els: ['body', null], item: 'love-story' },
  // 🏛 A venue card tapped opens Details › Venues in place — "Use the
  // supplier's details" or "Enter your own", and the card's photo (owner
  // 2026-09-30: "so click on it. use supplier details. or input your data").
  { key: 'w:venue_map', els: ['body', null], item: 'venues' },
];

/** The Details item a canvas tap names, or null (a design word, or no fact there). */
export function detailsItemForTap(key: string, el: unknown): DetailsItemKey | null {
  const part = typeof el === 'string' ? el : null;
  return STAGE_FACT_TAPS.find((t) => t.key === key && t.els.includes(part))?.item ?? null;
}

/** The fact a section's words ARE, whole (its Content) — the same table, read for the scene. */
export function detailsItemForSection(key: string): DetailsItemKey | null {
  return STAGE_FACT_TAPS.find((t) => t.key === key && t.els.includes('body'))?.item ?? null;
}

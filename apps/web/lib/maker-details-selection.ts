/**
 * lib/maker-details-selection.ts — 📦 THE MAKER PAGES THAT MOVED INTO DETAILS
 * WHOLE (Details part 2b, DECISION_LOG "OPTION B — EVERYTHING MADE ONCE LIVES
 * IN DETAILS"): the Love Story page and the RSVP page are Details items now —
 * the same components, inside the three columns. Every old door to them
 * (`?tool=love-story`, `?tool=rsvp-page`, a scene's "Open … editor", a saved
 * selection) lands on its item.
 *
 * Types only, on purpose: the Maker shell and the Details workspace (client
 * files) read it, and `maker-details-items.ts` carries the prints' and the
 * event types' tables, which a client bundle has no use for.
 */
import type { MakerSelection } from '@/app/dashboard/[eventId]/launch/_components/maker-context';
import type { DetailsItemKey } from '@/lib/maker-details-items';

export const TOOLS_IN_DETAILS = { 'love-story': 'love-story', 'rsvp-page': 'rsvp' } as const satisfies Record<string, DetailsItemKey>;
export type ToolInDetails = keyof typeof TOOLS_IN_DETAILS;

export function isToolInDetails(v: unknown): v is ToolInDetails {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(TOOLS_IN_DETAILS, v);
}

/**
 * A Maker selection, with a page that moved into Details landing on its item.
 * The ONE place the old tool keys are translated — the shell runs every
 * selection through it (a bar press, a scene's button, a restored tab).
 */
export function landInDetails(sel: MakerSelection): MakerSelection {
  if (sel?.kind === 'tool' && isToolInDetails(sel.key)) return { kind: 'tool', key: 'details', item: TOOLS_IN_DETAILS[sel.key] };
  return sel;
}

/** The Details item a selection names, or null (Details with none named, or not Details). */
export function detailsItemOfSelection(sel: MakerSelection): DetailsItemKey | null {
  return sel?.kind === 'tool' && sel.key === 'details' && sel.item ? sel.item : null;
}

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

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

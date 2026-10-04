/**
 * lib/see-as.ts — 👁 SEE AS ▾, the words and the one param (PR-10).
 *
 * Its own module because two sides read it: the Maker (the Preview menu's
 * rows, the desktop's dropdown above the preview, the canvas address) and the
 * guest page's sample-viewer branch (`app/[slug]/page.tsx` via
 * `lib/simulated-guest-preview.ts`) — and the guest route never reads the
 * Maker's Page ▾ module (`the-page-dropdown-is-the-guest-bar.test.ts`).
 *
 * Pure: no React, no DOM, no I/O.
 */

/**
 * 👁 SEE AS ▾ — THE PREVIEW AS ONE GUEST (owner 2026-10-04, EVENT_DETAILS_STUDY
 * §7 PR-10, prototype screen 12). The canvas can wear a guest's eyes: a guest
 * who hasn't replied · replied Yes · declined · signed out. It is a DRAW-TIME
 * switch, held in the Maker's state (never the draft, never a row): the canvas
 * address gains `?as=<key>` and the guest page draws that state with a SAMPLE
 * guest (`lib/simulated-guest-preview.ts`) — the same mechanism as the old
 * "See it as…" row and the sample-guest preview, extended, never a second one.
 *
 * 🔒 Nothing the sample guest does writes anything: it has no row (its id
 * matches none), no session, and the canvas swallows every submit and press
 * (`sample-viewer-inert.tsx`). `see-as-never-writes.test.ts` holds it.
 *
 * ONE PLACE: the Preview menu (👁) — on a desktop drawn as the one dropdown
 * above the preview, on a phone as the menu's rows. `null` = the couple's own
 * editing canvas ("You · editing").
 */
export const SEE_AS_PARAM = 'as';

export const SEE_AS = [
  { key: 'pending', label: 'Guest who hasn’t replied', note: null },
  { key: 'replied', label: 'Replied Yes', note: 'ticket · You’re going' },
  { key: 'declined', label: 'Declined', note: null },
  { key: 'signed-out', label: 'Signed out', note: 'the door' },
] as const;

export type SeeAs = (typeof SEE_AS)[number]['key'];

/** The editing canvas's row — the couple's own view, nobody's eyes borrowed. */
export const SEE_AS_EDITING = { key: 'editing', label: 'You · editing' } as const;

/** The same row on the host's own Event Hub (the ribbon's Preview ▾) — nothing is being edited there. */
export const SEE_AS_YOU = { key: 'you', label: 'You' } as const;

/** The value of `?as=`, read strictly: one of the four keys, or null. A repeated param (an array) is never a match. */
export function seeAsOf(v: unknown): SeeAs | null {
  if (typeof v !== 'string') return null;
  const k = v.trim().toLowerCase();
  return SEE_AS.some((s) => s.key === k) ? (k as SeeAs) : null;
}

/** The label a state wears ("See as · Replied Yes"). */
export function seeAsLabel(v: SeeAs | null): string {
  return SEE_AS.find((s) => s.key === v)?.label ?? SEE_AS_EDITING.label;
}

/** Does this state draw a guest's Me on the canvas? A signed-out visitor has no Me; the editing canvas draws none. */
export function seeAsDrawsMe(v: SeeAs | null | undefined): boolean {
  return v === 'pending' || v === 'replied' || v === 'declined';
}

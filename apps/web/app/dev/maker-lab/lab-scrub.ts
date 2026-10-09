import type { HubSectionCanvas } from '@/lib/hub-canvas';

/**
 * 🎚 THE LAB'S SCRUB CHAIN (`?scrub=1`, owner 2026-10-09 — the prototype he approved, as REAL scenes he can try and
 * arrange in the Maker). The lab's own scenes, drawn through the guest page's renderer (`HubScenes`):
 *
 *   Countdown        short — hands over IN THE SAME PLACE                                  (Leaves: Scrub out)
 *   A note from us   short — hands over to the Schedule                                    (Leaves: Scrub out)
 *   Schedule         its rows build ONE BY ONE as each reaches the centre, then it leaves  (Leaves: Scrub out)
 *   Venue            NO Build out — it stays on the page; the next builds in below it
 *   Dress code       an ordinary one — builds in below the Venue, then hands over          (Leaves: Scrub out)
 *   Our love story   the last arrival — nothing arranged on it at all
 *
 * 🔑 ONE CHAIN. `scripts/scrub-check-page.tsx` — the page a real browser plays at the five sizes
 * (`scripts/scrub-browser-check.mjs`) — takes its six canvases from HERE, so what the lab starts on is what that
 * check proves. `lib/the-lab-plays-the-scrub-chain.test.ts` holds both ends.
 *
 * The chain keeps its OWN draft cookie: a canvas the owner saved in the ordinary lab (a Style picked last week) must
 * not quietly take a scene off Scrub here, and what he arranges here must not follow him back.
 */
export const LAB_SCRUB_CHAIN = ['countdown', 'special_message', 'schedule', 'venue_map', 'dress_code', 'our_love_story'] as const;
export type LabScrubScene = (typeof LAB_SCRUB_CHAIN)[number];

export const LAB_SCRUB_SAMPLE: Readonly<Record<LabScrubScene, HubSectionCanvas>> = {
  countdown: { in: 'fade', out: 'move_fade', outTo: 'above', transition: 'scrub' },
  special_message: { in: 'move_fade', inFrom: 'below', out: 'settle', transition: 'scrub' },
  schedule: { in: 'move_fade', inFrom: 'right', sequence: 'one_after_another', outFx: { fade: true, blur: true }, transition: 'scrub' },
  venue_map: { inFx: { fade: true, size: 'grow' }, out: 'none' },
  dress_code: { in: 'move_fade', inFrom: 'left', out: 'fade', transition: 'scrub' },
  our_love_story: {},
};

/** The lab's "saved canvases" cookie — the chain's own when `?scrub=1`. */
export const labWidgetsCookie = (scrub: boolean) => (scrub ? 'lab_widgets_scrub' : 'lab_widgets');

/** What the lab's "server" holds for each scene: the chain's start, and over it whatever was saved here (whole, as a save is). */
export function labScrubCanvases(scrub: boolean, drafted: Record<string, unknown>): Record<string, unknown> {
  return scrub ? { ...LAB_SCRUB_SAMPLE, ...drafted } : drafted;
}

/**
 * The chain's canvas address. A PATH, not a query: the Maker writes its own query after the address it is given
 * (`${publicLandingUrl}?phase=…&editor=1`), so a `?scrub=1` in it would be cut off.
 */
export const LAB_SCRUB_GUEST = '/dev/maker-lab/guest/scrub';

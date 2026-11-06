import { hasHubCanvas, resolveHubMotion, sanitizeHubCanvas, type HubSectionCanvas } from '@/lib/hub-canvas';
import type { MotionFx } from '@/lib/motion-effects';

/**
 * 🎚 THE LAB'S SCRUB CHAIN (`?scrub=1`, owner 2026-10-09 — the prototype he approved, as REAL scenes he can try and
 * arrange in the Maker). The lab's own scenes, drawn through the guest page's renderer (`HubScenes`), each with the
 * prototype's settings for the SAME content:
 *
 *   Countdown        From below + Fade in · Shrink + Fade out — hands over IN THE SAME PLACE   (Leaves: Scrub out)
 *   Schedule         rows From the right + Fade, ONE BY ONE as each reaches the centre; Blur + Fade out, then it leaves
 *   A note from us   Grow + Fade in · NO Build out — it stays on the page; the next builds in below it
 *   Dress code       From the left + Fade in · Fade out — an ordinary one that hands over   (Leaves: Scrub out)
 *   Venue            the last arrival — nothing arranged on it at all: it is simply there
 *
 * 🎬 THE COVER IS HAND-OVER ZERO (2026-10-10 — the owner's own example: *"maria jose must build out and until we say i
 * do should be where maria jose build out"*). The prototype opens on "Maria & Jose" handing over; on a page the names
 * are the cover, which no scenes block draws — so the PAGE hands it over (`hub-scenes.tsx` `HubCoverHold`), and here
 * the lab's cover Leaves by Scrub from the start (`LAB_SCRUB_COVER`: what "Scene leaves ◆" on one of the cover's
 * parts stores on the hero row). What arrives is what comes next on the page — here the greeting, a plain block.
 * (Until then the chain began at the Countdown and its first card said the cover was not part of it.)
 *
 * 🔑 ONE CHAIN. `scripts/scrub-check-page.tsx` — the page a real browser plays at the five sizes
 * (`scripts/scrub-browser-check.mjs`) — takes these five canvases from HERE (its own first scene stands in for the
 * cover), so what the lab starts on is what that check proves. `lib/the-lab-plays-the-scrub-chain.test.ts` holds both ends.
 *
 * The chain keeps its OWN draft cookie: a canvas the owner saved in the ordinary lab (a Style picked last week) must
 * not quietly take a scene off Scrub here, and what he arranges here must not follow him back.
 */
export const LAB_SCRUB_CHAIN = ['countdown', 'schedule', 'special_message', 'dress_code', 'venue_map'] as const;
export type LabScrubScene = (typeof LAB_SCRUB_CHAIN)[number];

export const LAB_SCRUB_SAMPLE: Readonly<Record<LabScrubScene, HubSectionCanvas>> = {
  countdown: { in: 'move_fade', inFrom: 'below', outFx: { fade: true, size: 'shrink' }, transition: 'scrub' },
  schedule: { in: 'move_fade', inFrom: 'right', sequence: 'one_after_another', outFx: { fade: true, blur: true }, transition: 'scrub' },
  special_message: { inFx: { fade: true, size: 'grow' }, out: 'none' },
  dress_code: { in: 'move_fade', inFrom: 'left', out: 'fade', transition: 'scrub' },
  venue_map: {},
};

/** 🎬 The cover's own canvas on the chain — the hero row's: it Leaves by Scrub (its Build out is a scene's default). */
export const LAB_SCRUB_COVER: HubSectionCanvas = { transition: 'scrub' };

/** A scene's name on its card and in the lab's badge. */
export const LAB_SCRUB_NAME: Readonly<Record<LabScrubScene, string>> = {
  countdown: 'Countdown',
  schedule: 'Schedule',
  special_message: 'A note from us',
  dress_code: 'Dress code',
  venue_map: 'Venue',
};

const SIDE: Partial<Record<string, string>> = { below: 'below', above: 'above', left: 'the left', right: 'the right' };
const fxWords = (fx: MotionFx | null, move: (side: string) => string): string | null => {
  if (!fx) return null;
  const words = [fx.size === 'grow' ? 'Grow' : fx.size === 'shrink' || fx.size === 'settle' ? 'Shrink' : null, fx.move ? move(SIDE[fx.move] ?? fx.move.replace('_', ' ')) : null, fx.blur ? 'Blur' : null, fx.fade ? 'Fade' : null];
  return words.filter(Boolean).join(' + ') || null;
};

/**
 * 🏷 WHAT A CARD IS SET TO, in the Maker's own words (the prototype labelled every card; a hold with nothing saying
 * what is happening reads as a stuck page). Read from the canvas the scene is DRAWN with — the chain's start, or
 * whatever was arranged on it in the Maker — never written by hand, so a label cannot say what the scene does not do.
 */
export function labScrubLabel(config: unknown, opts: { last: boolean }): Array<{ name: string; value: string }> {
  const canvas = sanitizeHubCanvas(config);
  /* Nothing arranged = no frame at all (`hasHubCanvas`): none of the presets' defaults is drawn, so none is claimed. */
  if (!hasHubCanvas(canvas)) return [{ name: 'Nothing arranged on it', value: opts.last ? 'the last scene — it arrives with the hand-over’s own fade' : 'it is simply there' }];
  const m = resolveHubMotion(canvas);
  const scrub = canvas.transition === 'scrub';
  const out = m.out === 'none' ? null : fxWords(m.outFx, (side) => `Move ${side === 'above' ? 'up' : side === 'below' ? 'down' : `to ${side}`}`);
  const inn = m.in === 'none' ? null : fxWords(m.inFx, (side) => `From ${side}`);
  return [
    { name: m.sequence === 'one_after_another' ? 'Rows build in' : 'Build in', value: inn ? `${inn}${m.sequence === 'one_after_another' ? ', one by one' : ''}` : 'none — it is simply there' },
    { name: 'Build out', value: out ?? 'none — it stays on the page' },
    { name: 'Leaves', value: opts.last ? 'the last scene: nothing to hand over to' : scrub ? (out ? 'Scrub out' : 'Scrub out, with nothing to play') : canvas.transition === 'auto' ? 'Auto scroll' : 'As it scrolls away' },
  ];
}

/** The lab's "saved canvases" cookie — the chain's own when `?scrub=1`. */
export const labWidgetsCookie = (scrub: boolean) => (scrub ? 'lab_widgets_scrub' : 'lab_widgets');

/** What the lab's "server" holds for each scene: the chain's start, and over it whatever was saved here (whole, as a save is). */
export function labScrubCanvases(scrub: boolean, drafted: Record<string, unknown>): Record<string, unknown> {
  return scrub ? { hero: LAB_SCRUB_COVER, ...LAB_SCRUB_SAMPLE, ...drafted } : drafted;
}

/**
 * The chain's canvas address. A PATH, not a query: the Maker writes its own query after the address it is given
 * (`${publicLandingUrl}?phase=…&editor=1`), so a `?scrub=1` in it would be cut off.
 */
export const LAB_SCRUB_GUEST = '/dev/maker-lab/guest/scrub';

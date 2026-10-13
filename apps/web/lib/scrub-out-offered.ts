/**
 * 🌕 "SCRUB OUT" IS OFFERED (owner, 2026-10-13: "Turn on scrub" — his call, made before his own iPhone check).
 * Every control that names a scene's transition offers it, and a scene that STORES Scrub plays the held hand-over on
 * the guest page (still only where the renderer already allows it: `scrubAllowed`, the Pro read).
 *
 * 🕰 HISTORY — it shipped dark from 2026-10-09 (owner's cut line: proven in Chromium, not yet on an iPhone, not yet on
 * a real guest page); while dark a page whose scene stored Scrub drew that scene as "As it scrolls away". Nothing
 * stored was rewritten, so turning it on changes those pages the moment it ships.
 *
 * 🔑 A CONSTANT, NOT A SETTING. Turning it off again is this one line. No environment variable, nothing to
 * configure, nothing a deploy can forget.
 *
 * 🧪 THE LAB'S TWO DOORS STAY, and stay the lab's (they now open nothing the constant has not already opened, but
 * turning the constant off again must leave the lab able to play it):
 *   · on the SERVER, an explicit `scrubOut` handed to the renderer (`HubScenes` · `hubScrubHoldsAtMost`) — never a
 *     shared switch: a server's module state would leak from one request into the next;
 *   · in the BROWSER, `offerScrubOutInTheLab`, for the Maker's controls the lab mounts.
 * `lib/scrub-out-ships-dark.test.ts` holds that nothing outside `app/dev/` (which 404s in production) and
 * `scripts/` uses either door.
 */
export const SCRUB_OUT_OFFERED = true;

let lab = false;

/** 🧪 LAB ONLY (the browser): offer "Scrub out" in the Maker's controls on this page. */
export function offerScrubOutInTheLab(on: boolean): void {
  lab = on;
}

/** Is "Scrub out" offered in the Maker's controls right now? (The browser: the constant, or the lab's door.) */
export function scrubOutOffered(): boolean {
  return SCRUB_OUT_OFFERED || lab;
}

/** What a transition IS when Scrub out is not offered (the constant off, or `offered` false): a stored Scrub reads, and is drawn, as the plain "scroll". */
export function offeredTransition<T extends string>(transition: T, offered: boolean = scrubOutOffered()): T | 'scroll' {
  return transition === 'scrub' && !offered ? 'scroll' : transition;
}

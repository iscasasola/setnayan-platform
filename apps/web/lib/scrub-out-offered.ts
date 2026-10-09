/**
 * 🌑 "SCRUB OUT" SHIPS DARK (owner's cut line, 2026-10-09). The held hand-over is built and proven in Chromium, but
 * not yet on an iPhone and not yet on a real guest page — so in this batch it is NOT OFFERED: the choice is left out
 * of every control that names it, and a page whose scene STORES Scrub draws that scene as "As it scrolls away" (the
 * plain page: no nest, no page pairs, no island, no engine request). Nothing stored is rewritten.
 *
 * 🔑 A CONSTANT, NOT A SETTING. Turning it on is this one line, in a later batch, after an iPhone has played it.
 * No environment variable, nothing to configure, nothing a deploy can forget.
 *
 * 🧪 THE LAB KEEPS IT ON, so the owner can go on trying the real thing — by two doors that only the lab can use:
 *   · on the SERVER, an explicit `scrubOut` handed to the renderer (`HubScenes` · `hubScrubHoldsAtMost`) — never a
 *     shared switch: a server's module state would leak from one request into the next;
 *   · in the BROWSER, `offerScrubOutInTheLab`, for the Maker's controls the lab mounts.
 * `lib/scrub-out-ships-dark.test.ts` holds that nothing outside `app/dev/` (which 404s in production) and
 * `scripts/` uses either door.
 */
export const SCRUB_OUT_OFFERED = false;

let lab = false;

/** 🧪 LAB ONLY (the browser): offer "Scrub out" in the Maker's controls on this page. */
export function offerScrubOutInTheLab(on: boolean): void {
  lab = on;
}

/** Is "Scrub out" offered in the Maker's controls right now? (The browser: the constant, or the lab's door.) */
export function scrubOutOffered(): boolean {
  return SCRUB_OUT_OFFERED || lab;
}

/** What a transition IS while Scrub out is not offered: a stored Scrub reads, and is drawn, as the plain "scroll". */
export function offeredTransition<T extends string>(transition: T, offered: boolean = scrubOutOffered()): T | 'scroll' {
  return transition === 'scrub' && !offered ? 'scroll' : transition;
}

/**
 * apps/web/lib/motion.ts
 *
 * THE EVENT HUB'S MOTION READS THE SITE'S ONE TOKEN SET (owner 2026-09-21:
 * "make the whole event hub fully animated" — build-sessions/ARRIVAL-S7-motion.md).
 *
 * The tokens already existed in `app/globals.css` :root (`--sn-dur-*`,
 * `--sn-ease*`) — a second set would be the defect. This module mirrors the
 * three the hub uses so code and the guard (`lib/the-hub-moves-with-meaning.test.ts`)
 * can name them; the guard fails if globals.css and this file disagree.
 *
 * THE RULES (each enforced by that guard):
 *  · `prefers-reduced-motion: reduce` turns every hub movement off, and the
 *    page is complete without them.
 *  · Keyframes declare only `from` and run `backwards`, never `both`: a held
 *    transform unpins every `position: fixed` descendant (globals.css,
 *    .sn-page-enter note, measured on production 2026-09-18).
 *  · The hub adds no loop. "Happening now" uses the site's one live pulse,
 *    `.sn-live-dot`.
 */

export const MOTION = {
  /** Sheets, labels, the camera cards — `--sn-dur-elem`. */
  elem: '320ms',
  /** The arrival and the pass lifting — `--sn-dur-enter`. */
  enter: '640ms',
  /** `--sn-ease-out`. */
  easeOut: 'cubic-bezier(.16,1,.3,1)',
} as const;

/**
 * The arrival plays ONCE per invitation per browser, not on every return
 * visit. Keyed by path so a guest invited to two celebrations sees each open.
 */
export function arrivalSeenKey(pathname: string): string {
  return `sn-arrived:${pathname.replace(/\/+$/, '') || '/'}`;
}

/**
 * Pure decision behind the arrival script: animate only when the reader has
 * not asked for reduced motion and has not seen this invitation open before.
 */
export function shouldPlayArrival(input: { reducedMotion: boolean; seenBefore: boolean }): boolean {
  return !input.reducedMotion && !input.seenBefore;
}

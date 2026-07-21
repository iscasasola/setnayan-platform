/**
 * Height math for the scroll-free Live Studio console.
 *
 * ── Why the console must not scroll ─────────────────────────────────────────────────────────
 * It is an operator surface used during a ceremony that cannot be re-run. If the PROGRAM monitor
 * sits below the fold, cutting a camera means scrolling to find it — and whatever you scroll past
 * is a control you can no longer see. Every switcher ever built fits on one screen for this
 * reason.
 *
 * ── What was wrong ──────────────────────────────────────────────────────────────────────────
 * The monitor used `aspect-video`, which derives HEIGHT FROM WIDTH. On a wide desktop column
 * that's ~1000px of monitor before the sources rail is even reached, so the page scrolled and the
 * overlay's own bottom band fell off screen. Aspect-ratio boxes are right for a card in a feed
 * and wrong for a viewport-filling console.
 *
 * ── The fix ─────────────────────────────────────────────────────────────────────────────────
 * Height flows the other way: the console is told how tall it may be, and the monitor takes what
 * is left. The available height is MEASURED from the console's own position rather than derived
 * from a hardcoded list of chrome heights — the dashboard shell has a sticky top bar, its own
 * padding, and a mobile bottom nav, and any hardcoded sum of those silently rots the first time
 * one of them changes.
 */

/** Clearance for the mobile bottom nav (`pb-20` on the shell = 5rem) plus a little breathing room. */
export const MOBILE_NAV_CLEARANCE_PX = 88;

/** Desktop has no bottom nav — just enough gap that the console doesn't kiss the viewport edge. */
export const DESKTOP_BOTTOM_GAP_PX = 16;

/**
 * Never shrink below this. A console crushed into a sliver is worse than one that scrolls: on a
 * short window (or a laptop with a browser toolbar and OBS docked) letting it scroll a little is
 * the honest outcome.
 */
export const MIN_CONSOLE_HEIGHT_PX = 420;

export type FitInput = {
  /** `getBoundingClientRect().top` of the console root — everything above it is chrome. */
  consoleTop: number;
  /** `window.innerHeight` — the real visible height, already excluding browser chrome. */
  viewportHeight: number;
  /** Is the mobile bottom nav on screen? It is `lg:hidden`, so this tracks VIEWPORT width. */
  bottomNavVisible: boolean;
  /** `env(safe-area-inset-bottom)` in px — the iPhone home indicator. */
  safeAreaBottom?: number;
};

/**
 * Available height for the console, in px.
 *
 * Returns null when the measurement isn't usable yet (zero viewport during SSR/first paint, or a
 * console pushed off-screen by an ancestor mid-transition). Callers must treat null as "don't
 * constrain" so the page falls back to natural flow rather than collapsing to nothing.
 */
export function consoleFitHeight(input: FitInput): number | null {
  const { consoleTop, viewportHeight, bottomNavVisible, safeAreaBottom = 0 } = input;

  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return null;
  if (!Number.isFinite(consoleTop)) return null;

  const bottom =
    (bottomNavVisible ? MOBILE_NAV_CLEARANCE_PX : DESKTOP_BOTTOM_GAP_PX) + Math.max(0, safeAreaBottom);

  const available = viewportHeight - consoleTop - bottom;
  return Math.max(MIN_CONSOLE_HEIGHT_PX, Math.round(available));
}

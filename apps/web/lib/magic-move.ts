/**
 * apps/web/lib/magic-move.ts
 *
 * MAGIC MOVE — one element that travels, instead of two that hand over.
 *
 * Owner, 2026-09-23, on what he actually wants: *"the idea is like how
 * keynote's magic move operate"*, and then plainly — element animation is
 * *"something I really want"*.
 *
 * ── WHAT IT IS, AND WHAT IT IS NOT ─────────────────────────────────────────
 * Everything else in `lib/hub-canvas.ts` is a HANDOVER: one section fades out,
 * the next fades in. Magic Move is the other thing. A single element stays on
 * screen and MOVES between two places as the guest scrolls — the couple's mark
 * leaves the top of the page and arrives, smaller, in the bar that follows them
 * down. No second copy, no cross-fade; the same mark the whole way.
 *
 * 🔑 THAT IS WHY IT NEEDS SCRIPT, AND WHY THE OWNER WAS ASKED. Two elements
 * handing over is pure CSS. One element travelling between two LAID-OUT places
 * needs both places measured at runtime, and only the browser knows where they
 * are. Owner, 2026-09-23: *"yes, magic move can use javascript"*.
 *
 * ⚠ AND THE GUEST PAGE ALREADY RUNS SCRIPT — a correction to what this session
 * had been saying. `_components/pahina-motion.tsx` ships three inline scripts
 * as SERVER components (no client bundle, no hydration) for the scroll reveal
 * and the hero parallax. This joins them and follows their contract exactly.
 *
 * ── THE CONTRACT, COPIED FROM THE PARALLAX ─────────────────────────────────
 * 🔒 THE SCRIPT WRITES CUSTOM PROPERTIES AND NOTHING ELSE. Never a transform,
 * never a class on the traveller. So the effect exists only while the CSS rule
 * that reads those properties matches — and that rule is gated on `.pahina-js`,
 * which three separate paths already remove (no IntersectionObserver, reduced
 * motion, a 2s self-heal when the observer never runs). No flag, no travel, and
 * the mark simply sits where the layout puts it.
 *
 * 🪤 AND ONE LESSON FROM THAT FILE, WHICH COST SEVEN WEEKS: its safety net
 * concluded "nothing to observe" DURING STREAMING, when finding nothing was a
 * lie rather than a fact, and silently suppressed the animation on every public
 * invitation. So the script below never gives up on a first empty look while
 * the document is still parsing — it retries, and says so if it really is empty.
 *
 * Pure. No I/O. The script itself lives in `_components/magic-move.tsx`.
 */

/**
 * What may travel. One for now, and the list is the point: a traveller has to
 * be an element that genuinely EXISTS in two meaningful places, which is a
 * design decision each time and not a switch a couple flips on any element.
 */
export const MAGIC_TRAVELLERS = ['mark'] as const;
export type MagicTraveller = (typeof MAGIC_TRAVELLERS)[number];

export const MAGIC_TRAVELLER_LABEL: Record<MagicTraveller, string> = {
  mark: 'Your monogram travels down the page',
};

export const MAGIC_TRAVELLER_NOTE: Record<MagicTraveller, string> = {
  mark: 'It starts large at the top and shrinks into the bar as your guests scroll — one mark the whole way, never two.',
};

/** The attribute the travelling element carries. */
export const MAGIC_TRAVELLER_ATTR = 'data-magic-traveller';
/** The attribute on the empty box it travels INTO. */
export const MAGIC_BERTH_ATTR = 'data-magic-berth';

/**
 * The stored choice, or null for "nothing travels".
 *
 * ⛔ Dropped, never repaired — the same rule the canvas follows. A value this
 * product did not write came from somewhere else, and a guess about what it
 * meant would put motion on a wedding page nobody asked for.
 */
export function sanitizeMagicTraveller(value: unknown): MagicTraveller | null {
  return typeof value === 'string' && (MAGIC_TRAVELLERS as readonly string[]).includes(value)
    ? (value as MagicTraveller)
    : null;
}

/**
 * ⛔ OFF IS THE DEFAULT, AND IT IS NOT TIMIDITY. Nothing travels until a couple
 * says so, so every page on the platform today renders byte-identically — no
 * attribute, no script, no rule that matches. This ships inert on purpose: it
 * is the first motion on the guest page that MOVES an element across the
 * viewport, and it wants a real phone and the owner's eyes before it is the
 * default for anybody.
 */
export const MAGIC_DEFAULT: MagicTraveller | null = null;

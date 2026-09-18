/**
 * turnstile-submit-gate — the one decision behind "did this tap arrive too
 * early?", kept pure so it can be EXECUTED by a test instead of grepped for.
 *
 * `TurnstileField` is a client component wired to real DOM events; a guard over
 * its source can only assert that words appear. The thing that can actually be
 * got wrong is this three-input decision, so it lives here and the component
 * calls it.
 *
 * ── WHY A TAP ARRIVES EARLY AT ALL ─────────────────────────────────────────
 * The widget is rendered `appearance:'interaction-only'`, so a legitimate
 * visitor sees NOTHING. There is no spinner to wait for and no affordance
 * suggesting patience: the page paints, the button is there, they tap. Measured
 * on production the hour captcha went live — the first tap on /papic/claim was
 * refused, and so was the second.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────────
 * QUEUE only when all three hold:
 *   • no token yet, AND
 *   • a widget exists that could still produce one, AND
 *   • we are not already holding a queued submit (else a re-submit loops).
 *
 * Otherwise PROCEED — and "proceed" deliberately includes the case where the
 * script was blocked (ad-blocker, offline, CSP): there is nothing to wait for,
 * so the server receives an empty token and refuses for itself. Holding the
 * form shut in that case would convert an honest server refusal into a button
 * that silently does nothing.
 */
export type SubmitGate = 'queue' | 'proceed';

export function decideSubmitGate(input: {
  /** Current value of the hidden `captcha_token` field. */
  token: string;
  /** True once `turnstile.render()` has returned a widget id. */
  hasWidget: boolean;
  /** True while a previous tap is already being held. */
  alreadyQueued: boolean;
}): SubmitGate {
  if (input.token) return 'proceed';
  if (!input.hasWidget) return 'proceed';
  if (input.alreadyQueued) return 'proceed';
  return 'queue';
}

/* ────────────────────────────────────────────────────────────────────────────
   THE WIDGET'S LAYOUT FLOOR — a measured bug, not a preference.

   MEASURED on production 2026-09-18, live `/papic/claim/[token]`:

     viewport 375 x 812  ->  holder 293 x   0    ← the challenge CANNOT paint
     viewport (desktop)  ->  holder 382 x  72    ← paints, solvable

   Cloudflare's `flexible` size has a MINIMUM WIDTH OF 300px. The claim card's
   horizontal padding leaves 293px at phone width — SEVEN PIXELS SHORT — so the
   widget lays out at zero height. Invisible, unsolvable, and no token is ever
   produced.

   🛑 WHY THAT IS A WEDDING-DAY BUG AND NOT A COSMETIC ONE. With
   `appearance:'interaction-only'` a trusted visitor is passed SILENTLY: no
   widget is drawn, so zero height costs nothing and the page works. The floor
   only matters when Cloudflare decides it wants an INTERACTIVE solve — and the
   thing that makes it decide that is many requests from one IP in a short
   window. That is the exact shape of a reception: a hundred guests on one
   venue WiFi scanning Papic QR codes inside the same hour. Every one of them
   is on a phone. So the failure is invisible in every test that matters and
   total on the day, for the whole photo crew, with nobody able to fix it from
   the room.

   It was found by accident: automated probing from one IP made Cloudflare
   demand interaction, which is the state no ordinary test reaches.

   ⇒ The holder therefore carries `min-width` of its own, and the negative
   inline margin below lets it reclaim the card's padding rather than overflow
   the page (a body that scrolls sideways is its own defect).
   ──────────────────────────────────────────────────────────────────────────── */

/** The `size` passed to `turnstile.render()`. One source for the component and the guard. */
export const TURNSTILE_WIDGET_SIZE = 'flexible' as const;

/** Cloudflare's documented minimum width for the `flexible` size. */
export const TURNSTILE_FLEXIBLE_MIN_WIDTH_PX = 300;

/** What the holder guarantees itself, regardless of its parent's padding. */
export const TURNSTILE_HOLDER_MIN_WIDTH_PX = 300;

/**
 * Pixels the holder may reclaim from its parent's padding on each side, so it
 * can reach the minimum without pushing the page wider than the viewport.
 *
 * ⚠ 4px was the first value here and the guard REJECTED it. It covered the
 * measured 375px case (293 + 8 = 301) and left a 320px phone short
 * (288 + 8 = 296, still under 300) — the narrow devices most likely to be
 * somebody's spare handset at a reception. 8px each side clears both with
 * room: 288 + 16 = 304.
 *
 * The cards using this apply `px-4` (16px), so reclaiming 8 leaves 8px of
 * visual margin — the widget sits slightly wider than the fields above it,
 * which is the correct trade: a bot check that cannot be tapped is not a
 * layout preference.
 */
export const TURNSTILE_HOLDER_MARGIN_RECLAIM_PX = 8;

/**
 * The coupling that must hold: whatever size the widget is rendered at, the
 * holder must guarantee at least that size's minimum width. Executed by
 * `turnstile-holder-fits.test.ts` — so changing the size option without
 * changing the floor cannot merge.
 */
export function holderMeetsWidgetMinimum(): boolean {
  const required =
    TURNSTILE_WIDGET_SIZE === 'flexible' ? TURNSTILE_FLEXIBLE_MIN_WIDTH_PX : 0;
  return TURNSTILE_HOLDER_MIN_WIDTH_PX >= required;
}

/**
 * Does the holder reach the minimum inside a parent that offers `availablePx`?
 * `availablePx` is the content width the card's padding leaves — 293 at a
 * 375px viewport, which is the case that shipped broken.
 */
export function holderFitsAt(availablePx: number): boolean {
  return (
    availablePx + TURNSTILE_HOLDER_MARGIN_RECLAIM_PX * 2 >=
    TURNSTILE_HOLDER_MIN_WIDTH_PX
  );
}

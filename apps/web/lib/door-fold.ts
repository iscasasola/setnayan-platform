/**
 * lib/door-fold.ts — a door's one action belongs on the first screen of a phone.
 *
 * WHY THIS FILE EXISTS. `/{slug}/invite` door 01 (the Name step) is the screen a
 * guest meets after scanning a printed QR, on a phone, having never seen the
 * product. Measured in a browser on the real component tree at 375×812, the top
 * of its "Continue" button sat at:
 *
 *     theme      "Cale & Ice" (10)   27 chars   45 chars
 *     House            599              599        615
 *     Capiz            622              622        638
 *     Galeriya         635              654        691
 *     Velvet           648              669        720     ← merged and live
 *
 * against a **640px** bar — the usable height of a 375×812 phone once the
 * browser's own chrome is on screen.
 *
 * 🔑 THE BAR IS A PROPERTY OF THE DOOR, NOT OF A THEME. Velvet misses it on a
 * TEN-character name, and the two themes whose skin sets the name at 40px miss
 * it on any long one. Shortening a theme's ornament would fix one theme at one
 * name length and leave the cause standing — and Abaca would arrive with the
 * identical question. So the fix is in `DoorShell`, and a theme shipped
 * tomorrow inherits it without knowing this file exists.
 *
 * ⛔ WHAT THIS MODULE IS NOT. It does not measure anything. It holds the one
 * DECISION a session can get wrong — how far a long name is allowed to be set
 * down — as a pure function, so a `tsx --test` can EXECUTE it rather than grep
 * for it. The geometry it feeds is asserted in
 * `app/_components/door/the-door-keeps-its-action-on-screen.test.ts`.
 */

/**
 * THE BAR, in CSS pixels from the top of the document, at 375×812.
 *
 * 812 is the viewport; 640 is what is left of it on a phone whose browser is
 * showing its address bar and its toolbar. A control below this line exists but
 * is not on the first screen, and a guest who does not scroll never finds it.
 */
export const DOOR_FOLD_BAR = 640;

/**
 * A name up to this many characters is set at exactly the size its theme asks
 * for. "Cale & Ice" is 10 · "Bea & Miguel" is 12 · "Maria & Juan Carlos" is 19 —
 * ordinary two-name marks are untouched, which is the point: nothing about the
 * shipped look changes for the couples whose door already fits.
 */
export const DOOR_TITLE_FULL_CHARS = 26;

/**
 * How far down a name may ever be set. Below this the mark stops reading as the
 * couple's name and starts reading as a caption, so the floor is a design
 * limit, not an arithmetic one — a name long enough to hit it takes the floor
 * and the door absorbs the rest (it still clears the bar; see the test).
 */
export const DOOR_TITLE_MIN_RATIO = 0.72;

/**
 * THE NAME IS FITTED, NEVER TRUNCATED.
 *
 * A 45-character name set at Velvet's 40px takes FOUR lines in the card's 295px
 * of content — 168px of the fold for two people's names, which is what pushes
 * "Continue" to 720. Clipping it is not an option: on this screen the name is
 * the reason the reader trusts the link. So it is set smaller, proportionally
 * to its length, and the couple's whole name is always on the card.
 *
 * 🔑 IT IS A RATIO, NOT A SIZE, AND THAT IS THE WHOLE TRICK. Each theme sets its
 * own name size in its own stylesheet (House 24px · Velvet and Galeriya 40px)
 * and a skin's rule out-specifies anything the shell could say about
 * `font-size`. A ratio multiplies whatever the theme asked for, so the shell
 * imposes a CEILING without ever naming a size — it does not restyle the card
 * and it does not need to know which themes exist.
 *
 * Returned as a CSS `zoom` value because `zoom` is the one multiplier that
 * changes LAYOUT: a `transform: scale()` would paint the name smaller and
 * reserve exactly the same 168px, moving no pixel of the thing this is for.
 *
 * @returns the zoom value for the title, or `undefined` when the name is short
 *          enough to be set as its theme asks (the common case).
 */
export function doorTitleFit(title: string): string | undefined {
  const length = title.trim().length;
  if (length <= DOOR_TITLE_FULL_CHARS) return undefined;
  const ratio = Math.max(DOOR_TITLE_MIN_RATIO, DOOR_TITLE_FULL_CHARS / length);
  // Two decimals: a bare ratio is a valid `zoom`, and rounding keeps the
  // server-rendered attribute byte-stable for a given name.
  return ratio.toFixed(2);
}

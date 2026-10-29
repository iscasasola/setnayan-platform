/**
 * 🌫 THE ONE SCRIM — what a scrim is, in one place (owner 2026-10-29: *"the darkness of each scrims from different
 * places are different"* · *"make sure future scrims are connected to our design"*).
 *
 * A scrim is the dark behind anything popped up over the page. There is ONE way to draw it: `<OverlayBackdrop>`
 * (`app/_components/overlay-backdrop.tsx`), which wears `.sn-popup-dark`; a scrim that cannot be that component (a
 * stylesheet-only one, a panel's own) wears `.sn-popup-dark` or reads the `--sn-scrim*` tokens. The tokens
 * (`globals.css` `:root` and `html.dark`):
 *   --sn-scrim        the dark (light: the page's ink at 42 %; dark mode: black at 55 %)
 *   --sn-scrim-solid  the deeper dark alone, where blur is unsupported or less transparency is asked for
 *   --sn-scrim-blur   the partial blur that keeps the eye on the pop-up (6 px)
 *   --sn-scrim-fade   how long the dark takes to fade out after a tap (200 ms)
 * 🔒 `lib/one-scrim.test.ts`.
 */

/** Every element that is a scrim. `PressFeel` never dips one; `OverlayBackdrop` counts them to blur only once. */
export const SCRIM_SELECTOR = '.sn-popup-dark, [data-overlay-backdrop], .sn-side-panel-scrim, .sn-inspector-peek';

/** `200ms` → 200 · `0.2s` → 200 · anything unreadable → 200. */
export function scrimFadeMs(token: string): number {
  const t = token.trim();
  const n = parseFloat(t);
  if (!(n >= 0)) return 200;
  return /ms$/.test(t) ? n : /s$/.test(t) ? n * 1000 : n;
}

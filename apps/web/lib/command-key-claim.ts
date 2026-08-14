/**
 * command-key-claim.ts — who owns ⌘K / Ctrl-K on the screen right now.
 *
 * ─── THE DEFECT THIS EXISTS TO PREVENT ───────────────────────────────────
 * Four components in this repo bind ⌘K:
 *
 *   home-command-bar.tsx      the shared top bar's palette (from 2026-08-14)
 *   admin-command-palette.tsx every /admin page (108 of them)
 *   ugat-console.tsx          /admin/ugat
 *   guests-search.tsx         /dashboard/[eventId]/guests
 *
 * Until the top bar was shared, the first of those mounted on ONE route, and
 * its own docblock said so: *"This component only ever mounts on the launcher
 * route, so the two listeners never coexist."* Mounting it app-wide made that
 * sentence false everywhere at once — and two `keydown` listeners both firing
 * on one keystroke opens two dialogs stacked on each other, with the second
 * stealing focus from the first. Nothing throws. It just looks broken.
 *
 * 🔑 A CLAIM, NOT A ROUTE LIST. The competing owners are a PAGE (guests) and a
 * LAYOUT (admin); the shared bar lives above both and cannot know which route
 * is rendering. So the owner announces itself on mount and withdraws on
 * unmount, and the shared palette asks. A route allow-list in the shell would
 * be a fifth place to remember, and the first new palette would forget it.
 *
 * ⚠ COUNTED, NOT BOOLEAN. Two claimants can overlap for one render during a
 * client-side navigation (React mounts the next tree before unmounting the
 * last), and a boolean would be cleared by the departing one while the
 * arriving one still holds the key. The count only reaches 0 when nobody
 * holds it.
 *
 * This is the same shape as `anyModalOpen()` in `lib/use-modal-a11y.ts`, which
 * the palette already consults for a different reason (never stack a dialog
 * under an open one). Both answer "is something else in charge of this input
 * right now?", and neither can be answered from props.
 */

let claims = 0;

/**
 * Take ⌘K for as long as the caller is mounted. Returns the release function,
 * so the idiomatic use is a bare `useEffect(() => claimCommandKey(), [])`.
 *
 * ⚠ THE RELEASE IS IDEMPOTENT. React 18 StrictMode mounts, unmounts and
 * remounts an effect in development; a release that ran twice would drive the
 * count negative and hand the key back while a real owner still held it.
 */
export function claimCommandKey(): () => void {
  claims += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    claims = Math.max(0, claims - 1);
  };
}

/** True when another component on screen owns ⌘K. */
export function commandKeyClaimed(): boolean {
  return claims > 0;
}

/**
 * The one option the opener takes.
 *
 * Split into its own module so the PROVIDER — which lives in the root layout —
 * can type its state without importing the panel, and therefore without
 * dragging the login form into every page's first-load JS. A `import type`
 * would be erased anyway, but this keeps the boundary obvious rather than
 * dependent on a reader noticing the word `type`.
 */
export type OpenSignInOptions = {
  /**
   * Ran after a successful in-place sign-in, before the refresh. The shop
   * page's Save button uses it to retry the save the person had already
   * pressed, so the four presses in the prototype are four presses here.
   * `landing` is the person's profile page when the panel was opened from `/`
   * (nowhere of its own to stay on — owner 22 Nov 2026), else `null`.
   */
  onSignedIn?: (landing: string | null) => void;
  /**
   * 🪟 THE THIRD PANE (owner 2026-11-06, the supplier sign-up redesign: "on tablet and desktop a pop-up is a THIRD
   * PANE on the right, never floating; on the phone it is the bottom sheet"). The same card in the shipped
   * `SidePanel` (`size="wide"`, `phone="sheet"`) instead of the centred overlay. Default: the overlay, as before.
   */
  pane?: boolean;
};

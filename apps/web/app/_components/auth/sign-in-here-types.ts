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
   */
  onSignedIn?: () => void;
};

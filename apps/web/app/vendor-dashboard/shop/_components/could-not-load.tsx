/**
 * could-not-load.tsx
 *
 * One line, for the moment a panel has to admit it could not read something —
 * as opposed to reading it and finding nothing.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * My Shop wraps every optional read in a `try/catch` that degrades to an empty
 * value, so one hiccup cannot blank the page. That is right. What was wrong is
 * that the empty value is INDISTINGUISHABLE from the real thing: a supplier
 * whose review read failed was shown "No reviews yet — once couples review
 * you…", and one whose logo presign failed was shown their initials. The page
 * told them their shop was empty. It was not.
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL. Every one of those probes can be made to
 * log, and the supplier still sees the same empty shop. The measurement has to
 * reach the RENDER, which is what this component is for.
 *
 * ⚠ USE IT ONLY WHERE THE FAILURE IS OTHERWISE INVISIBLE. If the panel can
 * already tell (it asked for nine photos and got seven), it does not need to be
 * told. Printing a warning next to something that is plainly fine trains people
 * to stop reading warnings.
 */
export function CouldNotLoad({ what }: { what: string }) {
  return (
    <p
      role="status"
      className="text-sm font-medium"
      style={{ color: 'rgb(var(--color-warn))' }}
      data-could-not-load
    >
      {/* Design template rule 6: a failed read never looks like "none" — amber, short, and how to try again. */}
      Couldn&apos;t load {what} — your shop is unchanged. Refresh in a moment to try again.
    </p>
  );
}

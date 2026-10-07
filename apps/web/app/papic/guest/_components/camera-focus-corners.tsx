/**
 * 🎯 THE FOCUS CORNERS — four L-shaped corners framing the viewfinder, drawn in
 * `tint` (white for Classic and Challenges, the theme's colour for Your brand).
 * Decorative only: no hit area, nothing a screen reader reads.
 *
 * Its own file (2026-10-07) so the Maker's Camera › Style › Look miniatures
 * draw the SAME corners the guest camera draws (`papic-guest-capture.tsx`),
 * without loading the camera.
 */
export function FocusCorners({ tint, inset = 'inset-8' }: { tint: string; inset?: string }) {
  const arm = 'absolute h-7 w-7';
  const line = { borderColor: tint };
  return (
    <div aria-hidden data-focus-corners="" className={`pointer-events-none absolute ${inset}`}>
      <span className={`${arm} left-0 top-0 border-l-2 border-t-2`} style={line} />
      <span className={`${arm} right-0 top-0 border-r-2 border-t-2`} style={line} />
      <span className={`${arm} bottom-0 left-0 border-b-2 border-l-2`} style={line} />
      <span className={`${arm} bottom-0 right-0 border-b-2 border-r-2`} style={line} />
    </div>
  );
}

/**
 * 📱 THE TAPPED PART STAYS IN SIGHT ABOVE THE SHEET (owner, live phone test
 * 2026-10-02: "the edit sheet covers about half the screen, and the preview
 * behind it is shifted and clipped"). On a phone the part sheet rises from the
 * bottom over the canvas; the part being edited must sit in the band of canvas
 * still showing above it. Pure — how far to scroll the canvas, in CSS px —
 * so a guard can hold the rule (`lib/part-above-sheet.test.ts`); the DOM half
 * is `keepPartAboveSheet` in `element-sheet.tsx`.
 *
 *   · already wholly inside the band (with a margin) → 0, the canvas stays;
 *   · fits the band → centred in it;
 *   · taller than the band → its top at the margin (its start is what is read).
 */
export const PART_SHEET_MARGIN = 12;

export function scrollToClearSheet(input: {
  /** The part's top, in the canvas viewport (CSS px). */
  partTop: number;
  partHeight: number;
  /** How much of the canvas shows above the sheet (CSS px). */
  band: number;
  margin?: number;
}): number {
  const m = input.margin ?? PART_SHEET_MARGIN;
  const band = Math.max(0, input.band);
  if (band <= 2 * m) return 0; // nothing honest to aim for — leave the canvas be
  if (input.partTop >= m && input.partTop + input.partHeight <= band - m) return 0;
  const top = input.partHeight + 2 * m <= band ? (band - input.partHeight) / 2 : m;
  return Math.round(input.partTop - top);
}

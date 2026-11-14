/**
 * 📐 THE AWARD VIEWS SIZE FROM THE SCREEN (owner 15 Nov: *"Maximize the screen to adapt"*; *"Share button should
 * never overlap"*; *"The placque doesnt fit my phone"*). The two measurements of the approved prototype
 * (`badge-milestones_v35.html` `bzLayout` and `awFit`), as pure functions so a test can hold them at every size.
 *
 * PURE — numbers in, numbers out.
 */

/** Space kept above the badge (the close control lives there). */
export const BZ_TOP = 64;
/** Gap between the badge's foot and the caption. */
export const BZ_GAP = 40;

export type BadgeStack = {
  /** Badge box side, px. */
  size: number;
  /** Badge centre, px. */
  cx: number;
  cy: number;
  /** Caption's top edge, px. */
  capTop: number;
  /** The badge's floor shadow top, px. */
  shadowTop: number;
};

/**
 * `bzLayout`: badge → caption (with Share) → hallmark is a STACK. The room above the hallmark is measured and the
 * badge shrinks so all of it fits — never on top of each other. `min(92vw, 520px, 60vh, room left)`, floor 110.
 */
export function badgeStack(vw: number, vh: number, hallmarkBlock: number, captionH: number): BadgeStack {
  const avail = vh - hallmarkBlock - 14 - BZ_TOP;
  const size = Math.round(Math.max(110, Math.min(vw * 0.92, 520, vh * 0.6, avail - captionH - BZ_GAP)));
  const block = size + BZ_GAP + captionH;
  const cy = BZ_TOP + Math.max(0, (avail - block) / 2) + size / 2;
  return { size, cx: vw / 2, cy, capTop: cy + size * 0.5 + BZ_GAP, shadowTop: cy + size * 0.5 + 6 };
}

/**
 * `awFit`: the plaque and its share button scale down TOGETHER until the whole thing fits (transform scale, not
 * `zoom` — zoom failed on iPhone). Never grows past 1.
 */
export function plaqueScale(boxW: number, boxH: number, contentW: number, contentH: number): number {
  if (contentW <= 0 || contentH <= 0) return 1;
  const k = Math.min(1, (boxH - 20) / contentH, (boxW - 16) / contentW);
  // floored, never rounded up: a rounding up of 0.00005 can push the bottom edge a pixel past the screen
  return Math.max(0.1, Math.floor(k * 1e4) / 1e4);
}

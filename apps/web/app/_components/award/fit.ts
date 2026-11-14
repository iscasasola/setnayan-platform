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

/** The plaque's share button: its full height never shrinks (owner 15 Nov, "Stay full size") — 44 px tap floor. */
export const SHARE_H = 44;
/** Gap between the plaque's foot and the share button, and the margin kept under the button (px, unscaled). */
export const SHARE_GAP = 18;
export const SHARE_FOOT = 4;

export type PlaqueLayout = {
  /** The plaque's transform scale (≤ 1). */
  k: number;
  /** The scaled plaque's top edge, px from the dialog's top. */
  top: number;
  /** The scaled plaque's bottom edge. */
  bottom: number;
  /** The share button's top edge (full size, under the plaque); null with no button. */
  shareTop: number | null;
};

/**
 * Owner 15 Nov, on the plaque's share button: *"Stay full size"*. Only the PLAQUE scales (transform, never `zoom`); the
 * button keeps its full height and sits under it. The fit reserves the button's full height + its gap + a foot margin
 * first, then scales the plaque into what is left; plaque + button are centred as one block.
 */
export function plaqueLayout(boxW: number, boxH: number, contentW: number, contentH: number, shareH: number | null): PlaqueLayout {
  const foot = shareH == null ? 0 : SHARE_GAP + Math.max(SHARE_H, shareH) + SHARE_FOOT;
  const k = plaqueScale(boxW, boxH - foot, contentW, contentH);
  const block = contentH * k + foot;
  const top = Math.max(10, (boxH - block) / 2);
  const bottom = top + contentH * k;
  return { k, top, bottom, shareTop: shareH == null ? null : bottom + SHARE_GAP };
}

/**
 * `awFit`: the plaque scales down until it fits the room it is given (transform scale, not `zoom` — zoom failed on
 * iPhone). Never grows past 1.
 */
export function plaqueScale(boxW: number, boxH: number, contentW: number, contentH: number): number {
  if (contentW <= 0 || contentH <= 0) return 1;
  const k = Math.min(1, (boxH - 20) / contentH, (boxW - 16) / contentW);
  // floored, never rounded up: a rounding up of 0.00005 can push the bottom edge a pixel past the screen
  return Math.max(0.1, Math.floor(k * 1e4) / 1e4);
}

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

const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

/** v49 — the No. 1 exit: the stage (and its letter-box) dims away from 0.05 s to 0.8 s after the medal leaves. */
export function exitStageAlpha(te: number): number {
  return 1 - smooth((te - 0.05) / 0.75);
}

/**
 * v49 — where the flying medal lands and how big it ends: the CENTRE of the award's own viewBox as drawn inside the
 * mounted svg at rest (`tb` = that svg's box, `mv` = its viewBox; it is letter-boxed by `meet`), and the scale that turns
 * the staged medal (`dw` canvas px across its viewBox `vb`, drawn at `k`) into the mounted one. Without a viewBox: the
 * box centre and width.
 */
export function flightTarget(
  tb: { left: number; top: number; width: number; height: number },
  mv: readonly number[],
  vb: readonly number[],
  dw: number,
  k: number,
  w: number,
): { x: number; y: number; scale: number } {
  let x = tb.left + tb.width / 2;
  let y = tb.top + tb.height / 2;
  let scale = tb.width / (w || 1);
  const [m0, m1, m2, m3] = mv;
  const [v0, v1, v2, v3] = vb;
  if (mv.length === 4 && m2! > 0 && m3! > 0 && vb.length === 4 && v2! > 0) {
    const s2 = Math.min(tb.width / m2!, tb.height / m3!);
    const lx = tb.left + (tb.width - m2! * s2) / 2;
    const ly = tb.top + (tb.height - m3! * s2) / 2;
    x = lx + (v0! + v2! / 2 - m0!) * s2;
    y = ly + (v1! + v3! / 2 - m1!) * s2;
    scale = s2 / ((dw / v2!) * k);
  }
  return { x, y, scale };
}

/**
 * v86 `arcFrames` (owner 15 Nov: "the seal landing to the plaque is still not smooth"): the flight is ONE smooth curve
 * — a quadratic arc 70 px above the higher end, sampled densely (29 keyframes, so there is no corner mid-way) — ending
 * EXACTLY on the mounted seal at its mounted scale and upright, so the mounted seal takes over at rest with no jump.
 * (x0, y0, s0, r0) is where the flyer starts (translate px, scale, rotation rad); (x1, y1, s1) where it lands.
 */
export function arcFrames(x0: number, y0: number, s0: number, r0: number, x1: number, y1: number, s1: number): Keyframe[] {
  const cx = (x0 + x1) / 2;
  const cy = Math.min(y0, y1) - 70;
  const N = 28;
  const F: Keyframe[] = [];
  for (let i = 0; i <= N; i++) {
    const e = i / N;
    const u = 1 - e;
    const x = u * u * x0 + 2 * u * e * cx + e * e * x1;
    const y = u * u * y0 + 2 * u * e * cy + e * e * y1;
    const b = Math.sin(Math.PI * e);
    F.push({
      offset: e,
      transform: `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${(s0 + (s1 - s0) * e + 0.06 * b * ((s0 + s1) / 2)).toFixed(4)}) rotate(${(r0 * u - 0.1 * b).toFixed(4)}rad)`,
    });
  }
  return F;
}

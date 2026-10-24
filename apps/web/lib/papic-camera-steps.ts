/**
 * 📷 THE GUEST CAMERA'S ZOOM STEPS AND TAP-TO-FOCUS POINT — pure, so the rules
 * are executed by a test rather than re-read from JSX.
 *
 * Owner, 24 Oct 2026, on `prototypes/papic_camera_complete_2026-10-24_fable.html`
 * ("Okay build it"), the three picks:
 *   1. **2× shows on every phone** — a real 2× where the camera's own zoom
 *      reaches it, otherwise a digital crop of the main camera.
 *   2. "Tag who's in it" sits beside the shutter (the component, not here).
 *   3. "My shots" is this phone's shots, as a sheet over the camera (the
 *      component, not here).
 * And, in the same prototype: **on the selfie camera the pill drops to the
 * steps that camera has — no 0.5×.**
 *
 * `hardware` is what `usePapicCamera` found for the CURRENT facing (`[1]`, or
 * `[0.5, 1]` where an ultra-wide is reachable). The seat and supplier cameras
 * keep reading `lensOptions` directly and are unchanged.
 */

export type ZoomStep = 0.5 | 1 | 2;
export type CameraFacing = 'environment' | 'user';

const ORDER: readonly ZoomStep[] = [0.5, 1, 2];

/** The steps the guest camera's zoom pill draws, in order. Always 1× and 2×. */
export function zoomSteps(hardware: readonly number[], facing: CameraFacing): ZoomStep[] {
  return ORDER.filter((s) => {
    if (s === 0.5) return facing === 'environment' && hardware.includes(0.5);
    return true;
  });
}

/** ".5", "1", "2" — the × is drawn beside it, smaller. */
export function zoomLabel(step: number): string {
  return step === 0.5 ? '.5' : String(step);
}

/** The grid's remembered on/off, per device (owner prototype: "Remembered on the device"). */
export const PAPIC_GRID_STORAGE_KEY = 'papic:camera-grid';

/**
 * Where on the camera's own frame a tap landed, as 0–1 (the shape of the
 * `pointsOfInterest` constraint) — or null when the tap missed the picture.
 *
 * The preview is `object-cover` (a centre crop of the frame), may be scaled by
 * a digital 2× crop about its centre, and is mirrored on the selfie camera;
 * the frame itself is none of those.
 */
export function focusPointFromTap(input: {
  tapX: number;
  tapY: number;
  boxW: number;
  boxH: number;
  videoW: number;
  videoH: number;
  crop: number;
  mirrored: boolean;
}): { x: number; y: number } | null {
  const { boxW, boxH, videoW, videoH } = input;
  if (!(boxW > 0 && boxH > 0 && videoW > 0 && videoH > 0)) return null;
  const crop = input.crop > 0 ? input.crop : 1;
  // Undo the centre scale of a digital crop.
  let x = boxW / 2 + (input.tapX - boxW / 2) / crop;
  const y = boxH / 2 + (input.tapY - boxH / 2) / crop;
  // Undo the selfie mirror.
  if (input.mirrored) x = boxW - x;
  // Undo object-cover.
  const scale = Math.max(boxW / videoW, boxH / videoH);
  const dw = videoW * scale;
  const dh = videoH * scale;
  const fx = (x - (boxW - dw) / 2) / dw;
  const fy = (y - (boxH - dh) / 2) / dh;
  if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
  return { x: fx, y: fy };
}

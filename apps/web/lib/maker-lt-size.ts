/**
 * lib/maker-lt-size.ts — ↕ THE LOWER THIRD'S DRAG, as arithmetic (owner, live iPhone
 * 2026-10-06: *"Also the lower third screen can be resized up to lower half of the
 * screen. Drag the edge to resize"*; DECISION_LOG "THE LOWER THIRD CAN BE RESIZED").
 * Between its default (`MAKER_LT_HEIGHT`, `makerLtHeightPx`) and the lower half of the
 * screen (`MAKER_LT_HALF_SHARE`), never more; a tap toggles; remembered per device as a
 * share of the screen. Pure — and imported only by the handle (`stages-studio-parts.tsx`),
 * so none of it rides the Maker's first load.
 */
import { MAKER_LT_HALF_SHARE, makerLtHeightPx } from '@/lib/maker-phone-room';

/** Where a device remembers its size (the share of the screen's height). */
export const MAKER_LT_SIZE_KEY = 'sn-maker-lt-share';
/** A drag shorter than this is a tap on the handle. */
export const MAKER_LT_TAP_PX = 6;

/** The lower third's height for a dragged-to `px`, kept between its default and half the screen. */
export function makerLtClampPx(px: number, viewportH: number): number {
  const min = makerLtHeightPx(viewportH);
  const max = Math.max(min, MAKER_LT_HALF_SHARE * viewportH);
  return Math.round(Math.min(max, Math.max(min, px)));
}

/** A tap on the handle: at (or past) the middle it goes back to the default, else up to half. */
export function makerLtTapPx(currentPx: number | null, viewportH: number): number {
  const min = Math.round(makerLtHeightPx(viewportH));
  const max = makerLtClampPx(Number.POSITIVE_INFINITY, viewportH);
  const at = currentPx ?? min;
  return at >= (min + max) / 2 ? min : max;
}

/** A remembered share, read back for this screen — null when nothing (or nothing sane) is kept. */
export function makerLtStoredPx(raw: string | null, viewportH: number): number | null {
  if (raw === null) return null;
  const share = Number(raw);
  if (!Number.isFinite(share) || share <= 0 || share > 1) return null;
  return makerLtClampPx(share * viewportH, viewportH);
}

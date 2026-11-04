/**
 * The frame shapes and their aspects — a LEAF module (no imports), shared by the Frame step's geometry
 * (`lib/photo-frame.ts`) and the Seal and plate's (`lib/photo-mark-geometry.ts`, which re-exports these).
 *
 * Kept apart so a page that only displays a framed photo (`FramedImg`, the supplier avatar on every event
 * page) loads these three lines and not the mark's whole geometry.
 */
export type Box = { left: number; top: number; width: number; height: number };

export type FrameShape = 'square' | 'circle' | 'wide' | 'phone';

/** Aspect (w/h) of each frame shape. Wide = 5:2, the cover's phone aspect; phone = 9:16. */
export const FRAME_ASPECT: Readonly<Record<FrameShape, number>> = { square: 1, circle: 1, wide: 2.5, phone: 9 / 16 };

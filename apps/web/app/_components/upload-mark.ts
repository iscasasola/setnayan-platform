/**
 * ONE lazy door for a supplier upload's mark and frame (Seal and plate + Photo Frame Template, 2026-11-04).
 *
 * FileUpload import()s THIS module, never the parts, so the Frame step, its framing math and the upload's one
 * server action arrive as ONE chunk after a pick. The mark's painter and layout are not here: they come with
 * `lib/watermark.ts` (the Frame step imports them from there), whose chunk already exists for the plain
 * watermark. 🔑 Why one door: every separate lazy chunk is one more entry in the webpack runtime that EVERY
 * page loads, and the shared bundle had 19 bytes of room (`scripts/check-bundle-size.mjs`, measured
 * 2026-11-04: three separate chunks put it 13 bytes over).
 */
export { FrameStep } from './frame-step';
export { photoMark } from './photo-mark-actions';
export { FRAME_ASPECT, frameRect, framedFileName, framingFromRef } from '@/lib/photo-frame';

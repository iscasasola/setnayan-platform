/**
 * 📐 ONE FRAME: A PAPIC PHOTO IS 9:16 PORTRAIT, AND THE VIEWFINDER SHOWS EXACTLY THAT (owner 2026-10-30, verbatim:
 * *"we took a 1:1 photo but it save a portrait photo"* → *"so viewfinder needs to be portrait"* → *"9:16"*).
 *
 * The Papic viewfinder used to draw the camera `object-cover` into whatever box the screen left it — near-square on a
 * phone — while the shutter kept the whole frame, so a square on screen came back as a tall photo. Now there is one
 * frame and both sides use it:
 *   · `papicFrameAspect` — 9:16 for a portrait camera frame; a phone held sideways delivers a landscape frame, and the
 *     same frame turned with it, 16:9, is kept (the shipped camera always followed the phone's orientation — it kept
 *     the frame the phone delivered — so a sideways phone still makes a sideways photo, now in the same 9:16 shape);
 *   · `papicFrameCrop` — the centre of the camera frame in that shape, in the video's own pixels, further narrowed
 *     about its centre by a digital zoom (2× on a phone with no 2× of its own). The shutter draws exactly this;
 *   · the viewfinder is a box of `papicFrameAspect` with the video `object-cover` inside it — `object-cover` into a
 *     box of this shape shows exactly this crop, and the CSS 2× scales it about the same centre.
 *
 * Pure, so it is executed in a test.
 */
export type CropRect = { sx: number; sy: number; sw: number; sh: number };

/** Width ÷ height of the one Papic photo: 9:16 portrait. */
export const PAPIC_PHOTO_ASPECT = 9 / 16;

/** The shape kept for a camera frame of this size: 9:16, or 16:9 when the phone is held sideways. */
export function papicFrameAspect(video: { width: number; height: number }): number {
  return video.width > video.height ? 1 / PAPIC_PHOTO_ASPECT : PAPIC_PHOTO_ASPECT;
}

export function papicFrameCrop(video: { width: number; height: number }, zoom = 1): CropRect {
  const { width: vw, height: vh } = video;
  const ar = papicFrameAspect(video);
  // The largest centred rectangle of shape `ar` inside the frame: trim the sides of a frame wider than it, the top and
  // bottom of a frame taller than it.
  let w = vw;
  let h = vh;
  if (vw / vh > ar) w = vh * ar;
  else h = vw / ar;
  const z = zoom > 1 ? zoom : 1;
  const sw = Math.max(1, Math.min(vw, Math.round(w / z)));
  const sh = Math.max(1, Math.min(vh, Math.round(h / z)));
  return { sx: Math.round((vw - sw) / 2), sy: Math.round((vh - sh) / 2), sw, sh };
}

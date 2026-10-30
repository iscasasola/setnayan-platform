/**
 * 📐 WHAT THE VIEWFINDER SHOWS IS WHAT THE PHOTO KEEPS (owner 2026-10-30: *"i took a video and photo on a 1:1 screen
 * but it save a portrait shot?"*).
 *
 * The Papic viewfinder draws the camera with `object-cover` into whatever box the screen leaves it — near-square on a
 * phone — so it shows the CENTRE of a portrait frame. The shutter used to keep the whole frame, so a square on screen
 * came back as a tall photo. This is the region `object-cover` shows, in the video's own pixels, further narrowed
 * about its centre by a digital zoom (2× on a phone with no 2× of its own). Pure, so it is executed in a test.
 */
export type CropRect = { sx: number; sy: number; sw: number; sh: number };

export function viewfinderCrop(
  video: { width: number; height: number },
  box: { width: number; height: number } | null,
  zoom = 1,
): CropRect {
  const { width: vw, height: vh } = video;
  let w = vw;
  let h = vh;
  // object-cover: the frame is scaled until it COVERS the box, and the box shows its middle.
  if (box && box.width > 0 && box.height > 0) {
    const scale = Math.max(box.width / vw, box.height / vh);
    w = Math.min(vw, box.width / scale);
    h = Math.min(vh, box.height / scale);
  }
  const z = zoom > 1 ? zoom : 1;
  const sw = Math.max(1, Math.round(w / z));
  const sh = Math.max(1, Math.round(h / z));
  return { sx: Math.round((vw - sw) / 2), sy: Math.round((vh - sh) / 2), sw, sh };
}

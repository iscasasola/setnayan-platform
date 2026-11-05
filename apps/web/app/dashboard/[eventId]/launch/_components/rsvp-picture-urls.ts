/**
 * 🖼 A PICTURE JUST CHOSEN, SHOWN AT ONCE — the couple's own file, by its ref, as a local address (`URL.createObjectURL`
 * of the file they picked) for the session. The Maker's canvas draws a picture line the moment it is added or
 * replaced (`rsvp-canvas-arrange.ts`), before any render could sign its file: the page's own `<img>` (signed by the
 * server, `signRsvpPictures`) takes over on the next render that draws it.
 *
 * The scene upload keeps its fresh uploads the same way (`scene-background-row.tsx` `justUploaded`). The frame is
 * same-origin, so a local address made here is good inside it. Loaded with the lazy RSVP stage only.
 */
const urls = new Map<string, string>();

export function keepRsvpPictureUrl(ref: string, url: string): void {
  urls.set(ref, url);
}
export function rsvpPictureUrl(ref: string): string | null {
  return urls.get(ref) ?? null;
}

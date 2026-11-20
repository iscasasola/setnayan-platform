/**
 * 🎬 A PICTURE BADGE, READY FOR THE STORY. The story scene (`story-rig.ts`) paints SVG markup — the kit's own art
 * (`serializeArt`) is always an `<svg>`. The live Shop › Badges row draws the approved v84 badges as `.webp` pictures
 * (`public/badges/v84/*.webp`), so `serializeArt` finds no `<svg>` and would hand the story an empty string: the
 * video would play with no badge in it.
 *
 * This wraps the picture in an SVG the rig can paint. An SVG decoded as an image may not load anything from outside
 * itself (measured 21 Nov in Chromium: a file URL inside it draws the broken-image icon), so the picture is carried
 * INSIDE it as a data URL — the same-origin picture the row already drew, painted onto a canvas on the device and read
 * back (no fetch: award-kit rule 8). Its viewBox is the picture's own canvas, so the rig sizes it like any other award.
 *
 * Client-only, on a tap. Throws if the picture cannot be decoded — the caller then falls back.
 */
export function pictureSvg(dataUrl: string, w: number, h: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<image href="${dataUrl}" xlink:href="${dataUrl}" x="0" y="0" width="${w}" height="${h}"/></svg>`
  );
}

export async function pictureStorySvg(src: string, w: number, h: number): Promise<string> {
  const im = new Image();
  im.decoding = 'async';
  im.src = src;
  await im.decode();
  const c = document.createElement('canvas');
  c.width = im.naturalWidth || w;
  c.height = im.naturalHeight || h;
  const x = c.getContext('2d');
  if (!x) throw new Error('no 2d canvas');
  x.drawImage(im, 0, 0, c.width, c.height);
  return pictureSvg(c.toDataURL('image/png'), w, h);
}

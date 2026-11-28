/**
 * 👗 A SHOP'S FABRIC PHOTO → ITS SMALL SWATCH (gown maker port step B5; prototype v187 "6.4a, small swatches").
 *
 * In the designer's browser only (a canvas), never on the server and never for a bride: from one picked photo, the
 * centre square becomes
 *   · a 64 px WebP thumbnail (1–3 KB) — every fabric has one, so a 12-fabric list stays well under 40 KB of images;
 *   · for a PATTERNED cloth only, a 512 px WebP repeat tile — fetched by the mannequin only when the fabric is picked.
 *     A plain fabric has no tile, so picking it makes no tile request;
 *   · the photo's average colour, offered as the fabric's colour (the prototype's "colour from the photo").
 * The colour is the CLOTH's own colour (product data), not a page colour.
 */

export const GOWN_SWATCH_THUMB_PX = 64;
export const GOWN_SWATCH_TILE_PX = 512;

export type GownSwatch = { thumb: Blob; tile: Blob | null; hex: string };

/** The centre square of an image, as [sx, sy, side]. */
export function centreSquare(width: number, height: number): [number, number, number] {
  const side = Math.min(width, height);
  return [Math.round((width - side) / 2), Math.round((height - side) / 2), side];
}

/** "#rrggbb" from an RGBA pixel buffer's average (every 4th pixel; transparent ones skipped). */
export function averageHex(rgba: ArrayLike<number>): string {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i + 3 < rgba.length; i += 16) {
    if (rgba[i + 3]! < 8) continue;
    r += rgba[i]!; g += rgba[i + 1]!; b += rgba[i + 2]!; n += 1;
  }
  if (!n) return '#ffffff';
  return '#' + [r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('');
}

function square(source: CanvasImageSource, w: number, h: number, px: number): HTMLCanvasElement {
  const [sx, sy, side] = centreSquare(w, h);
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  if (!g) throw new Error('no canvas');
  g.imageSmoothingQuality = 'high';
  g.drawImage(source, sx, sy, side, side, 0, 0, px, px);
  return c;
}

const toWebp = (c: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('no blob'))), 'image/webp', quality));

/** One picked photo → its swatch. Throws when the file is not a photo the browser can open. */
export async function gownSwatchFromFile(file: File, patterned: boolean): Promise<GownSwatch> {
  const bitmap = await createImageBitmap(file);
  try {
    const thumbCanvas = square(bitmap, bitmap.width, bitmap.height, GOWN_SWATCH_THUMB_PX);
    const px = thumbCanvas.getContext('2d')!.getImageData(0, 0, GOWN_SWATCH_THUMB_PX, GOWN_SWATCH_THUMB_PX).data;
    const [thumb, tile] = await Promise.all([
      toWebp(thumbCanvas, 0.8),
      patterned ? toWebp(square(bitmap, bitmap.width, bitmap.height, Math.min(GOWN_SWATCH_TILE_PX, Math.min(bitmap.width, bitmap.height))), 0.82) : Promise.resolve(null),
    ]);
    return { thumb, tile, hex: averageHex(px) };
  } finally {
    bitmap.close();
  }
}

/** A look's photo → one 512 px WebP (a look is a picture of a finished gown, shown small in the bride's picker). */
export async function gownLookPhotoFromFile(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    return await toWebp(square(bitmap, bitmap.width, bitmap.height, Math.min(GOWN_SWATCH_TILE_PX, Math.min(bitmap.width, bitmap.height))), 0.82);
  } finally {
    bitmap.close();
  }
}

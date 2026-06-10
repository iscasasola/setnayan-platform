import 'server-only';

/**
 * Minimal ICO container packer (PNG-in-ICO).
 *
 * Modern browsers — including Safari 16+ (our min iOS target) and every
 * evergreen desktop browser — read PNG-compressed images inside an .ico
 * container, so we skip the legacy BMP/DIB encoding entirely and just wrap
 * pre-encoded PNG buffers. This keeps the encoder tiny and lossless.
 *
 * Why we ship our own .ico at all: there's no .ico encoder in our dep tree
 * (sharp can DECODE .ico but not ENCODE it), and the orange-tab Safari bug is
 * specifically a missing real `/favicon.ico` — Safari probes the root path,
 * gets HTML, and falls back to its stale cached icon. A genuine multi-size
 * .ico at that path is the fix.
 *
 * ICO layout:
 *   ICONDIR        6 bytes   reserved(2)=0, type(2)=1(icon), count(2)
 *   ICONDIRENTRY   16 bytes  × count  (width, height, …, byteLen, offset)
 *   image data     PNG bytes × count
 *
 * A byte value of 0 for width/height means 256 — but we only emit 16/32/48,
 * so that special case never triggers here.
 */
export function packIco(images: { size: number; png: Buffer }[]): Buffer {
  if (images.length === 0) {
    throw new Error('packIco: need at least one image');
  }

  const HEADER = 6;
  const ENTRY = 16;
  const dirSize = HEADER + ENTRY * images.length;

  const header = Buffer.alloc(HEADER);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(images.length, 4); // image count

  const entries: Buffer[] = [];
  let offset = dirSize;
  for (const { size, png } of images) {
    const entry = Buffer.alloc(ENTRY);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width  (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height (0 = 256)
    entry.writeUInt8(0, 2); // palette color count (0 for true-color)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel (RGBA)
    entry.writeUInt32LE(png.length, 8); // bytes in this image
    entry.writeUInt32LE(offset, 12); // offset of image data
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

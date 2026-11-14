import { inflateSync } from 'node:zlib';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  type PDFObject,
} from 'pdf-lib';

/**
 * pdf-embedded-images.ts — the pictures INSIDE a PDF, as image bytes `sharp`
 * can open.
 *
 * Why not render the page: the `sharp` this app ships has no PDF input
 * (`sharp.format.pdf.input.buffer === false`, measured 2026-11-14), and a page
 * renderer (pdfjs + a canvas) is a native dependency the build does not carry.
 * What a QR on a supplier's paper almost always IS, though, is a picture: a
 * phone scan saved as PDF is one big JPEG per page, and an e-certificate places
 * its QR as an image. So the QR reader looks at those pictures.
 *
 * ⚠ A QR DRAWN AS VECTOR SHAPES IS NOT SEEN. It comes back as "no QR found",
 * which the admin reads as "Couldn't read the QR — check by hand" — the honest
 * sentence for a QR we did not read.
 *
 * Handles DCTDecode (JPEG, passed through) and FlateDecode 8-bit Gray/RGB
 * (with or without PNG predictors) → PNG. Anything else is skipped. Bounded:
 * a hostile PDF cannot make this inflate forever or return a thousand images.
 */

export type PdfImageLimits = { maxImages?: number; maxPixels?: number };

const DEFAULTS = { maxImages: 12, maxPixels: 25_000_000 };

function filtersOf(dict: PDFDict): string[] {
  const f = dict.lookup(PDFName.of('Filter'));
  if (f instanceof PDFName) return [f.decodeText()];
  if (f instanceof PDFArray) {
    return f.asArray().map((x) => (x instanceof PDFName ? x.decodeText() : '?'));
  }
  return [];
}

function num(dict: PDFDict | undefined, key: string): number | null {
  const v = dict?.lookup(PDFName.of(key));
  return v instanceof PDFNumber ? v.asNumber() : null;
}

/** 1 (gray) or 3 (RGB), or null for a colour space we do not decode. */
function channelsOf(dict: PDFDict): 1 | 3 | null {
  const cs: PDFObject | undefined = dict.lookup(PDFName.of('ColorSpace'));
  if (cs instanceof PDFName) {
    const n = cs.decodeText();
    if (n === 'DeviceGray') return 1;
    if (n === 'DeviceRGB') return 3;
    return null;
  }
  if (cs instanceof PDFArray && cs.size() === 2) {
    const kind = cs.lookup(0);
    const prof = cs.lookup(1);
    if (kind instanceof PDFName && kind.decodeText() === 'ICCBased' && prof instanceof PDFRawStream) {
      const n = num(prof.dict, 'N');
      if (n === 1) return 1;
      if (n === 3) return 3;
    }
  }
  return null;
}

/** Undo PNG row predictors (Predictor >= 10). */
function unPredict(data: Buffer, width: number, channels: number): Buffer | null {
  const rowLen = width * channels;
  const stride = rowLen + 1;
  if (data.length % stride !== 0) return null;
  const rows = data.length / stride;
  const out = Buffer.alloc(rows * rowLen);
  for (let y = 0; y < rows; y++) {
    const type = data[y * stride]!;
    const src = y * stride + 1;
    const dst = y * rowLen;
    for (let x = 0; x < rowLen; x++) {
      const raw = data[src + x]!;
      const left = x >= channels ? out[dst + x - channels]! : 0;
      const up = y > 0 ? out[dst - rowLen + x]! : 0;
      const ul = y > 0 && x >= channels ? out[dst - rowLen + x - channels]! : 0;
      let v: number;
      switch (type) {
        case 0: v = raw; break;
        case 1: v = raw + left; break;
        case 2: v = raw + up; break;
        case 3: v = raw + ((left + up) >> 1); break;
        case 4: {
          const p = left + up - ul;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - ul);
          v = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : ul);
          break;
        }
        default: return null;
      }
      out[dst + x] = v & 0xff;
    }
  }
  return out;
}

/**
 * Every decodable picture inside the PDF, as encoded image bytes. Never throws:
 * an unparseable PDF returns [].
 */
export async function pdfEmbeddedImages(
  bytes: Uint8Array,
  limits: PdfImageLimits = {},
): Promise<Uint8Array[]> {
  const maxImages = limits.maxImages ?? DEFAULTS.maxImages;
  const maxPixels = limits.maxPixels ?? DEFAULTS.maxPixels;
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    return [];
  }
  const sharp = (await import('sharp')).default;
  const out: Uint8Array[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (out.length >= maxImages) break;
    if (!(obj instanceof PDFRawStream)) continue;
    const d = obj.dict;
    const sub = d.lookup(PDFName.of('Subtype'));
    if (!(sub instanceof PDFName) || sub.decodeText() !== 'Image') continue;
    const width = num(d, 'Width');
    const height = num(d, 'Height');
    if (!width || !height || width * height > maxPixels) continue;
    const filters = filtersOf(d);
    try {
      if (filters.length === 1 && filters[0] === 'DCTDecode') {
        out.push(obj.getContents());
        continue;
      }
      if (filters.length !== 1 || filters[0] !== 'FlateDecode') continue;
      if ((num(d, 'BitsPerComponent') ?? 8) !== 8) continue;
      const channels = channelsOf(d);
      if (!channels) continue;
      const expected = width * height * channels;
      let data: Buffer = inflateSync(obj.getContents(), { maxOutputLength: expected + height + 16 });
      const parms = d.lookup(PDFName.of('DecodeParms'));
      const predictor = parms instanceof PDFDict ? (num(parms, 'Predictor') ?? 1) : 1;
      if (predictor >= 10) {
        const un = unPredict(data, width, channels);
        if (!un) continue;
        data = un;
      }
      if (data.length < expected) continue;
      const png = await sharp(data.subarray(0, expected), {
        raw: { width, height, channels },
      })
        .png()
        .toBuffer();
      out.push(png);
    } catch {
      // one bad picture is skipped, never the whole paper
    }
  }
  return out;
}

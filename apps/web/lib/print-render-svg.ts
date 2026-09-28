/**
 * lib/print-render-svg.ts — the ON-SCREEN sample of a print piece.
 *
 * Draws a `PrintDoc` (lib/print-layout.ts) as one self-contained SVG — images
 * inlined as data URIs, type already outlines — so the Maker can show it in an
 * `<img>` and a couple can see their own names on the finished card (owner
 * 2026-09-25: "seeing their own names on a finished card is the strongest
 * reason to unlock").
 *
 * The screen render is the sheet as it will be CUT: clipped to the theme's die
 * shape, no bleed, no spot layers. ⚠ A THEMED vector is only ever served to a
 * couple who holds Event Hub Pro; Classic is free for everyone (owner
 * 2026-09-25, "EVERY PRINT IS FREE IN THE CLASSIC LOOK"), and so is the free
 * group's page-1 thumbnail. A free couple's screen copy of a THEMED piece is
 * the flattened, watermarked JPEG `lib/print-sample-raster.ts` rasterises FROM
 * this SVG — that SVG never leaves the server for them (the watermark would be
 * an element anyone could delete).
 *
 * Pure string work — no I/O.
 */
import type { PrintDoc, PrintImages, PrintOp } from '@/lib/print-layout';

/**
 * ⚡ THE SCREEN'S PATHS, COMPACTED (owner 2026-09-28: the boarding-pass
 * preview took ~8 s; measured, ~73% of its SVG was outlined type, not the
 * photo — the still is already a 420 px, q52 copy on screen). Two changes,
 * neither visible at any size the Maker draws a piece:
 *   · every number to a tenth of a point (0.05 pt at most — the pass is
 *     575 pt wide and shown ~350 px wide);
 *   · a line to where the pen already is (the outliner emits one after
 *     nearly every curve) is dropped.
 * Only FILLED paths: on a stroke a zero-length segment can be ink (a dot).
 * Anything it cannot read — a relative or unknown command — is left exactly
 * as drawn. Only the Maker's on-screen SVG asks for it (`compact: true`); the
 * print-ready PDF never comes through this file at all.
 */
const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, A: 7, Z: 0 };
const PATH_TOKEN = /[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g;
const tenth = (s: string): string => {
  const v = Math.round(Number(s) * 10) / 10;
  return Object.is(v, -0) ? '0' : String(v);
};

export function compactScreenPath(d: string): string {
  const toks = d.match(PATH_TOKEN);
  if (!toks) return d;
  let out = '';
  let cmd = '';
  let cx = '';
  let cy = '';
  let sx = '';
  let sy = '';
  let i = 0;
  while (i < toks.length) {
    const t = toks[i]!;
    if (/^[A-Za-z]$/.test(t)) {
      if (!(t in ARITY)) return d;
      cmd = t;
      i += 1;
      if (t === 'Z') {
        out += 'Z';
        cx = sx;
        cy = sy;
      }
      continue;
    }
    const n = ARITY[cmd];
    if (!n) return d;
    const raw = toks.slice(i, i + n);
    if (raw.length < n) return d;
    i += n;
    const a = cmd === 'A' ? raw.map((v, k) => (k === 3 || k === 4 ? v : tenth(v))) : raw.map(tenth);
    if (cmd === 'L' && a[0] === cx && a[1] === cy) continue;
    out += cmd + a.join(' ');
    if (cmd === 'H') cx = a[0]!;
    else if (cmd === 'V') cy = a[0]!;
    else {
      cx = a[n - 2]!;
      cy = a[n - 1]!;
    }
    if (cmd === 'M') {
      sx = cx;
      sy = cy;
      cmd = 'L';
    }
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const n = (v: number) => String(Math.round(v * 100) / 100);

function op(o: PrintOp, images: PrintImages, clipId: string, compact: boolean): string {
  const opacity = 'opacity' in o && o.opacity !== undefined && o.opacity < 1 ? ` opacity="${n(o.opacity)}"` : '';
  switch (o.t) {
    case 'rect': {
      const fill = o.fill ? ` fill="${esc(o.fill)}"` : ' fill="none"';
      const stroke = o.stroke ? ` stroke="${esc(o.stroke)}" stroke-width="${n(o.sw ?? 0.5)}"${o.dash ? ' stroke-dasharray="3 2"' : ''}` : '';
      return `<rect x="${n(o.x)}" y="${n(o.y)}" width="${n(o.w)}" height="${n(o.h)}"${fill}${stroke}${opacity}/>`;
    }
    case 'circle': {
      const fill = o.fill ? ` fill="${esc(o.fill)}"` : ' fill="none"';
      const stroke = o.stroke ? ` stroke="${esc(o.stroke)}" stroke-width="${n(o.sw ?? 0.5)}"${o.dash ? ' stroke-dasharray="2.5 2"' : ''}` : '';
      return `<circle cx="${n(o.cx)}" cy="${n(o.cy)}" r="${n(o.r)}"${fill}${stroke}${opacity}/>`;
    }
    case 'path': {
      const fill = o.fill ? ` fill="${esc(o.fill)}"` : ' fill="none"';
      const stroke = o.stroke ? ` stroke="${esc(o.stroke)}" stroke-width="${n(o.sw ?? 0.5)}"` : '';
      const rule = o.evenOdd ? ' fill-rule="evenodd"' : '';
      const d = compact && !o.stroke ? compactScreenPath(o.d) : o.d;
      return `<path d="${esc(d)}"${fill}${rule}${stroke}${opacity}/>`;
    }
    case 'image': {
      const img = images[o.ref];
      if (!img) return '';
      const href = `data:${img.mime};base64,${Buffer.from(img.bytes).toString('base64')}`;
      // Cover-crop into the box, the way the paper crops the still.
      const id = `${clipId}-${o.ref.replace(/[^a-z0-9]/gi, '')}-${Math.round(o.x)}-${Math.round(o.y)}`;
      return (
        `<clipPath id="${id}"><rect x="${n(o.x)}" y="${n(o.y)}" width="${n(o.w)}" height="${n(o.h)}"/></clipPath>` +
        `<image href="${href}" x="${n(o.x)}" y="${n(o.y)}" width="${n(o.w)}" height="${n(o.h)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"${opacity}/>`
      );
    }
  }
}

export function renderPrintSvg(
  doc: PrintDoc,
  images: PrintImages,
  /** `compact` — the Maker's on-screen preview only (`compactScreenPath`); the
   *  sample raster and the free thumbnails draw every coordinate as laid out. */
  opts: { idPrefix?: string; compact?: boolean } = {},
): string {
  const id = opts.idPrefix ?? `p-${doc.piece}`;
  const body = doc.ops.map((o) => op(o, images, id, opts.compact === true)).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(doc.w)} ${n(doc.h)}" width="${n(doc.w)}" height="${n(doc.h)}">` +
    `<defs><clipPath id="${id}-die"><path d="${doc.diePath}"/></clipPath></defs>` +
    `<g clip-path="url(#${id}-die)">${body}</g>` +
    `</svg>`
  );
}

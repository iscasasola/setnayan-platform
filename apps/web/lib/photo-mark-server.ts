// NOTE: deliberately NOT 'server-only' (same reason as lib/papic-photo-mark-raster.ts):
// nothing here is reachable from a client bundle, and leaving the marker off lets
// `tsx --test` burn a REAL mark into real bytes and read the pixels back.

/**
 * lib/photo-mark-server.ts — the SERVER painter of the Seal and plate.
 *
 * Paints the same `MarkLayout` as `lib/photo-mark-canvas.ts`, from the same
 * geometry (`lib/photo-mark-geometry.ts`), into an SVG overlay that `sharp`
 * composites. Used by the re-mark job (`lib/supplier-photo-remark.server.ts`)
 * and by any supplier photo that reaches the server unmarked.
 *
 * 🔒 NO `<text>`. librsvg's fontconfig path is flaky on Vercel (recorded in
 * lib/glyph-path.ts and lib/watermark-server.ts), so every glyph is an opentype
 * OUTLINE from the bundled TTFs — the very files the browser loads as FontFaces
 * (`MARK_FONT_FILES` / `MARK_FONT_URLS`). The overlay holds only shapes, paths,
 * gradients and (for a verified shop) the logo coin as an embedded PNG.
 *
 * 🔒 FAILS CLOSED. A layout that is not inside its box throws; nothing is
 * composited half-placed.
 */
import path from 'node:path';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { parse as parseFont, type Font as OtFont } from 'opentype.js';
import {
  MARK_COIN_FACE,
  MARK_FACE,
  MARK_FONT_FILES,
  MARK_GOLD,
  MARK_HAIR,
  MARK_PLATE,
  MARK_RIM,
  MARK_RIM_POS,
  SY_BOX_UNITS,
  SY_PATH,
  layoutInside,
  layoutMark,
  layoutMarkInFrame,
  sealLobes,
  type Box,
  type FrameShape,
  type MarkFont,
  type MarkLayout,
  type MarkMeasure,
  type MarkSpec,
} from './photo-mark-geometry';

let fonts: { jost: OtFont; cormorant: OtFont } | null = null;
function markFonts(): { jost: OtFont; cormorant: OtFont } {
  if (fonts) return fonts;
  const load = (rel: string) => {
    const buf = readFileSync(path.join(process.cwd(), rel));
    return parseFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  };
  fonts = { jost: load(MARK_FONT_FILES.jost), cormorant: load(MARK_FONT_FILES.cormorant) };
  return fonts;
}

function faceFor(font: MarkFont): OtFont {
  const f = markFonts();
  return font === 'name' ? f.cormorant : f.jost;
}

/** The ruler the geometry is given on the server: opentype advance widths over the bundled TTFs. */
export const serverMeasure: MarkMeasure = (text, font, px) => faceFor(font).getAdvanceWidth(text, px);

const n = (v: number) => (Math.round(v * 100) / 100).toString();

function stops(colors: readonly string[], pos: readonly number[]): string {
  return colors.map((c, i) => `<stop offset="${pos[i]}" stop-color="${c}"/>`).join('');
}

function rgbaStop(offset: number, rgba: string): string {
  const m = /rgba\(([^)]+)\)/.exec(rgba);
  if (!m) return `<stop offset="${offset}" stop-color="${rgba}"/>`;
  const [r, g, b, a] = m[1]!.split(',').map((s) => s.trim());
  return `<stop offset="${offset}" stop-color="rgb(${r},${g},${b})" stop-opacity="${a}"/>`;
}

function fillAttr(rgba: string, attr = 'fill'): string {
  const m = /rgba\(([^)]+)\)/.exec(rgba);
  if (!m) return `${attr}="${rgba}"`;
  const [r, g, b, a] = m[1]!.split(',').map((s) => s.trim());
  return `${attr}="rgb(${r},${g},${b})" ${attr}-opacity="${a}"`;
}

function scallopPath(cx: number, cy: number, D: number): string {
  const parts: string[] = [];
  sealLobes(cx, cy, D).forEach((l, i) => {
    const sx = l.x + l.r * Math.cos(l.a0);
    const sy = l.y + l.r * Math.sin(l.a0);
    const ex = l.x + l.r * Math.cos(l.a1);
    const ey = l.y + l.r * Math.sin(l.a1);
    parts.push(`${i === 0 ? 'M' : 'L'}${n(sx)} ${n(sy)} A${n(l.r)} ${n(l.r)} 0 0 1 ${n(ex)} ${n(ey)}`);
  });
  return `${parts.join(' ')} Z`;
}

function sealSvg(id: string, cx: number, cy: number, D: number): string {
  const r = D / 2;
  const box = 0.6 * D;
  const k = box / SY_BOX_UNITS;
  const scallop = scallopPath(cx, cy, D);
  return [
    `<defs>`,
    `<linearGradient id="${id}r" gradientUnits="userSpaceOnUse" x1="${n(cx - r)}" y1="${n(cy - r)}" x2="${n(cx + r)}" y2="${n(cy + r)}">${stops(MARK_RIM, MARK_RIM_POS)}</linearGradient>`,
    `<linearGradient id="${id}s" gradientUnits="userSpaceOnUse" x1="${n(cx - r)}" y1="${n(cy - r)}" x2="${n(cx + r * 0.6)}" y2="${n(cy + r)}">${rgbaStop(0, 'rgba(255,255,255,.55)')}${rgbaStop(0.42, 'rgba(255,255,255,0)')}${rgbaStop(0.6, 'rgba(0,0,0,0)')}${rgbaStop(1, 'rgba(0,0,0,.3)')}</linearGradient>`,
    `<radialGradient id="${id}f" gradientUnits="userSpaceOnUse" fx="${n(cx - 0.1 * D)}" fy="${n(cy - 0.16 * D)}" fr="${n(0.02 * D)}" cx="${n(cx)}" cy="${n(cy)}" r="${n(0.42 * D)}"><stop offset="0" stop-color="${MARK_FACE[0]}"/><stop offset="1" stop-color="${MARK_FACE[1]}"/></radialGradient>`,
    `<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="${n(cx - r)}" y1="${n(cy - r)}" x2="${n(cx)}" y2="${n(cy + r)}">${rgbaStop(0, 'rgba(255,255,255,.28)')}${rgbaStop(0.5, 'rgba(255,255,255,0)')}</linearGradient>`,
    `</defs>`,
    `<path d="${scallop}" fill="url(#${id}r)" stroke="rgb(0,0,0)" stroke-opacity="0.35" stroke-width="${n(Math.max(1, D * 0.02))}"/>`,
    `<path d="${scallop}" fill="url(#${id}s)"/>`,
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(0.395 * D)}" fill="url(#${id}f)"/>`,
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(0.395 * D)}" fill="url(#${id}g)"/>`,
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(0.376 * D)}" fill="none" stroke="rgb(255,255,255)" stroke-opacity="0.5" stroke-width="${n(Math.max(0.6, D * 0.009))}"/>`,
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(0.354 * D)}" fill="none" stroke="rgb(233,207,134)" stroke-opacity="0.55" stroke-width="${n(Math.max(0.6, D * 0.009))}" stroke-dasharray="${n(D * 0.012)} ${n(D * 0.024)}"/>`,
    `<path d="${SY_PATH}" fill="${MARK_GOLD}" transform="translate(${n(cx - box / 2)} ${n(cy - box / 2)}) scale(${k}) translate(0 ${SY_BOX_UNITS}) scale(1.3333333 -1.3333333)"/>`,
  ].join('');
}

function coinSvg(id: string, cx: number, cy: number, d: number, logoPng: Buffer | null): string {
  const r = d / 2;
  const rim = (d / 0.78) * 0.045;
  const fr = r - rim;
  const s = fr * 2 * 0.82;
  return [
    `<defs>`,
    `<linearGradient id="${id}r" gradientUnits="userSpaceOnUse" x1="${n(cx - r)}" y1="${n(cy - r)}" x2="${n(cx + r)}" y2="${n(cy + r)}">${stops(MARK_RIM, MARK_RIM_POS)}</linearGradient>`,
    `<radialGradient id="${id}f" gradientUnits="userSpaceOnUse" fx="${n(cx - fr * 0.3)}" fy="${n(cy - fr * 0.4)}" fr="${n(fr * 0.1)}" cx="${n(cx)}" cy="${n(cy)}" r="${n(fr * 1.1)}"><stop offset="0" stop-color="${MARK_COIN_FACE[0]}"/><stop offset="1" stop-color="${MARK_COIN_FACE[1]}"/></radialGradient>`,
    `<clipPath id="${id}c"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(fr)}"/></clipPath>`,
    `</defs>`,
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r + d * 0.04)}" fill="rgb(20,18,16)" fill-opacity="0.65"/>`,
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="url(#${id}r)"/>`,
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(fr)}" fill="url(#${id}f)"/>`,
    logoPng
      ? `<image clip-path="url(#${id}c)" x="${n(cx - s / 2)}" y="${n(cy - s / 2)}" width="${n(s)}" height="${n(s)}" href="data:image/png;base64,${logoPng.toString('base64')}"/>`
      : '',
  ].join('');
}

function linePath(line: MarkLayout['lines'][number]): string {
  const face = faceFor(line.font);
  const baseline = line.y + (face.ascender / face.unitsPerEm) * line.px;
  if (!line.tracking) return face.getPath(line.text, line.x, baseline, line.px).toPathData(2);
  const parts: string[] = [];
  let x = line.x;
  for (const ch of line.text) {
    parts.push(face.getPath(ch, x, baseline, line.px).toPathData(2));
    x += face.getAdvanceWidth(ch, line.px) + line.tracking;
  }
  return parts.join(' ');
}

/** The overlay for an image of W×H carrying `layout`. Shapes, paths and gradients only — never `<text>`. */
export function markOverlaySvgForLayout(W: number, H: number, layout: MarkLayout, logoPng: Buffer | null = null): string {
  const { plate } = layout;
  const body: string[] = [
    `<rect x="${plate.left}" y="${plate.top}" width="${plate.width}" height="${plate.height}" rx="${n(layout.radius)}" ${fillAttr(MARK_PLATE)}/>`,
  ];
  if (layout.hairline > 0) {
    const hw = layout.hairline;
    body.push(
      `<rect x="${n(plate.left + hw / 2)}" y="${n(plate.top + hw / 2)}" width="${n(plate.width - hw)}" height="${n(plate.height - hw)}" rx="${n(layout.radius - hw / 2)}" fill="none" ${fillAttr(MARK_HAIR, 'stroke')} stroke-width="${n(hw)}"/>`,
    );
  }
  if (layout.seal) body.push(sealSvg('s', layout.seal.cx, layout.seal.cy, layout.seal.D));
  if (layout.coin) body.push(coinSvg('c', layout.coin.cx, layout.coin.cy, layout.coin.d, logoPng));
  for (const line of layout.lines) {
    const m = /rgba\(([^)]+)\)/.exec(line.color);
    const fill = m ? fillAttr(line.color) : `fill="${line.color}"`;
    body.push(`<path d="${linePath(line)}" ${fill}/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body.join('')}</svg>`;
}

export type FramedBox = { frame: Box; shape: FrameShape };

/** Lay the mark out for W×H — inside `framed` when given, else in the centred safe square. */
export function serverMarkLayout(W: number, H: number, spec: MarkSpec, framed?: FramedBox | null): MarkLayout {
  const layout = framed
    ? layoutMarkInFrame(framed.frame, framed.shape, spec, serverMeasure)
    : layoutMark(W, H, spec, serverMeasure);
  const box = framed ? framed.frame : { left: 0, top: 0, width: W, height: H };
  if (!layoutInside(layout, box) || !layoutInside(layout, { left: 0, top: 0, width: W, height: H })) {
    throw new Error(`photo mark: the ${layout.tier} mark does not fit a ${W}×${H} image — refusing to composite`);
  }
  return layout;
}

/**
 * Burn the Seal and plate into image BYTES. EXIF orientation is applied first
 * (so the mark lands on the picture a viewer sees), output is JPEG. Throws —
 * never returns the input unmarked.
 */
export async function markPhotoBytes(
  input: Uint8Array | Buffer,
  spec: MarkSpec,
  opts: { logoPng?: Buffer | null; framed?: FramedBox | null; quality?: number } = {},
): Promise<{ bytes: Buffer; width: number; height: number; layout: MarkLayout }> {
  const upright = await sharp(input).rotate().toBuffer({ resolveWithObject: true });
  const W = upright.info.width;
  const H = upright.info.height;
  const layout = serverMarkLayout(W, H, spec, opts.framed ?? null);
  const svg = markOverlaySvgForLayout(W, H, layout, opts.logoPng ?? null);
  const bytes = await sharp(upright.data)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: opts.quality ?? 90 })
    .toBuffer();
  return { bytes, width: W, height: H, layout };
}

/** The shop's logo as a 256×256 PNG for the coin (contain on transparent), or null when it cannot be read. */
export async function logoCoinPng(bytes: Uint8Array | Buffer): Promise<Buffer | null> {
  try {
    return await sharp(bytes)
      .rotate()
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

/**
 * lib/photo-mark-canvas.ts — the BROWSER painter of the Seal and plate.
 *
 * It paints a `MarkLayout` from `lib/photo-mark-geometry.ts` and decides
 * nothing about placement itself. The drawing calls (`drawSeal`, `drawCoin`,
 * the plate, the tracked caps) are the approved page's own, verbatim, with the
 * geometry swapped for the layout's numbers.
 *
 * FONTS: the two bundled TTFs (`/logo-fonts/jost.ttf`, `/logo-fonts/cormorant.ttf`)
 * are loaded as FontFaces under private family names, so a host's own "Jost"
 * can never stand in, and the server's opentype path reads the SAME files.
 * 🔒 `ensureMarkFonts()` REJECTS when either face cannot load — and the upload
 * then refuses (fail-closed), because a mark drawn in a fallback face is not
 * the approved mark.
 */
import {
  MARK_COIN_FACE,
  MARK_FACE,
  MARK_FONT_URLS,
  MARK_GOLD,
  MARK_HAIR,
  MARK_PLATE,
  MARK_RIM,
  MARK_RIM_POS,
  SY_BOX_UNITS,
  SY_PATH,
  sealLobes,
  type MarkFont,
  type MarkLayout,
  type MarkMeasure,
} from './photo-mark-geometry';

const FAMILY = { jost: 'SetnayanMarkJost', cormorant: 'SetnayanMarkCormorant' } as const;

let fontsReady: Promise<void> | null = null;

/** Load both mark faces once. Rejects (and resets, so a retry can try again) when either fails. */
export function ensureMarkFonts(): Promise<void> {
  if (fontsReady) return fontsReady;
  fontsReady = (async () => {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined') {
      throw new Error('photo mark: this browser cannot load the mark fonts');
    }
    const faces = [
      new FontFace(FAMILY.jost, `url(${MARK_FONT_URLS.jost})`),
      new FontFace(FAMILY.cormorant, `url(${MARK_FONT_URLS.cormorant})`),
    ];
    const loaded = await Promise.all(faces.map((f) => f.load()));
    for (const f of loaded) document.fonts.add(f);
  })().catch((err) => {
    fontsReady = null;
    throw err;
  });
  return fontsReady;
}

export function markFontCss(font: MarkFont, px: number): string {
  if (font === 'name') return `600 ${px}px "${FAMILY.cormorant}", Georgia, serif`;
  if (font === 'caps') return `600 ${px}px "${FAMILY.jost}", system-ui, sans-serif`;
  return `500 ${px}px "${FAMILY.jost}", system-ui, sans-serif`;
}

/** The ruler the geometry is given in a browser: the canvas's own measureText over the loaded faces. */
export function canvasMeasure(ctx: CanvasRenderingContext2D): MarkMeasure {
  return (text, font, px) => {
    ctx.font = markFontCss(font, px);
    return ctx.measureText(text).width;
  };
}

let syPath: Path2D | null = null;

function goldRim(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  MARK_RIM.forEach((c, i) => g.addColorStop(MARK_RIM_POS[i]!, c));
  return g;
}

function drawSeal(ctx: CanvasRenderingContext2D, cx: number, cy: number, D: number): void {
  const r = D / 2;
  ctx.save();
  ctx.beginPath();
  for (const l of sealLobes(cx, cy, D)) ctx.arc(l.x, l.y, l.r, l.a0, l.a1, false);
  ctx.closePath();
  ctx.lineWidth = Math.max(1, D * 0.02);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
  ctx.fillStyle = goldRim(ctx, cx - r, cy - r, cx + r, cy + r);
  ctx.fill();
  let g = ctx.createLinearGradient(cx - r, cy - r, cx + r * 0.6, cy + r);
  g.addColorStop(0, 'rgba(255,255,255,.55)');
  g.addColorStop(0.42, 'rgba(255,255,255,0)');
  g.addColorStop(0.6, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.3)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 0.395 * D, 0, Math.PI * 2);
  const f = ctx.createRadialGradient(cx - 0.1 * D, cy - 0.16 * D, 0.02 * D, cx, cy, 0.42 * D);
  f.addColorStop(0, MARK_FACE[0]);
  f.addColorStop(1, MARK_FACE[1]);
  ctx.fillStyle = f;
  ctx.fill();
  g = ctx.createLinearGradient(cx - r, cy - r, cx, cy + r);
  g.addColorStop(0, 'rgba(255,255,255,.28)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(0.6, D * 0.009);
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.beginPath();
  ctx.arc(cx, cy, 0.376 * D, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(233,207,134,.55)';
  ctx.setLineDash([D * 0.012, D * 0.024]);
  ctx.beginPath();
  ctx.arc(cx, cy, 0.354 * D, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  const box = 0.6 * D;
  const k = box / SY_BOX_UNITS;
  ctx.translate(cx - box / 2, cy - box / 2);
  ctx.scale(k, k);
  ctx.translate(0, SY_BOX_UNITS);
  ctx.scale(1.3333333, -1.3333333);
  ctx.fillStyle = MARK_GOLD;
  syPath ??= new Path2D(SY_PATH);
  ctx.fill(syPath);
  ctx.restore();
}

function drawCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number, d: number, logo: CanvasImageSource | null): void {
  const r = d / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + d * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,18,16,.65)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = goldRim(ctx, cx - r, cy - r, cx + r, cy + r);
  ctx.fill();
  const rim = (d / 0.78) * 0.045;
  const fr = r - rim;
  ctx.beginPath();
  ctx.arc(cx, cy, fr, 0, Math.PI * 2);
  const f = ctx.createRadialGradient(cx - fr * 0.3, cy - fr * 0.4, fr * 0.1, cx, cy, fr * 1.1);
  f.addColorStop(0, MARK_COIN_FACE[0]);
  f.addColorStop(1, MARK_COIN_FACE[1]);
  ctx.fillStyle = f;
  ctx.fill();
  if (logo) {
    ctx.save();
    ctx.clip();
    const s = fr * 2 * 0.82;
    ctx.drawImage(logo, cx - s / 2, cy - s / 2, s, s);
    ctx.restore();
  }
  ctx.restore();
}

/** Paint a laid-out mark. `logo` is the shop's coin (verified with a logo only). */
export function paintMark(ctx: CanvasRenderingContext2D, l: MarkLayout, logo: CanvasImageSource | null = null): void {
  const { plate } = l;
  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(plate.left, plate.top, plate.width, plate.height, l.radius);
  else ctx.rect(plate.left, plate.top, plate.width, plate.height);
  ctx.fillStyle = MARK_PLATE;
  ctx.fill();
  if (l.hairline > 0 && typeof ctx.roundRect === 'function') {
    const hw = l.hairline;
    ctx.lineWidth = hw;
    ctx.strokeStyle = MARK_HAIR;
    ctx.beginPath();
    ctx.roundRect(plate.left + hw / 2, plate.top + hw / 2, plate.width - hw, plate.height - hw, l.radius - hw / 2);
    ctx.stroke();
  }
  if (l.seal) drawSeal(ctx, l.seal.cx, l.seal.cy, l.seal.D);
  if (l.coin) drawCoin(ctx, l.coin.cx, l.coin.cy, l.coin.d, logo);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  for (const line of l.lines) {
    ctx.font = markFontCss(line.font, line.px);
    ctx.fillStyle = line.color;
    if (line.tracking) {
      let x = line.x;
      for (const ch of line.text) {
        ctx.fillText(ch, x, line.y);
        x += ctx.measureText(ch).width + line.tracking;
      }
    } else {
      ctx.fillText(line.text, line.x, line.y);
    }
  }
  ctx.restore();
}

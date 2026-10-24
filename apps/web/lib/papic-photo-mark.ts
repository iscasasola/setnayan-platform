/**
 * lib/papic-photo-mark.ts — 🏷 THE SMALL MARK ON THE PHOTOS PEOPLE SEE.
 *
 * Owner, 24 Oct 2026, verbatim: *"Free: plain camera with a small Setnayan mark
 * on saved photos. Pro: their logo on the shutter, theme colours, and their
 * monogram on saved photos. No frames."*
 *
 *   · FREE event → the Setnayan mark;
 *   · PRO event (Logo & QR part, or Full Pro — `eventHubPartActive(…, 'logo_qr')`)
 *     → the couple's own monogram; an event with no monogram of its own falls
 *     back to the Setnayan mark.
 *
 * WHERE IT GOES — only the COPIES people see, share and download: the thumb,
 * tile and display tiers of a photo and a clip's poster (`MARKED_TIERS`). They
 * are made on the phone in the uploader's background step
 * (`lib/papic-upload/prepare.ts`), off the shutter, so the mark costs no server
 * work and never slows the next shot. 🔒 THE ORIGINAL IS NEVER MARKED — the
 * full-resolution file in storage is the photograph as taken (with the event's
 * Look), nothing drawn on it. The develop step (`develop.ts`) makes that
 * original, which is why the mark is NOT burned there.
 *
 * Small, bottom-right, on a soft light chip with a shadow — legible on a dark
 * photo and a light one. No frame, nothing over the viewfinder.
 *
 * Pure decisions here (`papicMarkFor`, `markBox`, `MARKED_TIERS`) + one
 * browser-only painter (`paintMark`).
 */

export type PapicMark =
  | { kind: 'setnayan' }
  | {
      kind: 'monogram';
      /** The couple's own mark as safe SVG (`resolveEventMonogramSvg`), or null. */
      svg: string | null;
      /** Their lettered monogram ("A&B"), drawn when there is no SVG. */
      text: string | null;
      /** The lettered monogram's ink. */
      ink: string | null;
    };

export const SETNAYAN_PHOTO_MARK: PapicMark = Object.freeze({ kind: 'setnayan' as const });

/** The tiers that carry the mark. Never 'original', never a clip's own bytes. */
export const MARKED_TIERS = ['thumb', 'tile', 'display', 'poster'] as const;

/** Free → the Setnayan mark; Pro → the couple's monogram (or the Setnayan mark when they have none). */
export function papicMarkFor(input: {
  pro: boolean;
  monogramSvg: string | null | undefined;
  monogramText: string | null | undefined;
  monogramInk?: string | null;
}): PapicMark {
  if (!input.pro) return SETNAYAN_PHOTO_MARK;
  const svg = typeof input.monogramSvg === 'string' && input.monogramSvg.trim() ? input.monogramSvg : null;
  const text =
    typeof input.monogramText === 'string' && input.monogramText.trim() ? input.monogramText.trim().slice(0, 12) : null;
  if (!svg && !text) return SETNAYAN_PHOTO_MARK;
  return { kind: 'monogram', svg, text: svg ? null : text, ink: input.monogramInk ?? null };
}

/** Does this event have a monogram of its OWN (not only one derived from its name)? */
export function eventHasOwnMonogram(e: {
  monogram_text?: string | null;
  monogram_style?: string | null;
  monogram_font_key?: string | null;
}): boolean {
  return Boolean(e.monogram_text?.trim() || e.monogram_style || e.monogram_font_key);
}

/**
 * Where the chip sits on a W × H copy: bottom-right, its height ~4.5 percent of
 * the long edge (14–64 px), inset by half its height. `aspect` = the art's w/h.
 */
export function markBox(w: number, h: number, aspect: number): { x: number; y: number; w: number; h: number; pad: number } {
  const long = Math.max(w, h);
  const chipH = Math.max(14, Math.min(64, Math.round(long * 0.045)));
  const pad = Math.max(2, Math.round(chipH * 0.18));
  const artH = chipH - pad * 2;
  const artW = Math.max(artH, Math.round(artH * (aspect > 0 ? aspect : 1)));
  const chipW = artW + pad * 2;
  const inset = Math.round(chipH * 0.5);
  return { x: w - inset - chipW, y: h - inset - chipH, w: chipW, h: chipH, pad };
}

/** The Setnayan mark, inline — a phone with no signal must still be able to draw it. */
export const SETNAYAN_MARK_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 5333.3335 5333.3335\" width=\"512\" height=\"512\"> <defs> <clipPath id=\"setnayan-mark-clip\" clipPathUnits=\"userSpaceOnUse\"> <path d=\"M 0,0 H 4000 V 4000 H 0 Z\" /> </clipPath> </defs> <path d=\"M 1859.526,3749.781 C 1458.028,3717.757 1065.454,3548.554 758.3406,3241.44 451.2286,2934.328 282.2397,2541.742 250.2195,2140.255 l 1326.8215,1.536 V 661.7647 C 1368.543,727.4195 1172.067,841.5416 1006.804,1006.804 768.3191,1245.29 633.8543,1548.261 602.7217,1859.526 H 250 C 282.024,1458.028 451.2265,1065.455 758.3406,758.3406 1065.453,451.2287 1458.039,282.2396 1859.526,250.2195 V 2422.739 H 661.7647 c 65.6549,208.498 179.7773,404.975 345.0393,570.237 238.486,238.486 541.457,372.95 852.722,404.083 z m 280.948,0 1.537,-1609.307 h 280.948 v 1197.761 c 208.498,-65.655 404.974,-179.776 570.237,-345.039 238.485,-238.486 372.95,-541.457 404.082,-852.722 H 3750 c -32.024,401.498 -201.226,794.071 -508.341,1101.185 -307.112,307.112 -699.697,476.101 -1101.185,508.122 z m 0,-1890.255 c 32.025,-401.498 201.227,-794.073 508.341,-1101.1854 0.658,-0.6584 1.316,-1.3173 1.975,-1.9754 -80.395,-42.041 -163.892,-76.0428 -249.331,-101.7389 -85.439,-25.696 -172.821,-43.0864 -260.985,-51.9046 V 250.2195 c 401.497,32.0253 794.073,201.0094 1101.185,508.1211 307.114,307.1134 476.317,699.6874 508.341,1101.1854 h -352.722 c -31.132,-311.265 -165.597,-614.236 -404.082,-852.722 -15.719,-15.7189 -32.464,-29.741 -48.727,-44.5564 -15.975,14.4789 -31.774,29.1397 -47.191,44.5564 -238.485,238.486 -372.95,541.457 -404.082,852.722 z\" fill=\"#cb9e4b\" fill-rule=\"nonzero\" transform=\"matrix(1.3333333,0,0,-1.3333333,0,5333.3333)\" clip-path=\"url(#setnayan-mark-clip)\" /> </svg>";

function svgDataUrl(svg: string): string {
  // Some engines need a size on the root to rasterise an SVG with only a viewBox.
  const sized = /<svg\b[^>]*\bwidth=/i.test(svg) ? svg : svg.replace(/<svg\b/i, '<svg width="512" height="512"');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
}

const artCache = new Map<string, Promise<HTMLImageElement | null>>();
function loadSvg(svg: string): Promise<HTMLImageElement | null> {
  let p = artCache.get(svg);
  if (!p) {
    p = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = svgDataUrl(svg);
    });
    artCache.set(svg, p);
  }
  return p;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Burn the mark into a COPY's canvas (browser only). Best-effort: a mark that
 * cannot be drawn never costs the shot its copy.
 */
export async function paintMark(ctx: CanvasRenderingContext2D, w: number, h: number, mark: PapicMark): Promise<void> {
  try {
    let img: HTMLImageElement | null = null;
    let text: string | null = null;
    if (mark.kind === 'monogram' && mark.svg) img = await loadSvg(mark.svg);
    else if (mark.kind === 'monogram' && mark.text) text = mark.text;
    if (!img && !text) img = await loadSvg(SETNAYAN_MARK_SVG);
    if (!img && !text) return;

    const fontFor = (px: number) => `italic 600 ${px}px Georgia, "Times New Roman", serif`;
    let aspect = img && img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
    if (text) {
      const probe = markBox(w, h, 1);
      const px = probe.h - probe.pad * 2;
      ctx.font = fontFor(px);
      aspect = Math.max(1, (ctx.measureText(text).width + px * 0.3) / Math.max(1, px));
    }
    const box = markBox(w, h, aspect);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = Math.round(box.h * 0.25);
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    roundRect(ctx, box.x, box.y, box.w, box.h, Math.round(box.h * 0.3));
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    const ax = box.x + box.pad;
    const ay = box.y + box.pad;
    const aw = box.w - box.pad * 2;
    const ah = box.h - box.pad * 2;
    if (img) {
      ctx.drawImage(img, ax, ay, aw, ah);
    } else if (text) {
      ctx.font = fontFor(ah);
      ctx.fillStyle = (mark.kind === 'monogram' && mark.ink) || '#3a2f2a';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(text, ax + aw / 2, ay + ah / 2);
    }
    ctx.restore();
  } catch {
    /* never cost the copy */
  }
}

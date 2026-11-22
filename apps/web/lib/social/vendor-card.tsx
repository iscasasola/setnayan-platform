import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { cardPhotoSignal } from '@/lib/social/card-photo-fetch';
import { resolvePrintBadgeArt } from '@/lib/print-badge-art';
import { sealArtSvgNoYear } from '@/lib/print-seal-art';
import { verifiedV84Svg } from '@/lib/verified-v84-art';
import { SETNAYAN_MARK_PATH, SETNAYAN_MARK_TRANSFORM, SETNAYAN_MARK_VIEWBOX } from '@/lib/qr-style-svg';
import { SETNAYAN_GOLD } from '@/lib/qr-look';
import type { PrintBadge } from '@/lib/print-badges-v84';
import {
  BADGE_ROW,
  LOGO_TILE,
  MARK,
  OG_HEIGHT,
  OG_WIDTH,
  SEAL_ON_LOGO,
  SEAL_SOLO,
  TEXT_COLUMN,
  badgeRowLefts,
  clampWords,
  morePillWidth,
  nameSize,
  vendorCardBadgeRow,
  vendorCardTopLine,
  type VendorCardStatus,
} from '@/lib/social/vendor-card-layout';

/**
 * apps/web/lib/social/vendor-card.tsx — THE SHOP SHARE CARD v2: the 1200×630 picture a shop's link shows in a chat
 * (`/api/og/v/[slug]`). Owner, 21 Nov 2026: *"approve the share card too"*; DECISION_LOG "SHOP SHARE CARD v2 —
 * APPROVED TO BUILD". Drawing (frozen): corpus `prototypes/shop_share_card_2026-11-21/shop_share_card_v2_fable.html`.
 *
 * Top to bottom: the shop's cover photo fills the card (the dark Setnayan ground when it has none) · the logo on a
 * white tile with the seal on its corner (Verified, or the Verified Partner seal in its place; no logo → the seal alone
 * in the middle) · the top line · the name, large · the proof line (★ rating · reviews · events, each only when there)
 * · what they do · city · up to four earned badges, seals first, then "+N" · the Setnayan mark, small, once.
 * WHAT is shown is decided in `lib/social/vendor-card-layout.ts` (pure, tested); this file only draws it.
 *
 * 🪤 NO IMAGE IS EVER A SATORI `<img>` NODE. satori reads an <img>'s `src` off a TOP-LEVEL prop and this file's `el()`
 * puts its second argument under `props.style` — an earlier version handed the logo to satori that way and every shop
 * WITH a logo 302'd to the brand card in production ("Image source is not provided"). So satori draws WORDS (and the
 * small ★ shape) only, on a transparent layer; the photo, the logo tile, the seal, the medals and the mark are each
 * a `sharp` `.composite()` at a fixed spot — the `profile-card.tsx` pipeline. 🔒 lib/social/vendor-card.test.ts
 *
 * 🛟 NEVER A BROKEN PICTURE. A photo, logo, seal or medal that will not fetch or decode is LEFT OUT and the card is
 * drawn without it (no photo → the dark ground; no logo → the seal moves to the middle). Only a failure of the words
 * themselves throws, and the route then serves the Setnayan card.
 *
 * JPEG: the ground is a photo (or the dark ground) now, so nothing on it is transparent — smaller and faster than PNG.
 */

// ── The card's own inks (a share picture is product art, not app chrome: it lives outside the token system, like every
//    card in lib/social). The values are the drawing's. ─────────────────────────────────────────────────────────────
const GROUND = '#111111';
const WHITE = '#FFFFFF';
const STAR_GOLD = '#E3B95E';
const SHADE = 'linear-gradient(to top, rgba(16,18,22,0.95) 0%, rgba(16,18,22,0.84) 36%, rgba(16,18,22,0.3) 60%, rgba(16,18,22,0) 78%)';

const FONT_DIR = path.join(process.cwd(), 'lib', 'social', 'fonts');
const loadFont = (file: string): Buffer => readFileSync(path.join(FONT_DIR, file));

const SATORI_FONTS = [
  { name: 'Cardo', data: loadFont('Cardo-Bold.ttf'), weight: 700 as const, style: 'normal' as const },
  { name: 'Poppins', data: loadFont('Poppins-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'Poppins', data: loadFont('Poppins-Medium.ttf'), weight: 500 as const, style: 'normal' as const },
];

/** ★ — not a letter in Cardo or Poppins, so it is a small shape (drawing build notes). */
const STAR_PATH = 'M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z';

export type VendorCardInput = {
  /** The resolved display label (`resolveVendorDisplayName`) — never the raw business_name. */
  displayName: string;
  /** not verified · Verified · Verified Partner — the top line and the seal on the logo. */
  status: VendorCardStatus;
  /** `DEMO_ONLY_LABEL` for a demo shop, else null — said on the top line, as before. */
  demoLabel?: string | null;
  /** "4.8 · 38 reviews · 120 events" or what is left of it; null = no proof line (`vendorCardProofWords`). */
  proofWords: string | null;
  /** Whether the proof line starts with a rating (then it wears the ★). */
  proofHasRating: boolean;
  /** "Lights & Sound · Quezon City" (`composeVendorTradeLine`); null = left out. */
  tradeLine: string | null;
  /** The print badge list as read; the row is cut from it here (`vendorCardBadgeRow`). */
  badges: readonly PrintBadge[];
  /** An already-resolved, fetchable cover photo URL, or null. */
  coverUrl?: string | null;
  /** An already-resolved, fetchable logo URL (public-bucket signer), or null. */
  logoUrl?: string | null;
};

type VNode = { type: string; props: Record<string, unknown> };

const el = (type: string, style: Record<string, unknown>, children?: unknown): VNode => ({ type, props: { style, children } });

function starNode(size: number): VNode {
  return {
    type: 'svg',
    props: {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      style: { flexShrink: 0 },
      children: { type: 'path', props: { d: STAR_PATH, fill: STAR_GOLD } },
    },
  };
}

/** The words' layer: transparent, the dark fade (on a photo), and the centred column, its last line 92 px up. */
function wordsTree(input: VendorCardInput, hasPhoto: boolean, row: { medals: number; more: number }): VNode {
  const name = nameSize(input.displayName);
  const column: VNode[] = [
    el(
      'div',
      { fontFamily: 'Poppins', fontWeight: 500, fontSize: '20px', letterSpacing: '4px', color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap' },
      vendorCardTopLine(input.status, input.demoLabel),
    ),
    el(
      'div',
      {
        fontFamily: 'Cardo',
        fontWeight: 700,
        fontSize: `${name.fontSize}px`,
        lineHeight: 1.06,
        marginTop: '12px',
        color: WHITE,
        textAlign: 'center',
        justifyContent: 'center',
        textShadow: '0 2px 14px rgba(0,0,0,0.45)',
        textWrap: 'balance',
      },
      name.text,
    ),
  ];
  if (input.proofWords) {
    column.push(
      el(
        'div',
        { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', fontFamily: 'Poppins', fontWeight: 500, fontSize: '30px', lineHeight: 1.25, color: WHITE, whiteSpace: 'nowrap' },
        input.proofHasRating ? [starNode(28), el('div', {}, input.proofWords)] : input.proofWords,
      ),
    );
  }
  if (input.tradeLine) {
    column.push(
      el(
        'div',
        { marginTop: '6px', fontFamily: 'Poppins', fontWeight: 400, fontSize: '24px', lineHeight: 1.3, color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap' },
        clampWords(input.tradeLine, 44),
      ),
    );
  }
  if (row.medals > 0) {
    // The medals are composited onto these empty spots (`badgeRowLefts` places them); "+N" is drawn here as words.
    const spots: VNode[] = Array.from({ length: row.medals }, () => el('div', { width: `${BADGE_ROW.medal}px`, height: `${BADGE_ROW.medal}px`, flexShrink: 0 }));
    if (row.more > 0) {
      spots.push(
        el(
          'div',
          {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: `${morePillWidth(row.more)}px`,
            height: '44px',
            borderRadius: '999px',
            backgroundColor: 'rgba(255,255,255,0.16)',
            fontFamily: 'Poppins',
            fontWeight: 500,
            fontSize: '24px',
            color: WHITE,
            flexShrink: 0,
          },
          `+${row.more}`,
        ),
      );
    }
    column.push(
      el('div', { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: `${BADGE_ROW.gap}px`, marginTop: '14px', height: `${BADGE_ROW.medal}px` }, spots),
    );
  }
  return el('div', { width: `${OG_WIDTH}px`, height: `${OG_HEIGHT}px`, display: 'flex', position: 'relative' }, [
    ...(hasPhoto ? [el('div', { position: 'absolute', left: 0, top: 0, width: `${OG_WIDTH}px`, height: `${OG_HEIGHT}px`, backgroundImage: SHADE })] : []),
    el(
      'div',
      {
        position: 'absolute',
        left: `${TEXT_COLUMN.left}px`,
        right: `${TEXT_COLUMN.right}px`,
        bottom: `${TEXT_COLUMN.bottom}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      },
      column,
    ),
  ]);
}

// ── The pictures (each a sharp composite; each fails to "left out") ──────────────────────────────────────────────

/** The dark Setnayan ground (drawing `.pc.nophoto`): a soft gold glow from above the top edge, on near-black. */
function darkGroundSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}">` +
    `<defs><radialGradient id="g" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(600 -63) scale(840 567)">` +
    `<stop offset="0" stop-color="${SETNAYAN_GOLD}" stop-opacity="0.30"/><stop offset="0.62" stop-color="${SETNAYAN_GOLD}" stop-opacity="0"/>` +
    `</radialGradient></defs><rect width="100%" height="100%" fill="${GROUND}"/><rect width="100%" height="100%" fill="url(#g)"/></svg>`
  );
}

async function fetchBytes(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: cardPhotoSignal() });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** The cover photo, cut to 1200×630 on its most interesting part (`position: attention`, as `profile-card.tsx`). */
async function coverGround(url: string | null | undefined): Promise<Buffer | null> {
  const bytes = await fetchBytes(url);
  if (!bytes) return null;
  try {
    return await sharp(bytes).rotate().resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'attention' }).flatten({ background: GROUND }).png().toBuffer();
  } catch {
    return null;
  }
}

/** A picture fitted into a `size` square, transparent around it. */
async function fitSquare(input: Buffer, size: number): Promise<Buffer> {
  return sharp(input).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

/** An SVG drawn sharp (at 4×) and fitted into a `size` square. */
async function svgSquare(svg: string, size: number): Promise<Buffer> {
  return fitSquare(await sharp(Buffer.from(svg), { density: 288 }).png().toBuffer(), size);
}

/**
 * The CSS `drop-shadow(0 dy blur rgba(0,0,0,alpha))` of the drawing, made with sharp: the picture's own shape in black,
 * moved down `dy`, blurred, under the picture. Returns the bigger picture and how far up-left of the spot it starts.
 */
async function withShadow(png: Buffer, s: { dy: number; blur: number; alpha: number }): Promise<{ input: Buffer; pad: number }> {
  const pad = s.blur * 2;
  const ext = (top: number, bottom: number) => ({ top, bottom, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const shadow = await sharp(png)
    .ensureAlpha()
    .linear([0, 0, 0, s.alpha], [0, 0, 0, 0])
    .extend(ext(pad + s.dy, pad))
    .blur(Math.max(0.3, s.blur / 2))
    .png()
    .toBuffer();
  const over = await sharp(png).ensureAlpha().extend(ext(pad, pad + s.dy)).png().toBuffer();
  return { input: await sharp(shadow).composite([{ input: over, top: 0, left: 0 }]).png().toBuffer(), pad };
}

/** The logo on its white tile (104 px, corners 24, the logo fitted into 76 %). Null when it will not fetch or decode. */
async function logoTile(url: string | null | undefined): Promise<Buffer | null> {
  const bytes = await fetchBytes(url);
  if (!bytes) return null;
  try {
    const { size, radius, inner } = LOGO_TILE;
    const logo = await fitSquare(await sharp(bytes).rotate().png().toBuffer(), inner);
    const tile = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${WHITE}"/></svg>`;
    const at = Math.floor((size - inner) / 2);
    return await sharp(Buffer.from(tile)).composite([{ input: logo, top: at, left: at }]).png().toBuffer();
  } catch {
    return null;
  }
}

/** The seal for the status: the v84 Verified check, or the v84 Verified Partner seal without its year. */
async function sealPicture(status: VendorCardStatus, size: number): Promise<Buffer | null> {
  try {
    if (status === 'verified') return await svgSquare(verifiedV84Svg({ uid: 'ogsl', size }), size);
    if (status === 'partner') {
      const svg = sealArtSvgNoYear('verified_partner', 'ogsl', size);
      return svg ? await svgSquare(svg, size) : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Each medal in the row as a 52 px picture, in order; one whose art fails is left out (as on prints). */
async function medals(shown: readonly PrintBadge[]): Promise<Buffer[]> {
  const art = await resolvePrintBadgeArt(shown, 'og').catch(() => []);
  const out = await Promise.all(
    art.map(async (a) => {
      try {
        return a.png ? await fitSquare(Buffer.from(a.png), BADGE_ROW.medal) : await svgSquare(a.svg, BADGE_ROW.medal);
      } catch {
        return null;
      }
    }),
  );
  return out.filter((b): b is Buffer => b !== null);
}

function markSvg(size: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SETNAYAN_MARK_VIEWBOX}" width="${size}" height="${size}">` +
    `<path d="${SETNAYAN_MARK_PATH}" transform="${SETNAYAN_MARK_TRANSFORM}" fill="${SETNAYAN_GOLD}"/></svg>`
  );
}

/**
 * Render the shop share card → JPEG (1200×630). Throws only when the words cannot be drawn — the route then serves the
 * Setnayan card, so a crawler never gets a broken answer.
 */
export async function renderVendorOgJpeg(input: VendorCardInput): Promise<Buffer> {
  const row = vendorCardBadgeRow(input.badges);
  const [photo, tile, medalPics, mark] = await Promise.all([
    coverGround(input.coverUrl),
    logoTile(input.logoUrl),
    medals(row.shown),
    svgSquare(markSvg(MARK.size), MARK.size).catch(() => null),
  ]);
  const seal = await sealPicture(input.status, tile ? SEAL_ON_LOGO.size : SEAL_SOLO.size);

  // A medal whose art failed is already left out, so the row is laid out for the medals that will really be drawn.
  const laidOut = { medals: medalPics.length, more: row.more };
  const words = await satori(wordsTree(input, photo !== null, laidOut) as unknown as React.ReactNode, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: SATORI_FONTS,
  });
  const layers: sharp.OverlayOptions[] = [{ input: await sharp(Buffer.from(words)).png().toBuffer(), top: 0, left: 0 }];

  if (tile) {
    const t = await withShadow(tile, { dy: 6, blur: 24, alpha: 0.35 });
    layers.push({ input: t.input, top: LOGO_TILE.top - t.pad, left: LOGO_TILE.left - t.pad });
  }
  if (seal) {
    const spot = tile ? SEAL_ON_LOGO : SEAL_SOLO;
    const s = await withShadow(seal, { dy: 2, blur: 6, alpha: 0.4 });
    layers.push({ input: s.input, top: spot.top - s.pad, left: spot.left - s.pad });
  }
  const lefts = badgeRowLefts(laidOut.medals, laidOut.more);
  for (const [i, pic] of medalPics.entries()) {
    const m = await withShadow(pic, { dy: 2, blur: 5, alpha: 0.45 });
    layers.push({ input: m.input, top: BADGE_ROW.top - m.pad, left: lefts[i]! - m.pad });
  }
  if (mark) layers.push({ input: mark, top: MARK.top, left: MARK.left });

  const ground = photo ?? (await sharp(Buffer.from(darkGroundSvg())).png().toBuffer());
  return sharp(ground).composite(layers).jpeg({ quality: 86 }).toBuffer();
}

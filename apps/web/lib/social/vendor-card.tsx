import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

/**
 * apps/web/lib/social/vendor-card.tsx — the Open Graph share card for a
 * public shop page (/{slug}, /v/[slug]) — E1 ("a shop's link preview never
 * breaks").
 *
 * WHY (owner): "a universal representation of a vendor that they will be
 * proud of to share to the public." Today a shop WITH a logo gets an og:image
 * that is a 24-hour presigned R2 URL (`X-Amz-Expires=86400`) — the card
 * breaks the day after it's shared. A shop with no logo gets no og:image at
 * all — the layout-default brand card (or, worse, the page's own broken-image
 * glyph) takes over. This module renders a card at a PERMANENT address
 * (`/api/og/v/[slug]`) instead: `renderVendorOgPng` is pure pixels, no signed
 * URL, no expiry.
 *
 * Same satori + sharp pipeline + bundled static fonts as
 * `lib/social/profile-card.tsx` / `lib/social/realstory-card.tsx`
 * (deterministic on Vercel serverless, no webfont fetch, no new native dep).
 * Self-contained (its own font + el() copies) so this render path and the
 * others can evolve independently — a concurrent edit to one never breaks
 * another.
 *
 * 🪤 THE LOGO IS NEVER A SATORI `<img>` NODE. An earlier version embedded the
 * fetched logo as a data-URI `<img>` inside the satori tree and it threw
 * "Image source is not provided" for every shop that actually HAS a logo
 * (reproduced locally against the real fixture: `saysay-live-band…` — no
 * logo — rendered fine; `setnaprod` — has a logo — 302'd to the brand
 * fallback in production). Root cause: this file's own `el()` helper puts
 * its second argument under `props.style`, which is correct for every other
 * node type here (satori reads a div's box model off `style`) but wrong for
 * `<img>`, whose `src` satori reads off a TOP-LEVEL prop — so the image
 * source silently never reached satori at all. Rather than hand-roll a
 * second prop-shape through `el()` (and re-risk the same class of bug), the
 * logo is composited the SAME way `profile-card.tsx` composites its hero
 * photo: satori renders TEXT ONLY (zero image awareness, zero risk), and a
 * separately-fetched, `sharp`-normalized logo tile is `.composite()`-d onto
 * the finished PNG at a fixed, hand-chosen corner position — pure raster
 * layering, the proven pattern, never satori image resolution.
 *
 * PNG, not JPEG: unlike the other social cards in this file's siblings, a
 * shop's card composites a small square logo tile that may carry
 * transparency (most uploaded shop logos are PNGs with a transparent
 * ground) — JPEG would print that transparency as black.
 */

// ── Brand palette (literal hexes — mirror apps/web/app/globals.css --m-*) ─────
const CREAM = '#FBFBFA';
const INK = '#1E2229';
const GOLD = '#C5A059';
const GOLD_DEEP = '#A88340';
const INK_FAINT = '#9AA0A6';

const FONT_DIR = path.join(process.cwd(), 'lib', 'social', 'fonts');
const loadFont = (file: string): Buffer => readFileSync(path.join(FONT_DIR, file));

const SATORI_FONTS = [
  { name: 'Cardo', data: loadFont('Cardo-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'Cardo', data: loadFont('Cardo-Bold.ttf'), weight: 600 as const, style: 'normal' as const },
  { name: 'Poppins', data: loadFont('Poppins-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'Poppins', data: loadFont('Poppins-Medium.ttf'), weight: 500 as const, style: 'normal' as const },
];

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// Fixed corner badge — NOT part of satori's flex layout, so no layout math
// needs reverse-engineering to know where to composite it. Sits inside the
// card's own border, clear of the centered eyebrow/name/description column.
const LOGO_SIZE = 88;
const LOGO_TOP = 64;
const LOGO_LEFT = 64;

export type VendorCardInput = {
  /** The resolved, hybrid-anonymity-safe display label — never the raw business_name. */
  displayName: string;
  /**
   * The card's one descriptive line: the shop's own tagline when it has one,
   * otherwise "category · city · Verified" (the caller composes this —
   * this module only lays it out).
   */
  description: string;
  /**
   * An ALREADY-RESOLVED, fetchable logo URL (the caller has already run it
   * through `displayUrlForStoredAsset` / `lib/site-media-ref.ts`) — or null
   * for a shop with no logo. This module fetches the bytes itself so the
   * card can composite them onto the finished PNG (see the module docblock —
   * never handed to satori).
   */
  logoUrl?: string | null;
};

type VNode = {
  type: string;
  props: { style?: Record<string, unknown>; children?: unknown };
};

const el = (
  type: string,
  style: Record<string, unknown>,
  children?: unknown,
): VNode => ({ type, props: { style, children } });

/** Truncate to `max` chars on a word boundary, then ellipsize. */
function clamp(text: string, max: number): string {
  const t = (text ?? '').trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

function wordmark(color: string = INK): VNode {
  return el(
    'div',
    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
    [
      el('div', { width: '56px', height: '1px', backgroundColor: GOLD }),
      el(
        'div',
        {
          fontFamily: 'Poppins',
          fontWeight: 500,
          fontSize: '22px',
          letterSpacing: '12px',
          paddingLeft: '12px',
          color,
        },
        'SETNAYAN',
      ),
    ],
  );
}

/** The eyebrow row — ALWAYS this text, whether or not the shop has a logo (the logo, when present, is a corner badge composited after render — see the module docblock). */
function eyebrowRow(): VNode {
  return el(
    'div',
    { display: 'flex', alignItems: 'center', gap: '14px' },
    [
      el('div', { width: '26px', height: '1px', backgroundColor: GOLD }),
      el(
        'div',
        {
          fontFamily: 'Poppins',
          fontWeight: 500,
          fontSize: '17px',
          letterSpacing: '4px',
          color: GOLD_DEEP,
        },
        'A SETNAYAN SHOP',
      ),
      el('div', { width: '26px', height: '1px', backgroundColor: GOLD }),
    ],
  );
}

function cardTree(input: VendorCardInput): VNode {
  return el(
    'div',
    {
      width: `${OG_WIDTH}px`,
      height: `${OG_HEIGHT}px`,
      display: 'flex',
      padding: '40px',
      backgroundColor: CREAM,
      fontFamily: 'Poppins',
    },
    [
      el(
        'div',
        {
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: `1px solid ${GOLD}`,
          borderRadius: '12px',
          padding: '48px 60px',
        },
        [
          eyebrowRow(),
          el(
            'div',
            { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' },
            [
              el(
                'div',
                {
                  fontFamily: 'Cardo',
                  fontWeight: 600,
                  fontSize: '76px',
                  lineHeight: '1.08',
                  color: INK,
                  textAlign: 'center',
                },
                clamp(input.displayName, 46),
              ),
              el('div', { width: '78px', height: '2px', backgroundColor: GOLD }),
              el(
                'div',
                {
                  fontFamily: 'Poppins',
                  fontWeight: 400,
                  fontSize: '24px',
                  lineHeight: '1.35',
                  color: INK_FAINT,
                  textAlign: 'center',
                  maxWidth: '900px',
                },
                clamp(input.description, 100),
              ),
            ],
          ),
          wordmark(),
        ],
      ),
    ],
  );
}

/**
 * Fetch the resolved logo URL and normalize it into a small square PNG tile,
 * framed with a thin gold border (matching the card's own rule) via a 1px
 * `sharp` extend. Never throws — a broken/unreachable/undecodable logo
 * degrades to `null` and the card composites nothing, exactly like a shop
 * with no logo.
 */
async function logoTile(logoUrl: string | null | undefined): Promise<Buffer | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    const inner = LOGO_SIZE - 2;
    const framed = await sharp(bytes)
      .resize(inner, inner, { fit: 'contain', background: '#FFFFFF' })
      .extend({ top: 1, bottom: 1, left: 1, right: 1, background: GOLD })
      .png()
      .toBuffer();
    return framed;
  } catch {
    return null;
  }
}

/**
 * Render the shop OG card → PNG buffer (1200×630). Never throws on a
 * font/layout/logo edge — the caller (`/api/og/v/[slug]`) falls back to the
 * static brand image so a crawler never gets a broken response.
 */
export async function renderVendorOgPng(input: VendorCardInput): Promise<Buffer> {
  const svg = await satori(cardTree(input) as unknown as React.ReactNode, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: SATORI_FONTS,
  });
  const base = sharp(Buffer.from(svg)).png();
  const tile = await logoTile(input.logoUrl);
  if (!tile) return base.toBuffer();
  return base
    .composite([{ input: tile, top: LOGO_TOP, left: LOGO_LEFT }])
    .png()
    .toBuffer();
}

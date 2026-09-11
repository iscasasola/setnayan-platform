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
 * The logo (when the shop has one) is embedded as a base64 DATA URI, not a
 * remote satori `<img src>` fetch — one network round trip (done by THIS
 * module, through the same public-bucket-only signer every other read of
 * `vendor_profiles.logo_url` goes through — see `displayUrlForStoredAsset` /
 * `lib/site-media-ref.ts`) instead of leaving satori to fetch it during
 * layout. A failed fetch/decode degrades to the wordmark-only card — a
 * broken logo must never break the whole share.
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
const LOGO_BOX = 108;

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
   * card can embed them as a data URI rather than hand satori a remote URL.
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

/** A small square logo tile as a data-URI `<img>` node, or the plain eyebrow row without one. */
function markRow(logoDataUri: string | null): VNode {
  if (logoDataUri) {
    return el(
      'div',
      {
        display: 'flex',
        width: `${LOGO_BOX}px`,
        height: `${LOGO_BOX}px`,
        borderRadius: '16px',
        border: `1px solid ${GOLD}`,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      },
      el('img', {
        src: logoDataUri,
        width: `${LOGO_BOX - 2}px`,
        height: `${LOGO_BOX - 2}px`,
      }),
    );
  }
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

function cardTree(input: VendorCardInput, logoDataUri: string | null): VNode {
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
          markRow(logoDataUri),
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
 * Fetch the resolved logo URL and normalize it into a small square PNG data
 * URI. Never throws — a broken/unreachable logo degrades to `null` and the
 * card renders the eyebrow row instead, exactly like a shop with no logo.
 */
async function logoAsDataUri(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    const tile = await sharp(bytes)
      .resize(LOGO_BOX - 2, LOGO_BOX - 2, { fit: 'contain', background: '#FFFFFF' })
      .png()
      .toBuffer();
    return `data:image/png;base64,${tile.toString('base64')}`;
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
  const logoDataUri = await logoAsDataUri(input.logoUrl);
  const svg = await satori(cardTree(input, logoDataUri) as unknown as React.ReactNode, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: SATORI_FONTS,
  });
  return sharp(Buffer.from(svg)).png().toBuffer();
}

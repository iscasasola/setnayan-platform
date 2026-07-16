import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

/**
 * apps/web/lib/social/profile-card.tsx — the personalized Open Graph share card
 * for a public account profile at /u/[slug] (social-share follow-through #7c).
 *
 * WHY: when an account opts its /u profile public AND has ≥1 public celebration,
 * a Facebook/Pinterest share of that profile should preview the PERSON — their
 * display name over their most-recent public celebration's hero photo — not the
 * generic brand card. The caller (app/api/og/u/[slug]/route.ts) renders this ONLY
 * under those two conditions; a disabled / empty profile falls back to the static
 * brand image, so a name is never leaked for a profile that isn't a public
 * showcase.
 *
 * Same satori + sharp pipeline + bundled static fonts as lib/social/realstory-
 * card.tsx (deterministic on Vercel serverless, no webfont fetch, no new native
 * dep). Self-contained (its own font + el() copies) so this render path and the
 * real-story one can evolve independently — a concurrent edit to one never
 * breaks the other.
 */

// ── Brand palette (literal hexes — mirror apps/web/app/globals.css --m-*) ─────
const CREAM = '#FBFBFA';
const INK = '#1E2229';
const GOLD = '#C5A059';
const GOLD_DEEP = '#A88340';
const INK_FAINT = '#9AA0A6';

// ── Font buffers (static weights only — satori's opentype.js parser rejects
// variable fonts). readFileSync at module load caches them for the life of the
// serverless instance. ────────────────────────────────────────────────────────
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

export type ProfileCardInput = {
  /** The account's display name, e.g. "Cale & Ice". */
  displayName: string;
  /** Short line under the name, e.g. "A collection of celebrations". */
  subtitle: string;
  /** Hero photo from the most-recent public chapter → photo variant when set. */
  heroPhotoUrl?: string | null;
};

// A satori-compatible element node (object form — no JSX runtime needed, so
// tsconfig `jsx: preserve` stays happy).
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

/** The "SETNAYAN" wordmark that anchors the card. */
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
          paddingLeft: '12px', // optical centering for the wide tracking
          color,
        },
        'SETNAYAN',
      ),
    ],
  );
}

// Branded (photoless) card — mirrors the /u page's cream showcase header.
function brandedTree(input: ProfileCardInput): VNode {
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
          el(
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
                'A SETNAYAN PROFILE',
              ),
              el('div', { width: '26px', height: '1px', backgroundColor: GOLD }),
            ],
          ),
          el(
            'div',
            {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '18px',
            },
            [
              el(
                'div',
                {
                  fontFamily: 'Cardo',
                  fontWeight: 600,
                  fontSize: '88px',
                  lineHeight: '1',
                  color: INK,
                  textAlign: 'center',
                },
                clamp(input.displayName, 38),
              ),
              el('div', { width: '78px', height: '2px', backgroundColor: GOLD }),
              el(
                'div',
                {
                  fontFamily: 'Poppins',
                  fontWeight: 400,
                  fontSize: '25px',
                  lineHeight: '1.35',
                  color: INK_FAINT,
                  textAlign: 'center',
                  maxWidth: '860px',
                },
                clamp(input.subtitle, 88),
              ),
            ],
          ),
          wordmark(),
        ],
      ),
    ],
  );
}

// Photo variant — a TRANSPARENT satori layer (bottom scrim + white type)
// composited over the account's most-recent public hero photo.
function photoOverlayTree(input: ProfileCardInput): VNode {
  return el(
    'div',
    {
      width: `${OG_WIDTH}px`,
      height: `${OG_HEIGHT}px`,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      fontFamily: 'Poppins',
    },
    [
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '100%',
          padding: '120px 64px 52px',
          // Bottom scrim keeps white type legible over any photo; fades to fully
          // transparent at the top so the image reads clean above it.
          backgroundImage:
            'linear-gradient(to top, rgba(16,18,22,0.86) 0%, rgba(16,18,22,0.55) 42%, rgba(16,18,22,0) 100%)',
        },
        [
          el(
            'div',
            {
              fontFamily: 'Poppins',
              fontWeight: 500,
              fontSize: '17px',
              letterSpacing: '4px',
              color: '#E8D9B5',
            },
            'A SETNAYAN PROFILE',
          ),
          el(
            'div',
            {
              fontFamily: 'Cardo',
              fontWeight: 600,
              fontSize: '78px',
              lineHeight: '1',
              color: '#FFFFFF',
            },
            clamp(input.displayName, 40),
          ),
          el(
            'div',
            {
              fontFamily: 'Poppins',
              fontWeight: 400,
              fontSize: '23px',
              color: 'rgba(255,255,255,0.88)',
            },
            clamp(input.subtitle, 92),
          ),
        ],
      ),
    ],
  );
}

/**
 * Render the profile OG card → JPEG buffer (1200×630). Never throws on a
 * font/layout/photo edge — the caller (the /api/og route) falls back to the
 * static brand image so the Graph crawler never gets a broken response.
 *
 * With a reachable `heroPhotoUrl`, renders the PHOTO variant (the hero photo,
 * smart-cropped to 1.91:1, white-type scrim overlaid); a fetch/decode failure
 * degrades to the branded card rather than failing the share.
 */
export async function renderProfileOgJpeg(input: ProfileCardInput): Promise<Buffer> {
  if (input.heroPhotoUrl) {
    try {
      const res = await fetch(input.heroPhotoUrl);
      if (res.ok) {
        const photo = Buffer.from(await res.arrayBuffer());
        const base = await sharp(photo)
          .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'attention' })
          .toBuffer();
        const overlaySvg = await satori(
          photoOverlayTree(input) as unknown as React.ReactNode,
          { width: OG_WIDTH, height: OG_HEIGHT, fonts: SATORI_FONTS },
        );
        const overlayPng = await sharp(Buffer.from(overlaySvg)).png().toBuffer();
        return sharp(base)
          .composite([{ input: overlayPng, top: 0, left: 0 }])
          .jpeg({ quality: 86 })
          .toBuffer();
      }
    } catch {
      // Photo unreachable / undecodable → fall through to the branded card.
    }
  }
  const svg = await satori(brandedTree(input) as unknown as React.ReactNode, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: SATORI_FONTS,
  });
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

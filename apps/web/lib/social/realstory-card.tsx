import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

/**
 * apps/web/lib/social/realstory-card.tsx — the per-editorial Open Graph share
 * card for the public Real Stories showcase (/realstories/[slug]).
 *
 * WHY (owner 2026-06-14, "the editorials should be shareable … will it have a
 * preview on facebook … so the exact editorial can be viewable than just a
 * link"): a Facebook/Pinterest share renders a rich card ONLY when the page
 * exposes an `og:image`. The editorial pages set og:title + og:description but
 * had no og:image, so a share read as a bare link. This module renders a
 * 1200×630 (the 1.91:1 Facebook/Open-Graph ratio) branded card so a shared
 * Real Story shows the couple, their palette, and the venue — then deep-links
 * to the exact editorial.
 *
 * Same satori + sharp pipeline + bundled static fonts as lib/social/card.tsx
 * (the Social Sharing Program) — deterministic on Vercel serverless, no
 * webfont fetch, no new native dep ([[project_setnayan_oss_self_host_preference]]).
 * Kept self-contained (its own font + el() copies) rather than importing
 * card.tsx internals so the two render paths can evolve independently and a
 * concurrent edit to one never breaks the other.
 *
 * Real editorials with a couple hero photo get the photo-background variant
 * when the showcase loop wires this onto the couple's own /[slug] editorial
 * (a follow-up); today the live sample (Maria & Juan) has no photo, so the
 * branded card is the rendered path. `heroPhotoUrl` is accepted now so that
 * wiring is a one-line change, not a signature change.
 */

// ── Brand palette (literal hexes — mirror apps/web/app/globals.css --m-*) ─────
const CREAM = '#FBFBFA';
const INK = '#1E2229';
const GOLD = '#C5A059';
const GOLD_DEEP = '#A88340';
const INK_SOFT = '#5B6068';
const INK_FAINT = '#9AA0A6';

// ── Font buffers (explicit-buffer model — satori needs raw TTF bytes; static
// weights only, its opentype.js parser rejects variable fonts). readFileSync at
// module load caches them for the life of the serverless instance. ────────────
const FONT_DIR = path.join(process.cwd(), 'lib', 'social', 'fonts');
const loadFont = (file: string): Buffer => readFileSync(path.join(FONT_DIR, file));

const SATORI_FONTS = [
  { name: 'Cardo', data: loadFont('Cardo-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'Cardo', data: loadFont('Cardo-Bold.ttf'), weight: 600 as const, style: 'normal' as const },
  { name: 'Poppins', data: loadFont('Poppins-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'Poppins', data: loadFont('Poppins-Medium.ttf'), weight: 500 as const, style: 'normal' as const },
  { name: 'GreatVibes', data: loadFont('GreatVibes-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
];

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

export type RealStoryCardInput = {
  /** "Maria & Juan" */
  coupleNames: string;
  /** One-line descriptor, e.g. "A Catholic garden wedding · Tagaytay". */
  descriptor: string;
  /** Human date, e.g. "February 2026". */
  dateLabel: string;
  /** Wedding palette hexes — rendered as a swatch row. */
  palette: ReadonlyArray<string>;
  /** True → a subtle "Sample" note in the eyebrow (honesty: never present a
   *  curated sample as a real client). */
  isSample: boolean;
  /** Reserved for the real-editorial photo-background variant. Null today. */
  heroPhotoUrl?: string | null;
};

// A satori-compatible element node (object form — no JSX/React runtime needed,
// matching lib/social/card.tsx so tsconfig `jsx: preserve` stays happy).
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

/** The "SETNAYAN" wordmark that anchors the bottom of the card. */
function wordmark(): VNode {
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
          color: INK,
        },
        'SETNAYAN',
      ),
    ],
  );
}

function cardTree(input: RealStoryCardInput): VNode {
  const eyebrow = input.isSample
    ? 'A SETNAYAN REAL STORY · SAMPLE'
    : 'A SETNAYAN REAL STORY';
  const swatches = input.palette.slice(0, 5);

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
      // Inset gold-ruled mat — the editorial "frame".
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
          padding: '44px 60px',
        },
        [
          // Eyebrow.
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
                eyebrow,
              ),
              el('div', { width: '26px', height: '1px', backgroundColor: GOLD }),
            ],
          ),
          // Center — names + descriptor + date + palette.
          el(
            'div',
            {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            },
            [
              el(
                'div',
                {
                  fontFamily: 'Cardo',
                  fontWeight: 600,
                  fontSize: '84px',
                  lineHeight: '1',
                  color: INK,
                  textAlign: 'center',
                },
                clamp(input.coupleNames, 40),
              ),
              el(
                'div',
                {
                  fontFamily: 'Poppins',
                  fontWeight: 400,
                  fontSize: '25px',
                  lineHeight: '1.35',
                  color: INK_SOFT,
                  textAlign: 'center',
                  maxWidth: '880px',
                },
                clamp(input.descriptor, 90),
              ),
              el(
                'div',
                {
                  fontFamily: 'Poppins',
                  fontWeight: 500,
                  fontSize: '18px',
                  letterSpacing: '3px',
                  color: INK_FAINT,
                },
                input.dateLabel.toUpperCase(),
              ),
              swatches.length > 0
                ? el(
                    'div',
                    { display: 'flex', gap: '10px', marginTop: '4px' },
                    swatches.map((hex) =>
                      el('div', {
                        width: '46px',
                        height: '9px',
                        borderRadius: '5px',
                        backgroundColor: hex,
                      }),
                    ),
                  )
                : el('div', { display: 'flex' }),
            ],
          ),
          // Footer wordmark.
          wordmark(),
        ],
      ),
    ],
  );
}

// Photo variant — a TRANSPARENT satori layer (bottom gradient scrim + white
// editorial type) composited over the couple's real hero photo. Used when a
// published editorial has a `hero_photo_id`; the branded `cardTree` is the
// fallback for photoless editorials (the sample, early real ones).
function photoOverlayTree(input: RealStoryCardInput): VNode {
  const eyebrow = input.isSample
    ? 'A SETNAYAN REAL STORY · SAMPLE'
    : 'A SETNAYAN REAL STORY';
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
          // Bottom scrim so white type stays legible over any photo; fades to
          // fully transparent at the top so the image reads clean above it.
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
            eyebrow,
          ),
          el(
            'div',
            {
              fontFamily: 'Cardo',
              fontWeight: 600,
              fontSize: '74px',
              lineHeight: '1',
              color: '#FFFFFF',
            },
            clamp(input.coupleNames, 42),
          ),
          el(
            'div',
            {
              fontFamily: 'Poppins',
              fontWeight: 400,
              fontSize: '23px',
              color: 'rgba(255,255,255,0.88)',
            },
            clamp(`${input.descriptor} · ${input.dateLabel}`, 96),
          ),
        ],
      ),
    ],
  );
}

/**
 * Render the Real Story OG card → JPEG buffer (1200×630). Never throws on a
 * font/layout edge — the caller (the /api/og route) can fall back to a static
 * brand image so the Graph crawler never gets a broken response.
 *
 * With a `heroPhotoUrl`, renders the PHOTO variant (the couple's real photo,
 * smart-cropped to 1.91:1, with the white-type scrim overlaid); a fetch/decode
 * failure degrades to the branded card rather than failing the share.
 */
export async function renderRealStoryOgJpeg(
  input: RealStoryCardInput,
): Promise<Buffer> {
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
  const svg = await satori(cardTree(input) as unknown as React.ReactNode, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: SATORI_FONTS,
  });
  return sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toBuffer();
}

// ── Couple monogram card ──────────────────────────────────────────────────────
// The share card for a couple's OWN /[slug] page while they have NO published
// editorial (the invitation / Save-the-Date phase). Mirrors the page hero — their
// monogram mark + names + date on cream — so a shared invitation shows THEM, not
// the generic brand image (owner 2026-06-21 "why is the cover photo … not the look
// of the page with the logo").

const MULBERRY = '#5C2542';

export type CoupleMonogramCardInput = {
  /** "Cale & Ice" */
  coupleNames: string;
  /** Human date, e.g. "December 18, 2026" (uppercased on the card). */
  dateLabel: string;
  /** Explicit monogram-text override (events.monogram_text); null → derive initials. */
  monogramText: string | null;
  /** Monogram colour (events.monogram_color); null/invalid → brand mulberry. */
  monogramColor: string | null;
};

/** Two-letter monogram from the couple's names, e.g. "Cale & Ice" → "CI". */
function monogramInitials(names: string, override: string | null): string {
  if (override && override.trim()) return override.trim().slice(0, 3).toUpperCase();
  const parts = (names ?? '')
    .split(/\s*&\s*|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const a = parts[0]?.charAt(0) ?? '';
  const b = parts[1]?.charAt(0) ?? '';
  return (a && b ? a + b : (names ?? '').trim().charAt(0) || '·').toUpperCase();
}

function monogramCardTree(input: CoupleMonogramCardInput): VNode {
  const mono =
    input.monogramColor && /^#[0-9a-fA-F]{6}$/.test(input.monogramColor.trim())
      ? input.monogramColor.trim()
      : MULBERRY;
  const initials = monogramInitials(input.coupleNames, input.monogramText);
  return el(
    'div',
    {
      width: `${OG_WIDTH}px`,
      height: `${OG_HEIGHT}px`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '54px 64px',
      backgroundColor: CREAM,
      fontFamily: 'Cardo',
    },
    [
      // Header — mirrors the page chrome.
      el(
        'div',
        {
          fontFamily: 'Poppins',
          fontWeight: 500,
          fontSize: '16px',
          letterSpacing: '5px',
          color: INK_FAINT,
        },
        'SETNAYAN · INVITATION',
      ),
      // Center — monogram mark + gold rule + names + date.
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        },
        [
          el(
            'div',
            {
              fontFamily: 'Cardo',
              fontWeight: 600,
              fontSize: '156px',
              lineHeight: '1',
              letterSpacing: '6px',
              paddingLeft: '6px', // optical centring for the tracking
              color: mono,
            },
            initials,
          ),
          el('div', { width: '78px', height: '2px', backgroundColor: GOLD }),
          el(
            'div',
            {
              fontFamily: 'Cardo',
              fontWeight: 600,
              fontSize: '66px',
              lineHeight: '1',
              color: INK,
              textAlign: 'center',
            },
            clamp(input.coupleNames, 40),
          ),
          input.dateLabel
            ? el(
                'div',
                {
                  fontFamily: 'Poppins',
                  fontWeight: 500,
                  fontSize: '22px',
                  letterSpacing: '5px',
                  color: INK_FAINT,
                },
                input.dateLabel.toUpperCase(),
              )
            : el('div', { display: 'flex' }),
        ],
      ),
      // Footer — wordmark + url.
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        },
        [
          wordmark(),
          el(
            'div',
            {
              fontFamily: 'Poppins',
              fontSize: '15px',
              letterSpacing: '1px',
              color: INK_FAINT,
            },
            'www.setnayan.com',
          ),
        ],
      ),
    ],
  );
}

/** Render the couple's monogram OG card → JPEG (1200×630). Never throws on a
 *  layout edge — the caller falls back to the static brand image. */
export async function renderCoupleMonogramOgJpeg(
  input: CoupleMonogramCardInput,
): Promise<Buffer> {
  const svg = await satori(monogramCardTree(input) as unknown as React.ReactNode, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: SATORI_FONTS,
  });
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

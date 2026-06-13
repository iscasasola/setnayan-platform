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

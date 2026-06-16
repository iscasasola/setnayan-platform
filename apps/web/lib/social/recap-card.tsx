import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

/**
 * apps/web/lib/social/recap-card.tsx — the 1200×630 Open Graph share card for a
 * published Auto-Recap (/[slug]/recap).
 *
 * Same satori + sharp + bundled-static-font pipeline as
 * lib/social/realstory-card.tsx (deterministic on Vercel serverless, no webfont
 * fetch, no new native dep). Self-contained (its own font + el() copies) so the
 * two share-card paths evolve independently.
 *
 * The photo variant uses ONLY a public-safe hero (the couple's own curated
 * gallery / hero, or a face-blurred wall-safe derivative — never an unblurred
 * master), passed in by the route.
 */

// ── Brand palette (literal hexes — mirror apps/web/app/globals.css --m-*) ─────
const CREAM = '#FBFBFA';
const INK = '#1E2229';
const GOLD = '#C5A059';
const GOLD_DEEP = '#A88340';
const INK_SOFT = '#5B6068';
const INK_FAINT = '#9AA0A6';
const MULBERRY = '#5C2542';

// ── Font buffers (static weights only; cached for the serverless instance). ───
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

export type RecapCardInput = {
  coupleNames: string;
  monogramInitials: string;
  monogramColor: string;
  /** Human date, e.g. "February 14, 2026" (or null). */
  dateLabel: string | null;
  /** Already-formatted stat line, e.g. "128 photos · 24 voices · 120 guests". */
  statLine: string;
  /** Public-safe hero (curated / wall-safe). Null → branded card. */
  heroPhotoUrl?: string | null;
};

type VNode = { type: string; props: { style?: Record<string, unknown>; children?: unknown } };
const el = (type: string, style: Record<string, unknown>, children?: unknown): VNode => ({
  type,
  props: { style, children },
});

function clamp(text: string, max: number): string {
  const t = (text ?? '').trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

/** A safe single hex (#RGB/#RRGGBB) or a neutral fallback — never raw into CSS. */
function safeHex(hex: string | null | undefined, fallback: string): string {
  return typeof hex === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(hex.trim()) ? hex.trim() : fallback;
}

function monogramBadge(initials: string, color: string): VNode {
  return el(
    'div',
    {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '96px',
      height: '96px',
      borderRadius: '50%',
      border: `2px solid ${GOLD}`,
    },
    el(
      'div',
      { fontFamily: 'Cardo', fontWeight: 600, fontSize: '40px', color, letterSpacing: '2px' },
      clamp(initials, 3),
    ),
  );
}

function cardTree(input: RecapCardInput): VNode {
  const color = safeHex(input.monogramColor, MULBERRY);
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
          padding: '40px 60px',
        },
        [
          el('div', { display: 'flex', alignItems: 'center', gap: '14px' }, [
            el('div', { width: '26px', height: '1px', backgroundColor: GOLD }),
            el(
              'div',
              { fontFamily: 'Poppins', fontWeight: 500, fontSize: '17px', letterSpacing: '4px', color: GOLD_DEEP },
              'THE RECAP · A SETNAYAN LIVING MEMORY',
            ),
            el('div', { width: '26px', height: '1px', backgroundColor: GOLD }),
          ]),
          el(
            'div',
            { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' },
            [
              monogramBadge(input.monogramInitials, color),
              el(
                'div',
                {
                  fontFamily: 'Cardo',
                  fontWeight: 600,
                  fontSize: '80px',
                  lineHeight: '1',
                  color: INK,
                  textAlign: 'center',
                },
                clamp(input.coupleNames, 40),
              ),
              el(
                'div',
                { fontFamily: 'Poppins', fontWeight: 400, fontSize: '24px', color: INK_SOFT, textAlign: 'center' },
                'The day, in their words.',
              ),
              el(
                'div',
                { fontFamily: 'Poppins', fontWeight: 500, fontSize: '18px', letterSpacing: '2px', color: INK_FAINT },
                input.statLine.toUpperCase(),
              ),
            ],
          ),
          el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }, [
            el('div', { width: '56px', height: '1px', backgroundColor: GOLD }),
            el(
              'div',
              { fontFamily: 'Poppins', fontWeight: 500, fontSize: '22px', letterSpacing: '12px', paddingLeft: '12px', color: INK },
              'SETNAYAN',
            ),
          ]),
        ],
      ),
    ],
  );
}

function photoOverlayTree(input: RecapCardInput): VNode {
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
          backgroundImage:
            'linear-gradient(to top, rgba(16,18,22,0.88) 0%, rgba(16,18,22,0.55) 42%, rgba(16,18,22,0) 100%)',
        },
        [
          el(
            'div',
            { fontFamily: 'Poppins', fontWeight: 500, fontSize: '17px', letterSpacing: '4px', color: '#E8D9B5' },
            'THE RECAP · A SETNAYAN LIVING MEMORY',
          ),
          el(
            'div',
            { fontFamily: 'Cardo', fontWeight: 600, fontSize: '72px', lineHeight: '1', color: '#FFFFFF' },
            clamp(input.coupleNames, 42),
          ),
          el(
            'div',
            { fontFamily: 'Poppins', fontWeight: 400, fontSize: '22px', color: 'rgba(255,255,255,0.9)' },
            clamp(
              [input.dateLabel, input.statLine].filter(Boolean).join('  ·  '),
              96,
            ),
          ),
        ],
      ),
    ],
  );
}

/** Render the recap OG card → JPEG (1200×630). Never throws on a font/layout
 *  edge; the route falls back to a static brand image. */
export async function renderRecapOgJpeg(input: RecapCardInput): Promise<Buffer> {
  if (input.heroPhotoUrl) {
    try {
      const res = await fetch(input.heroPhotoUrl);
      if (res.ok) {
        const photo = Buffer.from(await res.arrayBuffer());
        const base = await sharp(photo)
          .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'attention' })
          .toBuffer();
        const overlaySvg = await satori(photoOverlayTree(input) as unknown as React.ReactNode, {
          width: OG_WIDTH,
          height: OG_HEIGHT,
          fonts: SATORI_FONTS,
        });
        const overlayPng = await sharp(Buffer.from(overlaySvg)).png().toBuffer();
        return sharp(base)
          .composite([{ input: overlayPng, top: 0, left: 0 }])
          .jpeg({ quality: 86 })
          .toBuffer();
      }
    } catch {
      // hero unreachable → branded card
    }
  }
  const svg = await satori(cardTree(input) as unknown as React.ReactNode, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: SATORI_FONTS,
  });
  return sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toBuffer();
}

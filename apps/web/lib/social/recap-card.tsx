import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

/**
 * apps/web/lib/social/recap-card.tsx — the shareable Open Graph / story card for
 * a published Auto-Recap (/[slug]/recap), rendered in three sizes:
 *   - `og`     1200×630  link unfurl (Facebook / Messenger / Viber, default)
 *   - `square` 1080×1080 feed post (Instagram / Facebook)
 *   - `story`  1080×1920 Reels / TikTok / IG-FB Stories (9:16)
 *
 * WHY story/square (owner 2026-07-16, Social_Share_Settings_Council_Verdict
 * sign-off #3): Instagram feed, IG/FB Stories and TikTok don't accept web-URL
 * shares — they need an actual FILE pushed through the native share sheet. The
 * couple's recap only offered URL shares; this gives the recap a postable
 * file-asset so the couple can drop the day straight into a story.
 *
 * Same satori + sharp + bundled-static-font pipeline as
 * lib/social/manifesto-card.tsx / realstory-card.tsx (deterministic on Vercel
 * serverless, no webfont fetch, no new native dep). Self-contained (its own
 * font + el() copies) so the share-card paths evolve independently.
 *
 * The photo variant uses ONLY a public-safe hero (the couple's own curated
 * gallery / hero, or a face-blurred wall-safe derivative — never an unblurred
 * master), passed in by the route.
 *
 * WATERMARK (sign-off #4): the story/square cards are Setnayan-COMPOSED
 * artifacts (our frame, our type, our lockup around a public-safe hero), so
 * they carry a subtle "made with Setnayan" mark. This is on-policy — the mark
 * sits on the Setnayan-rendered card chrome, never stamped onto the couple's
 * raw photo. `og` keeps the existing footer wordmark unchanged.
 */

// ── Brand palette (literal hexes — mirror apps/web/app/globals.css --m-*) ─────
const CREAM = '#FBFBFA';
const INK = '#1E2229';
const GOLD = '#C5A059';
const GOLD_DEEP = '#A88340';
const INK_SOFT = '#5B6068';
const INK_FAINT = '#9AA0A6';
const MULBERRY = '#1E2229';

// ── Font buffers (static weights only; cached for the serverless instance). ───
const FONT_DIR = path.join(process.cwd(), 'lib', 'social', 'fonts');
const loadFont = (file: string): Buffer => readFileSync(path.join(FONT_DIR, file));

const SATORI_FONTS = [
  { name: 'Cardo', data: loadFont('Cardo-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'Cardo', data: loadFont('Cardo-Bold.ttf'), weight: 600 as const, style: 'normal' as const },
  { name: 'Poppins', data: loadFont('Poppins-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'Poppins', data: loadFont('Poppins-Medium.ttf'), weight: 500 as const, style: 'normal' as const },
];

export type RecapCardFormat = 'og' | 'square' | 'story';

/** Per-format geometry. `og` reproduces the original 1200×630 exactly. */
const DIMS: Record<
  RecapCardFormat,
  {
    w: number;
    h: number;
    // branded (no-photo) card
    framePad: string;
    monogram: number;
    monogramText: number;
    couple: number;
    sub: number;
    stat: number;
    wordmark: number;
    // photo-overlay card
    overlayPad: string;
    overlayEyebrow: number;
    overlayCouple: number;
    overlayMeta: number;
  }
> = {
  og: {
    w: 1200,
    h: 630,
    framePad: '40px 60px',
    monogram: 96,
    monogramText: 40,
    couple: 80,
    sub: 24,
    stat: 18,
    wordmark: 22,
    overlayPad: '120px 64px 52px',
    overlayEyebrow: 17,
    overlayCouple: 72,
    overlayMeta: 22,
  },
  square: {
    w: 1080,
    h: 1080,
    framePad: '72px 64px',
    monogram: 120,
    monogramText: 50,
    couple: 96,
    sub: 27,
    stat: 20,
    wordmark: 24,
    overlayPad: '300px 64px 72px',
    overlayEyebrow: 19,
    overlayCouple: 90,
    overlayMeta: 26,
  },
  story: {
    w: 1080,
    h: 1920,
    framePad: '140px 64px',
    monogram: 132,
    monogramText: 56,
    couple: 104,
    sub: 30,
    stat: 22,
    wordmark: 26,
    overlayPad: '560px 64px 132px',
    overlayEyebrow: 20,
    overlayCouple: 104,
    overlayMeta: 30,
  },
};

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

/** Subtle "made with Setnayan" maker mark for the Setnayan-composed story/square
 *  PHOTO cards (sign-off #4). Small, low-contrast, footer-anchored — reads as a
 *  maker mark on the couple's hero, not a banner. Tuned for the dark overlay. */
function madeWithMark(): VNode {
  return el('div', { display: 'flex', alignItems: 'center', gap: '10px' }, [
    el(
      'div',
      { fontFamily: 'Poppins', fontWeight: 400, fontSize: '15px', letterSpacing: '2px', color: 'rgba(255,255,255,0.66)' },
      'MADE WITH',
    ),
    el(
      'div',
      { fontFamily: 'Poppins', fontWeight: 500, fontSize: '16px', letterSpacing: '6px', paddingLeft: '6px', color: '#FFFFFF' },
      'SETNAYAN',
    ),
  ]);
}

function monogramBadge(initials: string, color: string, size: number, textSize: number): VNode {
  return el(
    'div',
    {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      border: `2px solid ${GOLD}`,
    },
    el(
      'div',
      { fontFamily: 'Cardo', fontWeight: 600, fontSize: `${textSize}px`, color, letterSpacing: '2px' },
      clamp(initials, 3),
    ),
  );
}

function cardTree(input: RecapCardInput, format: RecapCardFormat): VNode {
  const d = DIMS[format];
  const color = safeHex(input.monogramColor, MULBERRY);
  return el(
    'div',
    {
      width: `${d.w}px`,
      height: `${d.h}px`,
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
          padding: d.framePad,
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
              monogramBadge(input.monogramInitials, color, d.monogram, d.monogramText),
              el(
                'div',
                {
                  fontFamily: 'Cardo',
                  fontWeight: 600,
                  fontSize: `${d.couple}px`,
                  lineHeight: '1',
                  color: INK,
                  textAlign: 'center',
                },
                clamp(input.coupleNames, 40),
              ),
              el(
                'div',
                { fontFamily: 'Poppins', fontWeight: 400, fontSize: `${d.sub}px`, color: INK_SOFT, textAlign: 'center' },
                'The day, in their words.',
              ),
              el(
                'div',
                { fontFamily: 'Poppins', fontWeight: 500, fontSize: `${d.stat}px`, letterSpacing: '2px', color: INK_FAINT },
                input.statLine.toUpperCase(),
              ),
            ],
          ),
          el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }, [
            el('div', { width: '56px', height: '1px', backgroundColor: GOLD }),
            el(
              'div',
              {
                fontFamily: 'Poppins',
                fontWeight: 500,
                fontSize: `${d.wordmark}px`,
                letterSpacing: '12px',
                paddingLeft: '12px',
                color: INK,
              },
              'SETNAYAN',
            ),
            // The branded card is Setnayan brand chrome top-to-bottom — the
            // SETNAYAN wordmark above already IS the maker lockup, so the
            // story/square "made with Setnayan" mark (sign-off #4) rides the
            // PHOTO-overlay variant instead (see photoOverlayTree), where the
            // couple's own hero fills the frame and the attribution matters.
          ]),
        ],
      ),
    ],
  );
}

function photoOverlayTree(input: RecapCardInput, format: RecapCardFormat): VNode {
  const d = DIMS[format];
  const watermark = format !== 'og';
  return el(
    'div',
    {
      width: `${d.w}px`,
      height: `${d.h}px`,
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
          padding: d.overlayPad,
          backgroundImage:
            'linear-gradient(to top, rgba(16,18,22,0.88) 0%, rgba(16,18,22,0.55) 42%, rgba(16,18,22,0) 100%)',
        },
        [
          el(
            'div',
            { fontFamily: 'Poppins', fontWeight: 500, fontSize: `${d.overlayEyebrow}px`, letterSpacing: '4px', color: '#E8D9B5' },
            'THE RECAP · A SETNAYAN LIVING MEMORY',
          ),
          el(
            'div',
            { fontFamily: 'Cardo', fontWeight: 600, fontSize: `${d.overlayCouple}px`, lineHeight: '1', color: '#FFFFFF' },
            clamp(input.coupleNames, 42),
          ),
          el(
            'div',
            { fontFamily: 'Poppins', fontWeight: 400, fontSize: `${d.overlayMeta}px`, color: 'rgba(255,255,255,0.9)' },
            clamp([input.dateLabel, input.statLine].filter(Boolean).join('  ·  '), 96),
          ),
          // "made with Setnayan" maker mark on the shareable story/square cards.
          watermark ? el('div', { display: 'flex', marginTop: '10px' }, madeWithMark()) : null,
        ],
      ),
    ],
  );
}

/**
 * Render the recap share card → JPEG at the requested `format` (default `og`,
 * the original 1200×630). Never throws on a font/layout/hero edge; the route
 * falls back to a static brand image so a crawler/share never gets a broken
 * response.
 */
export async function renderRecapOgJpeg(
  input: RecapCardInput,
  format: RecapCardFormat = 'og',
): Promise<Buffer> {
  const d = DIMS[format];
  if (input.heroPhotoUrl) {
    try {
      const res = await fetch(input.heroPhotoUrl);
      if (res.ok) {
        const photo = Buffer.from(await res.arrayBuffer());
        const base = await sharp(photo)
          .resize(d.w, d.h, { fit: 'cover', position: 'attention' })
          .toBuffer();
        const overlaySvg = await satori(photoOverlayTree(input, format) as unknown as React.ReactNode, {
          width: d.w,
          height: d.h,
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
  const svg = await satori(cardTree(input, format) as unknown as React.ReactNode, {
    width: d.w,
    height: d.h,
    fonts: SATORI_FONTS,
  });
  return sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toBuffer();
}

import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

import { CREATOR_BADGE_LABEL } from '@/app/_components/creator-badge';

/**
 * apps/web/lib/social/chapter-card.tsx — the Open Graph share card for a public
 * Adventure Chapter at /u/[userSlug]/c/[publicId] (share-asset completion
 * 2026-07-17, the chapter follow-up the social-share council verdict deferred).
 *
 * WHY: the chapter page previously borrowed the OWNER's profile card
 * (/api/og/u/[slug]) as its og:image, so every chapter of a storyteller
 * unfurled identically. This card previews the CHAPTER — its title + the
 * storyteller's byline over the chapter's YouTube-derived thumbnail (the same
 * derivation rule the Storytellers shelf uses; Setnayan never hosts the edit,
 * and the ytimg thumb is the one visual we can legitimately frame) — plus the
 * Storyteller badge mark, so a shared chapter reads as a storyteller artifact.
 *
 * The caller (app/api/og/chapter/[publicId]/route.ts) renders this ONLY for a
 * published chapter on a public profile; anything else 302s to the static brand
 * card, so a title/name is never leaked for a page that isn't public.
 *
 * Same satori + sharp pipeline + bundled static fonts as
 * lib/social/profile-card.tsx (deterministic on Vercel serverless, no webfont
 * fetch, no new native dep). Self-contained (its own font + el() copies) so
 * this render path evolves independently of its siblings.
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

export type ChapterCardInput = {
  /** The chapter's title, e.g. "Three Days in Batanes". */
  title: string;
  /** The storyteller's public display name — the byline. */
  storytellerName: string;
  /** The chapter-kind label, e.g. "Travel" (CHAPTER_KIND_LABEL). */
  kindLabel: string;
  /** YouTube-derived thumbnail (i.ytimg.com hqdefault) → photo variant when
   *  reachable. Null (IG/TikTok embeds) → the branded card. */
  thumbUrl?: string | null;
};

// A satori-compatible element node (object form — no JSX runtime needed, so
// tsconfig `jsx: preserve` stays happy).
type VNode = {
  type: string;
  props: Record<string, unknown> & { style?: Record<string, unknown>; children?: unknown };
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

/**
 * The Storyteller badge mark — the OG-card render of <CreatorBadge>: a compact
 * gold pill, four-point sparkle + the mono uppercase CREATOR_BADGE_LABEL (a
 * single owner-flippable constant, imported so the card follows any rename).
 * `onDark` tunes the pill for the photo scrim vs the cream branded card.
 */
function storytellerBadge(onDark: boolean): VNode {
  const gold = onDark ? '#D9BC80' : GOLD_DEEP;
  const sparkle: VNode = {
    type: 'svg',
    props: {
      width: 16,
      height: 16,
      viewBox: '0 0 24 24',
      style: { display: 'flex' },
      children: {
        type: 'path',
        props: {
          d: 'M12 1.6c.5 4.4 2.5 6.4 6.9 6.9 .4.05.4.55 0 .6-4.4.5-6.4 2.5-6.9 6.9-.05.4-.55.4-.6 0-.5-4.4-2.5-6.4-6.9-6.9-.4-.05-.4-.55 0-.6 4.4-.5 6.4-2.5 6.9-6.9.05-.4.55-.4.6 0Z',
          fill: gold,
        },
      },
    },
  };
  return el(
    'div',
    {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 18px',
      borderRadius: '999px',
      border: `1px solid ${onDark ? 'rgba(217,188,128,0.55)' : 'rgba(168,131,64,0.45)'}`,
      backgroundColor: onDark ? 'rgba(30,34,41,0.35)' : 'rgba(197,160,89,0.12)',
    },
    [
      sparkle,
      el(
        'div',
        {
          fontFamily: 'Poppins',
          fontWeight: 500,
          fontSize: '16px',
          letterSpacing: '3px',
          color: gold,
        },
        CREATOR_BADGE_LABEL.toUpperCase(),
      ),
    ],
  );
}

// Branded (thumbless) card — mirrors the chapter page's paper surface.
function brandedTree(input: ChapterCardInput): VNode {
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
          padding: '44px 60px',
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
                `A ${input.kindLabel.toUpperCase()} CHAPTER`,
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
              gap: '20px',
            },
            [
              el(
                'div',
                {
                  fontFamily: 'Cardo',
                  fontWeight: 600,
                  fontSize: '76px',
                  lineHeight: '1.05',
                  color: INK,
                  textAlign: 'center',
                  maxWidth: '1000px',
                },
                clamp(input.title, 64),
              ),
              el(
                'div',
                {
                  fontFamily: 'Poppins',
                  fontWeight: 400,
                  fontSize: '25px',
                  color: INK_FAINT,
                },
                clamp(`by ${input.storytellerName}`, 60),
              ),
              storytellerBadge(false),
            ],
          ),
          wordmark(),
        ],
      ),
    ],
  );
}

// Photo variant — a TRANSPARENT satori layer (bottom scrim + white type)
// composited over the chapter's YouTube-derived thumbnail.
function photoOverlayTree(input: ChapterCardInput): VNode {
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
          alignItems: 'flex-start',
          gap: '12px',
          width: '100%',
          padding: '140px 64px 48px',
          // Bottom scrim keeps white type legible over any thumb; fades to fully
          // transparent at the top so the frame reads clean above it.
          backgroundImage:
            'linear-gradient(to top, rgba(16,18,22,0.88) 0%, rgba(16,18,22,0.55) 42%, rgba(16,18,22,0) 100%)',
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
            `A ${input.kindLabel.toUpperCase()} CHAPTER · SETNAYAN`,
          ),
          el(
            'div',
            {
              fontFamily: 'Cardo',
              fontWeight: 600,
              fontSize: '68px',
              lineHeight: '1.05',
              color: '#FFFFFF',
            },
            clamp(input.title, 66),
          ),
          el(
            'div',
            {
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              marginTop: '4px',
            },
            [
              el(
                'div',
                {
                  fontFamily: 'Poppins',
                  fontWeight: 400,
                  fontSize: '23px',
                  color: 'rgba(255,255,255,0.88)',
                },
                clamp(`by ${input.storytellerName}`, 56),
              ),
              storytellerBadge(true),
            ],
          ),
        ],
      ),
    ],
  );
}

/**
 * Render the chapter OG card → JPEG buffer (1200×630). Never throws on a
 * font/layout/thumb edge — the caller (the /api/og route) falls back to the
 * static brand image so the Graph crawler never gets a broken response.
 *
 * With a reachable `thumbUrl`, renders the PHOTO variant (the YouTube thumb,
 * smart-cropped to 1.91:1, white-type scrim overlaid); a fetch/decode failure
 * degrades to the branded card rather than failing the share.
 */
export async function renderChapterOgJpeg(input: ChapterCardInput): Promise<Buffer> {
  if (input.thumbUrl) {
    try {
      const res = await fetch(input.thumbUrl);
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
      // Thumb unreachable / undecodable → fall through to the branded card.
    }
  }
  const svg = await satori(brandedTree(input) as unknown as React.ReactNode, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: SATORI_FONTS,
  });
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

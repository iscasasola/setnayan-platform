import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

/**
 * apps/web/lib/social/manifesto-card.tsx — the shareable "Living Memories"
 * manifesto card for the /our-story brand page (and any feed/story post).
 *
 * WHY (owner 2026-06-14, "I want to share this idea with the world … embrace
 * this new concept of memories"): the manifesto needs a postable, on-brand
 * image — both as the `og:image` a link-share renders AND as a standalone
 * card to drop into a feed or story. This renders the dark, cinematic brand
 * card (cream + champagne gold on #0e0f12 — matching the homepage hero / the
 * manifesto film look) in three sizes:
 *   - `og`     1200×630  (Facebook / link unfurl, 1.91:1)
 *   - `square` 1080×1080 (Instagram / Facebook feed post)
 *   - `story`  1080×1920 (Reels / TikTok / Stories, 9:16)
 *
 * Same satori + sharp pipeline + bundled static fonts as lib/social/
 * realstory-card.tsx — deterministic on Vercel serverless, no webfont fetch,
 * no new native dep ([[project_setnayan_oss_self_host_preference]]). Self-
 * contained (its own font + el() copies) so the two render paths evolve
 * independently and a concurrent edit to one never breaks the other.
 */

// ── Brand palette (dark variant — cream + champagne gold on night) ───────────
const NIGHT = '#0e0f12'; // homepage hero / dark-bridge canvas
const CREAM = '#FBFBFA'; // --m-paper
const CREAM_SOFT = 'rgba(251,251,250,0.66)';
const CREAM_FAINT = 'rgba(251,251,250,0.42)';
const GOLD = '#C5A059'; // --m-orange
const GOLD_LIGHT = '#E0CCA0'; // --m-orange-3

// ── Font buffers (static weights only — satori's opentype parser rejects
// variable fonts; readFileSync caches for the serverless instance lifetime). ──
const FONT_DIR = path.join(process.cwd(), 'lib', 'social', 'fonts');
const loadFont = (file: string): Buffer => readFileSync(path.join(FONT_DIR, file));

const SATORI_FONTS = [
  { name: 'Cardo', data: loadFont('Cardo-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'Cardo', data: loadFont('Cardo-Bold.ttf'), weight: 600 as const, style: 'normal' as const },
  { name: 'Poppins', data: loadFont('Poppins-Regular.ttf'), weight: 400 as const, style: 'normal' as const },
  { name: 'Poppins', data: loadFont('Poppins-Medium.ttf'), weight: 500 as const, style: 'normal' as const },
];

export type ManifestoFormat = 'og' | 'square' | 'story';

const DIMS: Record<
  ManifestoFormat,
  { w: number; h: number; headline: number; sub: number; framePad: string }
> = {
  og: { w: 1200, h: 630, headline: 92, sub: 26, framePad: '46px 64px' },
  square: { w: 1080, h: 1080, headline: 104, sub: 30, framePad: '72px 64px' },
  story: { w: 1080, h: 1920, headline: 112, sub: 33, framePad: '120px 64px' },
};

// satori-compatible element node (object form — no JSX/React runtime needed,
// matching lib/social/realstory-card.tsx so tsconfig `jsx: preserve` stays happy).
type VNode = { type: string; props: { style?: Record<string, unknown>; children?: unknown } };
const el = (type: string, style: Record<string, unknown>, children?: unknown): VNode => ({
  type,
  props: { style, children },
});

/** PAPER → DIGITAL → LIVING — the evolution, with the present lit gold. */
function evolutionRow(): VNode {
  const item = (label: string, gold: boolean): VNode =>
    el(
      'div',
      {
        fontFamily: 'Poppins',
        fontWeight: 500,
        fontSize: '18px',
        letterSpacing: '4px',
        color: gold ? GOLD_LIGHT : CREAM_FAINT,
      },
      label,
    );
  const arrow = (): VNode =>
    el('div', { fontFamily: 'Poppins', fontWeight: 400, fontSize: '16px', color: 'rgba(251,251,250,0.3)' }, '→');
  return el('div', { display: 'flex', alignItems: 'center', gap: '14px' }, [
    item('PAPER', false),
    arrow(),
    item('DIGITAL', false),
    arrow(),
    item('LIVING', true),
  ]);
}

/** SETNAYAN wordmark + "Set na ’yan." anchoring the bottom. */
function wordmark(): VNode {
  return el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }, [
    el('div', { width: '56px', height: '1px', backgroundColor: GOLD }),
    el(
      'div',
      { fontFamily: 'Poppins', fontWeight: 500, fontSize: '22px', letterSpacing: '12px', paddingLeft: '12px', color: CREAM },
      'SETNAYAN',
    ),
    el('div', { fontFamily: 'Cardo', fontWeight: 400, fontSize: '21px', color: GOLD_LIGHT }, 'Set na ’yan.'),
  ]);
}

function cardTree(format: ManifestoFormat): VNode {
  const d = DIMS[format];
  return el(
    'div',
    {
      width: `${d.w}px`,
      height: `${d.h}px`,
      display: 'flex',
      padding: '36px',
      backgroundColor: NIGHT,
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
          border: '1px solid rgba(197,160,89,0.5)',
          borderRadius: '14px',
          padding: d.framePad,
        },
        [
          // Eyebrow.
          el('div', { display: 'flex', alignItems: 'center', gap: '14px' }, [
            el('div', { width: '26px', height: '1px', backgroundColor: GOLD }),
            el(
              'div',
              { fontFamily: 'Poppins', fontWeight: 500, fontSize: '17px', letterSpacing: '5px', color: GOLD },
              'A NEW WAY TO REMEMBER',
            ),
            el('div', { width: '26px', height: '1px', backgroundColor: GOLD }),
          ]),
          // Center — headline + subline + evolution.
          el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '26px' }, [
            el(
              'div',
              {
                fontFamily: 'Cardo',
                fontWeight: 600,
                fontSize: `${d.headline}px`,
                lineHeight: '1.04',
                color: CREAM,
                textAlign: 'center',
              },
              'Memories that move.',
            ),
            el(
              'div',
              {
                fontFamily: 'Poppins',
                fontWeight: 400,
                fontSize: `${d.sub}px`,
                lineHeight: '1.4',
                color: CREAM_SOFT,
                textAlign: 'center',
                maxWidth: '720px',
              },
              'Paper albums. Digital albums. Now — living ones.',
            ),
            evolutionRow(),
          ]),
          // Footer wordmark.
          wordmark(),
        ],
      ),
    ],
  );
}

/**
 * Render the manifesto card → JPEG buffer at the requested format. Never throws
 * on a font/layout edge — the caller (the /api/og route) falls back to a static
 * brand image so a crawler never gets a broken response.
 */
export async function renderManifestoCard(format: ManifestoFormat): Promise<Buffer> {
  const d = DIMS[format];
  const svg = await satori(cardTree(format) as unknown as React.ReactNode, {
    width: d.w,
    height: d.h,
    fonts: SATORI_FONTS,
  });
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

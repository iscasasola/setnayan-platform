import 'server-only';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

import { splitInitials, resolveMonogramDesign, type MonoStyle } from '@/lib/monogram';

/**
 * apps/web/lib/social/card.tsx — branded 1080×1080 social-card renderer
 * (Phase B of the social auto-publish pipeline — corpus
 * `03_Strategy/Social_Sharing_Program_2026-06-12.md` § 8).
 *
 * WHY satori + sharp (OSS-self-host preference · [[project_setnayan_oss_self_host_preference]]):
 *   • satori (MIT) turns a plain element tree into an SVG using EXPLICIT font
 *     buffers we pass in — there is no system fontconfig, no librsvg, no
 *     webfont fetch at render time. That determinism is the whole point on
 *     Vercel serverless, where librsvg's fontconfig path is flaky and
 *     next/font / webfonts simply aren't reachable inside a route handler.
 *     (Fonts MUST be static TTFs — satori's bundled opentype.js parser rejects
 *     variable fonts, so we bundle static Cardo + Poppins + Great Vibes.)
 *   • sharp (already a dep · ^0.34.5) rasterizes the SVG → JPEG. It's the
 *     same native pipeline the rest of the app already trusts (face-blur,
 *     watermark, favicon), so no new heavy native dep enters the tree.
 *
 * Cards render ON-THE-FLY from the public route GET /api/social/card/[postId]
 * — zero R2 storage, a live admin-queue preview, and a fetchable URL both the
 * Facebook /photos and Instagram /media Graph endpoints pull at publish time.
 *
 * We use satori's OBJECT element form ({ type, props }) rather than JSX — the
 * app's tsconfig is `jsx: preserve` (Next handles JSX), and satori wants
 * React-element-SHAPED objects but not real React, so the object form sidesteps
 * any pragma/transform friction while staying fully type-checked.
 *
 * SCOPE: static image cards in two formats — 1080×1080 SQUARE (Facebook /
 * Instagram feed) and 1080×1920 STORY (the 9:16 card TikTok Photo Mode posts
 * and the assisted-manual download surface uses · Phase C). Both share the same
 * centered-column layouts; only the canvas height changes. Real VIDEO / Reels
 * rendering (an actual MP4) stays OUT OF SCOPE — that needs a video render
 * pipeline that isn't wired (// PHASE D in lib/social/tiktok.ts).
 */

// ── Brand palette (literal hexes — mirror apps/web/app/globals.css) ──────────
const CREAM = '#FBFBFA'; // card background
const INK = '#1E2229'; // primary text
const GOLD = '#C5A059'; // champagne-gold accent / frame
const GOLD_DEEP = '#A88340';
const MULBERRY = '#5C2542'; // CTA / deep accent
const TERRACOTTA = '#C97B4B'; // monogram default ink
const INK_SOFT = '#5B6068'; // muted body
const INK_FAINT = '#9AA0A6'; // eyebrows / captions

// ── Font buffers (loaded once at module scope · explicit-buffer model) ───────
// satori needs the raw bytes; readFileSync at module load caches them for the
// life of the serverless instance. All five are TRUE STATIC TTFs — satori's
// bundled opentype.js parser rejects variable fonts (it chokes on the `fvar`
// table), so a static weight is mandatory for deterministic rendering. We use
// Cardo (a classical Garamond-cousin serif) for display, Poppins for body
// sans, and Great Vibes for the script flourish. NOTE: this satori version does
// NOT synthesize an oblique for `fontStyle: italic` on a family registered only
// at style:normal — it renders the upright face. So the lockup serif glyphs
// (bar/duo/infinity) read UPRIGHT on the card, a slight slant-drift vs the
// chrome's true-italic CSS face. Acceptable; bundling an italic TTF + registering
// it at style:italic would close the gap (deferred).
const FONT_DIR = path.join(process.cwd(), 'lib', 'social', 'fonts');

function loadFont(file: string): Buffer {
  return readFileSync(path.join(FONT_DIR, file));
}

const FONT_SERIF = loadFont('Cardo-Regular.ttf');
const FONT_SERIF_BOLD = loadFont('Cardo-Bold.ttf');
const FONT_SANS = loadFont('Poppins-Regular.ttf');
const FONT_SANS_MEDIUM = loadFont('Poppins-Medium.ttf');
const FONT_SANS_BOLD = loadFont('Poppins-Bold.ttf');
const FONT_SCRIPT = loadFont('GreatVibes-Regular.ttf');
// Cormorant (a real static OFL TTF copied from assets/cipher-fonts) — the EXACT
// face the `bar` + `infinity` lockups use on the dashboard chrome + landing hero
// (resolveMonogramDesign maps `cormorant`). The plain initials path keeps Cardo
// (the card's display serif); only the type-only lockups reference Cormorant, so
// the on-card mark matches what the couple designed in onboarding. satori needs
// a static face — this one has `glyf`, no `fvar`, so it parses cleanly.
const FONT_CORMORANT = loadFont('Cormorant-Regular.ttf');

// satori font registry — `name` is the family string we reference in styles.
const SATORI_FONTS = [
  { name: 'Cardo', data: FONT_SERIF, weight: 400 as const, style: 'normal' as const },
  { name: 'Cardo', data: FONT_SERIF_BOLD, weight: 600 as const, style: 'normal' as const },
  { name: 'Poppins', data: FONT_SANS, weight: 400 as const, style: 'normal' as const },
  { name: 'Poppins', data: FONT_SANS_MEDIUM, weight: 500 as const, style: 'normal' as const },
  { name: 'Poppins', data: FONT_SANS_BOLD, weight: 700 as const, style: 'normal' as const },
  { name: 'GreatVibes', data: FONT_SCRIPT, weight: 400 as const, style: 'normal' as const },
  { name: 'Cormorant', data: FONT_CORMORANT, weight: 600 as const, style: 'normal' as const },
];

/** The card canvas is always 1080 wide; only the height changes per format. */
const CARD_WIDTH = 1080;
const SQUARE_HEIGHT = 1080;
const STORY_HEIGHT = 1920;

/** Backwards-compatible alias — the square edge length used wherever the old
 *  fixed 1080×1080 geometry referenced CARD_SIZE (composite math, fallback). */
const CARD_SIZE = SQUARE_HEIGHT;

/** Output format: square = 1080×1080 (FB/IG feed), story = 1080×1920 (9:16). */
export type CardFormat = 'square' | 'story';

function cardHeight(format: CardFormat): number {
  return format === 'story' ? STORY_HEIGHT : SQUARE_HEIGHT;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-source-type card inputs.
// ─────────────────────────────────────────────────────────────────────────────

export type CardContext =
  | {
      sourceType: 'couple_creation';
      /** Couple display name, or null → a neutral line. */
      coupleName: string | null;
      /** Artifact label, e.g. "Monogram" / "Save the Date". */
      artifactLabel: string;
      /** resolveMonogram().text — used when there's no custom SVG. */
      monogramText: string;
      /** Monogram ink color. */
      monogramColor: string;
      /** Raw sanitized custom monogram SVG (events.monogram_custom_svg). When
       *  present it's composited over the satori card via a second sharp pass. */
      monogramCustomSvg: string | null;
      /** events.monogram_style — when it's a TYPE-ONLY lockup (bar/duo/script/
       *  infinity) AND there are two initials AND no monogramCustomSvg, the card
       *  draws the couple's REAL lockup (matching the chrome + hero + QR) instead
       *  of plain initials in a ring. null/legacy/`framed`/single-initial keep the
       *  existing initials-in-a-ring rendering. */
      monogramStyle: string | null;
      /** events.monogram_font_key — the couple's chosen typeface key, fed through
       *  resolveMonogramDesign so the lockup draws in their exact face. */
      monogramFontKey: string | null;
    }
  | {
      sourceType: 'vendor_feature';
      /** Named (Pro+) → business_name shown; else the unnamed category line. */
      named: boolean;
      businessName: string;
      categoryLabel: string;
      region: string;
    }
  | {
      sourceType: 'milestone';
      /** The celebrated number (parsed from title/body/source_ref). */
      number: string;
      /** Short metric phrase, e.g. "celebrations planned on Setnayan". */
      metricPhrase: string;
    }
  | {
      sourceType: 'announcement';
      title: string;
      body: string;
    }
  | {
      sourceType: 'evergreen';
      title: string;
      body: string;
    };

/** A satori-compatible element node (object form — no JSX/React needed). */
type VNode = {
  type: string;
  props: {
    style?: Record<string, unknown>;
    children?: VNode | VNode[] | string | number | null | (VNode | string | null)[];
    [key: string]: unknown;
  };
};

// ── Small helpers ────────────────────────────────────────────────────────────

/** Truncate to `max` chars on a word boundary where possible, then ellipsize. */
function clamp(text: string, max: number): string {
  const t = (text ?? '').trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

/** Strip hashtag/footer lines and collapse whitespace for an on-card excerpt. */
function bodyExcerpt(body: string, max: number): string {
  const cleaned = (body ?? '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clamp(cleaned, max);
}

function el(
  type: string,
  style: Record<string, unknown>,
  children?: VNode['props']['children'],
): VNode {
  return { type, props: { style, children } };
}

/** The "SETNAYAN" wordmark that anchors the bottom of every card. */
function wordmark(): VNode {
  return el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
    },
    [
      el('div', {
        width: '64px',
        height: '1px',
        backgroundColor: GOLD,
      }),
      el(
        'div',
        {
          fontFamily: 'Poppins',
          fontWeight: 500,
          fontSize: '26px',
          letterSpacing: '14px',
          // optical centering for the wide letter-spacing (right pad removed)
          paddingLeft: '14px',
          color: INK,
        },
        'SETNAYAN',
      ),
      el(
        'div',
        {
          fontFamily: 'Cardo',
          fontSize: '22px',
          fontStyle: 'italic',
          letterSpacing: '1px',
          color: INK_FAINT,
        },
        "Set na 'yan.",
      ),
    ],
  );
}

/** An eyebrow kicker — small uppercase gold label. */
function eyebrow(text: string, color = GOLD_DEEP): VNode {
  return el(
    'div',
    {
      fontFamily: 'Poppins',
      fontWeight: 500,
      fontSize: '22px',
      letterSpacing: '7px',
      textTransform: 'uppercase',
      color,
    },
    text,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Monogram LOCKUP (satori element tree).
//
// When the couple chose a TYPE-ONLY lockup (bar/duo/script/infinity) with two
// initials and NO custom SVG, the card draws their REAL mark — matching the
// dashboard chrome (app/_components/monogram-mark.tsx), the landing hero, and
// the QR center (lib/monogram.ts `lockupMarkSvg`). We CANNOT rasterize the
// shared SVG-with-text twin here: sharp's SVG text rasterizer would substitute
// the wrong system font. Instead we rebuild the same geometry as native satori
// elements (absolutely-positioned text spans in the BUNDLED faces + an inline
// <svg> path for the gold ∞), so satori shapes the glyphs with our own TTF
// buffers and the on-card mark reads in the couple's exact typeface.
//
// Geometry mirrors monogram-mark.tsx / lockupMarkSvg viewBox units, scaled to a
// fixed pixel box. Text-anchor=middle in SVG → here each glyph is a fixed-width
// flex box centered on the target x, with its baseline aligned via the box
// bottom (satori has no SVG-text baseline, so we approximate: a span whose box
// bottom sits ~fontSize*0.22 below the SVG baseline reads identically once the
// ascender/descender settle).
// ─────────────────────────────────────────────────────────────────────────────

/** Mulberry ink shared by all four type-only lockups (mirror lib/monogram.ts). */
const LOCKUP_INK = '#5C2542';

/** A single positioned glyph inside the lockup box. `cx`/`baseY` are in the
 *  SCALED pixel space of the lockup box; `fs` is the scaled font size. */
function lockupGlyph(opts: {
  char: string;
  cx: number;
  baseY: number;
  fs: number;
  fontFamily: string;
  fontStyle: 'italic' | 'normal';
  color: string;
}): VNode {
  const { char, cx, baseY, fs, fontFamily, fontStyle, color } = opts;
  // Fixed-width centering box so text-anchor=middle is honored without
  // measuring glyph metrics. Width = ~1.4× fs comfortably holds one cap; the
  // box is centered on cx. Top is derived from the baseline: a line box of
  // height ~fs*1.0 sits with its text baseline near the box bottom, so we place
  // the box so its bottom is a hair below baseY.
  const boxW = fs * 1.6;
  const top = baseY - fs * 1.06;
  return el(
    'div',
    {
      position: 'absolute',
      left: `${cx - boxW / 2}px`,
      top: `${top}px`,
      width: `${boxW}px`,
      height: `${fs * 1.2}px`,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      fontFamily,
      fontStyle,
      fontWeight: 600,
      fontSize: `${fs}px`,
      lineHeight: 1,
      color,
    },
    char,
  );
}

/**
 * Build the lockup as a satori element tree, or return null when this ctx is
 * NOT a type-only two-initial lockup (legacy / framed / single-initial / custom
 * SVG present → caller keeps the existing initials-in-a-ring rendering).
 *
 * `boxPx` is the rendered edge of the square the lockup centers within (the
 * 360px ring interior). The lockup's wide viewBox is scaled to fit `boxPx` wide
 * and centered vertically — exactly how monogram-mark.tsx letterboxes within a
 * square chip.
 */
function lockupTree(
  ctx: Extract<CardContext, { sourceType: 'couple_creation' }>,
  boxPx: number,
): VNode | null {
  if (ctx.monogramCustomSvg) return null; // bespoke / cipher mark wins.

  const styleKey = ctx.monogramStyle;
  const isTypeOnly =
    styleKey === 'bar' ||
    styleKey === 'duo' ||
    styleKey === 'script' ||
    styleKey === 'infinity';
  if (!isTypeOnly) return null;

  const [a, b] = splitInitials(ctx.monogramText);
  if (!a || !b) return null; // single initial → not a lockup.

  const style = styleKey as Exclude<MonoStyle, 'framed'>;

  // Resolve the couple's chosen face. We only consume fontStyle (the bundled
  // satori faces don't vary by family the way the chrome's CSS vars do — bar /
  // duo / infinity are serif, script is calligraphic), so map family ourselves
  // to the bundled TTFs while honoring the resolved italic/normal slant.
  const design = resolveMonogramDesign({
    monogram_style: ctx.monogramStyle,
    monogram_font_key: ctx.monogramFontKey,
    monogram_frame_key: null,
  });
  const fontStyle: 'italic' | 'normal' = design?.fontStyle ?? (style === 'script' ? 'normal' : 'italic');
  // bar + infinity = Cormorant (their exact chrome face); duo = Cardo (Playfair
  // Display isn't a bundled satori face — Cardo is the card's display serif and
  // the closest available serif-italic); script = Great Vibes.
  const serifFamily = style === 'duo' ? 'Cardo' : 'Cormorant';
  const ink = LOCKUP_INK;

  // Per-style viewBox (minX minY w h) — verbatim from lockupMarkSvg geometry.
  type Geo = { vb: [number, number, number, number] };
  const GEO: Record<typeof style, Geo> = {
    bar: { vb: [6, 14, 120, 70] },
    // duo's canonical tight viewBox is near-square (66w) → k≈4.5 → the glyphs
    // balloon and SPILL the ring, because (unlike the chrome's SVG viewport)
    // satori div-positioned glyphs have nothing to clip them. Pad the viewBox
    // horizontally around the content (caps centred ~x50) so k drops to ~2.1 and
    // the un-clipped glyphs sit inside the ring. Padding only ever SHRINKS the
    // mark — it cannot overflow. duo therefore reads a touch smaller than the
    // other styles on the card; exact parity needs Vercel-side visual tuning.
    duo: { vb: [-20, 18, 140, 62] },
    script: { vb: [8, 6, 168, 90] },
    infinity: { vb: [18, 8, 164, 76] },
  };
  const [minX, minY, vbW, vbH] = GEO[style].vb;
  // Scale so the wider dimension fits boxPx; center within a boxPx × boxPx square.
  const k = boxPx / Math.max(vbW, vbH);
  const renderW = vbW * k;
  const renderH = vbH * k;
  const offX = (boxPx - renderW) / 2;
  const offY = (boxPx - renderH) / 2;
  // Map a viewBox coordinate → pixel within the boxPx square.
  const px = (x: number) => offX + (x - minX) * k;
  const py = (y: number) => offY + (y - minY) * k;

  const children: VNode[] = [];

  if (style === 'bar') {
    children.push(
      lockupGlyph({ char: a, cx: px(28), baseY: py(72), fs: 64 * k, fontFamily: serifFamily, fontStyle, color: ink }),
      // Divider — two segments around the "&".
      el('div', {
        position: 'absolute',
        left: `${px(66) - (2.5 * k) / 2}px`,
        top: `${py(16)}px`,
        width: `${2.5 * k}px`,
        height: `${(42 - 16) * k}px`,
        borderRadius: `${1.25 * k}px`,
        backgroundColor: ink,
      }),
      el('div', {
        position: 'absolute',
        left: `${px(66) - (2.5 * k) / 2}px`,
        top: `${py(66)}px`,
        width: `${2.5 * k}px`,
        height: `${(82 - 66) * k}px`,
        borderRadius: `${1.25 * k}px`,
        backgroundColor: ink,
      }),
      lockupGlyph({ char: '&', cx: px(66), baseY: py(60), fs: 22 * k, fontFamily: serifFamily, fontStyle, color: ink }),
      lockupGlyph({ char: b, cx: px(104), baseY: py(72), fs: 64 * k, fontFamily: serifFamily, fontStyle, color: ink }),
    );
  } else if (style === 'duo') {
    children.push(
      lockupGlyph({ char: a, cx: px(42), baseY: py(72), fs: 66 * k, fontFamily: serifFamily, fontStyle, color: ink }),
      lockupGlyph({ char: b, cx: px(58), baseY: py(72), fs: 66 * k, fontFamily: serifFamily, fontStyle, color: ink }),
    );
  } else if (style === 'script') {
    children.push(
      lockupGlyph({ char: a, cx: px(42), baseY: py(78), fs: 74 * k, fontFamily: 'GreatVibes', fontStyle: 'normal', color: ink }),
      lockupGlyph({ char: '&', cx: px(92), baseY: py(76), fs: 46 * k, fontFamily: 'GreatVibes', fontStyle: 'normal', color: ink }),
      lockupGlyph({ char: b, cx: px(142), baseY: py(78), fs: 74 * k, fontFamily: 'GreatVibes', fontStyle: 'normal', color: ink }),
    );
  } else {
    // infinity — inline <svg> for the gold ∞ path (its width-6 stroke scales
    // with the viewBox → k), then two cap spans over the loops.
    children.push(
      {
        type: 'svg',
        props: {
          width: `${renderW}px`,
          height: `${renderH}px`,
          viewBox: `${minX} ${minY} ${vbW} ${vbH}`,
          style: { position: 'absolute', left: `${offX}px`, top: `${offY}px` },
          children: [
            {
              type: 'defs',
              props: {
                children: {
                  type: 'linearGradient',
                  props: {
                    id: 'sn-card-gold',
                    x1: '0',
                    y1: '0',
                    x2: '1',
                    y2: '0',
                    children: [
                      { type: 'stop', props: { offset: '0', 'stop-color': GOLD_DEEP } },
                      { type: 'stop', props: { offset: '0.5', 'stop-color': '#E4C77E' } },
                      { type: 'stop', props: { offset: '1', 'stop-color': GOLD_DEEP } },
                    ],
                  },
                },
              },
            },
            {
              type: 'path',
              props: {
                d: 'M100 46 C76 14 26 14 26 46 C26 78 76 78 100 46 C124 14 174 14 174 46 C174 78 124 78 100 46 Z',
                fill: 'none',
                stroke: 'url(#sn-card-gold)',
                'stroke-width': 6,
                'stroke-linecap': 'round',
              },
            },
          ],
        },
      } as unknown as VNode,
      lockupGlyph({ char: a, cx: px(56), baseY: py(56), fs: 30 * k, fontFamily: 'Cormorant', fontStyle, color: ink }),
      lockupGlyph({ char: b, cx: px(140), baseY: py(56), fs: 30 * k, fontFamily: 'Cormorant', fontStyle, color: ink }),
    );
  }

  return el(
    'div',
    {
      position: 'relative',
      display: 'flex',
      width: `${boxPx}px`,
      height: `${boxPx}px`,
    },
    children,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-type card bodies (the middle block; frame + wordmark wrap them).
// ─────────────────────────────────────────────────────────────────────────────

function coupleCreationBody(ctx: Extract<CardContext, { sourceType: 'couple_creation' }>): VNode {
  const name = ctx.coupleName?.trim() || 'A Setnayan couple';
  // When the couple chose a type-only lockup (bar/duo/script/infinity) with two
  // initials and no custom SVG, draw their REAL mark inside the ring (matching
  // chrome + hero + QR). Otherwise: framed / legacy / single-initial → the
  // existing plain-initials ring; custom SVG → the composited slot.
  const lockup = lockupTree(ctx, 300);
  // When a custom SVG is present we leave an empty 420×420 slot here; the
  // sharp composite pass paints the rasterized mark into it (see render fn).
  const monogramSlot: VNode = ctx.monogramCustomSvg
    ? el('div', {
        display: 'flex',
        width: '420px',
        height: '420px',
      })
    : el(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '360px',
          height: '360px',
          borderRadius: '360px',
          border: `2px solid ${GOLD}`,
          backgroundColor: '#FAF7F2',
        },
        lockup ??
          el(
            'div',
            {
              fontFamily: 'Cardo',
              fontStyle: 'italic',
              fontSize: ctx.monogramText.length <= 1 ? '200px' : '140px',
              color: ctx.monogramColor || TERRACOTTA,
              letterSpacing: '2px',
            },
            ctx.monogramText,
          ),
      );

  return el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '40px',
    },
    [
      eyebrow('Featured on Setnayan'),
      monogramSlot,
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
        },
        [
          el(
            'div',
            {
              fontFamily: 'Cardo',
              fontSize: '76px',
              color: INK,
              textAlign: 'center',
              lineHeight: 1.1,
            },
            clamp(name, 42),
          ),
          el(
            'div',
            {
              fontFamily: 'Cardo',
              fontStyle: 'italic',
              fontSize: '34px',
              color: MULBERRY,
            },
            ctx.artifactLabel,
          ),
        ],
      ),
    ],
  );
}

function vendorFeatureBody(ctx: Extract<CardContext, { sourceType: 'vendor_feature' }>): VNode {
  const headline =
    ctx.named && ctx.businessName.trim().length > 0
      ? ctx.businessName.trim()
      : `A new ${ctx.categoryLabel.toLowerCase()}`;
  const subline =
    ctx.named && ctx.businessName.trim().length > 0
      ? `${ctx.categoryLabel} · ${ctx.region}`
      : `in ${ctx.region}`;

  return el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '44px',
    },
    [
      // "Newly Verified" badge.
      el(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '16px 36px',
          borderRadius: '999px',
          backgroundColor: '#EAF5EE',
          border: '1px solid #BFE3CC',
        },
        [
          el(
            'div',
            {
              fontFamily: 'Poppins',
              fontWeight: 700,
              fontSize: '30px',
              color: '#1F7A46',
            },
            '✅',
          ),
          el(
            'div',
            {
              fontFamily: 'Poppins',
              fontWeight: 600,
              fontSize: '28px',
              letterSpacing: '4px',
              textTransform: 'uppercase',
              color: '#1F7A46',
            },
            'Newly Verified',
          ),
        ],
      ),
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
              fontSize: '88px',
              color: INK,
              textAlign: 'center',
              lineHeight: 1.08,
            },
            clamp(headline, 38),
          ),
          el(
            'div',
            {
              fontFamily: 'Poppins',
              fontSize: '32px',
              color: INK_SOFT,
              textAlign: 'center',
            },
            clamp(subline, 46),
          ),
        ],
      ),
      el(
        'div',
        {
          fontFamily: 'Poppins',
          fontSize: '26px',
          color: INK_FAINT,
          textAlign: 'center',
        },
        'Vetted by the Setnayan team · ready for your big day',
      ),
    ],
  );
}

function milestoneBody(ctx: Extract<CardContext, { sourceType: 'milestone' }>): VNode {
  return el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '24px',
    },
    [
      eyebrow('A Setnayan milestone'),
      el(
        'div',
        {
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
        },
        [
          el(
            'div',
            {
              fontFamily: 'Cardo',
              fontWeight: 600,
              fontSize: '320px',
              lineHeight: 1,
              color: MULBERRY,
            },
            ctx.number,
          ),
          el(
            'div',
            {
              fontFamily: 'Cardo',
              fontSize: '120px',
              lineHeight: 1.2,
              color: GOLD,
              paddingTop: '20px',
            },
            '+',
          ),
        ],
      ),
      el(
        'div',
        {
          fontFamily: 'Cardo',
          fontStyle: 'italic',
          fontSize: '52px',
          color: INK,
          textAlign: 'center',
          maxWidth: '760px',
          lineHeight: 1.2,
        },
        clamp(ctx.metricPhrase, 80),
      ),
    ],
  );
}

function posterBody(title: string, body: string, kicker: string): VNode {
  return el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '36px',
      maxWidth: '820px',
    },
    [
      eyebrow(kicker),
      el(
        'div',
        {
          fontFamily: 'Cardo',
          fontSize: '92px',
          color: INK,
          textAlign: 'center',
          lineHeight: 1.06,
        },
        clamp(title || body, 70),
      ),
      // Divider.
      el('div', { width: '80px', height: '2px', backgroundColor: GOLD }),
      el(
        'div',
        {
          fontFamily: 'Poppins',
          fontSize: '34px',
          color: INK_SOFT,
          textAlign: 'center',
          lineHeight: 1.4,
        },
        bodyExcerpt(body, 180),
      ),
    ],
  );
}

function cardBody(ctx: CardContext): VNode {
  switch (ctx.sourceType) {
    case 'couple_creation':
      return coupleCreationBody(ctx);
    case 'vendor_feature':
      return vendorFeatureBody(ctx);
    case 'milestone':
      return milestoneBody(ctx);
    case 'announcement':
      return posterBody(ctx.title, ctx.body, 'From Setnayan');
    case 'evergreen':
      return posterBody(ctx.title, ctx.body, 'Setnayan Tips');
  }
}

/** The full card tree: cream canvas + thin gold frame + body + wordmark. The
 *  layout is identical across formats — only the canvas height changes; the
 *  flexGrow:1 body region absorbs the extra height (story centres the body
 *  lower), and the wordmark stays pinned to the bottom via space-between. */
function cardTree(ctx: CardContext, format: CardFormat): VNode {
  return el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width: `${CARD_WIDTH}px`,
      height: `${cardHeight(format)}px`,
      backgroundColor: CREAM,
      padding: '56px',
    },
    [
      // Inner frame.
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          border: `1.5px solid ${GOLD}`,
          borderRadius: '8px',
          padding: '72px 64px',
        },
        [
          // top spacer keeps the body optically centred above the wordmark
          el('div', { display: 'flex', height: '8px' }),
          el(
            'div',
            {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexGrow: 1,
              width: '100%',
            },
            cardBody(ctx),
          ),
          wordmark(),
        ],
      ),
    ],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public renderer.
// ─────────────────────────────────────────────────────────────────────────────

/** Width of the reserved monogram-composite slot (mirrors coupleCreationBody). */
const MONOGRAM_SLOT = 420;

/**
 * Render a branded JPEG for a social post — `format` picks the canvas:
 * 'square' = 1080×1080 (FB/IG feed · the default, byte-identical to before),
 * 'story' = 1080×1920 (the 9:16 card TikTok Photo Mode posts). satori builds
 * the SVG (explicit font buffers), sharp rasterizes it to JPEG. For
 * couple_creation cards that carry a custom monogram SVG, the path-based mark
 * is rasterized separately and composited over the satori card with a second
 * sharp pass — librsvg renders path-based monogram SVGs cleanly, and
 * compositing keeps the mark crisp without trying to inline arbitrary SVG into
 * satori.
 *
 * Guards every field with a sensible default; the calling route still wraps
 * this in try/catch and serves a plain fallback card if anything throws.
 */
export async function renderSocialCardJpeg(
  ctx: CardContext,
  format: CardFormat = 'square',
): Promise<Buffer> {
  const height = cardHeight(format);
  const svg = await satori(cardTree(ctx, format) as unknown as React.ReactNode, {
    width: CARD_WIDTH,
    height,
    fonts: SATORI_FONTS,
  });

  let pipeline = sharp(Buffer.from(svg));

  // Composite a custom monogram (path-based SVG) into the reserved slot.
  if (ctx.sourceType === 'couple_creation' && ctx.monogramCustomSvg) {
    try {
      const markPng = await sharp(Buffer.from(ctx.monogramCustomSvg))
        .resize(MONOGRAM_SLOT, MONOGRAM_SLOT, { fit: 'contain', background: '#FAF7F2' })
        .png()
        .toBuffer();
      // Slot geometry mirrors coupleCreationBody. Horizontally the slot is
      // always centred on the fixed 1080 width. Vertically, on the SQUARE card
      // it sits at 56 outer pad + 72 frame pad + 8 spacer + ~96 (eyebrow + gap)
      // above the 420 slot. The body column is justify-centered inside the
      // flexGrow:1 region, so a TALLER canvas pushes that whole centred block
      // DOWN by exactly half the added height — derive the story top from the
      // square top + (height − square)/2 rather than hardcoding a 2nd magic px.
      const left = Math.round((CARD_WIDTH - MONOGRAM_SLOT) / 2);
      const squareTop = 56 + 72 + 8 + 96; // outer pad + frame pad + spacer + eyebrow block
      const top = squareTop + Math.round((height - SQUARE_HEIGHT) / 2);
      pipeline = sharp(
        await pipeline.png().toBuffer(),
      ).composite([{ input: markPng, top, left }]);
    } catch {
      // If the custom SVG won't rasterize, fall through to the satori card
      // (which shows an empty slot) rather than failing the whole render.
    }
  }

  return pipeline.jpeg({ quality: 88 }).toBuffer();
}

/**
 * Plain cream fallback card — only the SETNAYAN wordmark. Served by the route
 * when the real render throws, so the Graph APIs never receive a broken image.
 */
export async function renderFallbackCardJpeg(): Promise<Buffer> {
  const tree = el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: `${CARD_SIZE}px`,
      height: `${CARD_SIZE}px`,
      backgroundColor: CREAM,
    },
    wordmark(),
  );
  const svg = await satori(tree as unknown as React.ReactNode, {
    width: CARD_SIZE,
    height: CARD_SIZE,
    fonts: SATORI_FONTS,
  });
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

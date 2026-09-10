'use client';

/**
 * Mood Board — "In your colors" (owner directive 2026-06-09: "too many designs
 * there … keep it simple. we want palette samples and the palette samples would
 * be great if there is a picture to show how that looks like for the specific
 * role(attire), flower, or part of the reception").
 *
 * ONE representative per design element (not a gallery of every variant). Each
 * card shows the element + its SHARED palette, and auto-applies the palette to
 * the drawing so the picture literally shows the chosen colours.
 *
 * ── OWNER RULING 2026-09-05: RECOLOURED DRAWINGS ONLY ───────────────────────
 * This section shows the couple's palette applied to a DRAWING — never a
 * photograph, never a Make-it-real render, never another couple's anything.
 * Renders live in "Make it real" (paid) and in section 01's inspiration pool.
 *
 * ⛔ A COMMENT HERE WAS FALSE FOR MONTHS, AND IT IS WHY THIS SECTION LIED.
 * It said attire figures are "colored SVG illustrations on a no-CORS host, so
 * they can't be canvas-recolored". They are not. The R2 host echoes every origin
 * we run on — re-measure it in one line:
 *
 *   curl -sI -H "Origin: https://www.setnayan.com" \
 *     https://pub-37d64fe618584c2981a88610a55dd439.r2.dev/moodboard-library/figure_attire/elegant-simple-classic/bride.svg
 *   → 200 · Access-Control-Allow-Origin: https://www.setnayan.com
 *
 * (`https://setnayan.com` and the Vercel origin echo the same.) What actually
 * kept attire at stock colours was the SELECT in `page.tsx`, which never asked
 * for `moodboard_asset_color_ranges` — so `regions` was always undefined here.
 * All 75 live figures already carried tagged ranges. A query shape, not a
 * hosting problem. Do not reintroduce a softened version of the old claim; if
 * you believe a host is not CORS-clean, run the curl and paste the result.
 *
 * `RecolorStudio` sets `crossOrigin = 'anonymous'` on the image it loads for the
 * canvas (see its loader effect) — a CORS-clean host is useless if the tag never
 * asks — and falls back to an un-recoloured paint if a canvas is ever tainted.
 */

import { useEffect, useRef, useState } from 'react';
import { RecolorStudio } from './recolor-studio';
import {
  type ColorRangeSlot,
  type RegionEditMap,
} from '@/lib/color-recolor';

export type BoardCard = {
  key: string;
  label: string;
  imageUrl: string;
  /** The element's shared palette (role or venue), shown as swatches. */
  paletteColors: string[];
  /**
   * Tagged colour regions. When present (+ palette set), the card auto-recolors
   * the drawing to the palette in-browser.
   */
  regions?: ColorRangeSlot[];
  /** Portrait aspect for figures / tall arrangements. */
  portrait?: boolean;
};

export type BoardSection = {
  title: string;
  blurb?: string;
  cards: BoardCard[];
};

/** slot → palette color, cycling the palette. Drives the auto-applied preview. */
function autoEdits(regions: ColorRangeSlot[], palette: string[]): RegionEditMap {
  const out: RegionEditMap = {};
  if (palette.length === 0) return out;
  regions.forEach((r, i) => {
    out[r.slotId] = { mode: 'palette', hex: palette[i % palette.length]! };
  });
  return out;
}

export function MoodboardBoard({
  sections,
  /**
   * Smaller/quieter rendering (Mood Board redesign follow-up, 2026-09-03):
   * "In your colors" moved further down the page and is now a secondary
   * "here's a taste" gut-check rather than a primary section, per owner
   * direction — this only shrinks the container (denser grid, quieter
   * headings, tighter spacing); the cards themselves (including the
   * interactive RecolorStudio) are untouched, so the underlying
   * functionality is byte-identical.
   */
  compact = false,
}: {
  sections: BoardSection[];
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'space-y-4' : 'space-y-8'}>
      {sections.map((section) =>
        section.cards.length === 0 ? null : (
          <section key={section.title} className={compact ? 'space-y-2' : 'space-y-3'}>
            <header>
              <h2
                className={
                  compact
                    ? 'text-sm font-medium uppercase tracking-wide text-ink/60'
                    : 'text-xl font-semibold text-ink'
                }
              >
                {section.title}
              </h2>
              {section.blurb && !compact ? (
                <p className="text-sm text-ink/65">{section.blurb}</p>
              ) : null}
            </header>
            <ul
              className={
                compact
                  ? 'grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-5'
                  : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
              }
            >
              {section.cards.map((card) => (
                <BoardCardView key={card.key} card={card} />
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}

/**
 * 🔑 MB23 — NO PALETTE MEANS NO COLOUR. THIS IS THE OWNER'S BUG.
 *
 * Reported 2026-09-05, verbatim: "we do not have a design yet for the palette
 * and there are already samples on in your colors." A couple who had chosen
 * nothing saw a fully coloured bride, a fully coloured groom, and a stock
 * photograph labelled "Ceremony". Every colour on that screen was one they did
 * not choose — while `PaletteStrip` underneath said "Set this palette above to
 * see it here." The picture contradicted its own caption.
 *
 * The cause was this component: `recolorable` required a non-empty palette, so
 * an empty palette fell THROUGH to `<img src={card.imageUrl}>` — the drawing at
 * its stock, artist-chosen colours, presented as the couple's own.
 *
 * With no palette we now render an honest empty: the SAME drawing, from the SAME
 * source, desaturated to neutral greys through the SAME canvas path. No second
 * asset set, nothing invented, and not one hue the couple did not pick. If the
 * drawing cannot be painted at all (load failure, or a genuinely tainted canvas
 * on some future host), the card shows the caption alone — an absent drawing is
 * honest; a stock-coloured one is not.
 *
 * Guarded by `no-palette-means-no-colour.test.ts`, which mounts this component
 * with `paletteColors: []` and asserts the stock `<img>` is not what renders.
 */
export function BoardCardView({ card }: { card: BoardCard }) {
  const hasRegions = !!card.regions && card.regions.length > 0;
  const hasPalette = card.paletteColors.length > 0;

  return (
    <li className="overflow-hidden rounded-xl border border-ink/15 bg-cream">
      {!hasPalette ? (
        <NeutralDrawing src={card.imageUrl} alt={card.label} portrait={card.portrait} />
      ) : hasRegions ? (
        <div className="p-2">
          <RecolorStudio
            imageSrc={card.imageUrl}
            regions={card.regions!}
            initialEdits={autoEdits(card.regions!, card.paletteColors)}
            portrait={card.portrait}
          />
        </div>
      ) : (
        // A card WITH a palette but no tagged regions. No live card is in this
        // state after MB23 (all 75 figures and all 5 florals carry ranges), but
        // an untagged upload would be, and showing the reference drawing beside
        // the chosen swatches is defensible — the couple's colours are on screen.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.imageUrl}
          alt={card.label}
          loading="lazy"
          className={
            card.portrait
              ? 'aspect-[3/4] w-full bg-cream object-contain'
              : 'aspect-[4/3] w-full object-cover'
          }
        />
      )}
      <div className="space-y-2 p-3">
        <p className="text-sm font-medium text-ink">{card.label}</p>
        <PaletteStrip colors={card.paletteColors} />
      </div>
    </li>
  );
}

/**
 * The honest empty: the drawing in neutral greys, painted pixel-by-pixel on a
 * canvas rather than tinted with a CSS filter — so what the couple sees is the
 * same thing a pixel assertion can measure, and so a card can never be "grey in
 * the stylesheet, coloured in the bitmap".
 *
 * Luma weights match `colorDistance` in @/lib/color-recolor (R .30 · G .59 ·
 * B .11), so the neutral treatment and the recolour treatment agree about
 * brightness. Alpha is preserved, so a cut-out figure stays cut out.
 *
 * Nothing renders until the paint succeeds. A failed load, or a tainted canvas
 * on a host that stops echoing our origin, leaves the drawing ABSENT — the
 * caption still tells the couple what the card is, and no stock colour appears.
 */
function NeutralDrawing({
  src,
  alt,
  portrait,
}: {
  src: string;
  alt: string;
  portrait?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    setPainted(false);
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, 520 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      let frame: ImageData;
      try {
        frame = ctx.getImageData(0, 0, w, h);
      } catch {
        // Tainted canvas: we cannot prove the pixels are neutral, so we show
        // nothing rather than the stock-coloured drawing.
        ctx.clearRect(0, 0, w, h);
        return;
      }
      const d = frame.data;
      for (let i = 0; i < d.length; i += 4) {
        const y = 0.3 * d[i]! + 0.59 * d[i + 1]! + 0.11 * d[i + 2]!;
        d[i] = y;
        d[i + 1] = y;
        d[i + 2] = y;
      }
      ctx.putImageData(frame, 0, 0);
      setPainted(true);
    };
    img.onerror = () => {
      if (!cancelled) setPainted(false);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div
      className={`relative w-full overflow-hidden bg-cream ${
        portrait ? 'aspect-[3/4]' : 'aspect-[4/3]'
      }`}
      aria-label={`${alt} — shown in neutral until you set this palette`}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full object-contain opacity-70"
        style={{ visibility: painted ? 'visible' : 'hidden' }}
      />
    </div>
  );
}

function PaletteStrip({ colors }: { colors: string[] }) {
  if (colors.length === 0) {
    return (
      <p className="text-xs text-ink/50">
        Set this palette above to see it here.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((hex, i) => (
        <div
          key={`${hex}-${i}`}
          className="h-6 w-6 rounded border border-ink/15"
          style={{ backgroundColor: hex }}
          title={hex}
        />
      ))}
    </div>
  );
}

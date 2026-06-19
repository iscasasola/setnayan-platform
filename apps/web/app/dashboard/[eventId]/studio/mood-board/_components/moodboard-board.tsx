'use client';

/**
 * Mood Board — simplified "design checklist" (owner directive 2026-06-09:
 * "too many designs there … keep it simple. we want palette samples and the
 * palette samples would be great if there is a picture to show how that looks
 * like for the specific role(attire), flower, or part of the reception").
 *
 * Phase 1 of the simplification: ONE representative per design element (not a
 * gallery of every variant). Each card shows the element + its SHARED palette,
 * and — where the source photo is recolorable in-browser (CORS-clean: venue
 * scenes + the app-served florals) — auto-applies the palette so the picture
 * literally shows the chosen colors. Attire figures are colored SVG
 * illustrations on a no-CORS host, so they can't be canvas-recolored; those
 * cards show the representative figure + the role's palette swatches.
 *
 * Phase 2 (curated treatment library) layers the stylist designer on top:
 * tap a reception part → pick its treatment (chandelier / draped cloth / …).
 */

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
   * Tagged color regions. When present (+ palette set), the card auto-recolors
   * the photo to the palette in-browser. Absent → a plain reference image
   * (e.g. attire SVGs) shown beside its palette swatches.
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

export function MoodboardBoard({ sections }: { sections: BoardSection[] }) {
  return (
    <div className="space-y-8">
      {sections.map((section) =>
        section.cards.length === 0 ? null : (
          <section key={section.title} className="space-y-3">
            <header>
              <h2 className="text-xl font-semibold text-ink">{section.title}</h2>
              {section.blurb ? (
                <p className="text-sm text-ink/65">{section.blurb}</p>
              ) : null}
            </header>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

function BoardCardView({ card }: { card: BoardCard }) {
  const recolorable =
    !!card.regions && card.regions.length > 0 && card.paletteColors.length > 0;
  return (
    <li className="overflow-hidden rounded-xl border border-ink/15 bg-cream">
      {recolorable ? (
        <div className="p-2">
          <RecolorStudio
            imageSrc={card.imageUrl}
            regions={card.regions!}
            initialEdits={autoEdits(card.regions!, card.paletteColors)}
            portrait={card.portrait}
          />
        </div>
      ) : (
        // Attire SVGs / no-CORS sources: plain reference image (next/image
        // doesn't optimize external SVG; a plain <img> is the reliable shape).
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

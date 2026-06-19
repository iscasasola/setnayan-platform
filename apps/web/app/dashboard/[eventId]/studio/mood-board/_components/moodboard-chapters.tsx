'use client';

/**
 * Mood Board chapters — the redesigned couple-facing surface (owner directive
 * 2026-06-08). Four chapters, each a grid of curated library photos the couple
 * recolors with the Recolor Studio:
 *
 *   1. Church / Ceremony   (venue scenes)
 *   2. Reception           (venue scenes)
 *   3. Attire              (figure photos)
 *   4. Flowers             (florals — new)
 *
 * Replaces the old 2-pillar "Visual preview" (Location feel + Dress codes).
 * Each card opens an editable RecolorStudio; saves persist to
 * event_moodboard_saves and re-render in the pinned strip up top via a
 * read-only RecolorStudio.
 */

import Image from 'next/image';
import { useMemo, useState, useTransition } from 'react';
import { trackFailure } from '@/lib/telemetry/track-error';
import {
  parseSnapshot,
  type ColorRangeMap,
  type MoodboardSnapshot,
} from '@/lib/color-recolor';
import type { RolePalette, PaletteKey } from '@/lib/mood-board';
import { saveMoodboardSelection } from '../actions';
import { RecolorStudio } from './recolor-studio';

export type ChapterAsset = {
  asset_id: string;
  asset_type: 'venue_scene' | 'figure_attire' | 'florals';
  asset_subtype: string | null;
  label: string;
  public_url: string;
  color_ranges: ColorRangeMap;
};

export type ChapterSave = {
  save_id: string;
  pillar: 'location_feel' | 'dress_codes' | 'florals';
  pillar_slot: string;
  asset_id: string;
  palette_snapshot: Record<string, unknown>;
  saved_at: string;
};

type Props = {
  eventId: string;
  assets: ChapterAsset[];
  existingSaves: ChapterSave[];
  palette: RolePalette;
};

type ChapterDef = {
  key: string;
  title: string;
  blurb: string;
  pillar: ChapterSave['pillar'];
  paletteKeys: PaletteKey[];
  portrait: boolean;
  match: (a: ChapterAsset) => boolean;
};

const CEREMONY_SUBTYPES = new Set(['church', 'ceremony']);

const CHAPTERS: ChapterDef[] = [
  {
    key: 'church',
    title: 'Church / Ceremony',
    blurb:
      'The aisle, altar, and drapery. Recolor the decor to match your ceremony palette.',
    pillar: 'location_feel',
    paletteKeys: ['ceremony'],
    portrait: false,
    match: (a) =>
      a.asset_type === 'venue_scene' &&
      CEREMONY_SUBTYPES.has((a.asset_subtype || '').toLowerCase()),
  },
  {
    key: 'reception',
    title: 'Reception',
    blurb:
      'Ceiling, walls, linens, and lighting. See your reception colors land on a real setup.',
    pillar: 'location_feel',
    paletteKeys: ['reception'],
    portrait: false,
    match: (a) =>
      a.asset_type === 'venue_scene' &&
      !CEREMONY_SUBTYPES.has((a.asset_subtype || '').toLowerCase()),
  },
  {
    key: 'attire',
    title: 'Attire',
    blurb:
      'How your entourage and guests look in your colors. Recolor each outfit.',
    pillar: 'dress_codes',
    paletteKeys: ['bride', 'groom', 'wedding_party', 'guest'],
    portrait: true,
    match: (a) => a.asset_type === 'figure_attire',
  },
  {
    key: 'flowers',
    title: 'Flowers',
    blurb:
      'Bouquets, aisle arrangements, and centerpieces — recolor the blooms to your palette.',
    pillar: 'florals',
    paletteKeys: ['reception', 'bride'],
    portrait: false,
    match: (a) => a.asset_type === 'florals',
  },
];

export function MoodboardChapters({ eventId, assets, existingSaves, palette }: Props) {
  const [saves, setSaves] = useState<ChapterSave[]>(existingSaves);
  const [openId, setOpenId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const assetsById = useMemo(() => {
    const m = new Map<string, ChapterAsset>();
    for (const a of assets) m.set(a.asset_id, a);
    return m;
  }, [assets]);

  const savesByAsset = useMemo(() => {
    const m = new Map<string, ChapterSave>();
    for (const s of saves) m.set(s.asset_id, s);
    return m;
  }, [saves]);

  function swatchesFor(keys: PaletteKey[]): string[] {
    const out: string[] = [];
    for (const k of keys) {
      for (const hex of palette[k] ?? []) {
        if (!out.includes(hex)) out.push(hex);
      }
    }
    return out;
  }

  function handleSave(asset: ChapterAsset, chapter: ChapterDef, snapshot: MoodboardSnapshot) {
    const pillarSlot = asset.asset_subtype || asset.asset_type;
    setSavingId(asset.asset_id);
    startTransition(async () => {
      try {
        const { saveId } = await saveMoodboardSelection({
          eventId,
          pillar: chapter.pillar,
          pillarSlot,
          assetId: asset.asset_id,
          paletteSnapshot: snapshot,
        });
        setSaves((prev) => [
          ...prev.filter(
            (s) => !(s.pillar === chapter.pillar && s.pillar_slot === pillarSlot),
          ),
          {
            save_id: saveId,
            pillar: chapter.pillar,
            pillar_slot: pillarSlot,
            asset_id: asset.asset_id,
            palette_snapshot: snapshot as Record<string, unknown>,
            saved_at: new Date().toISOString(),
          },
        ]);
        setError(null);
        setOpenId(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not save right now — try again in a moment.',
        );
        void trackFailure({
          eventType: 'SUPABASE_SAVE_ERROR',
          elementName: 'Save moodboard recolor',
          filePath:
            'app/dashboard/[eventId]/studio/mood-board/_components/moodboard-chapters.tsx',
          error: err,
          payload: { pillar: chapter.pillar, pillarSlot },
        });
      } finally {
        setSavingId(null);
      }
    });
  }

  return (
    <div className="space-y-8">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          Could not save: {error}
        </p>
      )}

      {/* ---- pinned looks ---- */}
      {saves.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
            Your pinned moodboard ({saves.length})
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {saves.map((s) => {
              const asset = assetsById.get(s.asset_id);
              if (!asset) return null;
              const { slots, edits } = parseSnapshot(
                s.palette_snapshot,
                asset.color_ranges,
              );
              return (
                <li
                  key={s.save_id}
                  className="space-y-2 rounded-lg border border-ink/15 bg-cream p-2"
                >
                  <RecolorStudio
                    imageSrc={asset.public_url}
                    regions={slots}
                    initialEdits={edits}
                    portrait={asset.asset_type === 'figure_attire'}
                  />
                  <p className="px-1 text-sm font-medium text-ink">{asset.label}</p>
                  <p className="px-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    {s.pillar.replace('_', ' ')} · {s.pillar_slot}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ---- chapters ---- */}
      {CHAPTERS.map((chapter) => {
        const chapterAssets = assets.filter(chapter.match);
        const swatches = swatchesFor(chapter.paletteKeys);
        return (
          <section key={chapter.key} className="space-y-3">
            <header>
              <h2 className="text-xl font-semibold text-ink">{chapter.title}</h2>
              <p className="text-sm text-ink/65">{chapter.blurb}</p>
            </header>

            {chapterAssets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink/20 p-6 text-center text-sm text-ink/55">
                {chapter.key === 'flowers'
                  ? 'Floral scenes are being curated — check back soon.'
                  : 'Setnayan is curating photos for this chapter.'}
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {chapterAssets.map((asset) => {
                  const isOpen = openId === asset.asset_id;
                  const isSaved = savesByAsset.has(asset.asset_id);
                  return (
                    <li
                      key={asset.asset_id}
                      className="overflow-hidden rounded-xl border border-ink/15 bg-cream"
                    >
                      {isOpen ? (
                        <div className="space-y-2 p-3">
                          <RecolorStudio
                            imageSrc={asset.public_url}
                            regions={Object.values(asset.color_ranges)}
                            paletteColors={swatches}
                            portrait={chapter.portrait}
                            isSaving={savingId === asset.asset_id && isPending}
                            onSave={(snap) => handleSave(asset, chapter, snap)}
                          />
                          <button
                            type="button"
                            onClick={() => setOpenId(null)}
                            className="text-[11px] uppercase tracking-[0.15em] text-ink/50 hover:text-terracotta"
                          >
                            Close
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setOpenId(asset.asset_id)}
                            className="block w-full text-left"
                          >
                            <Image
                              src={asset.public_url}
                              alt={asset.label}
                              width={400}
                              height={chapter.portrait ? 533 : 300}
                              loading="lazy"
                              className={
                                chapter.portrait
                                  ? 'aspect-[3/4] w-full bg-cream object-contain'
                                  : 'aspect-[4/3] w-full object-cover'
                              }
                            />
                          </button>
                          <div className="space-y-2 p-3">
                            <div className="flex items-baseline justify-between">
                              <p className="text-sm font-medium text-ink">
                                {asset.label}
                              </p>
                              {isSaved && (
                                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
                                  ✓ pinned
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setOpenId(asset.asset_id)}
                              className="rounded-md bg-mulberry px-3 py-1.5 text-xs font-medium text-cream"
                            >
                              {isSaved ? 'Edit recolor' : 'Recolor this'}
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

'use client';

import Image from 'next/image';

/**
 * Host-side Visual preview pillars (locked 2026-05-21 in 0010 §
 * "Visual preview pillars · Location feel + Dress codes").
 *
 * The host's experience:
 *   - Browses approved template assets (venue scenes + figure attires)
 *   - Sees each template with the Color Range Manipulator's HSL substitution
 *     applied using the event's current palette
 *   - Saves a (pillar, pillar_slot, asset_id, palette_snapshot) pairing to
 *     persist the event's pinned moodboard. "Locked" = pinned, NOT immutable.
 *   - Can swap to a different template + re-save anytime
 *
 * Per owner directive 2026-05-21: hosts can only USE templates here, not
 * upload. Upload flow is admin-only (or stylist-Drive in V1.x).
 */

import { useMemo, useState, useTransition } from 'react';
import {
  ColorRangeManipulator,
  type ColorRangeMap,
  type PalettePreview,
} from '@/app/admin/moodboard-library/_components/color-range-manipulator';
import { saveMoodboardSelection } from '../actions';

export type TemplateAsset = {
  asset_id: string;
  asset_type: 'venue_scene' | 'figure_attire';
  asset_subtype: string | null;
  label: string;
  public_url: string;
  color_ranges: ColorRangeMap;
};

export type ExistingSave = {
  save_id: string;
  pillar: 'location_feel' | 'dress_codes';
  pillar_slot: string;
  asset_id: string;
  palette_snapshot: Record<string, string>;
  saved_at: string;
};

type Props = {
  eventId: string;
  templates: TemplateAsset[];
  existingSaves: ExistingSave[];
  /** Couple's current role_palette from events.role_palette (single hex per group) */
  rolePalette: Record<string, string>;
};

export function VisualPreview({ eventId, templates, existingSaves, rolePalette }: Props) {
  const [openAssetId, setOpenAssetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saves, setSaves] = useState<ExistingSave[]>(existingSaves);

  // Build palette preview map for each template based on the event's rolePalette.
  // Slot 1 = primary palette color for the role/venue this asset belongs to.
  // Other slots use the template's original sampled hex (no substitution).
  function buildPreviewPalette(asset: TemplateAsset): PalettePreview {
    const primary = primaryColorFor(asset, rolePalette);
    const preview: PalettePreview = {};
    if (primary) preview[1] = primary;
    // Slots 2-6 stay as the asset's sampled hex → no recolor for those slots
    // (V1 simplification: only slot 1 maps to the event's existing palette).
    return preview;
  }

  const venueTemplates = useMemo(
    () => templates.filter((t) => t.asset_type === 'venue_scene'),
    [templates],
  );
  const figureTemplates = useMemo(
    () => templates.filter((t) => t.asset_type === 'figure_attire'),
    [templates],
  );

  const savesByAsset = useMemo(() => {
    const m = new Map<string, ExistingSave>();
    for (const s of saves) m.set(s.asset_id, s);
    return m;
  }, [saves]);

  function handleSave(asset: TemplateAsset) {
    const palette = buildPreviewPalette(asset);
    const paletteSnapshot = Object.fromEntries(
      Object.entries(palette).map(([k, v]) => [k, v as string]),
    );
    const pillar: ExistingSave['pillar'] =
      asset.asset_type === 'venue_scene' ? 'location_feel' : 'dress_codes';
    const pillarSlot = asset.asset_subtype || asset.asset_type;

    startTransition(async () => {
      try {
        const { saveId } = await saveMoodboardSelection({
          eventId,
          pillar,
          pillarSlot,
          assetId: asset.asset_id,
          paletteSnapshot,
        });
        // Optimistic merge: replace any existing save for the same pillar+slot
        setSaves((prev) => [
          ...prev.filter(
            (s) => !(s.pillar === pillar && s.pillar_slot === pillarSlot),
          ),
          {
            save_id: saveId,
            pillar,
            pillar_slot: pillarSlot,
            asset_id: asset.asset_id,
            palette_snapshot: paletteSnapshot,
            saved_at: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        alert(`Save failed: ${(err as Error).message}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Pinned saves */}
      {saves.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
            Your pinned moodboard ({saves.length})
          </p>
          <p className="text-sm text-ink/65">
            You can swap to a different template or update your palette anytime — your
            saved selections will re-render with whichever palette you have set.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {saves.map((s) => {
              const asset = templates.find((t) => t.asset_id === s.asset_id);
              if (!asset) return null;
              return (
                <li
                  key={s.save_id}
                  className="overflow-hidden rounded-lg border border-ink/15 bg-cream"
                >
                  {/* 2026-05-24 — figure_attire assets are PORTRAIT (full-body
                      illustrations head-to-feet) and were getting cropped at
                      the head by the old aspect-[4/3] + object-cover combo.
                      Use 3:4 portrait + object-contain for figures so the
                      whole person renders; venue_scene assets stay landscape
                      since they're meant to be wider-than-tall mood photos. */}
                  <Image
                    src={asset.public_url}
                    alt={asset.label}
                    width={400}
                    height={asset.asset_type === 'figure_attire' ? 533 : 300}
                    loading="lazy"
                    className={
                      asset.asset_type === 'figure_attire'
                        ? 'aspect-[3/4] w-full object-contain bg-cream'
                        : 'aspect-[4/3] w-full object-cover'
                    }
                  />
                  <div className="space-y-1 p-3">
                    <p className="text-sm font-medium text-ink">{asset.label}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                      {s.pillar.replace('_', ' ')} · {s.pillar_slot}
                    </p>
                    <PaletteRow palette={s.palette_snapshot} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Location feel */}
      {venueTemplates.length > 0 && (
        <section className="space-y-3">
          <header>
            <h2 className="text-xl font-semibold text-ink">Location feel</h2>
            <p className="text-sm text-ink/65">
              How your venue setup will feel. Pick a template that matches the vibe you
              want — your palette colors will recolor the decor regions in the photo.
            </p>
          </header>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {venueTemplates.map((asset) => (
              <TemplateCard
                key={asset.asset_id}
                asset={asset}
                isSaved={savesByAsset.has(asset.asset_id)}
                isOpen={openAssetId === asset.asset_id}
                onToggle={() =>
                  setOpenAssetId((prev) => (prev === asset.asset_id ? null : asset.asset_id))
                }
                onSave={() => handleSave(asset)}
                previewPalette={buildPreviewPalette(asset)}
                isPending={isPending}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Dress codes */}
      {figureTemplates.length > 0 && (
        <section className="space-y-3">
          <header>
            <h2 className="text-xl font-semibold text-ink">Dress codes</h2>
            <p className="text-sm text-ink/65">
              How your entourage and guests will look in your colors. Pick the figures
              you want to see your palette applied to.
            </p>
          </header>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {figureTemplates.map((asset) => (
              <TemplateCard
                key={asset.asset_id}
                asset={asset}
                isSaved={savesByAsset.has(asset.asset_id)}
                isOpen={openAssetId === asset.asset_id}
                onToggle={() =>
                  setOpenAssetId((prev) => (prev === asset.asset_id ? null : asset.asset_id))
                }
                onSave={() => handleSave(asset)}
                previewPalette={buildPreviewPalette(asset)}
                isPending={isPending}
              />
            ))}
          </ul>
        </section>
      )}

      {templates.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/55">
          No templates yet — Setnayan is curating the library.
        </div>
      )}
    </div>
  );
}

// ---- subcomponents ----

function TemplateCard({
  asset,
  isSaved,
  isOpen,
  onToggle,
  onSave,
  previewPalette,
  isPending,
}: {
  asset: TemplateAsset;
  isSaved: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onSave: () => void;
  previewPalette: PalettePreview;
  isPending: boolean;
}) {
  return (
    <li className="overflow-hidden rounded-xl border border-ink/15 bg-cream">
      <button
        type="button"
        onClick={onToggle}
        className="block w-full text-left"
      >
        {/* 2026-05-24 — figure_attire portrait fix (same as pinned-moodboard
            grid above). Vector figures span head-to-feet; the legacy
            aspect-[4/3] + object-cover was clipping the head. */}
        <Image
          src={asset.public_url}
          alt={asset.label}
          width={400}
          height={asset.asset_type === 'figure_attire' ? 533 : 300}
          loading="lazy"
          className={
            asset.asset_type === 'figure_attire'
              ? 'aspect-[3/4] w-full object-contain bg-cream'
              : 'aspect-[4/3] w-full object-cover'
          }
        />
      </button>
      <div className="space-y-2 p-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-ink">{asset.label}</p>
          {isSaved && (
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
              ✓ pinned
            </span>
          )}
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          {asset.asset_type === 'venue_scene' ? 'Location feel' : 'Dress codes'}
          {asset.asset_subtype ? ` · ${asset.asset_subtype}` : ''}
        </p>
        <PaletteRow
          palette={Object.fromEntries(
            Object.entries(previewPalette).map(([k, v]) => [k, v]),
          )}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={onSave}
            disabled={isPending}
            className="rounded-md bg-terracotta px-3 py-1.5 text-xs font-medium text-cream disabled:opacity-50"
          >
            {isSaved ? 'Update pin' : 'Save to moodboard'}
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-md border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink"
          >
            {isOpen ? 'Hide preview' : 'See preview'}
          </button>
        </div>

        {isOpen && (
          <div className="mt-2 rounded-lg border border-ink/10 bg-white p-2">
            <ColorRangeManipulator
              imageSrc={asset.public_url}
              initialMap={asset.color_ranges}
              previewPalette={previewPalette}
            />
            <p className="mt-2 text-[11px] text-ink/55">
              The preview applies your palette to the regions Setnayan has tagged on this
              template. Tap &ldquo;Save to moodboard&rdquo; to pin this look.
            </p>
          </div>
        )}
      </div>
    </li>
  );
}

function PaletteRow({ palette }: { palette: Record<string, string> }) {
  const slots = [1, 2, 3, 4, 5, 6];
  return (
    <div className="flex gap-1.5">
      {slots.map((s) => {
        const hex = palette[String(s)];
        if (!hex) {
          return <div key={s} className="h-5 w-5 rounded border border-dashed border-ink/20" />;
        }
        return (
          <div
            key={s}
            className="h-5 w-5 rounded border border-ink/15"
            style={{ backgroundColor: hex }}
            title={`Slot ${s}: ${hex}`}
          />
        );
      })}
    </div>
  );
}

// ---- palette mapping helper ----

/**
 * For a given template, pick the primary palette color from the event's
 * existing role_palette JSONB based on asset_subtype.
 *
 * Mapping is best-effort: venue templates pull from ceremony/reception
 * palettes; figure templates pull from the role-matching palette
 * (bride, groom, wedding_party, etc.). Falls back to the bride palette,
 * then the first available palette, then null.
 */
function primaryColorFor(asset: TemplateAsset, palette: Record<string, string>): string | null {
  const sub = (asset.asset_subtype || '').toLowerCase();

  if (asset.asset_type === 'venue_scene') {
    if (sub === 'reception') return palette.reception || palette.ceremony || null;
    if (sub === 'church' || sub === 'ceremony') return palette.ceremony || palette.reception || null;
    if (sub === 'cocktail') return palette.reception || palette.ceremony || null;
    return palette.reception || palette.ceremony || null;
  }

  // figure_attire
  if (sub === 'bride') return palette.bride || null;
  if (sub === 'groom') return palette.groom || null;
  if (sub.startsWith('bridesmaid') || sub.startsWith('groomsman') || sub.startsWith('wedding_party'))
    return palette.wedding_party || palette.bride || null;
  if (sub.startsWith('guest')) return palette.guest || null;
  if (sub.startsWith('principal')) return palette.principal_sponsors || null;
  if (sub.startsWith('secondary')) return palette.secondary_sponsors || null;
  if (sub.startsWith('bearer') || sub.startsWith('flower'))
    return palette.bearers_flower_girl || null;
  if (sub.startsWith('officiant')) return palette.officiants || null;

  // Fallback chain
  return palette.bride || palette.guest || Object.values(palette)[0] || null;
}

'use client';

/**
 * Stylist-side moodboard library editor. Renders the vendor's own uploaded
 * photos (drafts + Setnayan-approved) plus an upload form. Strips the
 * admin-only affordances (approve/retire) from the admin editor.
 *
 * V1 implementation per the 2026-05-21 lock — vendor uploads land in
 * Setnayan storage with source='stylist_upload', awaiting admin approval
 * before hosts can see them on the moodboard.
 */

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { watermarkFile } from '@/lib/watermark';
import {
  ColorRangeManipulator,
  type ColorRangeMap,
  type PalettePreview,
} from '@/app/admin/moodboard-library/_components/color-range-manipulator';
import {
  deleteStylistAsset,
  saveStylistColorRanges,
  uploadStylistAsset,
} from '../actions';

export type StylistAsset = {
  asset_id: string;
  asset_type: 'venue_scene' | 'figure_attire';
  asset_subtype: string | null;
  label: string;
  storage_path: string;
  approved_at: string | null;
  retired_at: string | null;
  created_at: string;
  public_url: string;
  color_ranges: ColorRangeMap;
};

const DEFAULT_PREVIEW_PALETTE: PalettePreview = {
  1: '#5b3d8c',
  2: '#0e7f6a',
  3: '#c97b4b',
  4: '#d4af37',
  5: '#22455e',
  6: '#a02c45',
};

export function StylistLibraryEditor({ initialAssets }: { initialAssets: StylistAsset[] }) {
  const [assets, setAssets] = useState<StylistAsset[]>(initialAssets);
  const [selectedId, setSelectedId] = useState<string | null>(initialAssets[0]?.asset_id ?? null);
  const [isPending, startTransition] = useTransition();
  const [localMaps, setLocalMaps] = useState<Record<string, ColorRangeMap>>(() =>
    Object.fromEntries(initialAssets.map((a) => [a.asset_id, a.color_ranges])),
  );
  const [previewPalette, setPreviewPalette] = useState<PalettePreview>(DEFAULT_PREVIEW_PALETTE);

  const selected = useMemo(
    () => assets.find((a) => a.asset_id === selectedId) ?? null,
    [assets, selectedId],
  );

  function setMapForSelected(next: ColorRangeMap) {
    if (!selected) return;
    setLocalMaps((prev) => ({ ...prev, [selected.asset_id]: next }));
  }

  async function handleUpload(form: HTMLFormElement) {
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        // Auto SETNAYAN watermark (owner directive 2026-05-21).
        const original = formData.get('file') as File | null;
        if (original) {
          const watermarked = await watermarkFile(original, {
            position: 'bottom-right',
            opacity: 0.55,
          });
          formData.set('file', watermarked);
        }

        const { assetId } = await uploadStylistAsset(formData);
        const label = String(formData.get('label') ?? '');
        const assetType = String(formData.get('assetType') ?? '') as StylistAsset['asset_type'];
        const assetSubtype = String(formData.get('assetSubtype') ?? '') || null;
        const file = formData.get('file') as File | null;
        const blobUrl = file ? URL.createObjectURL(file) : '';
        const placeholder: StylistAsset = {
          asset_id: assetId,
          asset_type: assetType,
          asset_subtype: assetSubtype,
          label,
          storage_path: 'pending',
          approved_at: null,
          retired_at: null,
          created_at: new Date().toISOString(),
          public_url: blobUrl,
          color_ranges: {},
        };
        setAssets((prev) => [placeholder, ...prev]);
        setLocalMaps((prev) => ({ ...prev, [assetId]: {} }));
        setSelectedId(assetId);
        form.reset();
      } catch (err) {
        alert(`Upload failed: ${(err as Error).message}`);
      }
    });
  }

  function handleSaveTags() {
    if (!selected) return;
    const map = localMaps[selected.asset_id] ?? {};
    startTransition(async () => {
      try {
        await saveStylistColorRanges(selected.asset_id, map);
        setAssets((prev) =>
          prev.map((a) =>
            a.asset_id === selected.asset_id ? { ...a, color_ranges: map } : a,
          ),
        );
      } catch (err) {
        alert(`Save failed: ${(err as Error).message}`);
      }
    });
  }

  function handleDelete() {
    if (!selected) return;
    if (!confirm('Delete this asset? The photo + tags will be removed.')) return;
    startTransition(async () => {
      try {
        await deleteStylistAsset(selected.asset_id);
        setAssets((prev) => prev.filter((a) => a.asset_id !== selected.asset_id));
        setSelectedId(null);
      } catch (err) {
        alert(`Delete failed: ${(err as Error).message}`);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* LEFT: upload + own-asset grid */}
      <div className="space-y-4">
        <section className="rounded-xl border border-ink/15 bg-cream p-4">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Upload your design
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUpload(e.currentTarget);
            }}
            className="space-y-3"
          >
            <input
              name="file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              required
              className="block w-full text-sm"
            />
            <input
              name="label"
              type="text"
              required
              placeholder="Label (e.g. 'Tagaytay garden setup')"
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:border-terracotta focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                name="assetType"
                required
                defaultValue="venue_scene"
                className="rounded-md border border-ink/15 bg-white px-2 py-2 text-sm"
              >
                <option value="venue_scene">Venue scene</option>
                <option value="figure_attire">Figure attire</option>
              </select>
              <input
                name="assetSubtype"
                type="text"
                placeholder="Subtype (e.g. 'reception')"
                className="rounded-md border border-ink/15 bg-white px-2 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream disabled:opacity-50"
            >
              {isPending ? 'Uploading…' : 'Upload + tag'}
            </button>
            <p className="text-[11px] text-ink/55">
              Your photo will be auto-watermarked with SETNAYAN before it lands on
              your library. Submissions appear as drafts; Setnayan reviews them
              before hosts see them in the shared template library.
            </p>
          </form>
        </section>

        <section className="rounded-xl border border-ink/15 bg-cream p-4">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            My uploads ({assets.length})
          </p>
          {assets.length === 0 ? (
            <p className="text-sm text-ink/55">
              No uploads yet — pick a file above to start.
            </p>
          ) : (
            <ul className="space-y-2">
              {assets.map((a) => (
                <li key={a.asset_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(a.asset_id)}
                    className={`flex w-full items-center gap-3 rounded-md border p-2 text-left transition ${
                      selectedId === a.asset_id
                        ? 'border-terracotta bg-terracotta/5'
                        : 'border-ink/10 hover:border-ink/30'
                    }`}
                  >
                    <Image
                      src={a.public_url}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                      className="h-12 w-12 flex-shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{a.label}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                        {a.asset_type}
                        {a.asset_subtype ? ` · ${a.asset_subtype}` : ''}
                        {' · '}
                        {a.approved_at ? '✓ live' : 'draft'}
                        {a.retired_at ? ' · retired' : ''}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* RIGHT: editor */}
      <div className="space-y-4">
        {selected ? (
          <>
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-ink">{selected.label}</h2>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                  {selected.asset_type}
                  {selected.asset_subtype ? ` · ${selected.asset_subtype}` : ''} ·{' '}
                  {selected.approved_at ? '✓ approved by Setnayan' : 'draft (pending review)'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveTags}
                  disabled={isPending}
                  className="rounded-md bg-terracotta px-3 py-1.5 text-sm font-medium text-cream disabled:opacity-50"
                >
                  Save tags
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="rounded-md border border-rose-500 px-3 py-1.5 text-sm font-medium text-rose-600 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </header>

            <ColorRangeManipulator
              imageSrc={selected.public_url}
              initialMap={localMaps[selected.asset_id] ?? {}}
              onChange={setMapForSelected}
              previewPalette={previewPalette}
            />

            <details className="rounded-lg border border-ink/15 bg-cream p-3">
              <summary className="cursor-pointer text-sm font-medium text-ink">
                Preview palette (test how your tags look with different colors)
              </summary>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {[1, 2, 3, 4, 5, 6].map((slotId) => (
                  <div key={slotId} className="space-y-1">
                    <label
                      htmlFor={`preview-slot-${slotId}`}
                      className="block text-center font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
                    >
                      Slot {slotId}
                    </label>
                    <input
                      id={`preview-slot-${slotId}`}
                      type="color"
                      value={previewPalette[slotId] ?? '#000000'}
                      onChange={(e) =>
                        setPreviewPalette((prev) => ({ ...prev, [slotId]: e.target.value }))
                      }
                      className="block h-10 w-full cursor-pointer rounded border border-ink/20"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink/55">
                In production each host&apos;s palette renders here. This is your
                preview tool to verify the tag regions look right across colors.
              </p>
            </details>
          </>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-ink/20 text-sm text-ink/55">
            Upload a photo or pick one from your library to start tagging.
          </div>
        )}
      </div>
    </div>
  );
}

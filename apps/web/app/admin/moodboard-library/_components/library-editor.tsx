'use client';

/**
 * Library editor — the client-side wrapper around the Color Range Manipulator
 * that handles file uploads, asset selection from the existing library, palette
 * preview testing, and persistence via server actions.
 *
 * Per the 2026-05-21 lock, the workflow is "tap to pick photo, then edit and
 * colorize" — implemented here as a two-column layout:
 *   - LEFT: library grid + upload + new-asset metadata
 *   - RIGHT: Color Range Manipulator on the currently-selected asset
 */

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { watermarkFile } from '@/lib/watermark';
import {
  ColorRangeManipulator,
  type ColorRangeMap,
  type PalettePreview,
} from './color-range-manipulator';
import {
  approveAsset,
  deleteAsset,
  getRandomHiggsfieldPrompt,
  retireAsset,
  saveColorRanges,
  uploadAsset,
} from '../actions';
import type { RandomMoodboardPrompt } from '@/lib/higgsfield-prompts';

export type LibraryAsset = {
  asset_id: string;
  asset_type: 'venue_scene' | 'figure_attire';
  asset_subtype: string | null;
  label: string;
  storage_path: string;
  source: 'internet_placeholder' | 'higgsfield_generated' | 'stylist_upload';
  approved_at: string | null;
  retired_at: string | null;
  created_at: string;
  public_url: string;
  color_ranges: ColorRangeMap;
};

type Props = {
  initialAssets: LibraryAsset[];
};

const DEFAULT_PREVIEW_PALETTE: PalettePreview = {
  1: '#5b3d8c', // a deep purple — visually distinct from typical sampled colors
  2: '#0e7f6a',
  3: '#c97b4b', // terracotta, in honor of the brand
  4: '#d4af37', // gold
  5: '#22455e',
  6: '#a02c45',
};

export function LibraryEditor({ initialAssets }: Props) {
  const [assets, setAssets] = useState<LibraryAsset[]>(initialAssets);
  const [selectedId, setSelectedId] = useState<string | null>(initialAssets[0]?.asset_id ?? null);
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(
    () => assets.find((a) => a.asset_id === selectedId) ?? null,
    [assets, selectedId],
  );

  // Per-asset live color range map (kept locally so editing is responsive;
  // pushed to server on "Save tags").
  const [localMaps, setLocalMaps] = useState<Record<string, ColorRangeMap>>(() =>
    Object.fromEntries(initialAssets.map((a) => [a.asset_id, a.color_ranges])),
  );
  const [previewPalette, setPreviewPalette] = useState<PalettePreview>(DEFAULT_PREVIEW_PALETTE);
  const [randomPrompt, setRandomPrompt] = useState<RandomMoodboardPrompt | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);

  function generatePrompt() {
    startTransition(async () => {
      try {
        const p = await getRandomHiggsfieldPrompt();
        setRandomPrompt(p);
        setPromptCopied(false);
      } catch (err) {
        alert(`Generate failed: ${(err as Error).message}`);
      }
    });
  }

  async function copyPrompt() {
    if (!randomPrompt) return;
    try {
      await navigator.clipboard.writeText(randomPrompt.prompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      // ignored — clipboard API not always available in dev
    }
  }

  function setMapForSelected(next: ColorRangeMap) {
    if (!selected) return;
    setLocalMaps((prev) => ({ ...prev, [selected.asset_id]: next }));
  }

  async function handleUpload(form: HTMLFormElement) {
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        // Apply SETNAYAN watermark before upload (owner directive 2026-05-21:
        // all photos posted to the app get auto-watermark except event photos).
        const original = formData.get('file') as File | null;
        if (original) {
          const watermarked = await watermarkFile(original, {
            position: 'bottom-right',
            opacity: 0.55,
          });
          formData.set('file', watermarked);
        }

        const { assetId } = await uploadAsset(formData);
        // Optimistic: append a placeholder row; server will revalidate fully on next load
        const label = String(formData.get('label') ?? '');
        const assetType = String(formData.get('assetType') ?? '') as LibraryAsset['asset_type'];
        const assetSubtype = String(formData.get('assetSubtype') ?? '') || null;
        const source = (String(formData.get('source') ?? '') ||
          'internet_placeholder') as LibraryAsset['source'];
        // For immediate UX, store a blob URL of the watermarked file.
        const file = formData.get('file') as File | null;
        const blobUrl = file ? URL.createObjectURL(file) : '';
        const placeholder: LibraryAsset = {
          asset_id: assetId,
          asset_type: assetType,
          asset_subtype: assetSubtype,
          label,
          storage_path: 'pending',
          source,
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
        await saveColorRanges(selected.asset_id, map);
        // Reflect "saved" state into asset.color_ranges so subsequent re-selects load it
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

  function handleApprove() {
    if (!selected) return;
    startTransition(async () => {
      try {
        await approveAsset(selected.asset_id);
        setAssets((prev) =>
          prev.map((a) =>
            a.asset_id === selected.asset_id
              ? { ...a, approved_at: new Date().toISOString(), retired_at: null }
              : a,
          ),
        );
      } catch (err) {
        alert(`Approve failed: ${(err as Error).message}`);
      }
    });
  }

  function handleRetire() {
    if (!selected) return;
    if (!confirm('Retire this asset? It will stop appearing for hosts.')) return;
    startTransition(async () => {
      try {
        await retireAsset(selected.asset_id);
        setAssets((prev) =>
          prev.map((a) =>
            a.asset_id === selected.asset_id ? { ...a, retired_at: new Date().toISOString() } : a,
          ),
        );
      } catch (err) {
        alert(`Retire failed: ${(err as Error).message}`);
      }
    });
  }

  function handleDelete() {
    if (!selected) return;
    if (!confirm('Delete this asset entirely? This removes the photo and metadata.')) return;
    startTransition(async () => {
      try {
        await deleteAsset(selected.asset_id);
        setAssets((prev) => prev.filter((a) => a.asset_id !== selected.asset_id));
        setSelectedId(null);
      } catch (err) {
        alert(`Delete failed: ${(err as Error).message}`);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* LEFT: random-prompt generator + library grid + upload */}
      <div className="space-y-4">
        {/* Random Higgsfield prompt generator (owner directive 2026-05-21:
           "we can just click generate and it will make one everytime") */}
        <section className="rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
            Random Higgsfield prompt
          </p>
          <p className="mb-3 text-xs text-ink/65">
            One click → a Filipino-first prompt with randomized asset type,
            subtype, and accent color. Copy it into Higgsfield, generate,
            then upload the result below.
          </p>
          <button
            type="button"
            onClick={generatePrompt}
            disabled={isPending}
            className="mb-3 w-full rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream disabled:opacity-50"
          >
            {isPending ? 'Rolling…' : 'Generate random prompt'}
          </button>
          {randomPrompt && (
            <div className="space-y-2 rounded-md border border-ink/15 bg-white p-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  Label
                </p>
                <p className="text-sm font-medium text-ink">{randomPrompt.label}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <p className="font-mono uppercase tracking-[0.15em] text-ink/55">Type</p>
                  <p className="text-ink">
                    {randomPrompt.assetType}
                    {' · '}
                    {randomPrompt.assetSubtype}
                  </p>
                </div>
                <div>
                  <p className="font-mono uppercase tracking-[0.15em] text-ink/55">Model</p>
                  <p className="text-ink">
                    {randomPrompt.recommendedModel} · {randomPrompt.aspectRatio}
                  </p>
                </div>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  Accent · {randomPrompt.primaryAccentColor} on {randomPrompt.primaryAccentRegion}
                </p>
              </div>
              <details>
                <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.15em] text-ink/65">
                  Prompt
                </summary>
                <p className="mt-2 whitespace-pre-wrap rounded border border-ink/10 bg-cream p-2 text-xs text-ink/80">
                  {randomPrompt.prompt}
                </p>
              </details>
              <button
                type="button"
                onClick={copyPrompt}
                className="w-full rounded-md border border-ink/20 bg-cream px-3 py-1.5 text-xs font-medium text-ink"
              >
                {promptCopied ? '✓ Copied' : 'Copy prompt to clipboard'}
              </button>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-ink/15 bg-cream p-4">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Upload new
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
              placeholder="Label (e.g. 'Manila ballroom · burgundy')"
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
            <select
              name="source"
              defaultValue="internet_placeholder"
              className="w-full rounded-md border border-ink/15 bg-white px-2 py-2 text-sm"
            >
              <option value="internet_placeholder">Internet placeholder (V1 soft-beta only)</option>
              <option value="higgsfield_generated">Higgsfield-generated (V1.x)</option>
              <option value="stylist_upload">Stylist-approved upload (V1.x+)</option>
            </select>
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream disabled:opacity-50"
            >
              {isPending ? 'Uploading…' : 'Upload + tag'}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-ink/15 bg-cream p-4">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Library ({assets.length})
          </p>
          {assets.length === 0 ? (
            <p className="text-sm text-ink/55">Empty — upload a photo to begin.</p>
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
                        {a.approved_at ? '✓ approved' : 'draft'}
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
                  {selected.asset_subtype ? ` · ${selected.asset_subtype}` : ''} · {selected.source}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveTags}
                  disabled={isPending}
                  className="rounded-md bg-mulberry px-3 py-1.5 text-sm font-medium text-cream disabled:opacity-50"
                >
                  Save tags
                </button>
                {!selected.approved_at && (
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isPending}
                    className="rounded-md border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 disabled:opacity-50"
                  >
                    Publish
                  </button>
                )}
                {selected.approved_at && !selected.retired_at && (
                  <button
                    type="button"
                    onClick={handleRetire}
                    disabled={isPending}
                    className="rounded-md border border-ink/30 px-3 py-1.5 text-sm font-medium text-ink/70 disabled:opacity-50"
                  >
                    Retire
                  </button>
                )}
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
                Preview palette (used in the &ldquo;Preview with palette&rdquo; toggle)
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
                These are the colors that will be applied to each tagged slot when previewing.
                In production this comes from the host&apos;s master palette.
              </p>
            </details>
          </>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-ink/20 text-sm text-ink/55">
            Upload a photo or pick one from the library to begin tagging.
          </div>
        )}
      </div>
    </div>
  );
}

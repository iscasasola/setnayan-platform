'use client';

/**
 * Supplier-side moodboard library editor. Renders the shop's own uploaded
 * photos (drafts + Setnayan-approved) plus an upload form. Strips the
 * admin-only affordances (approve/retire) from the admin editor.
 *
 * V1 implementation per the 2026-05-21 lock — vendor uploads land in
 * Setnayan storage with source='stylist_upload', awaiting admin approval
 * before hosts can see them on the moodboard.
 *
 * ── MB11 (2026-09-04) ───────────────────────────────────────────────────────
 * Three additions, and one DELETION worth reading before touching this file:
 *
 *   + a SUPPLIER GALLERY asset type, whose subtype is the inspiration slot the
 *     photo answers. The slot list arrives from the server already filtered to
 *     the trades this shop actually covers.
 *   + a RIGHTS WARRANTY tick, which the server refuses the upload without.
 *   + an IMPORT list of the shop's own day-of editorial photos, which are
 *     event-linked and never count against the back-catalogue quota.
 *
 *   − 🛑 THE CLIENT-SIDE `watermarkFile` CALL IS GONE ON PURPOSE. It ran here
 *     from May 2026 and it was never a rule: the upload is a server action, and
 *     anything that can call it could hand it unmarked bytes while the browser
 *     path looked identical. MB11 moved the mark to the server
 *     (lib/watermark-server.ts) on the authoritative bytes. RE-ADDING IT HERE
 *     WOULD PRINT SETNAYAN TWICE — the server marks every photo that reaches
 *     this bucket, unconditionally.
 */

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { useConfirm } from '@/app/_components/confirm-dialog';
import {
  ColorRangeManipulator,
  type ColorRangeMap,
  type PalettePreview,
} from '@/app/admin/moodboard-library/_components/color-range-manipulator';
import {
  deleteStylistAsset,
  importEditorialMediaToGallery,
  saveStylistColorRanges,
  uploadStylistAsset,
  type ImportableEditorialPhoto,
} from '../actions';
// ⚠ FROM THE PURE MODULE, DELIBERATELY. `lib/moodboard-gallery.ts` and
// `lib/moodboard-gallery-upload.ts` both reach `lib/supabase/admin.ts` through
// the taxonomy, and this is a client component — importing either of them from
// here turns `lint-server-only-boundary` red, which is the only thing in the
// toolchain that can see the problem before a multi-minute `next build`.
import {
  RIGHTS_WARRANTY_TEXT,
  SUPPLIER_GALLERY_ASSET_TYPE,
} from '@/lib/moodboard-gallery-pure';
import { ShopNotice } from '../../_components/kit';

export type StylistAsset = {
  asset_id: string;
  // 'florals' added 2026-06-09 (mood-board redesign — Flowers chapter).
  // 'supplier_gallery' added by MB10 (2026-09-03): a shop's own portfolio
  // photograph, credited to `vendor_profile_id`, with the inspiration slot in
  // `asset_subtype`. Listed here because THIS PAGE READS EVERY asset_type and
  // casts the column to this union — a fourth DB value with a three-value type
  // would be a cast that lies. Deliberately NOT added to the <select> below:
  // gallery rows are authored by the supplier upload page (MB11), never
  // hand-made here, and they carry a rights warranty this form cannot capture.
  asset_type: 'venue_scene' | 'figure_attire' | 'florals' | 'supplier_gallery';
  asset_subtype: string | null;
  /** The celebration this photo came off. NULL = back-catalogue, which is the
   *  only thing the per-tier quota counts (MB11). */
  source_event_id: string | null;
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

export type StylistLibraryEditorProps = {
  initialAssets: StylistAsset[];
  /** Slots this shop may upload into — derived server-side from its trades. */
  gallerySlots: Array<{ key: string; label: string }>;
  /** This tier's back-catalogue ceiling, PER CATEGORY (MB19). 0 = event-linked photos only. */
  backCatalogueCap: number;
  /** The shop's own day-of editorial photos, eligible to become gallery rows. */
  importableEditorial: ImportableEditorialPhoto[];
  /** TRUE when that read FAILED — which is not the same as "you have none". */
  importableEditorialFailed: boolean;
};

export function StylistLibraryEditor({
  initialAssets,
  gallerySlots,
  backCatalogueCap,
  importableEditorial,
  importableEditorialFailed,
}: StylistLibraryEditorProps) {
  const [assets, setAssets] = useState<StylistAsset[]>(initialAssets);
  const [assetType, setAssetType] = useState<StylistAsset['asset_type']>(
    gallerySlots.length > 0 ? SUPPLIER_GALLERY_ASSET_TYPE : 'venue_scene',
  );
  const [rightsWarranted, setRightsWarranted] = useState(false);
  const [importSlot, setImportSlot] = useState<string>(gallerySlots[0]?.key ?? '');
  // The category this upload targets. MB19: the quota is PER CATEGORY, so the
  // select must be controlled — the button-disable and the helper copy below
  // both need to know which shelf's count to read.
  const [uploadSlot, setUploadSlot] = useState<string>(gallerySlots[0]?.key ?? '');
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialAssets[0]?.asset_id ?? null);
  const [isPending, startTransition] = useTransition();
  const [localMaps, setLocalMaps] = useState<Record<string, ColorRangeMap>>(() =>
    Object.fromEntries(initialAssets.map((a) => [a.asset_id, a.color_ranges])),
  );
  const [previewPalette, setPreviewPalette] = useState<PalettePreview>(DEFAULT_PREVIEW_PALETTE);
  // Shared error surface replaces the 3 prior `alert(...)` callsites per
  // pre-pilot audit cleanup 2026-05-30. Clears on next successful action.
  const [actionError, setActionError] = useState<string | null>(null);
  // In-app confirm dialog replaces the 1 prior `confirm(...)` callsite.
  // Render `{dialog}` at the editor root so the modal can mount.
  const { confirm, dialog } = useConfirm();

  const selected = useMemo(
    () => assets.find((a) => a.asset_id === selectedId) ?? null,
    [assets, selectedId],
  );

  const isGalleryUpload = assetType === SUPPLIER_GALLERY_ASSET_TYPE;

  // MB19: back-catalogue USED is derived PER CATEGORY, live off `assets` —
  // there is no separate counter to keep in sync. A shop holding 20 Flowers
  // photos reads 20/20 here while Tables reads 0/cap, because this recomputes
  // for whichever slot the vendor has selected.
  const usedInSelectedSlot = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.asset_type === SUPPLIER_GALLERY_ASSET_TYPE &&
          a.asset_subtype === uploadSlot &&
          a.source_event_id === null &&
          a.retired_at === null,
      ).length,
    [assets, uploadSlot],
  );
  const uploadSlotLabel =
    gallerySlots.find((s) => s.key === uploadSlot)?.label ?? 'that category';
  // The quota gates the BUTTON as well as the server, so a supplier who is out
  // of room is told before they pick a file rather than after they wait for an
  // upload. The server still decides — this is the same number, not a substitute.
  const quotaExhausted = isGalleryUpload && usedInSelectedSlot >= backCatalogueCap;

  function setMapForSelected(next: ColorRangeMap) {
    if (!selected) return;
    setLocalMaps((prev) => ({ ...prev, [selected.asset_id]: next }));
  }

  async function handleUpload(form: HTMLFormElement) {
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        // ⚠ NO CLIENT-SIDE WATERMARK HERE — the server marks the authoritative
        // bytes (see the file docblock). Adding one back prints it twice.
        setActionError(null);
        setNotice(null);
        const { assetId, textScreen } = await uploadStylistAsset(formData);
        const label = String(formData.get('label') ?? '');
        const uploadedType = String(
          formData.get('assetType') ?? '',
        ) as StylistAsset['asset_type'];
        const assetSubtype = String(formData.get('assetSubtype') ?? '') || null;
        const file = formData.get('file') as File | null;
        const blobUrl = file ? URL.createObjectURL(file) : '';
        const placeholder: StylistAsset = {
          asset_id: assetId,
          asset_type: uploadedType,
          asset_subtype: assetSubtype,
          label,
          storage_path: 'pending',
          approved_at: null,
          retired_at: null,
          created_at: new Date().toISOString(),
          source_event_id: null,
          public_url: blobUrl,
          color_ranges: {},
        };
        setAssets((prev) => [placeholder, ...prev]);
        setLocalMaps((prev) => ({ ...prev, [assetId]: {} }));
        setSelectedId(assetId);
        // usedInSelectedSlot recomputes off `assets` itself (MB19) — the
        // placeholder just pushed above already carries the right
        // asset_subtype, so no separate counter to increment here.
        // 🔑 A CHECK THAT DID NOT RUN IS NOT A CHECK THAT PASSED, and the
        // supplier is the one person who can act on knowing. When the text
        // screen was unavailable we say so instead of implying the photo was
        // read and found clean.
        if (textScreen === 'unavailable') {
          setNotice(
            'Uploaded. We couldn’t read the text in this photo just now, so Setnayan will look at it before couples see it.',
          );
        }
        setRightsWarranted(false);
        form.reset();
      } catch (err) {
        setActionError((err as Error).message);
      }
    });
  }

  function handleImport(mediaId: string) {
    startTransition(async () => {
      try {
        setActionError(null);
        setNotice(null);
        await importEditorialMediaToGallery({
          mediaId,
          slotKey: importSlot,
          rightsWarranted: true,
        });
        setNotice(
          'Added to your gallery. Photos from a celebration you were booked on never count against your back-catalogue allowance.',
        );
      } catch (err) {
        setActionError((err as Error).message);
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
        setActionError(`Save failed: ${(err as Error).message}`);
      }
    });
  }

  async function handleDelete() {
    if (!selected) return;
    const ok = await confirm({
      title: 'Delete this asset?',
      body: 'The photo + tags will be removed. This cannot be undone.',
      destructive: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteStylistAsset(selected.asset_id);
        setAssets((prev) => prev.filter((a) => a.asset_id !== selected.asset_id));
        setSelectedId(null);
      } catch (err) {
        setActionError(`Delete failed: ${(err as Error).message}`);
      }
    });
  }

  return (
    <>
      {dialog}
      {notice ? (
        <ShopNotice tone="success" role="status" className="mb-4 flex items-start justify-between gap-3">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700 hover:text-ink"
            aria-label="Dismiss message"
          >
            Dismiss
          </button>
        </ShopNotice>
      ) : null}
      {actionError ? (
        <ShopNotice tone="gold" role="alert" className="mb-4 flex items-start justify-between gap-3">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700 hover:text-ink"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </ShopNotice>
      ) : null}
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* LEFT: upload + own-asset grid */}
      <div className="space-y-4">
        <section className="rounded-xl border border-ink/15 bg-white/70 p-4">
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
                value={assetType}
                onChange={(e) =>
                  setAssetType(e.target.value as StylistAsset['asset_type'])
                }
                className="rounded-md border border-ink/15 bg-white px-2 py-2 text-sm"
              >
                {gallerySlots.length > 0 ? (
                  <option value={SUPPLIER_GALLERY_ASSET_TYPE}>
                    Couples&rsquo; inspiration gallery
                  </option>
                ) : null}
                <option value="venue_scene">Venue scene</option>
                <option value="figure_attire">Figure attire</option>
                <option value="florals">Florals</option>
              </select>
              {isGalleryUpload ? (
                <select
                  name="assetSubtype"
                  required
                  value={uploadSlot}
                  onChange={(e) => setUploadSlot(e.target.value)}
                  aria-label="Which part of the mood board"
                  className="rounded-md border border-ink/15 bg-white px-2 py-2 text-sm"
                >
                  {gallerySlots.map((slot) => (
                    <option key={slot.key} value={slot.key}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name="assetSubtype"
                  type="text"
                  placeholder="Subtype (e.g. 'reception')"
                  className="rounded-md border border-ink/15 bg-white px-2 py-2 text-sm"
                />
              )}
            </div>

            {/* 🛑 THE WARRANTY IS A DELIBERATE TICK, NEVER A HIDDEN FIELD. A
                pre-checked box, or a `<input type="hidden" value="1">`, would
                record a promise the supplier never made — the same shape as the
                onboarding consent this repo already had to unwind. The server
                refuses the upload without it. */}
            <label className="flex items-start gap-2 text-[11px] leading-snug text-ink/70">
              <input
                type="checkbox"
                name="rightsWarranted"
                value="1"
                checked={rightsWarranted}
                onChange={(e) => setRightsWarranted(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0"
              />
              <span>{RIGHTS_WARRANTY_TEXT}</span>
            </label>

            <button
              type="submit"
              disabled={isPending || !rightsWarranted || quotaExhausted}
              className="w-full rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream disabled:opacity-50"
            >
              {isPending ? 'Uploading…' : 'Upload + tag'}
            </button>

            {isGalleryUpload ? (
              <p className="text-[11px] text-ink/55">
                {backCatalogueCap === 0
                  ? `You can add ${uploadSlotLabel} photos from celebrations you were booked on, but not from your back catalogue. Those never count against any category.`
                  : `${uploadSlotLabel} back-catalogue photos: ${usedInSelectedSlot} of ${backCatalogueCap} used. Photos from celebrations you were booked on never count, and this cap is per category — your other shelves have their own room.`}
              </p>
            ) : null}

            <p className="text-[11px] text-ink/55">
              We watermark every photo with SETNAYAN on our side before storing
              it, and check it for QR codes and your own contact details —
              couples reach you through the credit under the photo, so those
              only take them off Setnayan. Submissions appear as drafts;
              Setnayan reviews them before couples see them.
            </p>
          </form>
        </section>

        {/* ── THE EVENT-LINKED ROUTE ───────────────────────────────────────
            The shop's own day-of photos from `editorial_vendor_media` — a
            table built in June 2026 and standing at zero rows since. They are
            already the couple's, already NSFW-screened, and already curated by
            the couple (a photo they hid on their own story never appears
            here). Promoting one re-checks `selection_match_rank = 1` server
            side rather than trusting the gate that let it be submitted, and
            the result is EVENT-LINKED — so it never touches the
            back-catalogue allowance, at any tier. */}
        {importableEditorialFailed ? (
          <ShopNotice tone="warn" role="status" className="text-sm">
            We couldn’t load your photos from celebrations you worked just now.
            They aren’t gone — reload in a moment, or upload from your own files
            below.
          </ShopNotice>
        ) : null}

        {importableEditorial.length > 0 && gallerySlots.length > 0 ? (
          <section className="rounded-xl border border-ink/15 bg-white/70 p-4">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              From celebrations you worked
            </p>
            <p className="mb-3 text-[11px] text-ink/55">
              Your day-of photos from couples who picked you. These never count
              against your back-catalogue allowance.
            </p>
            <label
              htmlFor="import-slot"
              className="mb-1 block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
            >
              Add to
            </label>
            <select
              id="import-slot"
              value={importSlot}
              onChange={(e) => setImportSlot(e.target.value)}
              className="mb-3 w-full rounded-md border border-ink/15 bg-white px-2 py-2 text-sm"
            >
              {gallerySlots.map((slot) => (
                <option key={slot.key} value={slot.key}>
                  {slot.label}
                </option>
              ))}
            </select>
            <ul className="space-y-2">
              {importableEditorial.map((photo) => (
                <li
                  key={photo.mediaId}
                  className="flex items-center justify-between gap-3 rounded-md border border-ink/10 p-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {photo.caption?.trim() || 'Day-of photo'}
                  </span>
                  <button
                    type="button"
                    disabled={isPending || photo.alreadyImported}
                    onClick={() => handleImport(photo.mediaId)}
                    className="flex-shrink-0 rounded-md border border-mulberry px-3 py-1.5 text-xs font-medium text-mulberry disabled:opacity-50"
                  >
                    {photo.alreadyImported ? 'Added' : 'Add to gallery'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-xl border border-ink/15 bg-white/70 p-4">
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
                      alt={a.label ? `Moodboard photo: ${a.label}` : 'Moodboard photo thumbnail'}
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
                  className="rounded-md bg-mulberry px-3 py-1.5 text-sm font-medium text-cream disabled:opacity-50"
                >
                  Save tags
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="rounded-md border border-danger-500 px-3 py-1.5 text-sm font-medium text-danger-600 disabled:opacity-50"
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

            <details className="rounded-lg border border-ink/15 bg-white/70 p-3">
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
    </>
  );
}

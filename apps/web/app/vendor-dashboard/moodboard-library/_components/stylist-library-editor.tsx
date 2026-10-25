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
import { UploadCloud } from 'lucide-react';
import { useConfirm } from '@/app/_components/confirm-dialog';
// 🔽 ANY SET OF CHOICES IS ONE DROPDOWN (owner rule) — the shipped PickMenu, never a native <select>.
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
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

/**
 * The editor's four writes — the SHIPPED server actions unless a caller hands in others. Only the dev lab
 * (`/dev/supplier-lab?s=library`) does, with stand-ins that keep the photo in the dev server's memory and never reach
 * the database; the page passes nothing, so production always runs these.
 */
export type StylistLibraryActions = {
  uploadStylistAsset: typeof uploadStylistAsset;
  importEditorialMediaToGallery: typeof importEditorialMediaToGallery;
  saveStylistColorRanges: typeof saveStylistColorRanges;
  deleteStylistAsset: typeof deleteStylistAsset;
};
const SHIPPED_ACTIONS: StylistLibraryActions = { uploadStylistAsset, importEditorialMediaToGallery, saveStylistColorRanges, deleteStylistAsset };
// ⚠ FROM THE PURE MODULE, DELIBERATELY. `lib/moodboard-gallery.ts` and
// `lib/moodboard-gallery-upload.ts` both reach `lib/supabase/admin.ts` through
// the taxonomy, and this is a client component — importing either of them from
// here turns `lint-server-only-boundary` red, which is the only thing in the
// toolchain that can see the problem before a multi-minute `next build`.
import {
  RIGHTS_WARRANTY_TEXT,
  SUPPLIER_GALLERY_ASSET_TYPE,
} from '@/lib/moodboard-gallery-pure';
import { PHOTO_PART_GROUP_LABEL, type PhotoPartGroup } from '@/lib/inspiration-slots';
import { ShopNotice } from '../../_components/kit';
import { RejectionNotice } from './rejection-notice';
import { formatCount } from '@/lib/format-number';

export type StylistAsset = {
  asset_id: string;
  // 'florals' added 2026-06-09 (mood-board redesign — Flowers chapter).
  // 'supplier_gallery' added by MB10 (2026-09-03): a shop's own portfolio
  // photograph, credited to `vendor_profile_id`, with the inspiration slot in
  // `asset_subtype`. Listed here because THIS PAGE READS EVERY asset_type and
  // casts the column to this union — a fourth DB value with a three-value type
  // would be a cast that lies. Deliberately NOT added to the dropdown below:
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
  /** MB21 · when Setnayan refused this photo. Paired with the reason by a DB
   *  CHECK, so a rejection can never arrive without something to read. */
  rejected_at: string | null;
  rejection_reason: string | null;
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

/** One of the shop's own photos (its page gallery or a service card) — `lib/shop-own-photos.server.ts`. */
export type ShopPhotoChoice = { ref: string; url: string; from: 'page' | 'card' };

/** The dropdown's headings, in the couple's order (`uploadableSlotsForShop`); "More boards" holds the older shelves. */
const SLOT_GROUP_LABEL: Record<PhotoPartGroup | 'more', string> = { ...PHOTO_PART_GROUP_LABEL, more: 'More boards' };

export type StylistLibraryEditorProps = {
  initialAssets: StylistAsset[];
  /** Slots this shop may upload into — derived server-side from its trades, in the couple's order and words. */
  gallerySlots: Array<{ key: string; label: string; group?: PhotoPartGroup | 'more' }>;
  /** 🌱🖼 The shop's own photos, offered beside Upload (owner 2026-10-19). Empty = it has none (or none readable). */
  shopPhotos?: ShopPhotoChoice[];
  /** TRUE when the shop's photos could not be read — said, never drawn as "you have none". */
  shopPhotosFailed?: boolean;
  /** This tier's back-catalogue ceiling, PER CATEGORY (MB19). 0 = event-linked photos only. */
  backCatalogueCap: number;
  /** The shop's own day-of editorial photos, eligible to become gallery rows. */
  importableEditorial: ImportableEditorialPhoto[];
  /** TRUE when that read FAILED — which is not the same as "you have none". */
  importableEditorialFailed: boolean;
  /** 🧪 The dev lab's stand-ins; absent everywhere in the app (the shipped actions run). */
  actions?: Partial<StylistLibraryActions>;
};

export function StylistLibraryEditor({
  initialAssets,
  gallerySlots,
  shopPhotos = [],
  shopPhotosFailed = false,
  backCatalogueCap,
  importableEditorial,
  importableEditorialFailed,
  actions: actionsIn,
}: StylistLibraryEditorProps) {
  const { uploadStylistAsset, importEditorialMediaToGallery, saveStylistColorRanges, deleteStylistAsset } = actionsIn
    ? { ...SHIPPED_ACTIONS, ...actionsIn }
    : SHIPPED_ACTIONS;
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
  // 🌱🖼 One of the shop's own photos instead of a file — the same form, the same server gates.
  const [shopPhotoRef, setShopPhotoRef] = useState<string | null>(null);
  const [shopPickerOpen, setShopPickerOpen] = useState(false);
  const shopPhoto = shopPhotos.find((p) => p.ref === shopPhotoRef) ?? null;
  // 📎 The file picked into the drop box — its name and a local preview, so the box says what it holds.
  const [pickedFile, setPickedFile] = useState<{ name: string; url: string } | null>(null);
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
    // 🔁 The manipulator reports its map from an effect keyed on THIS function, which is new every render — so an
    // unchanged map must not set state, or each report re-renders, re-reports and React stops at "Maximum update
    // depth exceeded" (seen on the 2026-10-19 walk, the moment an upload selected itself).
    setLocalMaps((prev) => (prev[selected.asset_id] === next ? prev : { ...prev, [selected.asset_id]: next }));
  }

  async function handleUpload(form: HTMLFormElement) {
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        // ⚠ NO CLIENT-SIDE WATERMARK HERE — the server marks the authoritative
        // bytes (see the file docblock). Adding one back prints it twice.
        setActionError(null);
        setNotice(null);
        const { assetId, textScreen, colorRanges } = await uploadStylistAsset(formData);
        const label = String(formData.get('label') ?? '');
        const uploadedType = String(
          formData.get('assetType') ?? '',
        ) as StylistAsset['asset_type'];
        const assetSubtype = String(formData.get('assetSubtype') ?? '') || null;
        const file = formData.get('file');
        const blobUrl = shopPhoto ? shopPhoto.url : file instanceof File && file.size > 0 ? URL.createObjectURL(file) : '';
        const placeholder: StylistAsset = {
          asset_id: assetId,
          asset_type: uploadedType,
          asset_subtype: assetSubtype,
          label,
          storage_path: 'pending',
          approved_at: null,
          retired_at: null,
          rejected_at: null,
          rejection_reason: null,
          created_at: new Date().toISOString(),
          source_event_id: null,
          public_url: blobUrl,
          // 🌱🖼 The colours the server read off the photo itself (2026-10-19) — tagged already, adjustable here.
          color_ranges: colorRanges ?? {},
        };
        setAssets((prev) => [placeholder, ...prev]);
        setLocalMaps((prev) => ({ ...prev, [assetId]: colorRanges ?? {} }));
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
        setShopPhotoRef(null);
        pickFile(null);
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
          'Added to Inspiration. Photos from an event you were booked on never count against your back-catalogue allowance.',
        );
      } catch (err) {
        setActionError((err as Error).message);
      }
    });
  }

  /** Keep the drop box's name + preview in step with the file input (null = cleared). */
  function pickFile(file: File | null) {
    setPickedFile((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return file && file.size > 0 ? { name: file.name, url: URL.createObjectURL(file) } : null;
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
            {shopPhoto ? (
              /* 🌱🖼 A photo from the shop itself — sent as its stored ref; the server checks it is this shop's. */
              <div data-library-shop-photo-chosen="" className="flex items-center gap-3">
                <input type="hidden" name="shopPhotoRef" value={shopPhoto.ref} />
                <Image
                  src={shopPhoto.url}
                  alt="The photo from your shop you picked"
                  width={56}
                  height={56}
                  unoptimized
                  className="h-14 w-14 flex-shrink-0 rounded object-cover"
                />
                <span className="min-w-0 flex-1 text-sm text-ink/70">
                  From your shop{shopPhoto.from === 'card' ? ' · a service card' : ' · your page'}
                </span>
                <button
                  type="button"
                  onClick={() => setShopPhotoRef(null)}
                  className="min-h-11 flex-shrink-0 rounded-md border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink"
                >
                  Use a file
                </button>
              </div>
            ) : (
              /* 📎 THE SHIPPED UPLOAD BOX'S LOOK (`app/_components/file-upload.tsx`'s dashed drop box), never the
                 browser's bare "Choose File · no file selected". The input stays a real `name="file"` field of THIS
                 form, so the bytes still travel inside `uploadStylistAsset` and are marked + screened on the server
                 (the file docblock) — `<FileUpload>` itself would send them to storage first, unmarked. */
              <label
                data-library-file-box=""
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  // A file dropped on the box (desktop) joins the same input a tap fills — never a browser navigation.
                  e.preventDefault();
                  const input = e.currentTarget.querySelector<HTMLInputElement>('input[name="file"]');
                  if (!input || e.dataTransfer.files.length === 0) return;
                  input.files = e.dataTransfer.files;
                  pickFile(input.files[0] ?? null);
                }}
                className="flex min-h-[120px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/20 bg-cream px-4 py-6 text-center transition-colors hover:border-terracotta/60 hover:bg-terracotta/[0.03] focus-within:border-terracotta"
              >
                {pickedFile ? (
                  <>
                    <Image
                      src={pickedFile.url}
                      alt="The photo you picked"
                      width={96}
                      height={96}
                      unoptimized
                      className="h-24 w-24 rounded-md object-cover"
                    />
                    <span className="max-w-full truncate text-sm font-medium text-ink/75">{pickedFile.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">Tap to change</span>
                  </>
                ) : (
                  <>
                    <UploadCloud aria-hidden className="h-8 w-8 text-ink/45" strokeWidth={1.5} />
                    <span className="text-sm font-medium text-ink/75">Drop a photo or tap to choose</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                      PNG · JPEG · WEBP · AVIF
                    </span>
                  </>
                )}
                <input
                  name="file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  required
                  onChange={(e) => pickFile(e.currentTarget.files?.[0] ?? null)}
                  className="sr-only"
                />
              </label>
            )}

            {/* 🌱🖼 ADD FROM THE SHOP'S OWN PHOTOS (owner 2026-10-19) — the page gallery and the service cards, beside
                Upload. Picking one only chooses the bytes: the part, the label, the tick, the screen and Setnayan's
                review below are the same as for a file. */}
            {isGalleryUpload && shopPhotosFailed ? (
              <p data-library-shop-photos-failed="" className="text-[11px] text-ink/60">
                We couldn&rsquo;t load your shop&rsquo;s photos just now — reload in a moment, or pick a file.
              </p>
            ) : null}
            {isGalleryUpload && shopPhotos.length > 0 && !shopPhoto ? (
              <div data-library-shop-photos="">
                <button
                  type="button"
                  aria-expanded={shopPickerOpen}
                  onClick={() => setShopPickerOpen((o) => !o)}
                  className="w-full rounded-md border border-ink/20 px-3 py-2 text-sm font-medium text-ink"
                >
                  {shopPickerOpen ? 'Hide your shop’s photos' : `Choose from your shop’s photos (${formatCount(shopPhotos.length)})`}
                </button>
                {shopPickerOpen ? (
                  <ul className="mt-2 grid grid-cols-4 gap-2" aria-label="Your shop’s photos">
                    {shopPhotos.map((p, i) => (
                      <li key={p.ref}>
                        <button
                          type="button"
                          data-library-shop-photo={p.from}
                          onClick={() => {
                            setShopPhotoRef(p.ref);
                            setShopPickerOpen(false);
                          }}
                          className="block w-full overflow-hidden rounded-md border border-ink/15"
                          aria-label={`Use photo ${i + 1} from your ${p.from === 'card' ? 'service cards' : 'page'}`}
                        >
                          <Image src={p.url} alt="" width={80} height={80} unoptimized className="aspect-square h-auto w-full object-cover" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <input
              name="label"
              type="text"
              required
              placeholder="Label (e.g. 'Tagaytay garden setup')"
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:border-terracotta focus:outline-none"
            />
            {/* 🔽 Two dropdowns, one per row at full width (a half-width native select cut "Couples' inspirati…"). Each
                posts through a hidden field of the same name, so `uploadStylistAsset` reads exactly what it did. */}
            <div className="space-y-2">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="shrink-0 text-sm text-ink/65">Goes to</span>
                <input type="hidden" name="assetType" value={assetType} />
                <PickMenu
                  label="Where this photo goes"
                  value={assetType}
                  options={assetTypeOptions(gallerySlots.length > 0)}
                  onPick={(k) => setAssetType(k as StylistAsset['asset_type'])}
                  dataAttr="data-library-asset-type"
                  className="!min-h-11"
                />
              </div>
              {isGalleryUpload ? (
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span className="shrink-0 text-sm text-ink/65">Part</span>
                  <input type="hidden" name="assetSubtype" value={uploadSlot} />
                  <PickMenu
                    label="Which part of the mood board"
                    value={uploadSlot}
                    options={slotOptions(gallerySlots)}
                    onPick={setUploadSlot}
                    dataAttr="data-library-upload-part"
                    stickyGroups
                    className="!min-h-11"
                  />
                </div>
              ) : (
                <input
                  name="assetSubtype"
                  type="text"
                  placeholder="Subtype (e.g. 'reception')"
                  className="min-h-11 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
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
                  ? `You can add ${uploadSlotLabel} photos from events you were booked on, but not from your back catalogue. Those never count against any category.`
                  : `${uploadSlotLabel} back-catalogue photos: ${formatCount(usedInSelectedSlot)} of ${formatCount(backCatalogueCap)} used. Photos from events you were booked on never count, and this cap is per category — your other shelves have their own room.`}
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
            We couldn’t load your photos from events you worked just now.
            They aren’t gone — reload in a moment, or upload from your own files
            below.
          </ShopNotice>
        ) : null}

        {importableEditorial.length > 0 && gallerySlots.length > 0 ? (
          <section className="rounded-xl border border-ink/15 bg-white/70 p-4">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              From events you worked
            </p>
            <p className="mb-3 text-[11px] text-ink/55">
              Your day-of photos from couples who picked you. These never count
              against your back-catalogue allowance.
            </p>
            <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">Add to</span>
              <PickMenu
                label="Add these photos to"
                value={importSlot}
                options={slotOptions(gallerySlots)}
                onPick={setImportSlot}
                dataAttr="data-library-import-part"
                stickyGroups
                className="!min-h-11"
              />
            </div>
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
                    {photo.alreadyImported ? 'Added' : 'Add to Inspiration'}
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
                        {assetWhere(a, gallerySlots)}
                        {' · '}
                        {a.rejected_at
                          ? '✕ not published'
                          : a.approved_at
                            ? '✓ live'
                            : 'draft'}
                        {a.retired_at && !a.rejected_at ? ' · retired' : ''}
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
                  {assetWhere(selected, gallerySlots)} ·{' '}
                  {selected.rejected_at
                    ? '✕ not published'
                    : selected.approved_at
                      ? '✓ approved by Setnayan'
                      : 'draft (pending review)'}
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

            {/* 🔑 MB21 · THE REASON REACHES THE PIXEL. Read off the selected
                asset, never hard-coded — a-rejection-reaches-the-vendor.test.ts
                pins this mount, because a rejection stored and not shown is
                exactly the "pending review forever" this replaced. */}
            <RejectionNotice
              rejectedAt={selected.rejected_at}
              reason={selected.rejection_reason}
            />

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
                Each couple sees their own colours here. Try a few to check your
                tagged areas look right in any palette.
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

/** "Goes to" — the couples' gallery first (when this shop has parts to fill), then the three older shelves. */
function assetTypeOptions(hasGallery: boolean): PickOption[] {
  return [
    ...(hasGallery ? [{ key: SUPPLIER_GALLERY_ASSET_TYPE, label: 'Couples’ Inspiration' }] : []),
    { key: 'venue_scene', label: 'Venue scene' },
    { key: 'figure_attire', label: 'Figure attire' },
    { key: 'florals', label: 'Florals' },
  ];
}

/**
 * The parts, grouped under the couple's headings in the couple's order (Main palette · The room · Flowers · Cake ·
 * Attire · More boards) — PickMenu draws a heading per run of one `group`. A list with no groups (an older caller)
 * draws flat, as it always did.
 */
function slotOptions(slots: StylistLibraryEditorProps['gallerySlots']): PickOption[] {
  const grouped = slots.some((s) => s.group);
  return slots.map((slot) => ({
    key: slot.key,
    label: slot.label,
    ...(grouped ? { group: SLOT_GROUP_LABEL[slot.group ?? 'more'] } : {}),
  }));
}

/** Where a photo sits, in the words the dropdown used ("Chairs"), never the stored key ("supplier_gallery · chairs"). */
function assetWhere(a: StylistAsset, slots: StylistLibraryEditorProps['gallerySlots']): string {
  if (a.asset_type === SUPPLIER_GALLERY_ASSET_TYPE) {
    const part = slots.find((s) => s.key === a.asset_subtype)?.label;
    return part ? `Inspiration · ${part}` : `Inspiration${a.asset_subtype ? ` · ${a.asset_subtype}` : ''}`;
  }
  return `${a.asset_type}${a.asset_subtype ? ` · ${a.asset_subtype}` : ''}`;
}

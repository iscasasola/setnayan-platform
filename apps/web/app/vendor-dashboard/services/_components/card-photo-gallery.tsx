'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { Star, Trash2, X } from 'lucide-react';

import { FileUpload, type GalleryTilesHandle } from '@/app/_components/file-upload';
import { InfoTip } from '@/app/_components/info-tip';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';
import { pushUndo } from '@/app/dashboard/[eventId]/guests/_components/undo-store';
import {
  CARD_MAX_PHOTOS,
  canAddCardPhoto,
  cardPhotoCountLine,
  cardPhotoOrder,
  deleteCardPhoto,
  mergeUploadedPhotos,
  setPrimaryPhoto,
} from '@/lib/card-photos';
import { formatCount } from '@/lib/format-number';

/**
 * 🖼 THE CARD'S PHOTOS ARE ONE GALLERY (owner 2026-11-13: *"Card maker main photo and photos to be added should look
 * like a gallery upload. tapping on a photo will pop up set as primary photo, delete photo. at the end of the uploaded
 * photos will be the photo place holder to upload more photos. if they have placed all photo limit number, then add
 * photo box will disappear"* — DECISION_LOG "CARD MAKER GALLERY UPLOAD APPROVED"; drawing
 * `prototypes/card_maker_gallery_upload_2026-11-13/`).
 *
 * MOVED, NOT INVENTED: the cover (`primary_photo_r2_key`) and the showcase photos (`showcase_photo_r2_keys`, ≤ 5 by the
 * DB CHECK) were two uploaders; they are one 3-across grid now — the PRIMARY first with its tag, the rest after, the add
 * tile last (gone at 6). The uploads are the shipped `FileUpload` (`tiles` mode): its pie, its 45 s stall watchdog and its
 * failed tile ("Couldn’t upload. Try again."). The same two field names post, so the server, the checks and the face
 * read what they always read; `cardPhotoFields` (lib/card-photos.ts) holds the server to the same two rules.
 *
 * Tap a photo → the house sheet: Set as primary photo · Delete photo (danger) · Cancel in its head. On the primary,
 * "Set as primary" is greyed and its reason sits in the ⓘ (T17). Deleting the primary promotes the next photo, said in
 * one line with Undo (the shipped Undo toast the maker already mounts).
 */

/** The section's ⓘ (T17) — every help line the two uploaders used to print, in one place. */
export const CARD_PHOTOS_TIP = `The first photo is the primary — the first thing couples see on the card. Tap a photo to make it primary or delete it. PNG, JPEG or WebP up to 5 MB each; the Setnayan mark is added as it uploads. Up to ${formatCount(CARD_MAX_PHOTOS)} photos.`;
/** The ⓘ once the grid is full — why the add tile is gone. */
export const CARD_PHOTOS_FULL_TIP = `A card holds the primary and ${formatCount(CARD_MAX_PHOTOS - 1)} more. Delete one to add another.`;
/** Why "Set as primary" is greyed on the primary itself. */
export const ALREADY_PRIMARY_TIP =
  'This is the first thing couples see on the card. Open another photo to make that one the primary instead.';
/** The failed tile's words (the shipped `failedSays`). */
export const CARD_PHOTO_FAILED_SAYS = 'Couldn’t upload. Try again.';

export function CardPhotoGallery({
  vendorProfileId,
  primaryCurrent,
  showcaseCurrent,
  displayUrls,
}: {
  vendorProfileId: string;
  /** The stored primary (`primary_photo_r2_key`) when editing; null on a new card. */
  primaryCurrent: string | null;
  /** The stored showcase photos when editing. */
  showcaseCurrent?: readonly string[];
  /** ref → presigned display URL, for photos already saved. */
  displayUrls?: Record<string, string>;
}) {
  const [order, setOrder] = useState<string[]>(() => cardPhotoOrder(primaryCurrent, showcaseCurrent));
  const [open, setOpen] = useState<string | null>(null);
  const handle = useRef<GalleryTilesHandle | null>(null);
  const headId = useId();

  const seed = cardPhotoOrder(primaryCurrent, showcaseCurrent);
  const onUploaded = useCallback((v: string | string[] | null) => {
    const refs = Array.isArray(v) ? v : v ? [v] : [];
    setOrder((o) => mergeUploadedPhotos(o, refs));
  }, []);

  const close = () => setOpen(null);

  function makePrimary(ref: string) {
    const before = order;
    setOrder(setPrimaryPhoto(before, ref));
    close();
    pushUndo({
      label: `Photo ${formatCount(before.indexOf(ref) + 1)} is now the primary.`,
      undo: async () => setOrder(before),
    });
  }

  function remove(ref: string) {
    const before = order;
    const wasPrimary = before[0] === ref;
    const undoUpload = handle.current?.remove(ref) ?? null;
    const { order: next, promoted } = deleteCardPhoto(before, ref);
    setOrder(next);
    close();
    pushUndo({
      label: !wasPrimary
        ? 'Photo deleted'
        : promoted
          ? 'Deleted. The next photo is now the primary.'
          : 'Deleted. The next photo you add will be the primary.',
      undo: async () => {
        undoUpload?.();
        setOrder(before);
      },
    });
  }

  const n = order.length;
  const full = !canAddCardPhoto(n);
  const openIdx = open ? order.indexOf(open) : -1;
  const openIsPrimary = openIdx === 0;
  const openUrl = open ? (displayUrls?.[open] ?? null) : null;

  return (
    <div data-card-photos={full ? 'full' : n ? 'has' : 'empty'}>
      {/* The two stored fields, from the ONE list: the first is the primary, the rest are the showcase. */}
      {order[0] ? <input type="hidden" name="primary_photo_r2_key" value={order[0]} /> : null}
      {order.slice(1).map((ref) => (
        <input key={ref} type="hidden" name="showcase_photo_r2_keys" value={ref} />
      ))}

      <FileUpload
        bucket="media"
        pathPrefix={`vendors/${vendorProfileId}/services/showcase`}
        multiple
        maxFiles={CARD_MAX_PHOTOS}
        maxSizeMB={5}
        acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
        mark="supplier"
        frame="square"
        previews="service-card"
        compressImage
        qrGuard
        variant="gallery"
        failedSays={CARD_PHOTO_FAILED_SAYS}
        currentValue={seed.length ? seed : null}
        initialDisplayUrls={displayUrls}
        onChange={onUploaded}
        tiles={{ order, leadTag: 'Primary', onTap: setOpen, addLabel: 'Add a photo', handle }}
      />

      {n > 0 ? (
        <p data-card-photos-count="" className="flex justify-end pb-1 pt-0.5 text-[12.5px] tabular-nums text-ink/55">
          {cardPhotoCountLine(n)}
        </p>
      ) : null}

      <Sheet
        open={open != null}
        onClose={close}
        labelledById={headId}
        head={
          <div className="flex items-center gap-2.5 border-b border-ink/10 py-1.5 pl-4 pr-2">
            {openUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={openUrl} alt="" className="h-10 w-10 flex-none rounded-lg object-cover" />
            ) : null}
            <span id={headId} className="min-w-0 flex-1 font-semibold text-ink">
              {openIsPrimary ? 'Primary photo' : `Photo ${formatCount(openIdx + 1)} of ${formatCount(n)}`}
              {openIsPrimary ? <small className="block text-[12.5px] font-normal text-ink/55">the first thing couples see</small> : null}
            </span>
            <ActionButton tone="neutral" icon={X} label="Cancel" onClick={close} />
          </div>
        }
      >
        {/* The two verbs as house pills (T19): Set as primary · Delete photo in the danger colour. On the primary,
            "Set as primary" WAITS (grey, still a button, announced unavailable) and its reason is in the ⓘ (T17). */}
        <div data-card-photo-sheet={openIsPrimary ? 'primary' : 'photo'} className="grid gap-2.5 px-4 py-3">
          <div className="flex min-h-[44px] items-center gap-1">
            <ActionButton
              tone="brand"
              icon={Star}
              label="Set as primary photo"
              waiting={openIsPrimary}
              data-card-photo-make-primary=""
              onClick={() => {
                if (open && !openIsPrimary) makePrimary(open);
              }}
            />
            {openIsPrimary ? (
              <InfoTip label="" ariaLabel="Why is Set as primary greyed?" align="end">
                <span className="block font-semibold">Already the primary</span>
                <span className="mt-1 block">{ALREADY_PRIMARY_TIP}</span>
              </InfoTip>
            ) : null}
          </div>
          <div className="flex min-h-[44px] items-center">
            <ActionButton
              tone="danger"
              icon={Trash2}
              label="Delete photo"
              data-card-photo-delete=""
              onClick={() => {
                if (open) remove(open);
              }}
            />
          </div>
        </div>
      </Sheet>
    </div>
  );
}

/**
 * apps/web/lib/venue-picture-choice.ts
 *
 * 🖼 A VENUE CARD'S PICTURE IS THE COUPLE'S CHOICE — the Maker's "Picture ▾", as
 * pure rules (owner 2026-10-16, DECISION_LOG "A VENUE CARD'S PICTURE IS THE
 * COUPLE'S CHOICE"), verbatim: *"on a church you can upload a photo or use our
 * pro feature photos of the venue"*.
 *
 * One dropdown per venue card (Details › Venues, `VenuePhotoPicker` in
 * `details-your-event.tsx` — the shipped photo chooser, extended), listing:
 *   · the booked supplier's photos (shipped, 2026-09-30) and **Your photo** —
 *     the couple's own upload (`VenueChoice.ownPhoto`), or "Upload your photo";
 *   · **Our drawing ◆** — ONLY when the parish library has a drawing of this
 *     venue (`parishDrawingFor`), marked Event Hub Pro (tried free in the draft,
 *     named at Apply — `venueBagNewDrawings` in lib/hub-draft.ts);
 *   · **None**.
 *
 * The photo is the default: the drawing shows only once picked here
 * (`VenueChoice.drawing: true`, in the `venue_map` scene's own `config_json.venue`
 * — no new column). Picking the drawing KEEPS the photo refs, so picking the
 * photo back restores it; picking a photo, an upload or None takes it off.
 *
 * PURE: the client component and the guard (`a-venue-cards-picture-is-the-couples-choice.test.ts`)
 * both call this, so the list a test reads is the list the couple sees.
 */
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import type { VenueChoice } from '@/lib/event-venues';
import type { ParishDrawing } from '@/lib/parish-drawings';
import type { PaidMarkState } from '@/lib/paid-mark';

export const PICTURE_NONE = 'none';
export const PICTURE_UPLOAD = 'upload';
export const PICTURE_DRAWING = 'drawing';

/** Event Hub Pro's mark on "Our drawing" — the house trail (`celebration-pick.tsx`'s), information, never a lock. */
function proTrail(mark: PaidMarkState | null, label: (m: PaidMarkState) => string): PickOption['trail'] {
  if (!mark) return undefined;
  return { text: mark === 'try' ? '◆ Pro' : '◆', tone: 'muted', label: label(mark) };
}

/** The Picture ▾ list, in order. */
export function venuePictureOptions(input: {
  supplierPhotos: readonly string[];
  /** The couple's own uploaded photo for this card, if any. */
  ownRef: string | null;
  /** The library's drawing of this venue, or null — "Our drawing" is listed only with one. */
  drawing: ParishDrawing | null;
  mark: PaidMarkState | null;
  markLabel: (m: PaidMarkState) => string;
  url: (ref: string) => string | null;
}): PickOption[] {
  const { supplierPhotos, ownRef, drawing, mark, markLabel, url } = input;
  const trail = proTrail(mark, markLabel);
  return [
    ...supplierPhotos.map((ref, i) => ({
      key: ref,
      label: supplierPhotos.length > 1 ? `Supplier’s photo ${i + 1}` : 'Supplier’s photo',
      thumb: url(ref) ?? undefined,
    })),
    ...(ownRef ? [{ key: ownRef, label: 'Your photo', thumb: url(ownRef) ?? undefined }] : []),
    { key: PICTURE_UPLOAD, label: ownRef ? 'Upload a different photo' : 'Upload your photo' },
    ...(drawing ? [{ key: PICTURE_DRAWING, label: 'Our drawing', thumb: drawing.webp, ...(trail ? { trail } : {}) }] : []),
    { key: PICTURE_NONE, label: 'None' },
  ];
}

/** Is the drawing what this card shows? Only where it was PICKED and the library has one. */
export function venueDrawingShown(choice: VenueChoice, drawing: ParishDrawing | null): boolean {
  return Boolean(drawing) && choice.drawing === true;
}

/** The choice with the drawing taken off — what a photo, an upload or None builds on. */
export function withoutDrawing(choice: VenueChoice): VenueChoice {
  const { drawing: _drawing, ...rest } = choice;
  void _drawing;
  return rest;
}

/**
 * The card's next choice for a pick of `key` (never `PICTURE_UPLOAD`, which
 * opens the uploader and picks nothing yet). `own` = the card is on the
 * couple's own details (its photo is `ownPhoto`), else the supplier's
 * (`supplierPhoto`).
 */
export function pickVenuePicture(choice: VenueChoice, key: string, own: boolean): VenueChoice {
  if (key === PICTURE_DRAWING) return { ...choice, drawing: true };
  const ref = key === PICTURE_NONE ? null : key;
  const base = withoutDrawing(choice);
  return own ? { ...base, ownPhoto: ref } : { ...base, supplierPhoto: ref };
}

/** A fresh upload — a pick of the photo: it takes the drawing off. */
export function uploadedVenuePicture(choice: VenueChoice, ref: string, own: boolean): VenueChoice {
  const base = withoutDrawing(choice);
  return own ? { ...base, ownPhoto: ref } : { ...base, ownPhoto: ref, supplierPhoto: ref };
}

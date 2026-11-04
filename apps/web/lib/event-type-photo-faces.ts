/**
 * Where the faces are in each repo event-type photo (`public/event-types/<key>.webp`).
 *
 * The launcher card and the event-dashboard band show these 4:5 photos as a wide strip
 * — as little as a fifth of the photo's height. Without knowing where the people are,
 * the strip showed bodies with no heads (measured 2026-11-04 on the owner's 4 Nov
 * renders: 13 of 17 types lost heads in most framings). `faceFramedObjectPosition()`
 * in `lib/event-card-art.ts` reads this table to keep the span inside the strip.
 *
 * Each span is `[top, bottom]` as a share of the photo's height: from the top of the
 * highest main head (hair included) to the lowest main chin. Read by eye from the
 * 880×1100 files on a 5 % grid. Background people are left out.
 *
 * ⚠ THESE NUMBERS BELONG TO THE FILES. Replacing a photo means re-measuring its row —
 * `event-type-photo-faces.test.ts` fails when a file has no row or a row has no file.
 * It cannot tell a stale row from a fresh one, so re-measure whenever a file changes.
 */
export type FaceSpan = readonly [top: number, bottom: number];

export const EVENT_TYPE_PHOTO_FACES: Readonly<Record<string, FaceSpan>> = {
  anniversary: [0.13, 0.28],
  birthday: [0.13, 0.33],
  celebration: [0.05, 0.17],
  christening: [0.28, 0.46],
  corporate: [0.15, 0.31],
  date: [0.15, 0.31],
  debut: [0.13, 0.24],
  gala_night: [0.16, 0.42],
  gender_reveal: [0.01, 0.25],
  graduation: [0.1, 0.36],
  hangout: [0.13, 0.32],
  reunion: [0.26, 0.43],
  simple_event: [0.15, 0.36],
  tournament: [0.14, 0.38],
  travel: [0.09, 0.24],
  // Two people a long way apart: the man standing (0.04–0.17), the woman seated
  // (0.27–0.43). A strip too short for both keeps the top, so the man's face shows.
  wake: [0.04, 0.43],
  wedding: [0.05, 0.17],
};

/** Height ÷ width of every repo event-type photo (880×1100). */
export const EVENT_TYPE_PHOTO_ASPECT = 1100 / 880;

/**
 * The face span for the photo actually drawn, or null. Only the REPO file has a
 * measured span: an admin-uploaded `hero_photo_url` is a different picture, so it
 * keeps the old per-event crop.
 */
export function faceSpanForTypePhoto(eventType: string, photoSrc: string): FaceSpan | null {
  if (photoSrc !== `/event-types/${eventType}.webp`) return null;
  return Object.prototype.hasOwnProperty.call(EVENT_TYPE_PHOTO_FACES, eventType)
    ? EVENT_TYPE_PHOTO_FACES[eventType]!
    : null;
}

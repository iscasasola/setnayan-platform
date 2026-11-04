/**
 * front-page-photos.ts — where the 4 Nov 2026 marketing photos live, and which event types have one.
 *
 * The owner's Soul 2.0 renders for the three marketing pages (DECISION_LOG 2026-11-04, "THE THREE
 * MARKETING PAGES GO TO CLOUD BUILD") sit in ONE folder, `public/marketing/2026-11-04/<key>.webp`, named
 * by the prototype's `data-p` key and already cropped to their slot. The front page, /for-suppliers and
 * /for-coordinators each copy in only the keys they draw, so the folder is shared.
 *
 * 🔑 THE EVENT-TYPE STRIP READS ITS TYPES FROM `event_type_vocab` (the reader `/start` uses), never from
 * a list here. This file only answers "is there a photo for this key?", so an eighteenth type an admin
 * launches tomorrow shows as a plain tile instead of a broken image. The keys are DB keys, not copy —
 * which is why they live here and not beside the front door's copy (its house-word guard reads every
 * string in that folder, and `celebration` is a real `event_type_vocab` key).
 */

/** The shared folder, as a public path. */
export const MARKETING_PHOTO_ROOT = '/marketing/2026-11-04';

/** A photo's public path from its prototype key (`hero-wedding` → `/marketing/2026-11-04/hero-wedding.webp`). */
export function marketingPhoto(key: string): string {
  return `${MARKETING_PHOTO_ROOT}/${key}.webp`;
}

/** `event_type_vocab.event_type` keys that have an `et-<key>` photo in the folder (underscores become dashes). */
const EVENT_TYPE_PHOTO_KEYS: ReadonlySet<string> = new Set([
  'wedding',
  'debut',
  'christening',
  'birthday',
  'anniversary',
  'reunion',
  'corporate',
  'gala_night',
  'graduation',
  'gender_reveal',
  'tournament',
  'travel',
  'date',
  'hangout',
  'celebration',
  'simple_event',
  'wake',
]);

/** The strip photo for an event type, or null when none was made for it. */
export function eventTypePhoto(key: string): string | null {
  return EVENT_TYPE_PHOTO_KEYS.has(key) ? marketingPhoto(`et-${key.replace(/_/g, '-')}`) : null;
}

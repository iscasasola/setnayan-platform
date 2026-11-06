// Event-type roster — TYPES + FALLBACK ONLY since the 2026-06-13 DB cutover.
//
// The live roster now comes from the `event_type_vocab` table (admin CRUD at
// /admin/event-types in Setnayan HQ) via `lib/event-types-db.ts`
// (`getEventTypeVocab()` / `getCreatableEventTypes()`). Server components
// fetch it and thread rows into the client pickers as props:
//   - /dashboard/create-event page → EventTypePicker → EventTypePhotoPicker
//
// This file keeps (a) the shared row shape the client picker consumes and
// (b) EVENT_TYPES_FALLBACK — the pre-cutover hardcoded roster, used ONLY when
// the vocab read fails or returns empty (lib/event-types-db.ts SAFETY
// contract, mirroring lib/taxonomy-db.ts). Do NOT add new types here: create
// them from /admin/event-types instead — that's the whole point.
//
// History: the V1 tile list was locked 2026-05-16, all nine types unlocked
// 2026-06-03, `onboardingHref` straight-jump added 2026-06-04 (wedding →
// /onboarding/wedding; others fall back to the inline name form). That exact
// state is what the fallback — and the 20261204000000 vocab seed — preserve.

import { hashToHue } from '@/lib/event-card-art';

export type EventTypeRow = {
  /** vocab key (event_type_vocab.event_type) — `^[a-z][a-z0-9_]{2,30}$`. */
  key: string;
  label: string;
  emoji: string;
  /** TRUE = pickable in the couple-side create-event surfaces. */
  enabled: boolean;
  /** Tailored-onboarding jump (e.g. /onboarding/wedding). NULL = inline name form. */
  onboardingHref: string | null;
  /** Admin-uploaded hero photo URL. NULL → /event-types/{key}.webp → generic fallback. */
  heroPhotoUrl?: string | null;
  /** One-line tagline on the picker card. */
  description?: string | null;
  /**
   * WHO this type can be FOR on the grid's "For ▾" (`event_type_vocab.for_whom`,
   * admin-edited on Admin › Categories › Event types). `self` · `someone` ·
   * `memorial` · `business`. Absent / NULL (the fallback roster, a row read before
   * the column existed) = unknown → the type shows for every answer (fail open).
   */
  forWhom?: readonly string[] | null;
};

/** Vocab keys are admin-created free strings now, not a closed union. */
export type EventTypeKey = string;

export const EVENT_TYPES_FALLBACK: readonly EventTypeRow[] = [
  { key: 'wedding', label: 'Wedding', emoji: '💍', enabled: true, onboardingHref: '/onboarding/wedding', description: 'The day you say “I do.”' },
  { key: 'debut', label: 'Debut', emoji: '👑', enabled: true, onboardingHref: null, description: 'Her grand eighteenth.' },
  { key: 'gender_reveal', label: 'Gender Reveal', emoji: '🎈', enabled: true, onboardingHref: null, description: 'Pink or blue?' },
  { key: 'birthday', label: 'Birthday', emoji: '🎂', enabled: true, onboardingHref: null, description: 'Another year, celebrated.' },
  { key: 'celebration', label: 'Celebration', emoji: '🥂', enabled: true, onboardingHref: null, description: 'Moments worth gathering for.' },
  { key: 'travel', label: 'Travel', emoji: '✈️', enabled: true, onboardingHref: null, description: 'The trip you’ll always remember.' },
  { key: 'corporate', label: 'Corporate', emoji: '🏢', enabled: true, onboardingHref: null, description: 'Where your brand shines.' },
  { key: 'tournament', label: 'Tournament', emoji: '🏆', enabled: true, onboardingHref: null, description: 'Game day, elevated.' },
  { key: 'christening', label: 'Christening', emoji: '🕯️', enabled: true, onboardingHref: null, description: 'A blessing to remember.' },
];

/**
 * Where a tapped type goes — THE ONE RULE, shared by the signed-in picker
 * (`event-type-picker.tsx`) and the public `/start` picker (owner 2026-10-25:
 * "Start your event — free" asks which event BEFORE sign-up). A type's own
 * onboarding page wins; otherwise a non-wedding type takes the generic
 * `/onboarding/<type>` while that flow is switched on. `null` = no onboarding
 * route, and the caller decides (the signed-in picker shows its inline form).
 */
export function onboardingRouteFor(
  t: Pick<EventTypeRow, 'key' | 'onboardingHref'>,
  experienceQuizOn: boolean,
): string | null {
  if (t.onboardingHref) return t.onboardingHref;
  if (experienceQuizOn && t.key !== 'wedding') return `/onboarding/${t.key}`;
  return null;
}

/**
 * Where a tile on the PUBLIC `/start` picker goes — always the type's own
 * onboarding, never sign-up first. Owner 2026-10-25, verbatim: *"Yes they can
 * create an event. But saving an event must link by logging in."* So the
 * questions run with no account and each onboarding keeps its own account gate
 * at the save. Same rule as the signed-in picker; the `/onboarding/<type>`
 * fallback only matters while the generic flow is switched off, and it is ON in
 * production (measured 2026-10-25: /onboarding/debut · birthday · wake ·
 * concert · grand_opening all 200 signed out).
 */
export function startHrefFor(t: Pick<EventTypeRow, 'key' | 'onboardingHref'>, experienceQuizOn: boolean): string {
  return onboardingRouteFor(t, experienceQuizOn) ?? `/onboarding/${t.key}`;
}

/** Hero-photo resolution shared by both pickers: admin upload → repo asset. */
export function eventTypePhotoSrc(t: Pick<EventTypeRow, 'key' | 'heroPhotoUrl'>): string {
  return t.heroPhotoUrl ?? `/event-types/${t.key}.webp`;
}

/**
 * THE FOCAL POINT PER TYPE — where the faces are in each repo event-type photo
 * (`public/event-types/<key>.webp`), kept beside `eventTypePhotoSrc` because the
 * numbers belong to those files.
 *
 * The launcher card and the event-dashboard band show these 4:5 photos as a wide strip
 * — as little as a fifth of the photo's height. Without knowing where the people are,
 * the strip showed bodies with no heads (measured 2026-11-04 on the owner's 4 Nov
 * renders: 13 of 17 types lost heads in most framings). `faceFramedObjectPosition()`
 * in `lib/event-card-art.ts` reads this table, through `EventScene`, to keep the span inside the strip.
 *
 * Each span is `[top, bottom]` as a share of the photo's height: from the top of the
 * highest main head (hair included) to the lowest main chin. Read by eye from the
 * 880×1100 files on a 5 % grid. Background people are left out.
 *
 * ⚠ THESE NUMBERS BELONG TO THE FILES. Replacing a photo means re-measuring its row —
 * `lib/event-type-photo-faces.test.ts` fails when a file has no row or a row has no file.
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

/** Last-resort hero when neither an upload nor a repo asset exists.
 *  @deprecated Pickers now render a branded placeholder tile
 *  (eventTypePlaceholderGradient) instead of standing in a wrong photo. Kept
 *  exported for back-compat with any external importer. */
export const EVENT_TYPE_PHOTO_FALLBACK = '/event-types/wedding.webp';

/**
 * Deterministic, on-brand gradient for an event type that has NO hero photo yet
 * (a newly-enabled or admin-created type with no repo asset and no upload). The
 * pickers render this behind the type emoji instead of falling back to
 * wedding.webp — so the roster never shows the same photo twice, and every
 * future admin type looks intentional the moment it is created.
 *
 * The hue is hashed from the key so each type gets a distinct but always dark,
 * warm-muted tile that keeps the white serif label legible and sits cohesively
 * next to the real feel-photos.
 *
 * The hash itself now lives in `lib/event-card-art.ts` alongside the per-EVENT
 * derivation that reuses the idiom, rather than being copied into both. The
 * arithmetic is byte-identical, so every existing type gradient renders
 * unchanged — `event-card-art.test.ts` pins that against the original.
 */
export function eventTypePlaceholderGradient(key: string): string {
  const h = hashToHue(key);
  const h2 = (h + 26) % 360;
  return `linear-gradient(155deg, hsl(${h} 32% 34%) 0%, hsl(${h2} 30% 23%) 48%, #1B1A17 100%)`;
}

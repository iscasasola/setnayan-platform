// Event-type roster — TYPES + FALLBACK ONLY since the 2026-06-13 DB cutover.
//
// The live roster now comes from the `event_type_vocab` table (admin CRUD at
// /admin/event-types in Setnayan HQ) via `lib/event-types-db.ts`
// (`getEventTypeVocab()` / `getCreatableEventTypes()`). Server components
// fetch it and thread rows into the client pickers as props:
//   - /dashboard/create-event page → EventTypePicker → EventTypePhotoPicker
//   - the four chrome layouts → EventSwitcher → EventTypeCarousel
//
// This file keeps (a) the shared row shape both client pickers consume and
// (b) EVENT_TYPES_FALLBACK — the pre-cutover hardcoded roster, used ONLY when
// the vocab read fails or returns empty (lib/event-types-db.ts SAFETY
// contract, mirroring lib/taxonomy-db.ts). Do NOT add new types here: create
// them from /admin/event-types instead — that's the whole point.
//
// History: the V1 tile list was locked 2026-05-16, all nine types unlocked
// 2026-06-03, `onboardingHref` straight-jump added 2026-06-04 (wedding →
// /onboarding/wedding; others fall back to the inline name form). That exact
// state is what the fallback — and the 20261204000000 vocab seed — preserve.

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

/** Hero-photo resolution shared by both pickers: admin upload → repo asset. */
export function eventTypePhotoSrc(t: Pick<EventTypeRow, 'key' | 'heroPhotoUrl'>): string {
  return t.heroPhotoUrl ?? `/event-types/${t.key}.webp`;
}

/** Last-resort hero when neither an upload nor a repo asset exists. */
export const EVENT_TYPE_PHOTO_FALLBACK = '/event-types/wedding.webp';

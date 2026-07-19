/**
 * Person-spine · Phase 2 · LIFE STORIES — feature flag + read-model helpers.
 *
 * ⚠ PHASE 2 IS COUNSEL-GATED. `personLifeStoriesEnabled()` defaults OFF. The
 * assembly flow that multi-homes a shared event photo / 5s clip / editorial
 * into every PARTICIPANT's own archive is guarded by this flag, so it is INERT
 * in production and stores/surfaces NO cross-event participant media until PH
 * counsel signs off and the owner sets `NEXT_PUBLIC_PERSON_LIFE_STORIES=1` as a
 * Vercel project env var. Mirrors the Phase-2 connections flag posture
 * (`peopleConnectionsEnabled()`, PR #2823).
 * Plan: 03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md §9 + §12.
 *
 * HARD-LOCKED CONSTRAINTS this module encodes (do NOT relax without the owner):
 *  - Assembled from TAGS + QR + CONFIRMED IDENTITY only — NEVER cross-event face
 *    recognition. `StoryOrigin` has no face value by construction.
 *  - REFERENCES, not copies — a story item is a soft ref into the R2 system of
 *    record (source_table + source_id), never a media copy.
 *  - A participant can HIDE any item from THEIR story without affecting the host
 *    gallery (`hidden_at` is per-person, on the person_story_items row only).
 *  - Opt-out / face-blur REMOVE the person (`removed_at` tombstone).
 *  - Editorials propagate only on host publish + the consented-guest gate
 *    (`origin: 'editorial_publish'` rows require `consented_at`).
 *  - Adults-first.
 */

/** How a person got linked to an item — TAGS + QR + CONFIRMED IDENTITY ONLY.
 *  `auto_face` is deliberately ABSENT: no cross-event face recognition. */
export type StoryOrigin =
  | 'individual_qr'
  | 'table_qr'
  | 'manual_pick'
  | 'confirmed_guest'
  | 'editorial_publish';

export type StoryItemKind = 'photo' | 'clip' | 'editorial';

/** The system-of-record tables a story item may reference (never copy from). */
export type StorySourceTable = 'papic_photos' | 'papic_guest_captures' | 'event_editorial';

export type StoryRemovedReason = 'opt_out' | 'face_blur' | 'admin';

/** A single reference in a person's lifelong archive. Holds a ref, not media. */
export type PersonStoryItem = {
  storyItemId: string;
  personId: string;
  eventId: string;
  itemKind: StoryItemKind;
  sourceTable: StorySourceTable;
  sourceId: string;
  origin: StoryOrigin;
  consentedAt: string | null;
  hiddenAt: string | null;
  removedAt: string | null;
  createdAt: string;
};

/** The origins allowed to seed a photo/clip life-story item. (Editorial uses
 *  only `editorial_publish`.) Excludes any face-derived origin by construction. */
export const MEDIA_STORY_ORIGINS: StoryOrigin[] = [
  'individual_qr',
  'table_qr',
  'manual_pick',
  'confirmed_guest',
];

/** Map a Papic photo_tags.source to the life-story origin. Returns null for
 *  'auto_face' — face-derived tags NEVER seed a cross-event life story. */
export function originFromPhotoTagSource(
  tagSource: 'individual_qr' | 'table_qr' | 'auto_face' | 'manual_pick',
): StoryOrigin | null {
  switch (tagSource) {
    case 'individual_qr':
      return 'individual_qr';
    case 'table_qr':
      return 'table_qr';
    case 'manual_pick':
      return 'manual_pick';
    case 'auto_face':
      // Cross-event face recognition boundary — a face-matched tag is per-event
      // only and must NOT propagate into a lifelong story.
      return null;
  }
}

/** True only when a person_story_items row is live (not hidden, not removed). */
export function isStoryItemLive(item: Pick<PersonStoryItem, 'hiddenAt' | 'removedAt'>): boolean {
  return item.hiddenAt === null && item.removedAt === null;
}

/**
 * OFF until PH counsel clears Phase 2 and the owner flips the env flag. Kept as a
 * function (not a module const) so it's re-read per request rather than captured.
 */
export function personLifeStoriesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PERSON_LIFE_STORIES === '1';
}

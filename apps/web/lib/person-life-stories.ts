import { createAdminClient } from '@/lib/supabase/admin';
import { filterPubliclyVisibleEvents } from '@/lib/public-profile';

/**
 * Person-spine · Phase 2 · LIFE STORIES — feature flag + read-model helpers.
 *
 * ⚠ ONE CONDITION LEFT, NOT TWO — corrected 2026-08-13. This block used to read
 * "PHASE 2 IS COUNSEL-GATED … until PH counsel signs off AND the owner sets
 * NEXT_PUBLIC_PERSON_LIFE_STORIES=1". The first condition was discharged by the
 * OWNER'S OWN RULING ("allow it. unblock it."), which he is entitled to make as
 * the registered DPO (Indalecio Sacdalan Casasola II, NPC-registered
 * 2026-07-07). ⚖ NO EXTERNAL PH COUNSEL OPINION EXISTS FOR PHASE 2, and nothing
 * in this codebase should be read as claiming one — a future reader would act
 * on the stronger claim. What remains is the env var, and it is his to set as a
 * Vercel project variable. `personLifeStoriesEnabled()` still defaults OFF, so
 * the assembly flow and every read stay INERT in production until he does.
 * Mirrors the Phase-2 connections flag posture (`peopleConnectionsEnabled()`,
 * PR #2823).
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
 * OFF until the owner flips the env flag. Kept as a function (not a module
 * const) so it's re-read per request rather than captured.
 *
 * ⚖ AUTHORITY, RECORDED HONESTLY (2026-08-13). The docblock at the top of this
 * file said the flow stays inert until "PH counsel signs off AND the owner sets
 * NEXT_PUBLIC_PERSON_LIFE_STORIES=1" — two conditions. The first was cleared by
 * the OWNER'S OWN RULING ("allow it. unblock it."), not by outside counsel. He
 * is entitled to make it: he is the registered DPO (Indalecio Sacdalan Casasola
 * II, NPC-registered 2026-07-07). No external PH counsel opinion exists for
 * Phase 2, and nothing here should be read as claiming one. The remaining
 * condition is the env var, and it is his to set in Vercel.
 */
export function personLifeStoriesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PERSON_LIFE_STORIES === '1';
}

// ---------------------------------------------------------------------------
// MUTUAL STORY DAYS — "the days you were both there".
//
// Opening somebody's public profile, a signed-in visitor sees the celebrations
// the two of them were BOTH at. This is the intersection of two things that
// already ship: the Alaala "Attended"/"With me" lenses, and this module's
// per-person story items.
//
// 🔒 THE PRIVACY RULE IS THE DESIGN, NOT A FOOTNOTE.
// A day appears ONLY when BOTH people are ALREADY VISIBLE IN IT — their story
// item is consented, live (not hidden, not removed), and the event itself is
// publicly visible. Consequences that make this safe rather than merely
// careful:
//   • It can only ever show what was already shown. No new fact about either
//     person's whereabouts is published by this feature.
//   • It is SYMMETRIC BY CONSTRUCTION (a set intersection), so if EITHER person
//     hides or opts out, the day leaves BOTH pages in the same instant.
//   • The only person who learns anything is the signed-in viewer, and the day
//     is one they were at themselves.
//
// 🚫 NEVER DERIVED FROM A GUEST LIST. `event_members` / `guests` say who was
// INVITED, which is private and stays private. Presence here comes only from
// consented story items. Without that rule this feature is an attendance-
// disclosure engine — the same family as the slug-forwarding leak, where a 307
// disclosed in its Location header whatever the target then returned.
//
// 🚫 AND NEVER FROM A FACE. `StoryOrigin` has no face-derived value by
// construction (see originFromPhotoTagSource) — tags, QR and confirmed identity
// only. Do not add one.
// ---------------------------------------------------------------------------

/** The gate-bearing columns of a person_story_items row. Presence, not media. */
export type StoryPresenceRow = {
  person_id: string;
  event_id: string;
  consented_at: string | null;
  hidden_at: string | null;
  removed_at: string | null;
};

/**
 * "Is this person ALREADY VISIBLE in that day?" — the per-row half of the rule.
 *
 * Live (isStoryItemLive) AND consented. Consent is what makes a co-presence
 * publishable at all: `consented_at` is NULL for a media row whose person never
 * cleared the photo-consent gate, and such a row must stay in that person's own
 * private archive and never surface on anybody's public page.
 */
export function isPubliclyVisiblePresence(row: StoryPresenceRow): boolean {
  return isStoryItemLive({ hiddenAt: row.hidden_at, removedAt: row.removed_at })
    && row.consented_at !== null;
}

/**
 * THE RULE, pure and symmetric: the event ids where BOTH people are already
 * visible. A set intersection — swapping the two person ids cannot change the
 * answer, which is what makes "if either hides, the day leaves BOTH pages" a
 * property of the shape rather than a promise in a comment.
 *
 * Re-checks `isPubliclyVisiblePresence` on every row even though the query also
 * filters: if a query filter is ever dropped, this still refuses. The pure rule
 * is the authority; the SQL filter is only an optimisation.
 *
 * Returns ids sorted, so callers are deterministic before they sort by date.
 */
export function mutualStoryEventIds(
  rows: StoryPresenceRow[],
  personIdA: string,
  personIdB: string,
): string[] {
  if (personIdA === personIdB) return [];
  const seenBy = (personId: string) => {
    const out = new Set<string>();
    for (const r of rows) {
      if (r.person_id !== personId) continue;
      if (!isPubliclyVisiblePresence(r)) continue;
      out.add(r.event_id);
    }
    return out;
  };
  const a = seenBy(personIdA);
  const b = seenBy(personIdB);
  return [...a].filter((eventId) => b.has(eventId)).sort();
}

/** One shared day, as the profile page renders it. */
export type MutualStoryDay = {
  eventId: string;
  slug: string;
  displayName: string | null;
  eventDate: string | null;
  venueName: string | null;
  eventType: string | null;
};

type MutualEventRow = {
  event_id: string;
  slug: string | null;
  display_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  event_type: string | null;
  landing_page_visibility: 'public' | 'unlisted' | 'private' | null;
  scheduled_launch_at: string | null;
};

/** Newest first; undated last; event id breaks ties so the order is stable. */
export function sortMutualDays(days: MutualStoryDay[]): MutualStoryDay[] {
  return [...days].sort((x, y) => {
    const dx = x.eventDate ?? '';
    const dy = y.eventDate ?? '';
    if (dx !== dy) {
      if (!dx) return 1;
      if (!dy) return -1;
      return dy.localeCompare(dx);
    }
    return x.eventId.localeCompare(y.eventId);
  });
}

/**
 * READ MODEL — the days `viewerUserId` and `profileUserId` were both at.
 *
 * ⚠ RLS IS A FLOOR, NOT A SCOPE — this reads through the ADMIN client on
 * purpose, and every scope is applied HERE. `person_story_items`' only policy is
 * `is_admin() OR the person is claimed by auth.uid()`. Two reasons the caller's
 * own session cannot do this job: it can never see the OTHER person's rows (so
 * the intersection would always be empty), and prod has an account that IS an
 * admin — the owner's — for whom that policy matches every row in the table. A
 * read leaning on it would be correctly scoped for everyone except the one
 * person most likely to look. Same trap as the vendor correction-requests card.
 *
 * FAILS CLOSED. Every read error returns [] — this is a disclosure surface, and
 * an error must never widen it.
 *
 * `adminClient` is injectable so a test can drive the real control flow (filters
 * included) without a database; production always gets createAdminClient().
 */
export async function resolveMutualStoryDays(input: {
  viewerUserId: string;
  profileUserId: string;
  adminClient?: ReturnType<typeof createAdminClient>;
}): Promise<MutualStoryDay[]> {
  if (!personLifeStoriesEnabled()) return [];
  const { viewerUserId, profileUserId } = input;
  // Your own page: "the days you were both there" is every day you were there.
  if (!viewerUserId || !profileUserId || viewerUserId === profileUserId) return [];

  const admin = input.adminClient ?? createAdminClient();

  // The two person nodes. A person node is what a story item hangs off; an
  // account with none simply has no story, which reads as "no shared days yet".
  const { data: peopleRows, error: peopleErr } = await admin
    .from('people')
    .select('person_id,claimed_by_user_id')
    .in('claimed_by_user_id', [viewerUserId, profileUserId])
    .is('deleted_at', null);
  if (peopleErr || !peopleRows) return [];

  const personOf = (userId: string) =>
    (peopleRows as { person_id: string; claimed_by_user_id: string }[]).find(
      (p) => p.claimed_by_user_id === userId,
    )?.person_id ?? null;
  const viewerPersonId = personOf(viewerUserId);
  const profilePersonId = personOf(profileUserId);
  if (!viewerPersonId || !profilePersonId) return [];
  if (viewerPersonId === profilePersonId) return [];

  // Presence rows for BOTH people in one read. The filters mirror
  // isPubliclyVisiblePresence; the pure rule re-checks them below.
  const { data: presence, error: presenceErr } = await admin
    .from('person_story_items')
    .select('person_id,event_id,consented_at,hidden_at,removed_at')
    .in('person_id', [viewerPersonId, profilePersonId])
    .is('hidden_at', null)
    .is('removed_at', null)
    .not('consented_at', 'is', null);
  if (presenceErr || !presence) return [];

  const eventIds = mutualStoryEventIds(
    presence as StoryPresenceRow[],
    viewerPersonId,
    profilePersonId,
  );
  if (eventIds.length === 0) return [];

  const { data: events, error: eventsErr } = await admin
    .from('events')
    .select(
      'event_id,slug,display_name,event_date,venue_name,event_type,landing_page_visibility,scheduled_launch_at',
    )
    .in('event_id', eventIds);
  if (eventsErr || !events) return [];

  // The event half of the rule — the SAME gate /[slug] and the public profile
  // apply, asked once, in one place.
  const visible = await filterPubliclyVisibleEvents(events as MutualEventRow[]);

  return sortMutualDays(
    visible.map((e) => ({
      eventId: e.event_id,
      slug: e.slug as string,
      displayName: e.display_name,
      eventDate: e.event_date,
      venueName: e.venue_name,
      eventType: e.event_type,
    })),
  );
}

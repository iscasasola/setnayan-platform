// ============================================================================
// Library › Editorials — cross-event data layer
// ============================================================================
// Server-only. Gathers every event editorial the signed-in user is "part of"
// and resolves it to a flat list of display cards for the Library Editorials
// tab. Two membership classes, two visibility gates:
//
//   OWNED    — member_type='couple' OR an accepted, non-removed event_moderator.
//              Their own editorial ALWAYS surfaces (draft + published), so the
//              host can find + edit it from the cross-event hub.
//   ATTENDED — member_type='guest'. Surfaces ONLY when the editorial is
//              status='published' AND the event's landing_page_visibility is
//              not 'private' — i.e. exactly the same visibility as the public
//              /[slug] link the guest could already open (the looser, owner-
//              chosen gate). Nothing else attended ever surfaces.
//
// WHY the admin client: event_editorial has NO guest/public RLS read policy
// (only couple/moderator/admin — supabase/migrations/
// 20260912000000_wedding_website_lifecycle_foundation.sql). A guest reading
// their host's editorial under their own session would see nothing, so we read
// via createAdminClient and enforce the gate in app code. This mirrors how
// app/[slug]/_components/editorial/data.ts (loadEditorialData) and
// lib/showcase-db.ts (loadPublishedShowcases) read these rows.
//
// Best-effort: every step degrades to a neutral default ([] / draft-only) on a
// missing table/column or thrown error so the tab never crashes the page.
// ============================================================================

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { resolveStillRef } from '@/lib/papic-display-ref';
import { fetchUserEvents } from '@/lib/events';

/** A single editorial the user can see, ready to render as a card. */
export type LibraryEditorial = {
  eventId: string;
  /** The couple/event display name, e.g. "Maria & Juan". */
  displayName: string;
  eventDate: string | null; // ISO
  monogramColor: string | null;
  /** Public slug — present only when the page has one; powers the /[slug] link. */
  slug: string | null;
  published: boolean;
  /** How the user relates to this event — drives the section split + links. */
  relation: 'owned' | 'attended';
  /** Presigned hero still for the card thumbnail, or null. */
  heroImageUrl: string | null;
};

export type LibraryEditorials = {
  owned: LibraryEditorial[];
  attended: LibraryEditorial[];
};

// Visibility values the couple keeps PRIVATE (no public link). The attended
// gate excludes these; 'public' + 'unlisted' both expose the /[slug] page, so
// both pass — matching loadPublishedShowcases' `!= 'private'` rule.
const PRIVATE_VISIBILITY = 'private';

type EventEditorialRow = {
  event_id: string;
  status: string | null;
  hero_photo_id: string | null;
};

type EventMetaRow = {
  event_id: string;
  slug: string | null;
  landing_page_visibility: string | null;
  monogram_color: string | null;
  landing_page_hero_image_url: string | null;
};

/**
 * Resolve every editorial the given user is part of, split into owned vs
 * attended sections. Never throws.
 */
export async function fetchLibraryEditorials(
  userId: string,
): Promise<LibraryEditorials> {
  const empty: LibraryEditorials = { owned: [], attended: [] };

  // 1. Membership across every event (RLS-scoped, under the user's session).
  //    fetchUserEvents returns member_type per event ('couple' = owned,
  //    'guest' = attended). It graceful-degrades to [] on any error.
  let supabase: SupabaseClient;
  try {
    supabase = await createClient();
  } catch {
    return empty;
  }

  const events = await fetchUserEvents(supabase, userId);
  if (events.length === 0) {
    // The user may still be an accepted moderator on events where they're not
    // an event_members row — fall through to the moderator read below.
  }

  // 1b. Accepted, non-removed moderator events also count as OWNED (the host-
  //     invite path writes only event_moderators, never event_members — see
  //     lib/events.ts resolvePrimaryHostEvent + lib/slug-access.ts). Read via
  //     admin because event_moderators RLS is restrictive in V1.2 Phase A.
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    // No admin client → we can't read editorial rows at all (they're behind
    // RLS the user can't satisfy for attended events, and we'd need it for the
    // moderator set too). Degrade to empty rather than a partial, confusing view.
    return empty;
  }

  const moderatorEventIds = new Set<string>();
  try {
    const { data } = await admin
      .from('event_moderators')
      .select('event_id')
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .is('removed_at', null);
    for (const r of (data ?? []) as Array<{ event_id: string | null }>) {
      if (r.event_id) moderatorEventIds.add(r.event_id);
    }
  } catch {
    // moderator table missing / read error → just no extra owned events.
  }

  // 2. Classify each event as owned vs attended. Owned wins on overlap (a
  //    couple who is also a guest row, or a moderator, is still the owner).
  const ownedIds = new Set<string>(moderatorEventIds);
  const attendedIds = new Set<string>();
  // Keep the richest event metadata we have from the membership read so the
  // card has a display name + date even before the admin event read.
  const eventMeta = new Map<
    string,
    { displayName: string; eventDate: string | null }
  >();

  for (const e of events) {
    eventMeta.set(e.event_id, {
      displayName: e.display_name,
      eventDate: e.event_date,
    });
    if (e.member_type === 'couple') {
      ownedIds.add(e.event_id);
    } else if (e.member_type === 'guest') {
      attendedIds.add(e.event_id);
    }
    // 'vendor' / 'coordinator' memberships don't surface an editorial here —
    // the Editorials tab is about weddings you host or were a guest at.
  }
  // Owned always wins — drop any owned id from the attended set.
  for (const id of ownedIds) attendedIds.delete(id);

  const allIds = [...ownedIds, ...attendedIds];
  if (allIds.length === 0) return empty;

  // 3. Editorial rows for every candidate event (one read, admin-scoped).
  let editorialByEvent = new Map<string, EventEditorialRow>();
  try {
    const { data } = await admin
      .from('event_editorial')
      .select('event_id, status, hero_photo_id')
      .in('event_id', allIds);
    editorialByEvent = new Map(
      ((data ?? []) as EventEditorialRow[]).map((r) => [r.event_id, r]),
    );
  } catch {
    // No editorial rows readable → nothing to show.
    return empty;
  }

  // 4. Event metadata (slug, visibility, monogram, hero) for the gate + card.
  const metaByEvent = new Map<string, EventMetaRow>();
  try {
    const { data } = await admin
      .from('events')
      .select(
        'event_id, slug, landing_page_visibility, monogram_color, landing_page_hero_image_url',
      )
      .in('event_id', allIds);
    for (const r of (data ?? []) as EventMetaRow[]) {
      metaByEvent.set(r.event_id, r);
    }
  } catch {
    // metadata read failed → cards lose slug/visibility/hero. For ATTENDED that
    // means the gate can't be satisfied (no visibility proof) → they drop out,
    // which is the safe (private-by-default) failure. OWNED still render.
  }

  // 5. Resolve hero stills. event_editorial.hero_photo_id points at a
  //    papic_photos row; if absent we fall back to the website hero image
  //    (events.landing_page_hero_image_url), exactly like loadEditorialData's
  //    hero fallback chain. Resolve the Papic keys in one batched read.
  const heroPhotoIds = Array.from(
    new Set(
      allIds
        .map((id) => editorialByEvent.get(id)?.hero_photo_id ?? null)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const heroKeyByPhotoId = new Map<string, string>();
  if (heroPhotoIds.length > 0) {
    try {
      const { data } = await admin
        .from('papic_photos')
        // Derivative columns + full_res_dropped_at so the hero thumb resolves to
        // the drop-durable web copy (a dropped original 404s otherwise).
        .select(
          'photo_id, r2_object_key, display_r2_key, thumb_r2_key, full_res_dropped_at, photo_type, moderation_state',
        )
        .in('photo_id', heroPhotoIds)
        // Public-safe: never surface a moderation-withheld capture as a thumb.
        .not(
          'moderation_state',
          'in',
          '("nsfw_blocked","consent_withheld","faceblock_withheld")',
        );
      for (const r of (data ?? []) as Array<{
        photo_id: string | null;
        r2_object_key: string | null;
        display_r2_key: string | null;
        thumb_r2_key: string | null;
        full_res_dropped_at: string | null;
        photo_type: string | null;
      }>) {
        if (r.photo_id && r.photo_type !== 'clip') {
          const ref = resolveStillRef({
            photo_type: 'photo',
            r2_object_key: r.r2_object_key,
            display_r2_key: r.display_r2_key,
            thumb_r2_key: r.thumb_r2_key,
            full_res_dropped_at: r.full_res_dropped_at,
          });
          if (ref) heroKeyByPhotoId.set(r.photo_id, ref);
        }
      }
    } catch {
      // Papic table missing / error → fall back to website hero per event.
    }
  }

  // 6. Build cards, applying the gates.
  const owned: LibraryEditorial[] = [];
  const attended: LibraryEditorial[] = [];

  for (const eventId of allIds) {
    const editorial = editorialByEvent.get(eventId);
    const relation: 'owned' | 'attended' = ownedIds.has(eventId)
      ? 'owned'
      : 'attended';
    const meta = metaByEvent.get(eventId);
    const published = editorial?.status === 'published';

    // ── GATES ────────────────────────────────────────────────────────────
    if (relation === 'owned') {
      // Owned: show the editorial whenever a row exists (draft or published).
      // No row = the host hasn't started an editorial yet → nothing to list.
      if (!editorial) continue;
    } else {
      // Attended: published AND not private. No row, draft, missing metadata,
      // or private visibility all drop the card (private-by-default safe fail).
      if (!editorial || !published) continue;
      if (!meta || meta.landing_page_visibility === PRIVATE_VISIBILITY) continue;
    }

    // Resolve the hero still: editorial hero photo first, else website hero.
    const heroPhotoId = editorial?.hero_photo_id ?? null;
    const heroKey = heroPhotoId ? heroKeyByPhotoId.get(heroPhotoId) ?? null : null;
    let heroImageUrl: string | null = null;
    try {
      heroImageUrl = await displayUrlForStoredAsset(
        heroKey ?? meta?.landing_page_hero_image_url ?? null,
      );
    } catch {
      heroImageUrl = null;
    }

    const card: LibraryEditorial = {
      eventId,
      displayName: eventMeta.get(eventId)?.displayName ?? 'A Setnayan wedding',
      eventDate: eventMeta.get(eventId)?.eventDate ?? null,
      monogramColor: meta?.monogram_color ?? null,
      slug: meta?.slug ?? null,
      published,
      relation,
      heroImageUrl,
    };

    if (relation === 'owned') owned.push(card);
    else attended.push(card);
  }

  // Stable, friendly order: most recent wedding first within each section.
  const byDateDesc = (a: LibraryEditorial, b: LibraryEditorial) =>
    (b.eventDate ?? '').localeCompare(a.eventDate ?? '');
  owned.sort(byDateDesc);
  attended.sort(byDateDesc);

  return { owned, attended };
}

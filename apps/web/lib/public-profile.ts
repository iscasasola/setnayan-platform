import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveEffectiveVisibility } from '@/lib/launch-save-the-date';
import { RESERVED_SLUGS } from '@/lib/reserved-slugs';
import {
  resolveProfile as resolveEventTypeProfile,
  surfaceEnabled,
} from '@/lib/event-type-profile';

// Shared resolver for the public account profile at setnayan.com/u/[user-slug].
//
// The definition of "a public chapter" (an event this profile is allowed to
// surface) is load-bearing and reused in THREE places that MUST agree:
//   • the page body + generateMetadata (app/u/[userSlug]/page.tsx)
//   • the personalized OG card (app/api/og/u/[slug]/route.ts)
//   • the settings share-doorway gate (dashboard/(account)/profile/page.tsx)
// Keeping it here (one cache()-wrapped resolver) guarantees "≥1 public chapter"
// means the same thing in every gate — a name/hero never leaks anywhere the
// others would have hidden it.

export type PublicProfileEvent = {
  event_id: string;
  slug: string | null;
  display_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  event_type: string | null;
  archived: boolean | null;
  landing_page_visibility: 'public' | 'unlisted' | 'private' | null;
  scheduled_launch_at: string | null;
  landing_page_hero_image_url: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
  monogram_style: string | null;
  monogram_font_key: string | null;
  monogram_frame_key: string | null;
  monogram_custom_svg: string | null;
};

export type PublicProfileUser = {
  user_id: string;
  display_name: string | null;
  slug: string | null;
  public_profile_enabled: boolean | null;
  /** Public aggregate audience numbers (no graph exposure). */
  followers_count: number;
  profile_view_count: number;
};

export type ResolvedPublicProfile = {
  user: PublicProfileUser;
  /** The events this profile is ever allowed to surface — effectively-public
   *  AND website-enabled-by-type. Empty ⇒ "no public chapter". */
  publicWebsiteEvents: PublicProfileEvent[];
};

const EVENT_FIELDS =
  'event_id, slug, display_name, event_date, venue_name, event_type, archived, landing_page_visibility, scheduled_launch_at, landing_page_hero_image_url, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_frame_key, monogram_custom_svg';

/** The minimum an event row must carry to be put through the public gate. */
export type PublicGateEventFields = {
  slug: string | null;
  event_type: string | null;
  landing_page_visibility: 'public' | 'unlisted' | 'private' | null;
  scheduled_launch_at: string | null;
};

/**
 * THE public gate — "would /[slug] actually render this event to a stranger?"
 *
 * Both halves are load-bearing and must be applied TOGETHER:
 *   (a) effectively-public visibility (so 'unlisted' / 'private' / pre-launch
 *       events never surface), and
 *   (b) the event type enables the public 'website' surface (generic / simple
 *       types don't, so listing one would point at a 404).
 *
 * 🔑 ONE GATE, NOT N CHECKS. This used to be inlined in resolvePublicProfile
 * only. `resolveMutualStoryDays` (lib/person-life-stories.ts) needs the exact
 * same question answered about events the viewer does NOT own, and a second
 * hand-written copy is a second chance to forget half of it — the lesson the
 * guest photo-wall cost (three surfaces each asking their own version). Every
 * caller asks HERE.
 */
export async function filterPubliclyVisibleEvents<T extends PublicGateEventFields>(
  events: T[],
): Promise<T[]> {
  const withSlug = events.filter((e): e is T & { slug: string } => !!e.slug);
  if (withSlug.length === 0) return [];
  // Resolve once per distinct event_type (resolveEventTypeProfile is React-cached).
  const websiteByType = new Map<string, boolean>();
  for (const et of new Set(withSlug.map((e) => e.event_type ?? ''))) {
    const profile = await resolveEventTypeProfile(et);
    websiteByType.set(et, surfaceEnabled(profile, 'website'));
  }
  return withSlug.filter(
    (e) =>
      resolveEffectiveVisibility(e) === 'public' &&
      (websiteByType.get(e.event_type ?? '') ?? false),
  );
}

// Wrapped in cache() so every caller in one request (page body +
// generateMetadata; or the OG route) shares a single set of queries.
export const resolvePublicProfile = cache(async function resolvePublicProfile(
  userSlugRaw: string,
): Promise<ResolvedPublicProfile | null> {
  const userSlug = (userSlugRaw ?? '').toLowerCase();
  // A path segment that's a reserved word is never a user profile.
  if (!userSlug || RESERVED_SLUGS.has(userSlug)) return null;

  const admin = createAdminClient();
  const { data: userRow } = await admin
    .from('users')
    .select(
      'user_id, display_name, slug, public_profile_enabled, followers_count, profile_view_count',
    )
    .ilike('slug', userSlug)
    .maybeSingle();
  if (!userRow) return null;
  const user: PublicProfileUser = {
    user_id: userRow.user_id as string,
    display_name: (userRow.display_name as string | null) ?? null,
    slug: (userRow.slug as string | null) ?? null,
    public_profile_enabled:
      (userRow.public_profile_enabled as boolean | null) ?? null,
    followers_count: Number(userRow.followers_count ?? 0),
    profile_view_count: Number(userRow.profile_view_count ?? 0),
  };

  // Events this account owns (couple member), that have a public slug.
  const { data: memberships } = await admin
    .from('event_members')
    .select('event_id')
    .eq('user_id', user.user_id)
    .eq('member_type', 'couple');
  const eventIds = (memberships ?? []).map((m) => m.event_id as string);
  const { data: events } =
    eventIds.length === 0
      ? { data: [] }
      : await admin.from('events').select(EVENT_FIELDS).in('event_id', eventIds);

  const all = (events ?? []) as PublicProfileEvent[];
  // Mirror the /[slug] target's BOTH gates — see filterPubliclyVisibleEvents.
  const publicWebsiteEvents = await filterPubliclyVisibleEvents(all);

  return { user, publicWebsiteEvents };
});

/** Newest public chapter (by event_date desc, nulls last) — the OG card's hero
 *  source + the profile's representative celebration. Null when there are none. */
export function mostRecentPublicChapter(
  events: PublicProfileEvent[],
): PublicProfileEvent | null {
  if (events.length === 0) return null;
  return [...events].sort((a, b) => {
    const da = a.event_date ?? '';
    const db = b.event_date ?? '';
    if (da === db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db.localeCompare(da);
  })[0]!;
}

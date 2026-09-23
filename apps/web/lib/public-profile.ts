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
  monogram_uploaded_svg: string | null;
  /* The celebration's own typeface — see EVENT_FIELDS for why this one column
     and not the three private ones. Read by `resolveCelebrationIdentity`. */
  std_theme: string | null;
  std_film_accent_hex: string | null;
  invite_theme: string | null;
  /* The last day of a celebration that spans several days. `isFinishedEvent`
     reads it so a multi-day event is not "past" on its morning. Zero prod rows
     carry one today, so adding it is behaviour-neutral now and correct the
     first time somebody sets a range — the same reasoning that module records. */
  event_end_date: string | null;
};

export type PublicProfileUser = {
  user_id: string;
  display_name: string | null;
  slug: string | null;
  public_profile_enabled: boolean | null;
  /** The stored ref — an `r2://…` object or a passthrough URL, NOT an <img src>. */
  profile_photo_url: string | null;
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

/*
 * ⚠ THIS SELECT FEEDS A PUBLIC PAGE. Every column here must be anon-readable —
 * check `supabase/security/exposure-surface.baseline.txt` before adding one.
 *
 * ONE identity column — `std_theme`, added 2026-09-23 — and the count is
 * deliberate. The cover art needs ZERO new columns: `eventCardTreatment()` in
 * lib/event-card-art.ts derives a stable wash and crop from the `event_id` this
 * select already carries. What the cover cannot do is tell his two WEDDINGS
 * apart: measured, they land on hues 204 and 214, ten degrees from each other,
 * so both read blue side by side. `std_theme` is the couple's own Save-the-Date
 * typeface, and two blue covers in different fonts read as two celebrations
 * where two blue covers in one font read as a rendering bug.
 *
 * `event_end_date` joined for the Coming-up/Past split (owner 2026-09-23,
 * "split coming up from past"): `isFinishedEvent` needs it to avoid calling a
 * multi-day celebration finished on its first morning. Also `anon=S`.
 *
 * `std_film_accent_hex` and `invite_theme` joined 2026-09-23 for the approved
 * poster design: the sheet colour IS the accent (wine #9a244f, gold #9b7e00),
 * and `invite_theme` ('capiz') is what draws the panes. They are not decoration
 * — without them every poster falls to the same house stock.
 *
 * ⚠ `invite_theme` IS `anon=-` IN THE BASELINE, UNLIKE THE OTHER TWO, and that
 * was checked rather than waved through. It is already rendered on the couple's
 * own PUBLIC site — `app/[slug]/_lib/hub-look.ts` selects it, as do the public
 * recap and pabuya pages — so the information is public already and the grant
 * governs direct PostgREST reads, not secrecy. Adding it here exposes nothing a
 * visitor cannot already see by opening the celebration itself.
 *
 * `site_bg_color` and `site_button_color` were tried and
 * REMOVED: the cover carries the colour now, so an accent edge was a second
 * answer to a question already answered, and every column on a public read has
 * to pay for itself.
 *
 * ⛔ `invite_theme`, `moodboard_theme_name` and `story_cover_kind`/`_ref` are
 * deliberately NOT here — all four are `anon=-` in that baseline. Two of them
 * would have looked good on the card; they are private fields.
 */
const EVENT_FIELDS =
  'event_id, slug, display_name, event_date, venue_name, event_type, archived, landing_page_visibility, scheduled_launch_at, landing_page_hero_image_url, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_frame_key, monogram_custom_svg, monogram_uploaded_svg, std_theme, std_film_accent_hex, invite_theme, event_end_date';

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
      /*
        ⚖ `profile_photo_url` IS ON A PUBLIC READ, BY OWNER RULING 2026-09-23.
        Asked whether turning the public profile ON counts as consent to publish
        the photo, he answered: "yes, turning it on is the consent". So the
        switch is the consent, and the page shows the face of an account that
        opted in.

        ⛔ `share_profile_photo_with_hosts` IS NOT READ HERE AND MUST NOT BE.
        It is a SEPARATE, NARROWER consent — "whether the couple running an event
        you have joined may see your photo" — opt-in, defaulting to OFF, owner
        2026-09-20. Two consents about one photo with different audiences stay
        two; folding them would make one column do two jobs and quietly widen
        the narrower one.
      */
      'user_id, display_name, slug, public_profile_enabled, followers_count, profile_view_count, profile_photo_url',
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
    profile_photo_url: (userRow.profile_photo_url as string | null) ?? null,
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

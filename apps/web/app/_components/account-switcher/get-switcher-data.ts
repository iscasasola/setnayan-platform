import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { fetchUserRoleSummary } from '@/lib/roles';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isPlaceholderEmail } from '@/lib/anon-onboarding';

/**
 * Data shape returned by `getSwitcherData` — everything the AccountSwitcher
 * panel needs in one server-side fetch.
 */
export type SwitcherEvent = {
  event_id: string;
  display_name: string;
  event_type: string;
  event_date: string | null;
  is_primary: boolean;
  /** 'couple' when the user owns the event; 'guest' when attending */
  role: 'couple' | 'guest';
  // Monogram design columns — so the switcher rows render the couple's REAL
  // mark (EventMonogram) instead of a generic first-initial (owner-locked
  // "show the custom mark everywhere" 2026-06-15).
  monogram_text: string | null;
  monogram_color: string | null;
  monogram_font_key: string | null;
  monogram_style: string | null;
  monogram_frame_key: string | null;
  monogram_custom_svg: string | null;
};

export type SwitcherGallery = {
  event_id: string;
  event_display_name: string;
  photo_count: number;
};

export type SwitcherFavorite = {
  vendor_profile_id: string;
  business_name: string;
  logo_url: string | null;
};

export type SwitcherContext = {
  hasVendor: boolean;
  /** Business name of the first vendor profile (for sub-label in context rail) */
  vendorName: string | null;
  isAdmin: boolean;
};

export type SwitcherData = {
  userId: string;
  displayName: string | null;
  email: string;
  /**
   * Anon-draft: true when this principal hasn't secured an account yet (carries
   * the placeholder email). The switcher swaps "Sign out" — which would lose
   * their only key to the plan — for a "Secure your plan" CTA.
   */
  isAnonymous: boolean;
  photoUrl: string | null;
  events: SwitcherEvent[];
  gallery: SwitcherGallery[];
  favorites: SwitcherFavorite[];
  context: SwitcherContext;
};

/**
 * Server-only data fetch for the AccountSwitcher panel. Designed to be called
 * from a server component (a layout or header server component), with the
 * result passed as a prop to the `<AccountSwitcher>` client component.
 *
 * Accepts `userId` explicitly so the caller (layout) can pass the already-
 * resolved user ID without a second `getCurrentUser()` call inside this
 * function — avoids any React cache() scoping issues in Promise.all chains.
 *
 * Every sub-query is wrapped in try/catch so a missing table (pre-migration)
 * or RLS error degrades to an empty array rather than crashing the chrome.
 */
export async function getSwitcherData(userId: string): Promise<SwitcherData> {
  try {
  const supabase = await createClient();

  // Parallel: user profile + role summary + events the user belongs to
  const [userRes, roles, membershipRes, favRes] = await Promise.all([
    supabase
      .from('users')
      .select('display_name, email, profile_photo_url, is_internal, is_team_member')
      .eq('user_id', userId)
      .maybeSingle(),
    fetchUserRoleSummary(supabase, userId),
    supabase
      .from('event_members')
      .select('event_id, member_type')
      .eq('user_id', userId),
    // Favorites (saved vendors) depend only on userId — no reason to wait for the
    // events→gallery chain, so this joins the first batch (2026-07-01 perf). The
    // `.then(ok, err)` keeps the graceful-degrade contract inside Promise.all: a
    // missing table (pre-migration) resolves to an empty result, never a throw.
    supabase
      .from('vendor_favorites')
      .select('vendor_profile_id, vendor_profiles:vendor_profile_id ( business_name, logo_url )')
      .eq('user_id', userId)
      .limit(20)
      .then((r) => r, () => ({ data: null })),
  ]);

  if (userRes.error) {
    logQueryError(
      'getSwitcherData (users)',
      userRes.error,
      { user_id: userId },
      'graceful_degrade',
    );
  }
  if (membershipRes.error) {
    logQueryError(
      'getSwitcherData (event_members)',
      membershipRes.error,
      { user_id: userId },
      'graceful_degrade',
    );
  }

  const profile = userRes.data as {
    display_name: string | null;
    email: string;
    profile_photo_url: string | null;
    is_internal: boolean;
    is_team_member: boolean;
  } | null;

  const memberships = (membershipRes.data ?? []) as Array<{
    event_id: string;
    member_type: string;
  }>;

  // Kick off the profile-photo presign now — it only needs the profile row from
  // batch 1 and is independent of the events→gallery chain below, so it overlaps
  // those queries instead of running as a tail await (2026-07-01 perf).
  const photoUrlPromise = displayUrlForStoredAsset(
    profile?.profile_photo_url ?? null,
  ).catch(() => null);

  // Fetch event metadata for all events the user is a member of
  let events: SwitcherEvent[] = [];
  if (memberships.length > 0) {
    const eventIds = memberships.map((m) => m.event_id);
    const { data: eventRows, error: eventsErr } = await supabase
      .from('events')
      .select(
        'event_id, display_name, event_type, event_date, is_primary, archived, monogram_text, monogram_color, monogram_font_key, monogram_style, monogram_frame_key, monogram_custom_svg',
      )
      .in('event_id', eventIds)
      .eq('archived', false)
      .order('is_primary', { ascending: false })
      .order('event_date', { ascending: true });

    if (eventsErr) {
      logQueryError(
        'getSwitcherData (events)',
        eventsErr,
        { user_id: userId },
        'graceful_degrade',
      );
    }

    const membershipMap = new Map(memberships.map((m) => [m.event_id, m.member_type]));
    events = (eventRows ?? []).map((ev) => ({
      event_id: ev.event_id as string,
      display_name: ev.display_name as string,
      event_type: (ev.event_type as string) ?? 'wedding',
      event_date: ev.event_date as string | null,
      is_primary: (ev.is_primary as boolean) ?? false,
      role: membershipMap.get(ev.event_id as string) === 'couple' ? 'couple' : 'guest',
      monogram_text: (ev.monogram_text as string | null) ?? null,
      monogram_color: (ev.monogram_color as string | null) ?? null,
      monogram_font_key: (ev.monogram_font_key as string | null) ?? null,
      monogram_style: (ev.monogram_style as string | null) ?? null,
      monogram_frame_key: (ev.monogram_frame_key as string | null) ?? null,
      monogram_custom_svg: (ev.monogram_custom_svg as string | null) ?? null,
    }));
  }

  // Gallery: count papic_photos per event via a grouped-COUNT RPC (perf fix
  // 2026-07-01) — this used to pull one row per photo across every event just
  // to tally them in JS (`.select('event_id').in('event_id', eventIds)`),
  // which meant thousands of rows crossing the wire for a wedding with a full
  // Papic gallery, on every dashboard chrome render. current_user_gallery_counts()
  // is self-gated (current_event_ids()), so it needs no event-id input.
  // Graceful degrade if the RPC or table isn't migrated yet.
  let gallery: SwitcherGallery[] = [];
  if (events.length > 0) {
    try {
      const { data: countRows, error: countErr } = await supabase.rpc(
        'current_user_gallery_counts',
      );

      if (!countErr && countRows) {
        const countMap = new Map<string, number>();
        for (const row of countRows as Array<{ event_id: string; photo_count: number }>) {
          countMap.set(row.event_id, row.photo_count);
        }
        gallery = events.map((ev) => ({
          event_id: ev.event_id,
          event_display_name: ev.display_name,
          photo_count: countMap.get(ev.event_id) ?? 0,
        }));
      }
    } catch {
      // current_user_gallery_counts may not exist yet — degrade to empty
    }
  }

  // Favorites resolved in the first batch above — just shape the rows here.
  let favorites: SwitcherFavorite[] = [];
  {
    const favRows = favRes.data;
    if (favRows) {
      favorites = (favRows as unknown as Array<{
        vendor_profile_id: string;
        vendor_profiles: { business_name: string | null; logo_url: string | null } | null;
      }>).map((row) => ({
        vendor_profile_id: row.vendor_profile_id,
        business_name: row.vendor_profiles?.business_name ?? 'Vendor',
        logo_url: row.vendor_profiles?.logo_url ?? null,
      }));
    }
  }

  // Presign profile photo (kicked off in parallel above).
  const photoUrl = await photoUrlPromise;

  const context: SwitcherContext = {
    hasVendor: roles.hasVendorAccess,
    vendorName: roles.vendorProfiles[0]?.business_name ?? null,
    isAdmin: roles.hasAdminAccess,
  };

  return {
    userId,
    displayName: profile?.display_name ?? null,
    // Anon-draft: hide the non-routable placeholder email from the switcher
    // (it would read "anon+<uuid>@…"); the dashboard banner carries the secure CTA.
    email: isPlaceholderEmail(profile?.email) ? '' : (profile?.email ?? ''),
    isAnonymous: isPlaceholderEmail(profile?.email),
    photoUrl: photoUrl ?? null,
    events,
    gallery,
    favorites,
    context,
  };
  } catch (err) {
    console.error('[AccountSwitcher] getSwitcherData threw unexpectedly:', err);
    return {
      userId,
      displayName: null,
      email: '',
      isAnonymous: false,
      photoUrl: null,
      events: [],
      gallery: [],
      favorites: [],
      context: { hasVendor: false, vendorName: null, isAdmin: false },
    };
  }
}

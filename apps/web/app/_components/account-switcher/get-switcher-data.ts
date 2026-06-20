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

export type SwitcherEditorial = {
  editorial_id: string;
  event_id: string;
  event_display_name: string;
  status: string;
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
  photoUrl: string | null;
  events: SwitcherEvent[];
  gallery: SwitcherGallery[];
  favorites: SwitcherFavorite[];
  editorials: SwitcherEditorial[];
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
  const [userRes, roles, membershipRes] = await Promise.all([
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

  // Fetch event metadata for all events the user is a member of
  let events: SwitcherEvent[] = [];
  if (memberships.length > 0) {
    const eventIds = memberships.map((m) => m.event_id);
    const { data: eventRows, error: eventsErr } = await supabase
      .from('events')
      .select('event_id, display_name, event_type, event_date, is_primary, archived')
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
    }));
  }

  // Gallery: count papic_photos per event (graceful degrade if table absent)
  let gallery: SwitcherGallery[] = [];
  if (events.length > 0) {
    try {
      const { data: photoRows, error: photoErr } = await supabase
        .from('papic_photos')
        .select('event_id')
        .in('event_id', events.map((e) => e.event_id));

      if (!photoErr && photoRows) {
        const countMap = new Map<string, number>();
        for (const row of photoRows as Array<{ event_id: string }>) {
          countMap.set(row.event_id, (countMap.get(row.event_id) ?? 0) + 1);
        }
        gallery = events.map((ev) => ({
          event_id: ev.event_id,
          event_display_name: ev.display_name,
          photo_count: countMap.get(ev.event_id) ?? 0,
        }));
      }
    } catch {
      // papic_photos may not exist yet — degrade to empty
    }
  }

  // Favorites: saved vendors (graceful degrade if table absent)
  let favorites: SwitcherFavorite[] = [];
  try {
    const { data: favRows, error: favErr } = await supabase
      .from('vendor_favorites')
      .select('vendor_profile_id, vendor_profiles:vendor_profile_id ( business_name, logo_url )')
      .eq('user_id', userId)
      .limit(20);

    if (!favErr && favRows) {
      favorites = (favRows as unknown as Array<{
        vendor_profile_id: string;
        vendor_profiles: { business_name: string | null; logo_url: string | null } | null;
      }>).map((row) => ({
        vendor_profile_id: row.vendor_profile_id,
        business_name: row.vendor_profiles?.business_name ?? 'Vendor',
        logo_url: row.vendor_profiles?.logo_url ?? null,
      }));
    }
  } catch {
    // vendor_favorites may not exist yet — degrade to empty
  }

  // Editorials: event_editorial rows for the user's events (graceful degrade)
  let editorials: SwitcherEditorial[] = [];
  if (events.length > 0) {
    try {
      const { data: edRows, error: edErr } = await supabase
        .from('event_editorial')
        .select('editorial_id, event_id, status')
        .in('event_id', events.map((e) => e.event_id))
        .limit(10);

      if (!edErr && edRows) {
        const eventNameMap = new Map(events.map((ev) => [ev.event_id, ev.display_name]));
        editorials = (edRows as Array<{
          editorial_id: string;
          event_id: string;
          status: string;
        }>).map((row) => ({
          editorial_id: row.editorial_id,
          event_id: row.event_id,
          event_display_name: eventNameMap.get(row.event_id) ?? 'Event',
          status: row.status,
        }));
      }
    } catch {
      // event_editorial may not exist yet — degrade to empty
    }
  }

  // Presign profile photo
  const photoUrl = await displayUrlForStoredAsset(
    profile?.profile_photo_url ?? null,
  ).catch(() => null);

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
    photoUrl: photoUrl ?? null,
    events,
    gallery,
    favorites,
    editorials,
    context,
  };
  } catch (err) {
    console.error('[AccountSwitcher] getSwitcherData threw unexpectedly:', err);
    return {
      userId,
      displayName: null,
      email: '',
      photoUrl: null,
      events: [],
      gallery: [],
      favorites: [],
      editorials: [],
      context: { hasVendor: false, vendorName: null, isAdmin: false },
    };
  }
}

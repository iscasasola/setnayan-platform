import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { fetchUserEvents, sortEventsForSwitcher } from '@/lib/events';
import { fetchUserRoleSummary } from '@/lib/roles';
import { countUnread } from '@/lib/notifications';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { OuterDashboardHeader } from '@/app/dashboard/_components/outer-dashboard-header';

/**
 * Account-scoped dashboard chrome — route group `(account)` (URL-transparent),
 * covering the non-event dashboard surfaces: the event picker (`/dashboard`),
 * profile, notifications, create-event, api-keys.
 *
 * SPLIT OUT of `dashboard/layout.tsx` 2026-06-14 (chrome retirement). The old
 * parent layout rendered `OuterDashboardHeader` + a `bg-cream lg:pl-60` gutter
 * UNCONDITIONALLY for every `/dashboard` route — including event routes, where
 * the header was suppressed only by a CLIENT `usePathname()` guard and the
 * gutter cancelled by a `lg:-ml-60` hack in `[eventId]/layout.tsx`. Result:
 * the legacy cream chrome painted first on event navigations, then vanished
 * after hydration — the "old design flashes, then reroutes to the new design"
 * report. By moving the account chrome into this group it renders ONLY on the
 * account routes (structurally, server-side); the parent layout owns no chrome;
 * and `[eventId]/layout.tsx` owns the paper SidebarShell alone. No dual-render,
 * no `-ml-60` cancel, no flash. The header is restyled to the v2.1 `--m-*`
 * paper palette so the old cream design is fully retired.
 *
 * Auth/profile/deleted/vendor gating + the welcome tour stay in the parent
 * `dashboard/layout.tsx` (shared by this group AND the event subtree). This
 * layout owns only the chrome-data fetch (events/roles/unread/avatar) that the
 * header switcher needs — the same fetch the event layout runs independently.
 */
export default async function AccountDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/dashboard'));
  const supabase = await createClient();

  // Resolve the switcher chrome data once. Each fetcher is individually
  // `.catch()`-wrapped with safe defaults so a single throw can't reject the
  // whole `Promise.all` and crash the layout (5th-hotfix defensive pattern,
  // preserved verbatim from the prior parent layout).
  const [events, roles, unreadCount, profilePhotoUrl] = await Promise.all([
    fetchUserEvents(supabase, user.id, 'couple').catch((err: unknown) => {
      logQueryError(
        'AccountDashboardLayout (fetchUserEvents threw)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: user.id },
        'graceful_degrade',
      );
      return [] as Awaited<ReturnType<typeof fetchUserEvents>>;
    }),
    fetchUserRoleSummary(supabase, user.id).catch((err: unknown) => {
      logQueryError(
        'AccountDashboardLayout (fetchUserRoleSummary threw)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: user.id },
        'graceful_degrade',
      );
      return {
        hasCustomerAccess: true,
        hasVendorAccess: false,
        hasAdminAccess: false,
        vendorProfiles: [],
      } as Awaited<ReturnType<typeof fetchUserRoleSummary>>;
    }),
    countUnread(supabase, user.id).catch((err: unknown) => {
      logQueryError(
        'AccountDashboardLayout (countUnread threw)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: user.id },
        'graceful_degrade',
      );
      return 0;
    }),
    // Account profile photo for the (I) avatar (owner directive 2026-06-12:
    // avatar = ACCOUNT photo, never the event logo). Presigned display URL;
    // degrades to null (initial fallback) on any error.
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('profile_photo_url')
        .eq('user_id', user.id)
        .maybeSingle();
      return displayUrlForStoredAsset(
        (data as { profile_photo_url?: string | null } | null)
          ?.profile_photo_url ?? null,
      );
    })().catch(() => null),
  ]);

  // Hide archived events from the switcher, then sort active-first /
  // expired-rightmost (2026-05-17 owner directive · sortEventsForSwitcher
  // preserves primary-then-date-asc inside the active group).
  const visibleEvents = events.filter((e) => !e.archived);
  const activeEvents = sortEventsForSwitcher(visibleEvents);
  const primary =
    visibleEvents.find((e) => e.is_primary) ?? activeEvents[0] ?? null;

  const eventTypes = await getCreatableEventTypes();

  return (
    <div
      className="app-surface flex min-h-dvh flex-col lg:pl-60"
      style={{ background: 'var(--m-paper)' }}
    >
      {/* lg:pl-60 offsets the OuterDashboardHeader's 240px desktop sidebar
          (fixed left). On account routes the header ALWAYS renders, so the
          gutter is structurally correct — no client guard, no flash. */}
      <OuterDashboardHeader
        userId={user.id}
        email={user.email ?? ''}
        photoUrl={profilePhotoUrl}
        unreadCount={unreadCount}
        primaryEvent={
          primary
            ? {
                event_id: primary.event_id,
                display_name: primary.display_name,
                event_date: primary.event_date,
                monogram_text: primary.monogram_text,
                monogram_color: primary.monogram_color,
                monogram_frame_key: primary.monogram_frame_key,
                monogram_font_key: primary.monogram_font_key,
                monogram_style: primary.monogram_style,
              }
            : null
        }
        switcherEvents={activeEvents.map((e) => ({
          event_id: e.event_id,
          display_name: e.display_name,
          event_date: e.event_date,
          is_primary: e.is_primary,
          monogram_text: e.monogram_text,
          monogram_color: e.monogram_color,
          monogram_frame_key: e.monogram_frame_key,
          monogram_font_key: e.monogram_font_key,
          monogram_style: e.monogram_style,
        }))}
        hasVendorAccess={roles.hasVendorAccess}
        hasAdminAccess={roles.hasAdminAccess}
        vendorProfiles={roles.vendorProfiles}
        eventTypes={eventTypes}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}

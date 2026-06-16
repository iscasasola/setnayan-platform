import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { sortEventsForSwitcher } from '@/lib/events';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { getDashboardShell } from '@/lib/dashboard-shell';
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
  // getDashboardShell fetches events + roles + unreadCount in one cached
  // Promise.all. React cache() deduplicates this call across layouts that
  // share the same render tree — any page or layout that also calls
  // getDashboardShell(user.id) in this request gets the already-resolved
  // result at zero DB cost.
  const supabase = await createClient();
  const [{ events, roles, unreadCount }, profilePhotoUrl] = await Promise.all([
    getDashboardShell(user.id),
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
                monogram_custom_svg: primary.monogram_uploaded_svg ?? primary.monogram_custom_svg,
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
          monogram_custom_svg: e.monogram_uploaded_svg ?? e.monogram_custom_svg,
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

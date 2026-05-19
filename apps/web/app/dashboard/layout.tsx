import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { GuidedTour } from '@/app/_components/guided-tour';
import { completeTour } from '@/lib/tour-actions';
import { TOURS } from '@/lib/tours';
import { fetchUserEvents, sortEventsForSwitcher } from '@/lib/events';
import { fetchUserRoleSummary } from '@/lib/roles';
import { countUnread } from '@/lib/notifications';
import { OuterDashboardHeader } from './_components/outer-dashboard-header';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('users')
    .select('theme_preference, account_type, deleted_at, tour_seen_keys')
    .eq('user_id', user.id)
    .maybeSingle();

  // Reject deleted accounts — sign them out cleanly.
  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect('/login?error=Account+deleted');
  }

  // Vendors belong on the vendor-side tree.
  if (profile?.account_type === 'vendor') {
    redirect('/vendor-dashboard');
  }

  const theme = profile?.theme_preference ?? 'setnayan_default';

  // Resolve the chrome data once at the layout level so the outer header
  // can render the per-event monogram switcher + (I) menu (iteration 0000
  // single-strip lock 2026-05-14 + add-event entry 2026-05-15). The nested
  // `[eventId]/layout.tsx` re-runs its own queries for the active event;
  // the duplicate cost is small and keeps the two trees decoupled.
  const [events, roles, unreadCount] = await Promise.all([
    fetchUserEvents(supabase, user.id, 'couple'),
    fetchUserRoleSummary(supabase, user.id),
    countUnread(supabase, user.id),
  ]);
  // Hide archived events from the switcher (existing behavior); then sort
  // the remaining list with active-first + expired-rightmost per the
  // 2026-05-17 owner directive. `sortEventsForSwitcher` preserves the
  // prior primary-then-date-asc order inside the active group.
  const visibleEvents = events.filter((e) => !e.archived);
  const activeEvents = sortEventsForSwitcher(visibleEvents);
  const primary = visibleEvents.find((e) => e.is_primary) ?? activeEvents[0] ?? null;

  // Top-level dashboard chrome. The single-strip top nav renders only on
  // non-event-scoped routes (/dashboard root, /dashboard/profile, etc.).
  // On /dashboard/[eventId]/* the EventSwitcher in that nested layout is
  // the single source of chrome per the 2026-05-14 single-strip lock —
  // OuterDashboardHeader returns null there to avoid the two-stacked-row
  // drift confirmed in production 2026-05-15.
  return (
    <div data-theme={theme} className="flex min-h-dvh flex-col bg-cream">
      <OuterDashboardHeader
        userId={user.id}
        email={user.email ?? ''}
        unreadCount={unreadCount}
        primaryEvent={
          primary
            ? {
                event_id: primary.event_id,
                display_name: primary.display_name,
                event_date: primary.event_date,
                monogram_text: primary.monogram_text,
                monogram_color: primary.monogram_color,
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
        }))}
        hasVendorAccess={roles.hasVendorAccess}
        hasAdminAccess={roles.hasAdminAccess}
        vendorProfiles={roles.vendorProfiles}
      />
      <main className="flex-1">{children}</main>
      {!(profile?.tour_seen_keys ?? []).includes('couple_welcome_v1') ? (
        <GuidedTour
          tourKey="couple_welcome_v1"
          slides={TOURS.couple_welcome_v1.slides}
          completeAction={completeTour}
        />
      ) : null}
    </div>
  );
}

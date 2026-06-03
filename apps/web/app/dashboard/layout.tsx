import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { GuidedTour } from '@/app/_components/guided-tour';
import { completeTour } from '@/lib/tour-actions';
import { fetchUserEvents, sortEventsForSwitcher } from '@/lib/events';
import { fetchUserRoleSummary } from '@/lib/roles';
import { countUnread } from '@/lib/notifications';
import { logQueryError } from '@/lib/supabase/error-detect';
import { OuterDashboardHeader } from './_components/outer-dashboard-header';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(loginRedirectPath('/dashboard'));
  }
  const supabase = await createClient();

  // 5th hotfix pass (2026-05-23 PM): Defensive try/catch around the
  // users SELECT. The 4th pass switched from silent `{data}` destructure
  // to explicit error capture via logQueryError — that helps Sentry
  // surface the call_site but doesn't catch synchronous throws from
  // supabase-js itself (malformed cookie state, transport-layer
  // exception, fetch failure on the edge runtime). Owner reported
  // global-error firing on /login → /dashboard redirect; sweep #2
  // pointed at this surface as the load-bearing chrome that ALL
  // authenticated routes pass through. A throw here breaks every
  // /dashboard/* render including the post-login landing. Wrap the
  // await in try/catch so a thrown supabase error degrades to
  // profile=null (same fallback the original 4th-pass had) and the
  // layout still renders.
  //
  // Fallback to SELECT * on column-not-found error so a future
  // users.* ADD COLUMN landing before its migration is pushed to prod
  // doesn't crash the layout (matches the defensive pattern from
  // PR #448 on /dashboard/[eventId]/page.tsx).
  type ProfileShape = {
    account_type?: string | null;
    deleted_at?: string | null;
    tour_seen_keys?: string[] | null;
  };
  let profile: ProfileShape | null = null;
  try {
    const fullRes = await supabase
      .from('users')
      .select('account_type, deleted_at, tour_seen_keys')
      .eq('user_id', user.id)
      .maybeSingle();
    if (
      fullRes.error &&
      /column .* does not exist|undefined_column|42703/i.test(
        (fullRes.error as { message?: string; code?: string }).message ??
          (fullRes.error as { code?: string }).code ??
          '',
      )
    ) {
      // Column missing on prod → migration drift. Fall back to SELECT *.
      const fallbackRes = await supabase
        .from('users')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      profile = (fallbackRes.data as unknown as ProfileShape) ?? null;
      if (fallbackRes.error) {
        logQueryError(
          'DashboardLayout (users.profile fallback)',
          fallbackRes.error,
          { user_id: user.id },
          'graceful_degrade',
        );
      }
    } else if (fullRes.error) {
      logQueryError(
        'DashboardLayout (users.profile)',
        fullRes.error,
        { user_id: user.id },
        'graceful_degrade',
      );
      profile = null;
    } else {
      profile = (fullRes.data as unknown as ProfileShape) ?? null;
    }
  } catch (caught) {
    // Synchronous throw from supabase-js or its transport layer. Log
    // via the same call_site so Sentry surfaces it, then continue with
    // profile=null. The page still renders the chrome.
    logQueryError(
      'DashboardLayout (users.profile threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { user_id: user.id },
      'graceful_degrade',
    );
    profile = null;
  }

  // Reject deleted accounts — sign them out cleanly.
  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    redirect('/login?error=Account+deleted');
  }

  // Vendors belong on the vendor-side tree.
  if (profile?.account_type === 'vendor') {
    redirect('/vendor-dashboard');
  }

  // 2026-05-22 brand pivot: per-wrapper `data-theme` is retired. The global
  // ThemeProvider toggles `html.dark` instead of swapping a 5-theme palette
  // attribute — see CLAUDE.md decision-log for the rationale. `theme_preference`
  // is still read on the profile settings page for the picker UI.

  // Resolve the chrome data once at the layout level so the outer header
  // can render the per-event monogram switcher + (I) menu (iteration 0000
  // single-strip lock 2026-05-14 + add-event entry 2026-05-15). The nested
  // `[eventId]/layout.tsx` re-runs its own queries for the active event;
  // the duplicate cost is small and keeps the two trees decoupled.
  //
  // 5th hotfix pass (2026-05-23 PM) — each fetcher individually wrapped
  // in a .catch() so a throw in ONE doesn't reject the whole Promise.all
  // (which would crash the layout + bubble to global-error.tsx). All
  // three helpers internally use logQueryError + return safe defaults
  // on PostgREST errors, but synchronous throws from supabase-js / edge
  // transport / cookie state can still escape. Owner reported global-
  // error firing on /login → /dashboard redirect; sweep #2 traced it
  // here. Safe defaults: empty events array, null role summary,
  // unread=0 — chrome renders with no events visible + 0 unread bell
  // but the user lands on the dashboard.
  const [events, roles, unreadCount] = await Promise.all([
    fetchUserEvents(supabase, user.id, 'couple').catch((err: unknown) => {
      logQueryError(
        'DashboardLayout (fetchUserEvents threw)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: user.id },
        'graceful_degrade',
      );
      return [] as Awaited<ReturnType<typeof fetchUserEvents>>;
    }),
    fetchUserRoleSummary(supabase, user.id).catch((err: unknown) => {
      logQueryError(
        'DashboardLayout (fetchUserRoleSummary threw)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: user.id },
        'graceful_degrade',
      );
      // Safe-default role summary matches the shape fetchUserRoleSummary
      // returns when the user has no admin / vendor associations.
      return {
        hasCustomerAccess: true,
        hasVendorAccess: false,
        hasAdminAccess: false,
        vendorProfiles: [],
      } as Awaited<ReturnType<typeof fetchUserRoleSummary>>;
    }),
    countUnread(supabase, user.id).catch((err: unknown) => {
      logQueryError(
        'DashboardLayout (countUnread threw)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: user.id },
        'graceful_degrade',
      );
      return 0;
    }),
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
    <div className="flex min-h-dvh flex-col bg-cream lg:pl-60">
      {/* lg:pl-60 offset accounts for the OuterDashboardHeader's desktop
          sidebar (240px wide, fixed left) so main content sits to the
          right of it. Mobile pl is 0 — top strip stacks above the main
          flow. The event-scoped routes apply their own pl-60 from
          [eventId]/layout.tsx where OuterDashboardHeader returns null
          and bottom-nav.tsx's sidebar takes over. */}
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
                monogram_frame_key: primary.monogram_frame_key,
                monogram_font_key: primary.monogram_font_key,
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
        }))}
        hasVendorAccess={roles.hasVendorAccess}
        hasAdminAccess={roles.hasAdminAccess}
        vendorProfiles={roles.vendorProfiles}
      />
      <main className="flex-1">{children}</main>
      {!(profile?.tour_seen_keys ?? []).includes('couple_welcome_v1') ? (
        <GuidedTour tourKey="couple_welcome_v1" completeAction={completeTour} />
      ) : null}
    </div>
  );
}

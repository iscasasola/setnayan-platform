import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchUserEvents, formatEventDate, type EventWithRole } from '@/lib/events';
import { fetchUserRoleSummary, type UserRoleSummary } from '@/lib/roles';
import { logQueryError } from '@/lib/supabase/error-detect';

export const metadata = {
  title: 'Your events',
};

export default async function DashboardIndexPage() {
  const user = await getCurrentUser();
  // Layout already redirects to /login if no user; this is for type narrowing.
  if (!user) redirect('/login');
  const supabase = await createClient();

  // 7th hotfix pass 2026-05-23 — this page runs RIGHT AFTER an OAuth
  // callback (Google + Facebook social login). The newly-created
  // auth.users row + the trigger-inserted public.users row can race
  // with the JWT propagating through the supabase-js session, so the
  // initial fetchUserEvents call can throw with PGRST 401 / RLS error
  // for ~1-2 seconds before settling. Migration drift between local +
  // prod (Path A pending) is a parallel risk. Shielding every query
  // here with a graceful-degrade fallback eliminates the 5-10s flash
  // of the global error boundary the owner saw on Facebook OAuth
  // sign-in. Same defensive pattern as PR #452/#454/#458.
  const events = await fetchUserEvents(supabase, user.id, 'couple').catch(
    (err: unknown) => {
      logQueryError(
        'DashboardIndex (fetchUserEvents threw)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: user.id },
        'graceful_degrade',
      );
      return [] as Awaited<ReturnType<typeof fetchUserEvents>>;
    },
  );
  const active = events.filter((e) => !e.archived);
  const archived = events.filter((e) => e.archived);

  // Universal login-landing rule (locked 2026-05-20). Every user — customer,
  // vendor, admin — lands on their primary event after login. The admin
  // (`/admin`) and vendor (`/vendor-dashboard`) consoles are reachable only
  // via the chrome role-switch pill, never as auto-redirect. Supersedes
  // the 2026-05-15 row-3 rule that bounced 0-event vendors to /vendor-
  // dashboard and 0-event admins to /admin. See memory file
  // `project_setnayan_login_landing.md` for the why.
  //
  // Auto-jump order: primary (events.is_primary=true) → first active.
  // The chrome event-switcher (PR #67) is the only way to hop between
  // events once landed.
  if (active.length >= 1) {
    const primary = active.find((e) => e.is_primary) ?? active[0]!;
    redirect(`/dashboard/${primary.event_id}`);
  }

  // 7th hotfix pass 2026-05-23 — same shielding rationale as the
  // events fetch above. The users SELECT for the display_name greeting
  // is the SAME row that supabase-auth just inserted via the auth.users
  // → public.users sync trigger; reads can race against the trigger
  // commit during OAuth bootstrap. Both queries graceful-degrade with
  // safe defaults (empty profile + null-role-summary) so the page
  // still renders the empty-state monogram instead of the global
  // error boundary.
  const [profileRes, roles] = await Promise.all([
    (async () => {
      try {
        return await supabase
          .from('users')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle();
      } catch (caught) {
        logQueryError(
          'DashboardIndex (users.display_name SELECT threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { user_id: user.id },
          'graceful_degrade',
        );
        return { data: null, error: null } as never;
      }
    })(),
    fetchUserRoleSummary(supabase, user.id).catch((err: unknown) => {
      logQueryError(
        'DashboardIndex (fetchUserRoleSummary threw)',
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
  ]);
  const profile = profileRes.data;
  const greeting = profile?.display_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'there';

  // Zero-event branch (locked 2026-05-20).
  //   - Vendor or admin users → redirect to /dashboard/create-event so they
  //     plan an event first (consoles reached via chrome role-switch pill,
  //     not via auto-redirect).
  //   - Customer-only users → fall through to render the existing "+"
  //     create-event empty-state monogram below (same destination,
  //     different UX).
  if (active.length === 0 && (roles.hasVendorAccess || roles.hasAdminAccess)) {
    redirect('/dashboard/create-event');
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Setnayan · dashboard
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {active.length === 0 ? `Welcome, ${greeting}.` : `Hi ${greeting}.`}
        </h1>
        <p className="text-base text-ink/60">
          {active.length === 0
            ? "Let's set up your first event."
            : 'Which event are you working on?'}
        </p>
      </header>

      {active.length === 0 ? (
        <EmptyState />
      ) : (
        <EventList events={active} roles={roles} />
      )}

      {archived.length > 0 ? (
        <details className="mt-10 rounded-lg border border-ink/10 bg-cream p-4 text-sm text-ink/70">
          <summary className="cursor-pointer font-medium">
            Archived events ({archived.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {archived.map((event) => (
              <li key={event.event_id}>
                <Link
                  href={`/dashboard/${event.event_id}`}
                  className="text-ink/80 underline-offset-4 hover:underline"
                >
                  {event.display_name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
      <p className="mb-4 text-ink/70">
        You haven&rsquo;t created or joined an event yet.
      </p>
      <Link className="button-primary" href="/dashboard/create-event">
        + Create event
      </Link>
    </div>
  );
}

function EventList({
  events,
  roles,
}: {
  events: EventWithRole[];
  roles: UserRoleSummary;
}) {
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {events.map((event) => (
          <li key={event.event_id}>
            <Link
              href={`/dashboard/${event.event_id}`}
              className="group flex items-start justify-between gap-4 rounded-lg border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5"
            >
              <div className="space-y-1">
                <p className="flex items-center gap-2 text-base font-medium text-ink">
                  {event.is_primary ? (
                    <span aria-hidden className="text-terracotta">
                      ★
                    </span>
                  ) : null}
                  <span>{event.display_name}</span>
                </p>
                <p className="text-sm text-ink/60">
                  {[
                    formatEventDate(event.event_date),
                    event.venue_name,
                    event.event_type !== 'wedding' ? event.event_type : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/40">
                  {event.public_id}
                </p>
              </div>
              <span
                aria-hidden
                className="text-2xl text-ink/30 transition-transform group-hover:translate-x-1 group-hover:text-terracotta"
              >
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="pt-4">
        <Link className="button-secondary" href="/dashboard/create-event">
          + Create another event
        </Link>
      </div>

      {roles.hasVendorAccess || roles.hasAdminAccess ? (
        <RoleSwitchRows roles={roles} />
      ) : null}
    </div>
  );
}

/**
 * Role-switch rows inside the event list — iteration 0000 § event switcher
 * (locked 2026-05-15). Renders below the event list with a thin separator;
 * Shop console row appears when the user is a vendor owner OR sits on any
 * vendor team; Setnayan HQ row appears when the user has any admin grant.
 *
 * When a user sits across multiple vendors, the Shop console expands into
 * a sub-list — each vendor row routes into that specific shop console.
 */
function RoleSwitchRows({ roles }: { roles: UserRoleSummary }) {
  return (
    <div className="mt-6 border-t border-ink/10 pt-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/40">
        Switch view
      </p>
      <ul className="mt-3 space-y-2">
        {roles.hasVendorAccess && roles.vendorProfiles.length === 1 ? (
          <li>
            <Link
              href="/vendor-dashboard"
              className="group flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-cream px-4 py-3 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5"
            >
              <span className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-terracotta/15 text-sm font-semibold text-terracotta-700"
                >
                  S
                </span>
                <span>
                  <span className="block text-sm font-medium text-ink">Shop console</span>
                  <span className="block text-xs text-ink/55">
                    {roles.vendorProfiles[0]?.business_name ?? 'Vendor profile'}
                  </span>
                </span>
              </span>
              <span aria-hidden className="text-ink/40 group-hover:text-terracotta">
                ›
              </span>
            </Link>
          </li>
        ) : roles.hasVendorAccess && roles.vendorProfiles.length > 1 ? (
          <li>
            <p className="px-4 text-xs text-ink/55">Shop console</p>
            <ul className="mt-1 space-y-2">
              {roles.vendorProfiles.map((vp) => (
                <li key={vp.vendor_profile_id}>
                  <Link
                    href="/vendor-dashboard"
                    className="group flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-cream px-4 py-3 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5"
                  >
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-terracotta/15 text-sm font-semibold text-terracotta-700"
                      >
                        {vp.business_name.charAt(0).toUpperCase() || 'V'}
                      </span>
                      <span className="block text-sm font-medium text-ink">
                        {vp.business_name}
                      </span>
                    </span>
                    <span aria-hidden className="text-ink/40 group-hover:text-terracotta">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ) : null}

        {roles.hasAdminAccess ? (
          <li>
            <Link
              href="/admin"
              className="group flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-cream px-4 py-3 transition-colors hover:border-purple-300 hover:bg-purple-50"
            >
              <span className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-800"
                >
                  S
                </span>
                <span>
                  <span className="block text-sm font-medium text-ink">Setnayan HQ</span>
                  <span className="block text-xs text-ink/55">Setnayan admin</span>
                </span>
              </span>
              <span aria-hidden className="text-ink/40 group-hover:text-purple-700">
                ›
              </span>
            </Link>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

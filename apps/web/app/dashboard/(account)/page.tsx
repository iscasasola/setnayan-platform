import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchUserEvents, formatEventDate, type EventWithRole } from '@/lib/events';
import { fetchUserRoleSummary, type UserRoleSummary } from '@/lib/roles';
import { logQueryError } from '@/lib/supabase/error-detect';
import { EventMonogram } from '@/app/_components/event-monogram';

export const metadata = {
  title: 'Your events',
};

/**
 * Person-shaped account home — Phase 0 of the person-spine model
 * (03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md, owner-locked
 * "lock everything" 2026-07-04).
 *
 * This surface is the PERSON's home: one individual, and the events that hang
 * off them, bucketed by lifecycle — Ongoing · Upcoming · Completed. It is NOT a
 * couple/wedding dashboard (owner "this is not Bride or Groom. just person
 * because it is events"): the account is a single person, and a wedding is just
 * one event among any type (birthday, christening, reunion, …). The
 * AccountSidebar is the rail; this page renders the Home content. Graph-powered
 * surfaces (People / connections) arrive in Phase 2 and are not built here.
 *
 * Landing rule (owner 2026-07-04 — supersedes the 2026-05-20 universal auto-
 * jump): a single-event, non-console user still jumps straight into their one
 * event (nothing to pick); everyone else — 2+ events, or any vendor/admin —
 * lands here on the person-shaped hub.
 */

type Bucket = 'ongoing' | 'upcoming' | 'completed';

/**
 * Bucket an event by its date relative to today (date-only compare, in PH
 * time — the market — to avoid a UTC-midnight off-by-one on "Ongoing").
 * A null date = still being planned → Upcoming.
 */
function bucketOf(event: EventWithRole, todayISO: string): Bucket {
  const day = event.event_date?.slice(0, 10);
  if (!day) return 'upcoming';
  if (day === todayISO) return 'ongoing';
  return day < todayISO ? 'completed' : 'upcoming';
}

/** "gender_reveal" → "Gender Reveal", "wedding" → "Wedding". */
function titleCaseType(type: string): string {
  return type
    .split(/[_\s]+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export default async function DashboardIndexPage() {
  const user = await getCurrentUser();
  // Layout already redirects to /login if no user; this is for type narrowing.
  if (!user) redirect('/login');
  const supabase = await createClient();

  // OAuth-race graceful-degrade shielding, preserved from the prior picker
  // (7th hotfix pass 2026-05-23): the users / events rows this page reads are
  // the SAME rows supabase-auth just inserted via the auth → public.users sync
  // trigger, so reads can race the JWT/trigger commit for ~1-2s right after a
  // Google / Facebook OAuth callback. Every query graceful-degrades with a safe
  // default so the page renders the empty-state / hub instead of flashing the
  // global error boundary. Same defensive pattern as PR #452/#454/#458.
  const [events, profileRes, roles] = await Promise.all([
    fetchUserEvents(supabase, user.id, 'couple').catch((err: unknown) => {
      logQueryError(
        'DashboardIndex (fetchUserEvents threw)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: user.id },
        'graceful_degrade',
      );
      return [] as Awaited<ReturnType<typeof fetchUserEvents>>;
    }),
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

  const active = events.filter((e) => !e.archived);
  const archived = events.filter((e) => e.archived);
  const hasConsole = roles.hasVendorAccess || roles.hasAdminAccess;

  // Landing (owner 2026-07-04, supersedes the 2026-05-20 universal auto-jump):
  //   - single-event, non-console user → jump straight into their one event
  //     (nothing to pick; the common couple case is unchanged).
  //   - 0-event console user → send to create-event (unchanged from 2026-05-20).
  //   - everyone else (2+ events, or any vendor/admin with events, or a
  //     0-event couple) → render the person-shaped hub below.
  if (active.length === 1 && !hasConsole) {
    redirect(`/dashboard/${active[0]!.event_id}`);
  }
  if (active.length === 0 && hasConsole) {
    redirect('/dashboard/create-event');
  }

  const profile = profileRes.data;
  const greeting =
    profile?.display_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'there';

  // PH-local "today" (Asia/Manila) as YYYY-MM-DD for the date-only bucket compare.
  const todayISO = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Manila',
  });
  const ongoing = active.filter((e) => bucketOf(e, todayISO) === 'ongoing');
  const upcoming = active.filter((e) => bucketOf(e, todayISO) === 'upcoming');
  const completed = active.filter((e) => bucketOf(e, todayISO) === 'completed');

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {active.length === 0 ? `Welcome, ${greeting}.` : `Hi, ${greeting}.`}
        </h1>
        <p className="text-base text-ink/60">
          {active.length === 0
            ? "Let's set up your first event."
            : 'Your events, all in one place.'}
        </p>
      </header>

      {active.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {ongoing.length > 0 ? (
            <EventBucket title="Ongoing" events={ongoing} live />
          ) : null}
          <EventBucket title="Upcoming" events={upcoming} withAdd />
          {completed.length > 0 ? (
            <EventBucket title="Completed" events={completed} muted />
          ) : null}

          <CollectionLink />

          {hasConsole ? <RoleSwitchRows roles={roles} /> : null}
        </div>
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

/**
 * One lifecycle bucket (Ongoing / Upcoming / Completed) — a sentence-case
 * heading + a count, and the events as cards. Deliberately NOT an uppercase
 * letter-spaced label (the site-wide no-eyebrow-kicker rule, 2026-07-02).
 */
function EventBucket({
  title,
  events,
  withAdd,
  live,
  muted,
}: {
  title: string;
  events: EventWithRole[];
  withAdd?: boolean;
  live?: boolean;
  muted?: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <span className="text-xs text-ink/40">{events.length}</span>
      </div>
      <ul className="space-y-2">
        {events.map((event) => (
          <li key={event.event_id}>
            <EventCard event={event} live={live} muted={muted} />
          </li>
        ))}
      </ul>
      {withAdd ? (
        <Link
          href="/dashboard/create-event"
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed border-terracotta/50 px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:border-terracotta hover:bg-terracotta/5 hover:text-ink"
        >
          <span aria-hidden className="text-terracotta">
            +
          </span>
          Add event
        </Link>
      ) : null}
    </section>
  );
}

function EventCard({
  event,
  live,
  muted,
}: {
  event: EventWithRole;
  live?: boolean;
  muted?: boolean;
}) {
  const meta =
    [formatEventDate(event.event_date), event.venue_name].filter(Boolean).join(' · ') ||
    'Date to be confirmed';
  return (
    <Link
      href={`/dashboard/${event.event_id}`}
      className={`group flex items-center gap-3 rounded-lg border border-ink/10 bg-cream p-3 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5 ${
        muted ? 'opacity-75' : ''
      }`}
    >
      <EventMonogram event={event} size="md" className="shrink-0" />
      <div className="min-w-0 flex-1 space-y-0.5">
        {live ? (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-700">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-green-600" />
            Live now
          </span>
        ) : null}
        <p className="flex min-w-0 items-center gap-2 text-base font-medium text-ink">
          {event.is_primary ? (
            <span aria-hidden className="shrink-0 text-terracotta">
              ★
            </span>
          ) : null}
          <span className="truncate">{event.display_name}</span>
          <span className="shrink-0 rounded border border-ink/15 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-ink/50">
            {titleCaseType(event.event_type)}
          </span>
        </p>
        <p className="truncate text-sm text-ink/60">{meta}</p>
      </div>
      <span
        aria-hidden
        className="shrink-0 text-2xl text-ink/30 transition-transform group-hover:translate-x-1 group-hover:text-terracotta"
      >
        ›
      </span>
    </Link>
  );
}

/** Link into the cross-event Memories Hub (Photos & Videos · Saved Vendors ·
 *  Editorials) — the account-level "Collection" of the person-spine model. */
function CollectionLink() {
  return (
    <Link
      href="/dashboard/library"
      className="group flex items-center justify-between gap-4 rounded-lg border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5"
    >
      <div>
        <p className="text-sm font-medium text-ink">Memories Hub</p>
        <p className="text-xs text-ink/55">
          Photos &amp; videos · editorials · saved vendors — across all your events
        </p>
      </div>
      <span aria-hidden className="text-ink/40 group-hover:text-terracotta">
        ›
      </span>
    </Link>
  );
}

/**
 * Role-switch rows — iteration 0000 § event switcher (locked 2026-05-15).
 * Renders below the events for vendor/admin accounts (who land on this hub per
 * the 2026-07-04 rule): Shop console when the user owns / sits on any vendor,
 * Setnayan HQ when the user has any admin grant. Multiple vendors expand into
 * a sub-list. Preserved from the prior picker.
 */
function RoleSwitchRows({ roles }: { roles: UserRoleSummary }) {
  return (
    <div className="border-t border-ink/10 pt-4">
      <p className="text-sm font-semibold text-ink/70">Switch</p>
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

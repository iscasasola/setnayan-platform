import { Suspense, type ReactNode, type ComponentType } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Sparkles,
  Store,
  ShieldCheck,
  Plus,
  ArrowUpRight,
  Users,
  LayoutGrid,
  Wand2,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchUserEvents, type EventWithRole } from '@/lib/events';
import { fetchChecklistItems, daysUntilEvent } from '@/lib/checklist';
import { deriveMonogram } from '@/lib/monogram';
import { fetchUserRoleSummary } from '@/lib/roles';
import { logQueryError } from '@/lib/supabase/error-detect';
import { ProgressRing } from '@/app/_components/progress-ring';
import { accountAutosurfaceEnabled } from '@/lib/account-autosurface-flag';
import { AutoSurfacedEvents } from '../(account)/_components/autosurfaced-events';
import { personLifeStoriesEnabled } from '@/lib/person-life-stories';
import { lifeStoryEnabled } from '@/lib/life-story-flag';
import {
  LifeFlashHomeCard,
  LifeFlashHomeCardSkeleton,
} from '../(account)/_components/life-flash-home-card';
import { getMyLifeStory } from '../(account)/people/life-stories';
import {
  LifeStorySection,
  type LifeStoryGroup,
} from '../(account)/_components/life-story-section';

export const metadata = {
  title: 'Your events',
};

/**
 * "Where to?" — the full-screen account LAUNCHER (owner design 2026-07-09,
 * "splash screen to control where they want to go"). This route lives in its own
 * `(launcher)` group (NOT the `(account)` sidebar group), so it renders
 * chrome-less: a slim top bar (brand · notifications · account menu, from
 * `(launcher)/layout.tsx`) over three tile groups —
 *   • YOUR EVENTS — upcoming events as rich cards (badge · monogram · place/date ·
 *     a wine progress ring · N-days) + a "New event" tile. FINISHED (past +
 *     archived) events are hidden behind a "Show all events" toggle (`?show=all`).
 *   • YOUR SPACES — the doorways into surfaces with their OWN dashboards:
 *     Life Story · Your shop (vendor console, gated) · HQ (admin console, gated).
 *   • YOUR ACCOUNT — the remaining account features as tiles: People · Memories
 *     Hub · Setnayan AI. (Notifications = the top-bar bell; Settings + sign-out =
 *     the top-bar account menu.)
 *
 * Marketplace is intentionally NOT a launcher tile — vendor discovery is an
 * in-event surface (`/explore` from an event), not an account-level destination.
 *
 * Landing rule (owner 2026-07-04, preserved): a single-event, non-console user
 * still jumps straight into their one event; a 0-event console user is sent to
 * create-event; everyone else lands on this launcher.
 *
 * Flag-gated blocks preserved (all default-OFF in prod): LifeFlashHomeCard
 * (`lifeStoryEnabled`), AutoSurfacedEvents (`accountAutosurfaceEnabled`), and the
 * person-spine "Your story" section (`personLifeStoriesEnabled`).
 */

/**
 * event_type → short badge. Filipino term where one is well established
 * (kasal · binyag · kaarawan · anibersaryo), else an uppercased English label —
 * matching the owner mockup (KASAL / BINYAG / DEBUT). Extend as verticals grow.
 */
const EVENT_TYPE_BADGE: Record<string, string> = {
  wedding: 'KASAL',
  christening: 'BINYAG',
  baptism: 'BINYAG',
  debut: 'DEBUT',
  birthday: 'KAARAWAN',
  anniversary: 'ANIBERSARYO',
};

function eventTypeBadge(type: string): string {
  return (
    EVENT_TYPE_BADGE[type] ??
    type
      .split(/[_\s]+/)
      .filter(Boolean)
      .join(' ')
      .toUpperCase()
  );
}

/** Big faint monogram letter for the card header — the event's set monogram,
 *  else the derived initials, else the first letter of the name. */
function monogramLetter(event: EventWithRole): string {
  const src =
    event.monogram_text?.trim() ||
    deriveMonogram(event.display_name ?? '') ||
    event.display_name ||
    '';
  return (src.charAt(0) || '·').toUpperCase();
}

/** Short "Mon D" date matching the mockup (tz-safe, date-only). */
function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
  ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Best-effort place for the meta line. venue_name when set, else a leading
 *  segment of the free-text address (there is no venue_city column). */
function placeLabel(event: EventWithRole): string | null {
  if (event.venue_name?.trim()) return event.venue_name.trim();
  const addr = event.venue_address?.trim();
  if (!addr) return null;
  return addr.split(',')[0]?.trim() || null;
}

export default async function LauncherPage({
  searchParams,
}: {
  searchParams?: Promise<{ show?: string }>;
}) {
  const user = await getCurrentUser();
  // Layout already redirects to /login if no user; this is for type narrowing.
  if (!user) redirect('/login');
  const supabase = await createClient();
  const sp = (await searchParams) ?? {};
  const showAll = sp.show === 'all';

  // OAuth-race graceful-degrade shielding (preserved from the prior hub): the
  // users / events rows this page reads are the SAME rows supabase-auth just
  // inserted via the auth → public.users sync trigger, so reads can race the
  // JWT/trigger commit for ~1-2s right after a Google / Facebook OAuth callback.
  // Every query graceful-degrades with a safe default so the page renders the
  // launcher instead of flashing the global error boundary.
  const [events, profileRes, roles] = await Promise.all([
    fetchUserEvents(supabase, user.id, 'couple').catch((err: unknown) => {
      logQueryError(
        'Launcher (fetchUserEvents threw)',
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
          'Launcher (users.display_name SELECT threw)',
          caught instanceof Error ? caught : new Error(String(caught)),
          { user_id: user.id },
          'graceful_degrade',
        );
        return { data: null, error: null } as never;
      }
    })(),
    fetchUserRoleSummary(supabase, user.id).catch((err: unknown) => {
      logQueryError(
        'Launcher (fetchUserRoleSummary threw)',
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
  const hasConsole = roles.hasVendorAccess || roles.hasAdminAccess;

  // Landing (owner 2026-07-04, preserved verbatim from the prior hub):
  //   - single-event, non-console user → jump straight into their one event.
  //   - 0-event console user → send to create-event.
  //   - everyone else → render the launcher below.
  if (active.length === 1 && !hasConsole) {
    redirect(`/dashboard/${active[0]!.event_id}`);
  }
  if (active.length === 0 && hasConsole) {
    redirect('/dashboard/create-event');
  }

  // Split for display: upcoming (shown) vs finished (hidden behind "Show all").
  // Finished = archived OR the event date has passed (PH-local date compare).
  const todayISO = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Manila',
  });
  const isPast = (e: EventWithRole) =>
    !!e.event_date && e.event_date.slice(0, 10) < todayISO;
  const upcoming = active.filter((e) => !isPast(e));
  const finished = [...active.filter(isPast), ...events.filter((e) => e.archived)];

  const profile = profileRes.data;
  const greeting =
    profile?.display_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'there';
  const noEvents = events.length === 0;

  // "% planned" per event — real done/total from the event checklist, fetched in
  // parallel (event count is small). Null when an event has no checklist rows yet
  // → the card shows the countdown without a fabricated percentage. Only the
  // non-archived set is scored; archived cards read null (caption only).
  const progressEntries = await Promise.all(
    active.map(async (e): Promise<[string, number | null]> => {
      try {
        const items = await fetchChecklistItems(supabase, e.event_id);
        if (items.length === 0) return [e.event_id, null];
        const done = items.filter((i) => i.status === 'done').length;
        return [e.event_id, Math.round((done / items.length) * 100)];
      } catch {
        return [e.event_id, null];
      }
    }),
  );
  const progressByEvent = new Map<string, number | null>(progressEntries);

  // Person-spine · Phase 2 · Life Stories (STAGED / flag-off / counsel-gated).
  // Runs ONLY when the flag is on; otherwise `lifeStoryGroups` stays null and the
  // "Your story" section never renders — zero visible change in production.
  const lifeStoryGroups = personLifeStoriesEnabled()
    ? await buildLifeStoryGroups(supabase)
    : null;

  // YOUR SPACES — doorways into surfaces with their own dashboards. Marketplace
  // is intentionally excluded (it's an in-event vendor-discovery surface).
  // Life Story → the Life-Flash experience (/dashboard/life-flash) when its
  // rollout flag is on; that route `notFound()`s while the flag is off, so in
  // prod (flag off) the card falls back to the Memories Hub until launch.
  const spaces: SpaceCardProps[] = [
    {
      href: lifeStoryEnabled() ? '/dashboard/life-flash' : '/dashboard/library',
      icon: Sparkles,
      title: 'Life Story',
      subtitle: 'Your whole life, from every celebration.',
      tone: 'hero',
    },
  ];
  if (roles.hasVendorAccess) {
    spaces.push({
      href: '/vendor-dashboard',
      icon: Store,
      title: 'Your shop',
      subtitle: `${roles.vendorProfiles[0]?.business_name ?? 'Your business'} · Vendor`,
      tone: 'default',
    });
  }
  if (roles.hasAdminAccess) {
    spaces.push({
      href: '/admin',
      icon: ShieldCheck,
      title: 'HQ',
      subtitle: 'Admin console',
      tone: 'admin',
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-8 space-y-2">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/45">
          <span aria-hidden className="h-px w-5 bg-mulberry/60" />
          Kumusta, {greeting} · {noEvents ? 'Welcome' : 'Welcome back'}
        </p>
        <h1 className="m-serif text-3xl leading-tight text-ink sm:text-[2.6rem]">
          Where to?{' '}
          <span className="text-ink/40">
            {noEvents
              ? 'Let’s set up your first event.'
              : 'Pick up where you left off.'}
          </span>
        </h1>
      </header>

      <section className="mb-10">
        <SectionLabel
          action={
            finished.length > 0 ? (
              <ShowAllToggle showAll={showAll} />
            ) : null
          }
        >
          Your events
        </SectionLabel>
        <div className="flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:thin] sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4">
          {upcoming.map((event) => (
            <EventCard
              key={event.event_id}
              event={event}
              pct={progressByEvent.get(event.event_id) ?? null}
            />
          ))}
          {showAll
            ? finished.map((event) => (
                <EventCard
                  key={event.event_id}
                  event={event}
                  pct={progressByEvent.get(event.event_id) ?? null}
                  finished
                />
              ))
            : null}
          <NewEventCard />
        </div>
        {!showAll && finished.length > 0 ? (
          <p className="mt-3 text-xs text-ink/40">
            {finished.length} finished event{finished.length > 1 ? 's' : ''} hidden
          </p>
        ) : null}
      </section>

      <section className="mb-10">
        <SectionLabel>Your spaces</SectionLabel>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {spaces.map((space) => (
            <SpaceCard key={space.href + space.title} {...space} />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>Your account</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <AccountTile
            href="/dashboard/people"
            icon={Users}
            title="People"
            subtitle="Everyone across your events"
          />
          <AccountTile
            href="/dashboard/library"
            icon={LayoutGrid}
            title="Memories Hub"
            subtitle="Photos · videos · saved vendors"
          />
          <AccountTile
            href="/dashboard/setnayan-ai"
            icon={Wand2}
            title="Setnayan AI"
            subtitle="Your planning copilot"
          />
        </div>
      </section>

      {/* Flag-gated (default OFF in prod). LIFE-FLASH home card. */}
      {lifeStoryEnabled() ? (
        <div className="mt-10">
          <Suspense fallback={<LifeFlashHomeCardSkeleton />}>
            <LifeFlashHomeCard userId={user.id} />
          </Suspense>
        </div>
      ) : null}

      {/* #7b (gap G5): events auto-surfaced to this account + a one-tap Leave.
          Flag-gated so there is ZERO extra query while FEATURE_ACCOUNT_AUTOSURFACE
          is off (the default). */}
      {accountAutosurfaceEnabled() ? (
        <div className="mt-10">
          <AutoSurfacedEvents userId={user.id} />
        </div>
      ) : null}

      {lifeStoryGroups ? (
        <section className="mt-10">
          <SectionLabel>Your story</SectionLabel>
          {lifeStoryGroups.length === 0 ? (
            <p className="rounded-2xl border border-ink/10 bg-cream/50 px-4 py-6 text-sm text-ink/60">
              Photos and clips you appear in will gather here.
            </p>
          ) : (
            <LifeStorySection groups={lifeStoryGroups} />
          )}
        </section>
      ) : null}
    </div>
  );
}

/**
 * Assemble the signed-in person's life story into per-event groups for the
 * flag-gated "Your story" section. Reads the flag-guarded `getMyLifeStory`
 * (returns [] while the flag is off / no person node), then resolves each
 * event's display_name in ONE lookup and groups items by event (newest-first).
 * Only ever called when the flag is on.
 */
async function buildLifeStoryGroups(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<LifeStoryGroup[]> {
  const items = await getMyLifeStory({ includeHidden: true });
  if (items.length === 0) return [];

  const eventIds = [...new Set(items.map((i) => i.eventId))];
  const nameById = new Map<string, string | null>();
  const { data: eventRows } = await supabase
    .from('events')
    .select('event_id, display_name')
    .in('event_id', eventIds);
  for (const row of (eventRows ?? []) as Array<{
    event_id: string;
    display_name: string | null;
  }>) {
    nameById.set(row.event_id, row.display_name);
  }

  // Group by event, keeping the newest-first ordering getMyLifeStory returns.
  const byEvent = new Map<string, LifeStoryGroup>();
  for (const item of items) {
    let group = byEvent.get(item.eventId);
    if (!group) {
      group = {
        eventId: item.eventId,
        eventName: nameById.get(item.eventId) ?? null,
        items: [],
      };
      byEvent.set(item.eventId, group);
    }
    group.items.push({
      storyItemId: item.storyItemId,
      itemKind: item.itemKind,
      hiddenAt: item.hiddenAt,
    });
  }
  return [...byEvent.values()];
}

/** Uppercase letter-spaced section label + optional right-aligned action. */
function SectionLabel({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">
        {children}
      </h2>
      {action}
    </div>
  );
}

/**
 * "Show all events" toggle — a checkbox-styled link that flips the `?show=all`
 * search param (server-only; no client JS). Reveals the finished/archived
 * events, which are hidden by default. `scroll={false}` keeps the viewport put.
 */
function ShowAllToggle({ showAll }: { showAll: boolean }) {
  return (
    <Link
      href={showAll ? '/dashboard' : '/dashboard?show=all'}
      scroll={false}
      className="flex items-center gap-2 text-xs font-medium text-ink/55 transition-colors hover:text-mulberry"
    >
      <span
        aria-hidden
        className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
          showAll ? 'border-mulberry bg-mulberry text-white' : 'border-ink/25'
        }`}
      >
        {showAll ? <Check className="h-3 w-3" /> : null}
      </span>
      Show all events
    </Link>
  );
}

/** A rich event card — badge · monogram · title · place/date · progress ring. */
function EventCard({
  event,
  pct,
  finished,
}: {
  event: EventWithRole;
  pct: number | null;
  finished?: boolean;
}) {
  const badge = eventTypeBadge(event.event_type);
  const letter = monogramLetter(event);
  const days = daysUntilEvent(event.event_date);
  const place = placeLabel(event);
  const dateLabel = shortDate(event.event_date);
  const meta = [place, dateLabel].filter(Boolean).join(' · ') || 'In planning';
  const countdown =
    days == null
      ? null
      : days > 1
        ? `${days} days`
        : days === 1
          ? '1 day'
          : days === 0
            ? 'today'
            : null;
  const caption = finished
    ? pct != null
      ? `${pct}% planned · done`
      : 'Wrapped'
    : pct != null
      ? `Planned${countdown ? ` · ${countdown}` : ''}`
      : countdown
        ? `${countdown} to go`
        : 'In planning';

  return (
    <Link
      href={`/dashboard/${event.event_id}`}
      className={`group flex min-h-[11rem] min-w-[15rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-ink/10 bg-cream transition-all hover:-translate-y-0.5 hover:border-mulberry/30 hover:shadow-lg sm:min-w-0 ${
        finished ? 'opacity-70 hover:opacity-100' : ''
      }`}
    >
      <div className="relative h-20 bg-gradient-to-br from-mulberry/12 via-mulberry/5 to-transparent">
        <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-mulberry shadow-sm">
          {badge}
        </span>
        <span
          aria-hidden
          className="m-serif pointer-events-none absolute -bottom-3 right-3 select-none text-6xl leading-none text-mulberry/20"
        >
          {letter}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="flex items-center gap-1.5 text-base font-semibold text-ink">
          {event.is_primary ? (
            <span aria-hidden className="shrink-0 text-terracotta">
              ★
            </span>
          ) : null}
          <span className="truncate">{event.display_name}</span>
        </p>
        <p className="truncate text-sm text-ink/55">{meta}</p>
        <div className="mt-auto flex items-center gap-2.5 pt-3">
          {pct != null ? (
            <ProgressRing pct={pct} size={42} stroke={4}>
              <span className="text-[9px] font-semibold text-ink">{pct}%</span>
            </ProgressRing>
          ) : null}
          <p className="text-xs text-ink/55">{caption}</p>
        </div>
      </div>
    </Link>
  );
}

/** Dashed "New event" tile — same footprint as an event card. */
function NewEventCard() {
  return (
    <Link
      href="/dashboard/create-event"
      className="group flex min-h-[11rem] min-w-[15rem] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/20 bg-cream/40 p-4 text-center transition-colors hover:border-mulberry/40 hover:bg-mulberry/5 sm:min-w-0"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 text-ink/50 transition-colors group-hover:border-mulberry/40 group-hover:text-mulberry"
      >
        <Plus className="h-5 w-5" />
      </span>
      <span className="text-sm font-medium text-ink/70 group-hover:text-ink">
        New event
      </span>
    </Link>
  );
}

type SpaceCardProps = {
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  /** hero = obsidian Life-Story card · admin = violet accent · default = wine. */
  tone: 'hero' | 'admin' | 'default';
};

/** One "YOUR SPACES" doorway card. */
function SpaceCard({ href, icon: Icon, title, subtitle, tone }: SpaceCardProps) {
  const hero = tone === 'hero';
  const admin = tone === 'admin';
  return (
    <Link
      href={href}
      className={`group flex min-h-[9rem] flex-col justify-between rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        hero
          ? 'border-white/10 bg-gradient-to-br from-[#3f1a2e] to-[#1E2229] text-white'
          : 'border-ink/10 bg-cream text-ink hover:border-mulberry/30'
      }`}
    >
      <div className="flex items-start justify-between">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            hero
              ? 'bg-white/10 text-white'
              : admin
                ? 'bg-violet-100 text-violet-700'
                : 'bg-mulberry/10 text-mulberry'
          }`}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <ArrowUpRight
          aria-hidden
          className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
            hero ? 'text-white/40' : 'text-ink/30'
          }`}
        />
      </div>
      <div className="space-y-0.5">
        <p className={`m-serif text-lg ${hero ? 'text-white' : 'text-ink'}`}>
          {title}
        </p>
        <p className={`text-xs ${hero ? 'text-white/60' : 'text-ink/55'}`}>
          {subtitle}
        </p>
      </div>
    </Link>
  );
}

/** A compact "YOUR ACCOUNT" tile — icon chip + title + subtitle, horizontal. */
function AccountTile({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-ink/10 bg-cream p-4 transition-all hover:-translate-y-0.5 hover:border-mulberry/30 hover:shadow-lg"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mulberry/10 text-mulberry">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block truncate text-xs text-ink/55">{subtitle}</span>
      </span>
    </Link>
  );
}

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
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchUserEvents, type EventWithRole } from '@/lib/events';
import {
  fetchChecklistItems,
  daysUntilEvent,
  dueDateForItem,
} from '@/lib/checklist';
import { fetchUserRoleSummary } from '@/lib/roles';
import {
  fetchEventDecisionCounts,
  fetchEventUnreadCounts,
  fetchVendorUnreadCounts,
  summarizeEventDecisions,
  type EventDecisionSummary,
} from '@/lib/event-decisions';
import { getAdminQueueDigest, ADMIN_QUEUE_META } from '@/lib/admin/queue-counts';
import { logQueryError } from '@/lib/supabase/error-detect';
import { ProgressRing } from '@/app/_components/progress-ring';
import { EventMonogram } from '@/app/_components/event-monogram';
import { ShopLogo } from './_components/shop-logo';
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
 *     a gold progress ring · N-days) + a "New event" tile. FINISHED (past +
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
        ownedShopCount: 0,
        canOpenShop: false,
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
  // Per-event checklist pass — one fetch each (event count is small), reused for
  // BOTH the "% planned" ring AND the overdue-task decision signal below.
  const checklistEntries = await Promise.all(
    active.map(
      async (
        e,
      ): Promise<[string, { pct: number | null; overdue: number }]> => {
        try {
          const items = await fetchChecklistItems(supabase, e.event_id);
          if (items.length === 0) return [e.event_id, { pct: null, overdue: 0 }];
          const done = items.filter((i) => i.status === 'done').length;
          const overdue = items.filter((i) => {
            if (i.status !== 'pending') return false;
            const due = dueDateForItem(e.event_date, i.due_offset_days);
            return !!due && due < todayISO;
          }).length;
          return [
            e.event_id,
            { pct: Math.round((done / items.length) * 100), overdue },
          ];
        } catch {
          return [e.event_id, { pct: null, overdue: 0 }];
        }
      },
    ),
  );
  const checklistByEvent = new Map(checklistEntries);
  const progressByEvent = new Map<string, number | null>(
    checklistEntries.map(([id, v]) => [id, v.pct]),
  );

  // "Needs a decision now" per event — the pay + approve signals (batched into
  // two queries) merged with the overdue-task count from the checklist pass. A
  // named action line, not a bare badge (owner 2026-07-10). Graceful-degrades to
  // an empty summary; a card with nothing pending shows no attention line.
  const [decisionCounts, unreadByEvent] = await Promise.all([
    fetchEventDecisionCounts(
      supabase,
      active.map((e) => e.event_id),
    ).catch(() => new Map<string, { pay: number; approve: number }>()),
    fetchEventUnreadCounts(supabase).catch(() => new Map<string, number>()),
  ]);
  const decisionByEvent = new Map<string, EventDecisionSummary>();
  for (const e of active) {
    const c = decisionCounts.get(e.event_id) ?? { pay: 0, approve: 0 };
    // Overdue tasks are meaningless once the date has passed, so a finished
    // event still surfaces pay / approve / message decisions but not a
    // "50 tasks overdue" line for a wedding that already happened.
    const overdue = isPast(e)
      ? 0
      : (checklistByEvent.get(e.event_id)?.overdue ?? 0);
    const message = unreadByEvent.get(e.event_id) ?? 0;
    decisionByEvent.set(
      e.event_id,
      summarizeEventDecisions({
        pay: c.pay,
        approve: c.approve,
        message,
        overdue,
      }),
    );
  }

  // Person-spine · Phase 2 · Life Stories (STAGED / flag-off / counsel-gated).
  // Runs ONLY when the flag is on; otherwise `lifeStoryGroups` stays null and the
  // "Your story" section never renders — zero visible change in production.
  const lifeStoryGroups = personLifeStoriesEnabled()
    ? await buildLifeStoryGroups(supabase)
    : null;

  // YOUR SPACES — doorways into surfaces with their own dashboards. Marketplace
  // is intentionally excluded (it's an in-event vendor-discovery surface).
  //
  // Life Story dedup (owner default, reversible via `lifeStoryEnabled`): when the
  // flag is ON, the richer <LifeFlashHomeCard/> below is the SOLE Life-Story
  // doorway, so we DROP this flat hero SpaceCard to avoid rendering the surface
  // twice. When the flag is OFF (prod today), the flat hero card stays as the
  // fallback into the Memories Hub (/dashboard/library) — prod is unchanged.
  // Vendor shop "needs a reply" signal — pending client inquiries per shop
  // (chat_threads.inquiry_status = 'pending' = a couple messaged and the vendor
  // hasn't accepted yet). One batched query across all the user's shops.
  const shopIds = roles.vendorProfiles.map((v) => v.vendor_profile_id);
  const inquiryByShop = new Map<string, number>();
  // Unread REPLIES per shop (accepted conversations with a waiting reply) — the
  // vendor-side twin of the couple event-card message signal.
  const unreadByShop = shopIds.length > 0
    ? await fetchVendorUnreadCounts(supabase).catch(() => new Map<string, number>())
    : new Map<string, number>();
  if (shopIds.length > 0) {
    try {
      const { data } = await supabase
        .from('chat_threads')
        .select('vendor_profile_id')
        .in('vendor_profile_id', shopIds)
        .eq('inquiry_status', 'pending');
      for (const row of (data ?? []) as Array<{
        vendor_profile_id: string | null;
      }>) {
        if (row.vendor_profile_id) {
          inquiryByShop.set(
            row.vendor_profile_id,
            (inquiryByShop.get(row.vendor_profile_id) ?? 0) + 1,
          );
        }
      }
    } catch {
      // graceful-degrade: no attention line rather than a broken launcher.
    }
  }

  // Admin HQ "awaiting review" signal — open items across the ACTIONABLE work
  // queues. Deliberately excludes the `support` lane (help desk, review appeals)
  // so ongoing support volume doesn't inflate the count next to real gating
  // decisions (payments, verification, disputes, approvals). Gated to admins, so
  // the per-queue count fan-out never runs for a plain couple.
  let adminOpenTotal = 0;
  if (roles.hasAdminAccess) {
    try {
      const digest = await getAdminQueueDigest();
      for (const [key, meta] of Object.entries(ADMIN_QUEUE_META)) {
        if (meta.lane === 'support') continue;
        adminOpenTotal += Math.max(0, digest[key]?.count ?? 0);
      }
    } catch {
      adminOpenTotal = 0;
    }
  }

  const lifeOn = lifeStoryEnabled();
  const spaces: SpaceCardProps[] = [];
  if (!lifeOn) {
    spaces.push({
      href: '/dashboard/library',
      icon: Sparkles,
      title: 'Life Story',
      subtitle: 'Your whole life, from every celebration.',
      tone: 'hero',
    });
  }
  // YOUR SPACES → the vendor's actual shop(s), by name. One card per shop the
  // user owns or is on the team of (owner: "show what shop we have"), so a
  // multi-shop vendor sees each business by name instead of a single generic
  // "Your shop" tile. Logo when set; the store glyph otherwise.
  const inquiryLabel = (n: number) =>
    `${n} new ${n === 1 ? 'inquiry' : 'inquiries'}`;
  const unreadChatLabel = (n: number) =>
    `${n} unread ${n === 1 ? 'chat' : 'chats'}`;
  // A shop needs a reply for either a brand-new inquiry OR an unread message in
  // an accepted chat. New inquiries lead the line (they gate the conversation);
  // unread chats fall through.
  const shopAttention = (inquiries: number, unread: number) =>
    inquiries > 0
      ? inquiryLabel(inquiries)
      : unread > 0
        ? unreadChatLabel(unread)
        : undefined;
  const shopNeedCount = (vpId: string) =>
    (inquiryByShop.get(vpId) ?? 0) + (unreadByShop.get(vpId) ?? 0);
  if (roles.hasVendorAccess) {
    // Cap the number of shop tiles so a many-shop vendor's section stays short;
    // the rest collapse into a single "N more shops" tile. Rank shops that need
    // a reply first so a waiting shop is never hidden behind the cap, and the
    // "more" tile still surfaces what's waiting among the shops it hides.
    const MAX_SHOP_CARDS = 3;
    const ranked = [...roles.vendorProfiles].sort(
      (a, b) =>
        shopNeedCount(b.vendor_profile_id) - shopNeedCount(a.vendor_profile_id),
    );
    const shown = ranked.slice(0, MAX_SHOP_CARDS);
    const hidden = ranked.slice(MAX_SHOP_CARDS);
    for (const vp of shown) {
      spaces.push({
        id: vp.vendor_profile_id,
        href: '/vendor-dashboard',
        icon: Store,
        logoUrl: vp.logo_url,
        title: vp.business_name,
        subtitle: 'Vendor shop',
        tone: 'default',
        attention: shopAttention(
          inquiryByShop.get(vp.vendor_profile_id) ?? 0,
          unreadByShop.get(vp.vendor_profile_id) ?? 0,
        ),
      });
    }
    if (hidden.length > 0) {
      const hiddenInquiries = hidden.reduce(
        (sum, vp) => sum + (inquiryByShop.get(vp.vendor_profile_id) ?? 0),
        0,
      );
      const hiddenUnread = hidden.reduce(
        (sum, vp) => sum + (unreadByShop.get(vp.vendor_profile_id) ?? 0),
        0,
      );
      spaces.push({
        id: 'more-shops',
        href: '/vendor-dashboard',
        icon: Store,
        title: `${hidden.length} more ${hidden.length === 1 ? 'shop' : 'shops'}`,
        subtitle: 'See all your shops',
        tone: 'default',
        attention: shopAttention(hiddenInquiries, hiddenUnread),
      });
    }
  }
  if (roles.hasAdminAccess) {
    spaces.push({
      href: '/admin',
      icon: ShieldCheck,
      title: 'HQ',
      subtitle: 'Admin console',
      tone: 'admin',
      attention:
        adminOpenTotal > 0 ? `${adminOpenTotal} awaiting review` : undefined,
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
              decision={decisionByEvent.get(event.event_id) ?? null}
            />
          ))}
          {showAll
            ? finished.map((event) => (
                <EventCard
                  key={event.event_id}
                  event={event}
                  pct={progressByEvent.get(event.event_id) ?? null}
                  decision={decisionByEvent.get(event.event_id) ?? null}
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
            <SpaceCard key={space.id ?? space.href + space.title} {...space} />
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

      {/* Flag-gated (default OFF in prod). LIFE-FLASH home card — the SOLE
          Life-Story doorway when the flag is on (the flat hero SpaceCard above
          is dropped in that case; see the `spaces` construction). */}
      {lifeOn ? (
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

/** A rich event card — badge · monogram · title · place/date · progress ring ·
 *  a "needs a decision" line when something is waiting on the couple. */
function EventCard({
  event,
  pct,
  decision,
  finished,
}: {
  event: EventWithRole;
  pct: number | null;
  decision: EventDecisionSummary | null;
  finished?: boolean;
}) {
  const badge = eventTypeBadge(event.event_type);
  const days = daysUntilEvent(event.event_date);
  const place = placeLabel(event);
  const dateLabel = shortDate(event.event_date);
  // WHEN + WHERE on one line — the date leads, place trails. Never blank: an
  // event with neither reads "Date to be set" so the card is self-explanatory.
  const dateMeta =
    [dateLabel, place].filter(Boolean).join(' · ') || 'Date to be set';
  // WHAT'S NEXT — a plain-language countdown, not the ambiguous "Planned" of the
  // old caption. Past dates fall through to the finished / status branches.
  const countdown =
    days == null
      ? null
      : days > 1
        ? `${days} days to go`
        : days === 1
          ? 'Tomorrow'
          : days === 0
            ? 'Happening today'
            : null;
  const status = finished
    ? 'Celebrated'
    : (countdown ?? (pct != null ? 'Planning underway' : 'Just getting started'));
  // The ring already draws the number; this line just tells you what it means.
  const plannedLabel = pct != null ? `${pct}% planned` : null;

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
        {/* The event's REAL monogram (uploaded / bespoke SVG · framed lockup ·
            lettered), not a faint decorative initial. Uploaded outranks custom
            per the app-wide precedence; EventMonogram only reads
            monogram_custom_svg, so resolve it here. */}
        <EventMonogram
          event={{
            ...event,
            monogram_custom_svg:
              event.monogram_uploaded_svg ?? event.monogram_custom_svg,
          }}
          size="lg"
          className="absolute bottom-3 right-3 shadow-md ring-1 ring-black/5"
        />
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
        <p className="truncate text-sm text-ink/55">{dateMeta}</p>
        <div className="mt-auto space-y-2 pt-3">
          <div className="flex items-center gap-2.5">
            {pct != null ? (
              <ProgressRing pct={pct} size={42} stroke={4}>
                <span className="text-[9px] font-semibold text-ink">{pct}%</span>
              </ProgressRing>
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-ink">{status}</p>
              {plannedLabel ? (
                <p className="truncate text-[11px] text-ink/45">
                  {plannedLabel}
                </p>
              ) : null}
            </div>
          </div>
          {decision?.top ? (
            <AttentionPill
              label={decision.top.label}
              more={decision.total - decision.top.count}
            />
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/**
 * The "needs a decision now" line — a gold pill naming the top pending
 * action (+ "· N more" when other kinds are also waiting). Named, not a bare
 * count badge, so the couple knows WHAT before they click (owner 2026-07-10).
 * Reused on the vendor shop + admin HQ cards.
 */
function AttentionPill({ label, more = 0 }: { label: string; more?: number }) {
  return (
    <span className="flex items-center gap-1.5 rounded-lg bg-warn-100 px-2 py-1 text-warn-900">
      <AlertCircle aria-hidden className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate text-[11px] font-medium">
        {label}
        {more > 0 ? (
          <span className="font-normal text-warn-900/70"> · {more} more</span>
        ) : null}
      </span>
    </span>
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
  /** Stable key when several cards share an href (e.g. one per vendor shop). */
  id?: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  /** Shop logo — shown in the icon chip in place of the glyph when set. */
  logoUrl?: string | null;
  title: string;
  subtitle: string;
  /** hero = gold-to-ink Life-Story card · admin = violet accent · default = gold. */
  tone: 'hero' | 'admin' | 'default';
  /** "Needs a decision" line (e.g. "3 new inquiries" · "5 awaiting review"). */
  attention?: string;
};

/** One "YOUR SPACES" doorway card. */
function SpaceCard({
  href,
  icon: Icon,
  logoUrl,
  title,
  subtitle,
  tone,
  attention,
}: SpaceCardProps) {
  const hero = tone === 'hero';
  const admin = tone === 'admin';
  return (
    <Link
      href={href}
      className={`group flex min-h-[9rem] flex-col justify-between rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        hero
          ? 'border-white/10 bg-gradient-to-br from-[#8a6b39] to-[#1B1A17] text-white'
          : 'border-ink/10 bg-cream text-ink hover:border-mulberry/30'
      }`}
    >
      <div className="flex items-start justify-between">
        <span
          className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl ${
            hero
              ? 'bg-white/10 text-white'
              : admin
                ? 'bg-violet-100 text-violet-700'
                : 'bg-mulberry/10 text-mulberry'
          }`}
        >
          {logoUrl ? (
            <ShopLogo
              src={logoUrl}
              fallback={<Icon className="h-[18px] w-[18px]" />}
            />
          ) : (
            <Icon className="h-[18px] w-[18px]" />
          )}
        </span>
        <ArrowUpRight
          aria-hidden
          className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
            hero ? 'text-white/40' : 'text-ink/30'
          }`}
        />
      </div>
      <div className="space-y-1.5">
        <div className="space-y-0.5">
          <p className={`m-serif text-lg ${hero ? 'text-white' : 'text-ink'}`}>
            {title}
          </p>
          <p className={`text-xs ${hero ? 'text-white/60' : 'text-ink/55'}`}>
            {subtitle}
          </p>
        </div>
        {attention ? <AttentionPill label={attention} /> : null}
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

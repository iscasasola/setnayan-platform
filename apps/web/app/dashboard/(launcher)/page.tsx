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
import { YearMomentsStrip } from './_components/year-moments-strip';
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
import { PhotosTab } from '../(account)/library/_components/photos-tab';
import { Expandable } from './_components/expandable';
import { PeopleInline, LifeStoryInline } from './_components/account-inline';
import {
  HomeCommandBar,
  type HomeCommandItem,
} from './_components/home-command-bar';

export const metadata = {
  title: 'Your events',
};

/**
 * "Where to?" — the full-screen account LAUNCHER, remodeled to the FOUR-SURFACE
 * home (owner-approved final design 2026-07-15, "build it"; council verdict
 * `User_Home_Redesign_Council_Verdict_2026-07-14.md` in the spec corpus). Every
 * block has exactly ONE home — no duplicated surfaces:
 *   • EVENTS — ongoing + upcoming events as glass cards (badge · monogram ·
 *     place/date · gold progress ring · countdown · attention line), date
 *     DESCENDING (newest on top, per the 2026-07-13 timeline ordering rule),
 *     ending in a "New event" card. COMPLETED (past) + archived stay hidden
 *     behind "Show all" (`?show=all`) and read "Celebrated". Each card jumps
 *     into its event dashboard — an allowed navigation.
 *   • ALAALA — the single memory dimension (owner-confirmed name 2026-07-14). It
 *     absorbs what used to be four sibling zones: the Life Story doorway ·
 *     "This year" derived moments (YearMomentsStrip, embedded) · Memories Hub ·
 *     People — each still EXPANDS INLINE per the owner 2026-07-13 rule
 *     ("everything on the home page must expand … not open a new page", except
 *     the role-routed dashboards). Flag-gated blocks (LifeFlashHomeCard, the
 *     person-spine "Your story") render inside Alaala when their flags turn on.
 *   • SPACES — the vendor shop(s) + admin HQ doorways; still the only allowed
 *     jumps besides events. Capability-gated: absent for a plain couple.
 *   • YOU — behind the top-bar avatar only (AccountSwitcher: Profile & settings ·
 *     Setnayan AI · sign-out). The on-page "Your account" section is gone — its
 *     rows moved into Alaala (People · Memories Hub) and the avatar menu
 *     (Profile · Setnayan AI), killing the old zone overlap.
 * Plus the deterministic SEARCH bar (HomeCommandBar, ⌘K): client-side jump-to
 * over the user's own events/spaces/destinations — no LLM (Setnayan AI Rule 1).
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
  // Timeline order (owner 2026-07-13): a Facebook-style feed — newest at the top,
  // OLDER as you scroll down. So the spine runs date DESCENDING: furthest-future
  // upcoming event on top, the most imminent one near the bottom, then (only when
  // "Show all" reveals them) completed events continue oldest-toward-the-bottom —
  // a smooth "older as you scroll down" across the upcoming→completed boundary.
  // Undated ("Date to be set") events sit at the tail of the upcoming block.
  const dateKey = (e: EventWithRole) => e.event_date?.slice(0, 10) ?? '';
  const upcoming = active
    .filter((e) => !isPast(e))
    .sort((a, b) => {
      const da = dateKey(a);
      const db = dateKey(b);
      if (!da && !db) return 0;
      if (!da) return 1; // undated → tail
      if (!db) return -1;
      return da < db ? 1 : da > db ? -1 : 0; // latest date first
    });
  const finished = [
    ...active.filter(isPast),
    ...events.filter((e) => e.archived),
  ].sort((a, b) => {
    const da = dateKey(a);
    const db = dateKey(b);
    return da < db ? 1 : da > db ? -1 : 0; // most recent past first → oldest last
  });

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

  // SPACES — doorways into surfaces with their own dashboards. Marketplace
  // is intentionally excluded (it's an in-event vendor-discovery surface).
  // (The Life Story doorway is NOT a space — it renders inside ALAALA, as an
  // Expandable when `lifeStoryEnabled()` is off or the richer LifeFlashHomeCard
  // when on; exactly one doorway either way.)
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
  // SPACES → the vendor's actual shop(s), by name. One card per shop the
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

  // The deterministic search index — the user's OWN events, spaces and account
  // destinations, serialized for the HomeCommandBar client island (no functions
  // across the RSC boundary; icons resolve from string keys client-side).
  const commandItems: HomeCommandItem[] = [
    ...[...upcoming, ...finished].map((e): HomeCommandItem => {
      const dateLabel = shortDate(e.event_date);
      const place = placeLabel(e);
      return {
        id: `event-${e.event_id}`,
        label: e.display_name,
        sublabel:
          [eventTypeBadge(e.event_type), dateLabel ?? 'Date to be set', place]
            .filter(Boolean)
            .join(' · '),
        href: `/dashboard/${e.event_id}`,
        kind: 'event',
        icon: 'calendar',
      };
    }),
    ...spaces.map(
      (s): HomeCommandItem => ({
        id: `space-${s.id ?? s.title}`,
        label: s.title,
        sublabel: s.subtitle,
        href: s.href,
        kind: 'space',
        icon: s.href === '/admin' ? 'shield' : 'store',
      }),
    ),
    {
      id: 'action-new-event',
      label: 'New event',
      sublabel: 'Start planning a new celebration',
      href: '/dashboard/create-event',
      kind: 'action',
      icon: 'plus',
    },
    {
      id: 'action-library',
      label: 'Memories Hub',
      sublabel: 'Photos · videos · saved vendors',
      href: '/dashboard/library',
      kind: 'action',
      icon: 'grid',
    },
    {
      id: 'action-people',
      label: 'People',
      sublabel: 'Everyone across your events',
      href: '/dashboard/people',
      kind: 'action',
      icon: 'users',
    },
    {
      id: 'action-profile',
      label: 'Profile & account',
      sublabel: 'Personal info · security · privacy',
      href: '/dashboard/profile',
      kind: 'action',
      icon: 'user',
    },
    {
      id: 'action-setnayan-ai',
      label: 'Setnayan AI',
      sublabel: 'Your planning copilot',
      href: '/dashboard/setnayan-ai',
      kind: 'action',
      icon: 'wand',
    },
    {
      id: 'action-notifications',
      label: 'Notifications',
      sublabel: 'Everything waiting for you',
      href: '/dashboard/notifications',
      kind: 'action',
      icon: 'bell',
    },
  ];

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

      {/* The deterministic search & jump bar (⌘K) — client-side filtering over
          the user's own events/spaces/destinations. No LLM (Setnayan AI Rule 1). */}
      <div className="mb-10">
        <HomeCommandBar items={commandItems} />
      </div>

      {/* EVENTS — ongoing + upcoming as glass cards, date descending (newest on
          top, owner 2026-07-13 ordering). Completed stay behind "Show all".
          Each card jumps into its event dashboard — an allowed navigation. */}
      <section className="mb-10">
        <SectionLabel
          action={
            finished.length > 0 ? (
              <ShowAllToggle showAll={showAll} />
            ) : null
          }
        >
          Events
        </SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((event) => (
            <GlassEventCard
              key={event.event_id}
              event={event}
              pct={progressByEvent.get(event.event_id) ?? null}
              decision={decisionByEvent.get(event.event_id) ?? null}
            />
          ))}
          {showAll
            ? finished.map((event) => (
                <GlassEventCard
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

      {/* #7b (gap G5): events auto-surfaced to this account + a one-tap Leave.
          Flag-gated so there is ZERO extra query while FEATURE_ACCOUNT_AUTOSURFACE
          is off (the default). Lives with EVENTS — it surfaces events. */}
      {accountAutosurfaceEnabled() ? (
        <div className="mb-10">
          <AutoSurfacedEvents userId={user.id} />
        </div>
      ) : null}

      {/* ALAALA — the single memory dimension (owner-confirmed 2026-07-14): the
          Life Story doorway · "This year" derived moments · Memories Hub ·
          People, each expanding INLINE (owner 2026-07-13 rule). What used to be
          four sibling zones is one surface with one job. */}
      <section className="mb-10">
        <SectionLabel>Alaala</SectionLabel>
        <p className="-mt-1 mb-3 text-xs text-ink/45">
          Every event you hold and attend — kept for life.
        </p>
        <div className="space-y-4">
          {lifeOn ? (
            /* Flag ON: the richer Life-Flash card is the SOLE Life-Story
               doorway (dedup rule preserved from the `spaces` construction). */
            <Suspense fallback={<LifeFlashHomeCardSkeleton />}>
              <LifeFlashHomeCard userId={user.id} />
            </Suspense>
          ) : (
            <Expandable
              icon={<Sparkles className="h-[18px] w-[18px]" />}
              title="Life Story"
              subtitle="Your whole life, from every celebration."
            >
              <LifeStoryInline />
            </Expandable>
          )}

          {/* Date-anchor model — the couple's next few derived moments
              (anniversaries · wedding countdowns). Self-fetching; renders
              nothing when there are no anchors. Embedded = "This year" heading
              inside Alaala instead of its old standalone "Your year" section. */}
          <Suspense fallback={null}>
            <YearMomentsStrip userId={user.id} />
          </Suspense>

          <Expandable
            icon={<LayoutGrid className="h-[18px] w-[18px]" />}
            title="Memories Hub"
            subtitle="Photos · videos · saved vendors"
          >
            <Suspense fallback={<InlinePanelSkeleton />}>
              <PhotosTab userId={user.id} />
            </Suspense>
          </Expandable>
          <Expandable
            icon={<Users className="h-[18px] w-[18px]" />}
            title="People"
            subtitle="Everyone across your events"
          >
            <PeopleInline />
          </Expandable>

          {/* Person-spine "Your story" (flag-gated, counsel-gated) — the
              "with me" lens of Alaala once the flag turns on. */}
          {lifeStoryGroups ? (
            <div>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/40">
                Your story
              </h3>
              {lifeStoryGroups.length === 0 ? (
                <p className="rounded-2xl border border-ink/10 bg-cream/50 px-4 py-6 text-sm text-ink/60">
                  Photos and clips you appear in will gather here.
                </p>
              ) : (
                <LifeStorySection groups={lifeStoryGroups} />
              )}
            </div>
          ) : null}
        </div>
      </section>

      {/* SPACES — the vendor shop(s) + admin HQ doorways. Capability-gated:
          this section simply does not exist for a plain couple. These still
          NAVIGATE (their own dashboards are allowed jumps). */}
      {spaces.length > 0 ? (
        <section>
          <SectionLabel>Spaces</SectionLabel>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {spaces.map((space) => (
              <SpaceCard key={space.id ?? space.href + space.title} {...space} />
            ))}
          </div>
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

/**
 * One EVENTS glass card (owner-approved final design 2026-07-15). A frosted
 * panel over the warm paper — the Atelier + macOS-glass language (owner-locked
 * 2026-07-12) — carrying the same signals as the old timeline node: badge ·
 * monogram · place/date · gold progress ring · countdown · attention line.
 * The card jumps into the event dashboard — an allowed navigation.
 */
function GlassEventCard({
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
  // WHAT'S NEXT — a plain-language countdown. Past dates fall through to the
  // finished / status branches.
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
  const plannedLabel = pct != null ? `${pct}% planned` : null;

  return (
    <Link
      href={`/dashboard/${event.event_id}`}
      className={`group flex flex-col gap-2 rounded-2xl border border-white/70 bg-white/60 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-mulberry/30 hover:shadow-lg ${
        finished ? 'opacity-75 hover:opacity-100' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex w-fit rounded-full bg-mulberry/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-mulberry">
          {badge}
        </span>
        {/* The event's REAL monogram (uploaded / bespoke SVG · framed lockup ·
            lettered). Uploaded outranks custom per app-wide precedence;
            EventMonogram only reads monogram_custom_svg, so resolve it here. */}
        <EventMonogram
          event={{
            ...event,
            monogram_custom_svg:
              event.monogram_uploaded_svg ?? event.monogram_custom_svg,
          }}
          size="lg"
          className="shrink-0 shadow-sm ring-1 ring-black/5"
        />
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-base font-semibold text-ink">
          {event.is_primary ? (
            <span aria-hidden className="shrink-0 text-terracotta">
              ★
            </span>
          ) : null}
          <span className="truncate">{event.display_name}</span>
        </p>
        <p className="truncate text-sm text-ink/55">{dateMeta}</p>
      </div>
      <div className="mt-auto flex items-center gap-2.5 pt-1">
        {pct != null ? (
          <ProgressRing pct={pct} size={38} stroke={4}>
            <span className="text-[8px] font-semibold text-ink">{pct}%</span>
          </ProgressRing>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-ink">{status}</p>
          {plannedLabel ? (
            <p className="truncate text-[11px] text-ink/45">{plannedLabel}</p>
          ) : null}
        </div>
      </div>
      {decision?.top ? (
        <AttentionPill
          label={decision.top.label}
          more={decision.total - decision.top.count}
        />
      ) : null}
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

/**
 * The terminal EVENTS card — "New event". Creating an event is a distinct flow
 * (not a page of content to preview), so this stays a navigation. Dashed ghost
 * card with the same footprint as an event card.
 */
function NewEventCard() {
  return (
    <Link
      href="/dashboard/create-event"
      className="group flex min-h-[10rem] flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-ink/20 bg-white/40 p-4 text-sm font-medium text-ink/60 transition-colors hover:border-mulberry/40 hover:bg-mulberry/5 hover:text-ink"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 text-ink/50 transition-colors group-hover:border-mulberry/40 group-hover:text-mulberry"
      >
        <Plus className="h-5 w-5" />
      </span>
      New event
    </Link>
  );
}

/** Streaming skeleton for an inline account panel (e.g. Memories Hub photos). */
function InlinePanelSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-xl border border-ink/10 bg-ink/[0.04]"
        />
      ))}
    </div>
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
  /** admin = violet accent · default = gold. (The old 'hero' Life-Story tone is
   *  gone — that doorway lives inside ALAALA as an Expandable now.) */
  tone: 'admin' | 'default';
  /** "Needs a decision" line (e.g. "3 new inquiries" · "5 awaiting review"). */
  attention?: string;
};

/** One SPACES doorway card — a frosted glass panel per the Atelier language. */
function SpaceCard({
  href,
  icon: Icon,
  logoUrl,
  title,
  subtitle,
  tone,
  attention,
}: SpaceCardProps) {
  const admin = tone === 'admin';
  return (
    <Link
      href={href}
      className="group flex min-h-[9rem] flex-col justify-between rounded-2xl border border-white/70 bg-white/60 p-4 text-ink shadow-sm transition-all hover:-translate-y-0.5 hover:border-mulberry/30 hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <span
          className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl ${
            admin ? 'bg-violet-100 text-violet-700' : 'bg-mulberry/10 text-mulberry'
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
          className="h-4 w-4 text-ink/30 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </div>
      <div className="space-y-1.5">
        <div className="space-y-0.5">
          <p className="m-serif text-lg text-ink">{title}</p>
          <p className="text-xs text-ink/55">{subtitle}</p>
        </div>
        {attention ? <AttentionPill label={attention} /> : null}
      </div>
    </Link>
  );
}


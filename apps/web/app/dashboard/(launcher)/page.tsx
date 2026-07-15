import { Suspense, type ReactNode, type ComponentType } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Store,
  ShieldCheck,
  Plus,
  ArrowUpRight,
  LayoutGrid,
  Wand2,
  AlertCircle,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchUserEvents, type EventWithRole } from '@/lib/events';
import {
  fetchUserCommunities,
  type CommunityWithRole,
} from '@/lib/communities';
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
import { getMyLifeStory } from '../(account)/people/life-stories';
import {
  LifeStorySection,
  type LifeStoryGroup,
} from '../(account)/_components/life-story-section';
import { PhotosTab } from '../(account)/library/_components/photos-tab';
import { Expandable } from './_components/expandable';
import { CountUp } from '@/app/_components/count-up';
import { AlaalaTile, AlaalaTileSkeleton } from './_components/alaala-tile';
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
 *   • ALAALA — the single memory dimension (owner-confirmed name 2026-07-14),
 *     composed as the prototype's BENTO: the obsidian Alaala·Life-Flash tile
 *     (headline · face row · Play when the flag is on · the five LENSES —
 *     Recent/Owned/Attended/People/With me, all inline swaps) beside the
 *     Setnayan-AI "Watch" aggregate; "This year" (YearMomentsStrip) + the
 *     Memories Hub Expandable continue beneath — inline per the owner
 *     2026-07-13 rule. The flag-gated person-spine "Your story" renders in the
 *     tile's column when its flag turns on.
 *   • SPACES — the vendor shop(s) + admin HQ doorways as compact rows in the
 *     bento's right column (still the only allowed jumps besides events),
 *     PLUS the Samahan · Communities section. The shop/HQ rows stay
 *     capability-gated (absent for a plain couple), but the tile now renders
 *     for EVERYONE because Samahan does: the user's samahans as rows (icon
 *     Users · role + member count · href /dashboard/samahan/<id>) capped at 3
 *     with a "N more samahans" overflow row, then a "+ Create a Samahan" door.
 *     A plain couple with zero shops + zero samahans still sees the section
 *     label, the "shared space for your barkada…" line, and the create door.
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
 * Flag-gated behavior preserved (all default-OFF in prod): `lifeStoryEnabled`
 * gates the Alaala tile's moment-graph fetch + "Play Life-Flash" link,
 * AutoSurfacedEvents (`accountAutosurfaceEnabled`), and the person-spine
 * "Your story" block (`personLifeStoriesEnabled`).
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
  const [events, profileRes, roles, communities] = await Promise.all([
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
    // Samahan (communities) the user belongs to — graceful-degrade to [] so a
    // pre-migration environment (or an OAuth-race read) renders the launcher
    // with the create-only Samahan section rather than the error boundary.
    fetchUserCommunities(supabase, user.id).catch((err: unknown) => {
      logQueryError(
        'Launcher (fetchUserCommunities threw)',
        err instanceof Error ? err : new Error(String(err)),
        { user_id: user.id },
        'graceful_degrade',
      );
      return [] as CommunityWithRole[];
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
  // (The Life Story doorway is NOT a space — the obsidian AlaalaTile carries
  // it: flag-off = invite copy, flag-on = moment-graph summary + Play link;
  // exactly one doorway either way.)
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

  // Hero "Watch" stat — everything currently waiting on the user across all
  // active events (pay + approve + message + overdue), straight from the
  // per-event decision summaries above. Real data only.
  let needsTotal = 0;
  for (const summary of decisionByEvent.values()) needsTotal += summary.total;

  // The Watch tile's per-event rows — only events with something waiting,
  // busiest first. Same real summaries as the hero stat.
  const watchRows = active
    .map((e) => ({
      eventId: e.event_id,
      name: e.display_name,
      total: decisionByEvent.get(e.event_id)?.total ?? 0,
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  // The Alaala "Attended" lens — a real head-count of guest memberships.
  // Graceful-degrade to null (the lens shows its invite line, never a
  // fabricated number).
  let attendedCount: number | null = null;
  try {
    const { count, error } = await supabase
      .from('event_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('member_type', 'guest')
      .is('hidden_at', null);
    if (!error) attendedCount = count ?? 0;
  } catch {
    attendedCount = null;
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

  // SAMAHAN rows — the user's communities as compact SpaceRows (owner
  // 2026-07-15 composable-event model). Organizer subtitle carries the member
  // count; a plain member reads just "Member". Capped at 3 (MAX_SHOP_CARDS
  // idiom) with a "N more samahans" overflow row into the index. RA 10173: only
  // display name + role + count reach the DOM — never a user UUID or email.
  const samahanSubtitle = (c: CommunityWithRole) =>
    c.role === 'organizer'
      ? `Organizer · ${c.member_count} ${c.member_count === 1 ? 'member' : 'members'}`
      : 'Member';
  const MAX_SAMAHAN_CARDS = 3;
  const samahanRows: SpaceCardProps[] = communities
    .slice(0, MAX_SAMAHAN_CARDS)
    .map((c) => ({
      id: `samahan-${c.community_id}`,
      href: `/dashboard/samahan/${c.community_id}`,
      icon: Users,
      title: c.name,
      subtitle: samahanSubtitle(c),
      tone: 'default' as const,
    }));
  if (communities.length > MAX_SAMAHAN_CARDS) {
    const moreCount = communities.length - MAX_SAMAHAN_CARDS;
    samahanRows.push({
      id: 'more-samahans',
      href: '/dashboard/samahan',
      icon: Users,
      title: `${moreCount} more ${moreCount === 1 ? 'samahan' : 'samahans'}`,
      subtitle: 'See all your samahans',
      tone: 'default',
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
    // Samahan jump items — one per community, findable by name (⌘K). Same
    // mapping shape as spaces.map above.
    ...communities.map(
      (c): HomeCommandItem => ({
        id: `samahan-${c.community_id}`,
        label: c.name,
        sublabel: samahanSubtitle(c),
        href: `/dashboard/samahan/${c.community_id}`,
        kind: 'space',
        icon: 'users',
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
      id: 'action-new-samahan',
      label: 'Create a Samahan',
      sublabel: 'A shared space for your barkada, parish, or clan',
      href: '/dashboard/samahan/new',
      kind: 'action',
      icon: 'users',
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
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-10 lg:px-8">
      <header
        className="sn-reveal mb-5 space-y-2 sm:mb-8"
        style={{ animationDelay: '0.24s' }}
      >
        <p className="text-[13px] text-[color:var(--sn-ink-500)]">
          Kumusta, {greeting} · {noEvents ? 'welcome' : 'welcome back'}
        </p>
        <h1 className="text-[1.375rem] font-extrabold leading-tight tracking-[-0.03em] text-ink sm:text-4xl sm:leading-[1.02]">
          Where to?{' '}
          <span
            className={`font-bold text-[color:var(--sn-ink-400)] ${
              /* Instructional first-run copy stays visible at every width; the
                 returning-user soft tail is desktop-only (proto mobile head). */
              noEvents ? '' : 'hidden sm:inline'
            }`}
          >
            {noEvents
              ? 'Let’s set up your first event.'
              : 'Pick up where you left off.'}
          </span>
        </h1>
        {/* The Watch line (prototype hero stat) — REAL aggregates only: active
            event count + the summed "needs a decision" total. Hidden when
            nothing is waiting so it never fabricates urgency. */}
        {active.length > 0 && needsTotal > 0 ? (
          <p className="pt-1 text-[12.5px] text-[color:var(--sn-ink-500)]">
            <span className="font-mono font-bold text-[color:var(--sn-gold-700)]">
              {active.length}
            </span>{' '}
            {active.length === 1 ? 'event' : 'events'} in motion ·{' '}
            <span className="font-mono font-bold text-[color:var(--sn-gold-700)]">
              <CountUp value={needsTotal} delayMs={900} />
            </span>{' '}
            {needsTotal === 1 ? 'thing needs' : 'things need'} you
          </p>
        ) : null}
      </header>

      {/* The deterministic search & jump bar (⌘K) — client-side filtering over
          the user's own events/spaces/destinations. No LLM (Setnayan AI Rule 1). */}
      <div className="sn-reveal mb-6 sm:mb-10" style={{ animationDelay: '0.32s' }}>
        <HomeCommandBar items={commandItems} />
      </div>

      {/* EVENTS — ongoing + upcoming as glass cards, date descending (newest on
          top, owner 2026-07-13 ordering). Completed stay behind "Show all".
          Each card jumps into its event dashboard — an allowed navigation. */}
      <section
        className="sn-reveal mb-7 sm:mb-6"
        style={{ animationDelay: '0.4s' }}
      >
        <SectionLabel
          sub="ongoing & upcoming"
          action={
            finished.length > 0 ? (
              <ShowAllToggle showAll={showAll} />
            ) : null
          }
        >
          Events
        </SectionLabel>
        {/* MOBILE composition (proto .mhero/.mbento/.m-nudge/.mghost): the
            primary event as a full-width dark hero, the rest as compact glass
            chips, the neediest-event nudge row, then the New-event ghost. Same
            real data + hrefs as the desktop cards. */}
        <div className="space-y-3 sm:hidden">
          {upcoming[0] ? (
            <MobileEventHero
              event={upcoming[0]}
              pct={progressByEvent.get(upcoming[0].event_id) ?? null}
            />
          ) : null}
          {upcoming.length > 1 || (showAll && finished.length > 0) ? (
            <div
              className="sn-reveal grid grid-cols-2 gap-2.5"
              style={{ animationDelay: '0.58s' }}
            >
              {upcoming.slice(1).map((event) => (
                <MobileEventChip
                  key={event.event_id}
                  event={event}
                  pct={progressByEvent.get(event.event_id) ?? null}
                />
              ))}
              {showAll
                ? finished.map((event) => (
                    <MobileEventChip
                      key={event.event_id}
                      event={event}
                      pct={progressByEvent.get(event.event_id) ?? null}
                      finished
                    />
                  ))
                : null}
            </div>
          ) : null}
          {/* The overdue NUDGE row — the mobile stand-in for the desktop Watch
              tile. Real data only: hidden when nothing is waiting. */}
          {watchRows[0] ? (
            <Link
              href={`/dashboard/${watchRows[0].eventId}`}
              className="sn-reveal sn-press flex items-center gap-2.5 rounded-xl bg-[color:var(--sn-warning-soft)] px-3 py-3"
              style={{ animationDelay: '0.66s' }}
            >
              <AlertCircle
                aria-hidden
                className="h-[18px] w-[18px] shrink-0 text-[color:var(--sn-warning)]"
              />
              <span className="flex-1 truncate text-[13px] font-bold text-[color:var(--sn-warning)]">
                {watchRows[0].total}{' '}
                {watchRows[0].total === 1 ? 'thing needs' : 'things need'} you —{' '}
                {watchRows[0].name}
              </span>
              <ArrowUpRight
                aria-hidden
                className="h-4 w-4 shrink-0 text-[color:var(--sn-warning)]"
              />
            </Link>
          ) : null}
          <NewEventCard delay={0.74} />
        </div>
        {/* DESKTOP grid (proto .evrow — 4 columns on the wide canvas). */}
        <div className="hidden gap-3 sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {upcoming.map((event, i) => (
            <GlassEventCard
              key={event.event_id}
              event={event}
              pct={progressByEvent.get(event.event_id) ?? null}
              index={i}
            />
          ))}
          {showAll
            ? finished.map((event, i) => (
                <GlassEventCard
                  key={event.event_id}
                  event={event}
                  pct={progressByEvent.get(event.event_id) ?? null}
                  finished
                  index={upcoming.length + i}
                />
              ))
            : null}
          <NewEventCard
            delay={0.5 + (upcoming.length + (showAll ? finished.length : 0)) * 0.08}
          />
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
        <div className="mb-7 sm:mb-6">
          <AutoSurfacedEvents userId={user.id} />
        </div>
      ) : null}

      {/* ALAALA + THE WATCH + SPACES — the prototype's BENTO (owner-approved
          final design 2026-07-15): the obsidian Alaala·Life-Flash tile with the
          five lenses on the left; the Setnayan AI "Watch" aggregate and the
          Spaces doorways stacked on the right. "This year" + Memories Hub
          continue full-width beneath — all still ONE Alaala surface. */}
      <section className="mb-7 sm:mb-6">
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          <div className="space-y-3 sm:space-y-4">
            <Suspense fallback={<AlaalaTileSkeleton />}>
              <AlaalaTile
                userId={user.id}
                lifeOn={lifeOn}
                ownedEvents={active.slice(0, 5).map((e) => ({
                  name: e.display_name,
                  dateLabel: shortDate(e.event_date) ?? 'TBD',
                }))}
                attendedCount={attendedCount}
                personStoriesOn={lifeStoryGroups !== null}
              />
            </Suspense>

            {/* Person-spine "Your story" (flag-gated, counsel-gated) — the
                "With me" lens made concrete once the flag turns on. */}
            {lifeStoryGroups && lifeStoryGroups.length > 0 ? (
              <div>
                <h3 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/40">
                  Your story
                </h3>
                <LifeStorySection groups={lifeStoryGroups} />
              </div>
            ) : null}
          </div>

          <div className="space-y-3 sm:space-y-4">
            {/* SETNAYAN AI · THE WATCH — the deterministic aggregate of
                everything waiting on the user (pay · approve · message ·
                overdue), per event. Sums, not an LLM (Rule 1). Desktop-only
                (proto): on mobile the Events-block nudge row carries this
                signal, so Alaala follows Events immediately. */}
            <div
              className="sn-tile-glass sn-lift-3 sn-reveal hidden rounded-2xl p-4 sm:p-[18px] lg:block"
              style={{ animationDelay: '0.78s' }}
            >
              <p className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--sn-gold-700)]">
                <Wand2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Setnayan AI · The Watch
              </p>
              {needsTotal > 0 ? (
                <>
                  <p className="mt-2.5">
                    <span className="font-mono text-[26px] font-bold tracking-[-0.01em] text-ink">
                      <CountUp value={needsTotal} delayMs={850} />
                    </span>{' '}
                    <span className="text-[13px] font-semibold text-[color:var(--sn-ink-500)]">
                      {needsTotal === 1 ? 'thing needs' : 'things need'} you
                    </span>
                  </p>
                  <ul className="mt-3 space-y-[11px]">
                    {watchRows.map((row, i) => (
                      <li
                        key={row.eventId}
                        className="flex items-center gap-[9px] text-[12.5px] text-ink"
                      >
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--sn-warning)]"
                        />
                        <span className="min-w-0 truncate">{row.name}</span>
                        <span className="ml-auto shrink-0 font-mono text-xs font-bold text-[color:var(--sn-warning)]">
                          <CountUp value={row.total} delayMs={1050 + 150 * i} />
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-[13px] flex items-center gap-2 border-t border-ink/[0.08] pt-3 text-[11.5px] text-[color:var(--sn-ink-400)]">
                    <span
                      aria-hidden
                      className="h-[7px] w-[7px] shrink-0 rounded-full bg-[color:var(--sn-success)]"
                      style={{ animation: 'sn-pulse 1.9s infinite' }}
                    />
                    Everything else — quiet
                  </p>
                </>
              ) : (
                <p className="mt-3 flex items-center gap-2 text-sm text-ink/55">
                  <span
                    aria-hidden
                    className="h-[7px] w-[7px] shrink-0 rounded-full bg-[color:var(--sn-success)]"
                    style={{ animation: 'sn-pulse 1.9s infinite' }}
                  />
                  Everything — quiet. Nothing needs you right now.
                </p>
              )}
            </div>

            {/* SPACES — the vendor shop(s) + admin HQ doorways (capability-gated
                INSIDE the tile) PLUS Samahan · Communities, which renders for
                EVERYONE. The whole tile now always renders: a plain couple must
                still get the "+ Create a Samahan" door. These still NAVIGATE
                (their own dashboards / space pages are allowed jumps). */}
            <div
              className="sn-tile-glass sn-lift-3 sn-reveal rounded-2xl p-4 sm:p-[18px]"
              style={{ animationDelay: '0.9s' }}
            >
              <p className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--sn-gold-700)]">
                <Store aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Spaces
              </p>
              {/* Vendor shop / admin HQ rows — capability-gated: empty for a
                  plain couple, so the block collapses and Samahan leads. */}
              {spaces.length > 0 ? (
                <div className="mt-2 divide-y divide-ink/[0.07]">
                  {spaces.map((space) => (
                    <SpaceRow
                      key={space.id ?? space.href + space.title}
                      {...space}
                    />
                  ))}
                </div>
              ) : null}
              {/* Samahan — communities are LIVE (owner 2026-07-15 composable-
                  event model): real rows + a create door for everyone. */}
              <p className="mb-0.5 mt-[13px] font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sn-ink-400)]">
                Samahan · Communities
              </p>
              {communities.length === 0 ? (
                <p className="mb-1 mt-1 text-xs text-ink/45">
                  A shared space for your barkada, parish, or clan.
                </p>
              ) : null}
              <div className="mt-1 divide-y divide-ink/[0.07]">
                {samahanRows.map((space) => (
                  <SpaceRow
                    key={space.id ?? space.href + space.title}
                    {...space}
                  />
                ))}
                <CreateSamahanRow />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
          {/* Date-anchor model — the couple's next few derived moments
              (anniversaries · wedding countdowns). Self-fetching; renders
              nothing when there are no anchors. */}
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
        </div>
      </section>
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

/**
 * Section header (proto .sec-h): sentence-case bold title with an optional
 * soft sub-caption from `sm` up; at base the mobile treatment — 14px w800 with
 * a trailing hairline rule filling the line (proto .mtitle). Optional
 * right-aligned action either way.
 */
function SectionLabel({
  children,
  sub,
  action,
}: {
  children: ReactNode;
  /** Soft caption beside the title (desktop only), e.g. "ongoing & upcoming". */
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
        <h2 className="flex flex-1 items-center gap-2.5 whitespace-nowrap text-sm font-extrabold tracking-tight text-ink after:h-px after:flex-1 after:bg-ink/10 sm:flex-none sm:text-base sm:tracking-[-0.015em] sm:after:hidden">
          {children}
        </h2>
        {sub ? (
          <span className="hidden shrink-0 text-xs text-[color:var(--sn-ink-400)] sm:inline">
            {sub}
          </span>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * "Show all" toggle (proto .viewall) — a gold text link that flips the
 * `?show=all` search param (server-only; no client JS). Reveals the
 * finished/archived events, which are hidden by default; reads "Hide finished"
 * while they show. `scroll={false}` keeps the viewport put.
 */
function ShowAllToggle({ showAll }: { showAll: boolean }) {
  return (
    <Link
      href={showAll ? '/dashboard' : '/dashboard?show=all'}
      scroll={false}
      className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[color:var(--sn-gold-700)] transition-colors hover:text-[color:var(--sn-gold-600)]"
    >
      {showAll ? 'Hide finished' : 'Show all'}
      <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
    </Link>
  );
}

/**
 * One EVENTS glass card (owner-approved final design 2026-07-15). A frosted
 * panel over the warm paper — the Atelier + macOS-glass language (owner-locked
 * 2026-07-12) — carrying the same signals as the old timeline node: badge ·
 * monogram · place/date · gold progress ring · countdown · attention line.
 * The card jumps into the event dashboard — an allowed navigation.
 *
 * Attention/overdue signals deliberately live ONLY in The Watch (desktop tile)
 * / the mobile nudge row now (owner 2026-07-15: one home for overdue counts) —
 * this card carries identity/type/date/progress, never a decision pill.
 */
function GlassEventCard({
  event,
  pct,
  finished,
  index = 0,
}: {
  event: EventWithRole;
  pct: number | null;
  finished?: boolean;
  /** Position in the grid — drives the entrance-cascade + ring/count-up
   *  stagger delays (computed, never hardcoded per card). */
  index?: number;
}) {
  const { badge, dateMeta, status, plannedLabel } = deriveEventView(
    event,
    pct,
    finished,
  );

  return (
    <Link
      href={`/dashboard/${event.event_id}`}
      className={`sn-tile-glass sn-lift-4 sn-press sn-reveal group flex min-h-[196px] flex-col overflow-hidden rounded-2xl hover:border-mulberry/30 ${
        finished ? 'opacity-75 hover:opacity-100' : ''
      }`}
      style={{ animationDelay: `${0.5 + index * 0.08}s` }}
    >
      {/* Editorial texture band (the prototype's card top) — warm paper stripes
          with the type badge overlaid and the event's monogram floating over
          the band's edge. */}
      <div className="sn-texture-band relative h-16 shrink-0">
        <span className="absolute left-3 top-3 inline-flex rounded-full bg-white/85 px-2 py-1 font-mono text-[9px] font-normal uppercase tracking-[0.12em] text-[color:var(--sn-gold-700)] shadow-[0_2px_8px_rgba(30,26,18,0.08)]">
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
          shape="square"
          className="absolute -bottom-4 right-3 border-2 border-white/80 shadow-[var(--sn-sh-tile)]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 pt-5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[15px] font-extrabold text-ink">
            {event.is_primary ? (
              <span
                aria-hidden
                className="shrink-0 text-xs text-[color:var(--sn-terra)]"
              >
                ★
              </span>
            ) : null}
            <span className="truncate">{event.display_name}</span>
          </p>
          <p className="truncate text-[12.5px] text-[color:var(--sn-ink-500)]">
            {dateMeta}
          </p>
        </div>
        <div className="mt-auto flex items-center gap-2.5 pt-1">
          {pct != null ? (
            <ProgressRing
              pct={pct}
              size={44}
              stroke={4.5}
              trackColor="rgb(var(--color-ink) / 0.08)"
              sweep={{ delayMs: 600 + 150 * index }}
              className="rounded-full shadow-[0_6px_16px_-8px_rgba(30,26,18,0.3)]"
            >
              {/* Frosted inner disc behind the label (proto .ring inner). */}
              <span
                aria-hidden
                className="absolute inset-[4.5px] rounded-full bg-white/[0.78] backdrop-blur-[6px]"
              />
              <span className="relative font-mono text-[10px] font-bold text-ink">
                <CountUp value={pct} suffix="%" delayMs={600 + 150 * index} />
              </span>
            </ProgressRing>
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-bold text-ink">{status}</p>
            {plannedLabel ? (
              <p className="truncate font-mono text-[11px] text-ink/45">
                {plannedLabel}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Shared per-event display derivation (badge · date/place meta · countdown ·
 * status · planned label) — one source for the desktop glass cards AND the
 * mobile hero/chips, so the two compositions can never drift.
 */
function deriveEventView(
  event: EventWithRole,
  pct: number | null,
  finished?: boolean,
) {
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
  return { badge, dateLabel, place, dateMeta, countdown, status, plannedLabel };
}

/**
 * MOBILE events hero (proto .mhero) — the first (primary) upcoming event as a
 * full-width dark card: gold eyebrow, name, mono facts line, slim gold progress
 * bar with the library shimmer. Real data only — facts and the bar render only
 * from what actually exists.
 */
function MobileEventHero({
  event,
  pct,
}: {
  event: EventWithRole;
  pct: number | null;
}) {
  const { badge, dateLabel, countdown, plannedLabel } = deriveEventView(
    event,
    pct,
  );
  // Attention/overdue lives ONLY in the mobile nudge row now (owner 2026-07-15:
  // one home for overdue counts). The hero keeps identity/date/progress facts.
  const facts = [plannedLabel, dateLabel].filter(Boolean) as string[];
  return (
    <Link
      href={`/dashboard/${event.event_id}`}
      className="sn-press sn-reveal block w-full rounded-2xl bg-ink p-4 text-cream shadow-[0_20px_44px_-26px_rgba(23,22,15,0.7)]"
      style={{ animationDelay: '0.5s' }}
    >
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sn-gold-300)]">
        {badge} · {countdown ?? dateLabel ?? 'Date to be set'}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-lg font-bold">
        {event.is_primary ? (
          <span aria-hidden className="shrink-0 text-xs text-[color:var(--sn-terra)]">
            ★
          </span>
        ) : null}
        <span className="truncate">{event.display_name}</span>
      </p>
      {facts.length > 0 ? (
        <p className="mt-1 flex gap-3 font-mono text-[11px] text-cream/60">
          {facts.map((f) => (
            <span key={f} className="truncate">
              {f}
            </span>
          ))}
        </p>
      ) : null}
      {pct != null ? (
        <span className="sn-bar mt-2.5 block h-1.5 overflow-hidden rounded-full bg-white/15">
          <i
            className="relative overflow-hidden bg-terracotta"
            style={{ width: `${pct}%` }}
          >
            {/* Infinite capiz shim inside the gold fill (library sn-shimmer;
                the global reduced-motion freeze caps it to one instant run). */}
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-white/25"
              style={{ animation: 'sn-shimmer 2.8s ease-in-out 1.8s infinite' }}
            />
          </i>
        </span>
      ) : null}
    </Link>
  );
}

/**
 * MOBILE compact event chip (proto .mbento cell) — eyebrow (badge · date),
 * name, status line. No ring/texture/monogram at this density.
 */
function MobileEventChip({
  event,
  pct,
  finished,
}: {
  event: EventWithRole;
  pct: number | null;
  finished?: boolean;
}) {
  const { badge, dateLabel, status } = deriveEventView(event, pct, finished);
  return (
    <Link
      href={`/dashboard/${event.event_id}`}
      className={`sn-press block rounded-2xl border border-white/70 bg-white/60 p-3 text-left ${
        finished ? 'opacity-75' : ''
      }`}
    >
      <p className="truncate font-mono text-[9px] uppercase text-mulberry">
        {badge}
        {dateLabel ? ` · ${dateLabel}` : ''}
      </p>
      <p className="truncate text-sm font-bold text-ink">{event.display_name}</p>
      <p className="truncate text-[11px] text-ink/55">{status}</p>
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
    <span className="flex items-center gap-1.5 rounded-lg bg-[color:var(--sn-warning-soft)] px-[9px] py-[5px] text-[color:var(--sn-warning)]">
      <AlertCircle aria-hidden className="h-[13px] w-[13px] shrink-0" />
      <span className="truncate text-[11px] font-bold">
        {label}
        {more > 0 ? (
          <span className="font-mono font-normal opacity-70"> · {more} more</span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * The terminal EVENTS card — "New event". Creating an event is a distinct flow
 * (not a page of content to preview), so this stays a navigation. At base a
 * compact dashed ROW (proto .mghost — a light footer to the Events block);
 * from `sm` the dashed ghost card with the same footprint as an event card
 * (proto .evghost — bare gold plus, no circle).
 */
function NewEventCard({ delay = 0 }: { delay?: number }) {
  return (
    <Link
      href="/dashboard/create-event"
      className="sn-press sn-reveal group flex flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-ink/20 bg-white/[0.35] px-4 py-3.5 text-[13px] font-bold text-[color:var(--sn-ink-500)] transition-[color,background-color,border-color,transform] duration-200 hover:-translate-y-[3px] hover:border-terracotta hover:bg-white/50 hover:text-[color:var(--sn-gold-700)] sm:min-h-[196px] sm:flex-col sm:rounded-2xl sm:p-4"
      style={{ animationDelay: `${delay}s` }}
    >
      <Plus aria-hidden className="h-[22px] w-[22px] text-[color:var(--sn-gold-600)]" />
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
  /** Stable key when several rows share an href (e.g. one per vendor shop). */
  id?: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  /** Shop logo — shown in the icon chip in place of the glyph when set. */
  logoUrl?: string | null;
  title: string;
  subtitle: string;
  /** admin = slate accent · default = gold. */
  tone: 'admin' | 'default';
  /** "Needs a decision" line (e.g. "3 new inquiries" · "5 awaiting review"). */
  attention?: string;
};

/** One SPACES doorway row — the prototype tile's compact row (icon chip ·
 *  name · role · attention · jump arrow). Still a real navigation. */
function SpaceRow({
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
      className="sn-press group -mx-2 flex items-center gap-[11px] rounded-xl px-2 py-2.5 transition-[background-color,transform] hover:translate-x-0.5 hover:bg-white/70"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md ${
          /* HQ = slate (--sn-info) per the prototype — violet retired by the
             2026-07-12 atelier reskin. */
          admin
            ? 'bg-[color:var(--sn-info-soft)] text-[color:var(--sn-info)]'
            : 'bg-[color:var(--sn-gold-100)] text-[color:var(--sn-gold-700)]'
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
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink">{title}</span>
        <span className="block truncate text-xs text-ink/55">{subtitle}</span>
        {attention ? (
          <span className="mt-1 block">
            <AttentionPill label={attention} />
          </span>
        ) : null}
      </span>
      <ArrowUpRight
        aria-hidden
        className="h-[15px] w-[15px] shrink-0 text-[color:var(--sn-ink-400)] transition-[transform,color] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-mulberry"
      />
    </Link>
  );
}

/**
 * The "+ Create a Samahan" doorway — the SpaceRow layout with a MUTED dashed
 * Plus chip (the "New event" / samahan-index create-row idiom). Always present
 * in the Spaces tile so a plain couple, or a member with no samahans yet, still
 * has the real create door.
 */
function CreateSamahanRow() {
  return (
    <Link
      href="/dashboard/samahan/new"
      className="sn-press group -mx-2 flex items-center gap-[11px] rounded-xl px-2 py-2.5 transition-[background-color,transform] hover:translate-x-0.5 hover:bg-white/70"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-ink/20 text-[color:var(--sn-ink-400)]">
        <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-[color:var(--sn-ink-500)] group-hover:text-ink">
        Create a Samahan
      </span>
      <ArrowUpRight
        aria-hidden
        className="h-[15px] w-[15px] shrink-0 text-[color:var(--sn-ink-400)] transition-[transform,color] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-mulberry"
      />
    </Link>
  );
}


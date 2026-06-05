import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Link2, X, LayoutGrid, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import {
  computeGuestStats,
  fetchGroupMembershipsByEvent,
  fetchGuestGroupsByEvent,
  fetchGuestsByEvent,
  GROUP_CATEGORY_LABELS,
  ROLE_LABELS,
  RSVP_LABELS,
  SIDE_LABELS,
  TEAM_SIDE_LABELS,
  type GuestGroupWithCount,
  type GuestRow,
  type GuestSide,
  type GuestStats,
  type RsvpStatus,
} from '@/lib/guests';
import { filterByRoleGroup, ROLE_GROUP_LABELS } from '@/lib/role-groups';
import { sanitizeRolePalette, type RolePalette } from '@/lib/mood-board';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { GuestListMultiselect } from './_components/guest-list-multiselect';
import { GroupsSidebar } from './_components/groups-sidebar';
import { LiveSearch } from './_components/live-search';
import { MobileGuestCarousel } from './_components/mobile-guest-carousel';
import {
  OpenQuickAddButton,
  QuickAddSheet,
} from './_components/quick-add-sheet';

export const metadata = { title: 'Guests' };

const SORT_OPTIONS = [
  { value: 'last_name', label: 'Last name (A–Z)' },
  { value: 'first_name', label: 'First name (A–Z)' },
  // Side / Role / Group — owner directive 2026-06-03 ("sort by side, role or
  // group"), added alongside the existing alphabetical / RSVP / newest sorts.
  { value: 'side', label: 'Side' },
  { value: 'role', label: 'Role' },
  { value: 'group', label: 'Group' },
  { value: 'rsvp', label: 'RSVP status' },
  { value: 'newest', label: 'Newest first' },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]['value'];

// Owner directive 2026-05-23 PM:
//   "remove family, friends, work, and school, and wedding party? these
//   are all groups and needs to be identified as Guests with group."
//   "add Role: Bride's Parents, Groom's Parents, Bride's Immediate
//   Family and Groom's Immediate Family these are VIP seating."
//
// VIEW is now strictly role-based. Social categories (family / friends
// / work / school) belong in the GROUPS section below (custom
// `guest_groups` rows). Wedding Party stays as a role-based group
// internally — the four wedding-party roles (MoH / matron / best man /
// bridesmaid / groomsman) still map there — but is hidden from the
// View sidebar because owner wants those guests categorized through
// custom groups instead.
const VIEW_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All guests' },
  { key: 'vip_family', label: ROLE_GROUP_LABELS.vip_family },
  // Wedding Party — owner directive 2026-05-23 (post-PR #424). Distinct
  // from the social-grouping filters (family/friends/work/school) that
  // were retired into custom guest_groups: wedding party = a defined
  // wedding-role cluster (MOH/MoH/best man/bridesmaid/groomsman) that
  // mirrors the sibling role-group filters (Principal Sponsors,
  // Secondary Sponsors, Bearers, Officiants). Position matches the
  // BULK_ROLE_SECTIONS ordering in guest-list-multiselect.tsx for
  // muscle-memory consistency between sidebar + bulk toolbar.
  { key: 'wedding_party', label: ROLE_GROUP_LABELS.wedding_party },
  { key: 'principal_sponsors', label: ROLE_GROUP_LABELS.principal_sponsors },
  { key: 'secondary_sponsors', label: ROLE_GROUP_LABELS.secondary_sponsors },
  { key: 'bearers_flower_girl', label: ROLE_GROUP_LABELS.bearers_flower_girl },
  { key: 'officiants', label: ROLE_GROUP_LABELS.officiants },
];

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    q?: string;
    rsvp?: string;
    view?: string;
    team?: string;
    tag?: string;
    sort?: string;
    added?: string;
    saved?: string;
    removed?: string;
    imported?: string;
    skipped?: string;
    duplicates?: string;
    error?: string;
    bulk_assigned?: string;
    bulk_grouped?: string;
    bulk_sided?: string;
    bulk_deleted?: string;
    group_created?: string;
    group_saved?: string;
    group_deleted?: string;
    group_member_removed?: string;
  }>;
};

export default async function GuestsPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // All reads fire in ONE parallel batch — including the share-invite token,
  // which used to run as a 5th *sequential* round-trip after this block (owner
  // perf pass 2026-06-03). Folding it in drops one Singapore RTT off every
  // visit to the Guests tab.
  const [guests, eventRow, groups, membershipsMap, joinUrl] = await Promise.all([
    fetchGuestsByEvent(supabase, eventId),
    supabase
      .from('events')
      .select('role_palette')
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchGuestGroupsByEvent(supabase, eventId),
    fetchGroupMembershipsByEvent(supabase, eventId),
    fetchJoinUrl(supabase, eventId),
  ]);
  // Log silent palette-read errors so a future ADD COLUMN regression
  // would surface in Sentry instead of falling through to an empty
  // palette. sanitizeRolePalette already handles null input cleanly, so
  // the page still renders — but we want the breadcrumb.
  if (eventRow.error) {
    logQueryError(
      'GuestsPage (events.role_palette)',
      eventRow.error,
      { event_id: eventId },
      'graceful_degrade',
    );
  }
  const palette: RolePalette = sanitizeRolePalette(eventRow.data?.role_palette ?? {});

  const q = (search.q ?? '').trim().toLowerCase();
  const rsvpFilter = (search.rsvp ?? '') as RsvpStatus | '';
  const view = search.view ?? 'all';
  const teamRaw = search.team ?? 'all';
  const teamFilter: 'all' | 'bride' | 'groom' =
    teamRaw === 'bride' || teamRaw === 'groom' ? teamRaw : 'all';
  const tagFilter = (search.tag ?? '').trim();
  const sort = (search.sort ?? 'last_name') as SortKey;

  // Custom-group view detection — view param is "group:<group_id>"
  // when the host has clicked a custom group in the sidebar.
  const currentGroupId =
    view.startsWith('group:') ? view.slice('group:'.length) : null;
  const groupMemberSet = currentGroupId
    ? new Set(
        Array.from(membershipsMap.entries())
          .filter(([, gids]) => gids.includes(currentGroupId))
          .map(([gid]) => gid),
      )
    : null;

  // Build a guest_id → group-label-blob index so the search haystack
  // can match against custom-group labels + team_side labels (so typing
  // "katropa" or "team bride" finds the guests in that group). Done
  // once before the filter loop instead of inside it to avoid N×M
  // lookups across the guests × groups cross product.
  const groupBlobByGuestId = new Map<string, string>();
  if (q) {
    const groupById = new Map<string, GuestGroupWithCount>(
      groups.map((g) => [g.group_id, g]),
    );
    for (const [guestId, groupIds] of membershipsMap.entries()) {
      const parts: string[] = [];
      for (const gid of groupIds) {
        const grp = groupById.get(gid);
        if (!grp) continue;
        parts.push(grp.label);
        parts.push(TEAM_SIDE_LABELS[grp.team_side]);
      }
      if (parts.length > 0) groupBlobByGuestId.set(guestId, parts.join(' '));
    }
  }

  let visible = guests.filter((g) => {
    if (teamFilter === 'bride' && !(g.side === 'bride' || g.side === 'both'))
      return false;
    if (teamFilter === 'groom' && !(g.side === 'groom' || g.side === 'both'))
      return false;
    if (rsvpFilter && g.rsvp_status !== rsvpFilter) return false;
    if (tagFilter && !g.custom_tags.includes(tagFilter)) return false;
    if (groupMemberSet && !groupMemberSet.has(g.guest_id)) return false;
    if (q) {
      // Haystack covers (owner directive 2026-05-23 PM):
      //   - names · display name · email · mobile · custom tags
      //   - role display label (e.g. "Matron of Honor") AND the raw
      //     enum value space-normalized ("matron of honor") so typing
      //     either form hits
      //   - side label ("Bride's side" / "Groom's side" / "Both sides")
      //   - group category label (Family / Friends / Work / School /
      //     Officiant / Other)
      //   - RSVP status label (Attending / Pending / Declined / Maybe)
      //   - custom group labels (e.g. "Katropa") + team_side labels
      //     ("Team Bride" / "Team Groom" / "Both sides") for every
      //     custom group the guest belongs to
      const roleLabel = ROLE_LABELS[g.role];
      const roleEnumNormalized = g.role.replace(/_/g, ' ');
      const groupBlob = groupBlobByGuestId.get(g.guest_id) ?? '';
      const haystack = [
        g.first_name,
        g.last_name,
        g.display_name ?? '',
        g.email ?? '',
        g.mobile ?? '',
        g.custom_tags.join(' '),
        roleLabel,
        roleEnumNormalized,
        SIDE_LABELS[g.side],
        GROUP_CATEGORY_LABELS[g.group_category],
        RSVP_LABELS[g.rsvp_status],
        groupBlob,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  // The role-group sidebar only filters when view is one of the
  // canonical role groups — custom-group views ("group:<uuid>") skip
  // this step because the groupMemberSet filter above already narrowed
  // the list to the group's members.
  if (!currentGroupId) {
    visible = filterByRoleGroup(visible, view);
  }
  // Group sort needs each guest's first (alphabetical) group label — build
  // the lookup once. Ungrouped guests sort last (handled in sortCompare).
  const sortGroupKey =
    sort === 'group' ? buildGroupSortKey(groups, membershipsMap) : undefined;
  visible.sort((a, b) => sortCompare(a, b, sort, sortGroupKey));

  // Convert the Map<guest_id, group_id[]> to a plain object so it
  // serializes cleanly across the server/client component boundary.
  const groupMemberships: Record<string, string[]> = Object.fromEntries(
    membershipsMap.entries(),
  );

  const stats = computeGuestStats(guests);
  const allTags = uniqueTags(guests);
  const flash = pickFlash(search);

  // Resolve each guest's stored photo ref → a display URL once on the server:
  // a 24h presigned GET for r2:// refs, or the raw Google avatar URL passed
  // through verbatim (oauth_google). Keyed by the stored value so the client
  // grid looks each card up — the same `initialDisplayUrls` contract
  // <FileUpload> uses. Resolved over the FULL guest list (not `visible`) so
  // re-filtering/sorting never re-signs; signing runs in parallel per the
  // displayUrlForStoredAsset doc guidance.
  const photoDisplayUrls: Record<string, string> = Object.fromEntries(
    (
      await Promise.all(
        guests
          .filter((g) => g.photo_url)
          .map(
            async (g) =>
              [g.photo_url!, await displayUrlForStoredAsset(g.photo_url)] as const,
          ),
      )
    ).filter((e): e is [string, string] => e[1] !== null),
  );

  // Team Bride / Team Groom counts — "both" counts to both sides on
  // purpose (a guest invited by both shows in either team view).
  const teamCounts = {
    all: guests.length,
    bride: guests.filter((g) => g.side === 'bride' || g.side === 'both').length,
    groom: guests.filter((g) => g.side === 'groom' || g.side === 'both').length,
  };
  // Minimal pool the quick-add sheet matches new names against for the
  // duplicate check — full unfiltered list, not the filtered `visible`.
  const quickAddPool = guests.map((g) => ({
    guest_id: g.guest_id,
    first_name: g.first_name,
    last_name: g.last_name,
    side: g.side,
    role: g.role,
    extra_roles: g.extra_roles ?? [],
  }));
  const quickAddGroups = groups.map((g) => ({
    group_id: g.group_id,
    label: g.label,
  }));

  return (
    /* Owner directive 2026-06-01: top nav removed on Guests (mobile-first),
       matching the Vendors tab treatment. .shell-topbar{display:none} is
       scoped to this page via the injected <style> tag — the nav returns
       the moment the host navigates away. -mt-6 cancels the <main py-6>
       top-padding so the page content sits flush under the bottom-nav. */
    <section
      className="-mt-6 space-y-6 pt-[calc(env(safe-area-inset-top)+3.25rem)] lg:pt-0"
      style={{ ['--gcar-h' as string]: '280px' }}
    >
      <style>{`.shell-topbar{display:none}`}</style>

      {/* Focus-mode exit (mobile only) — owner directive 2026-06-03. On the
          Guests page the global bottom nav is replaced by the carousel's own
          menu, so this floating X is the single way back to event home. Fixed
          top-left, safe-area-aware, z-50 above the scrolling list; the section
          pt above clears the first row so the X never sits on a guest. Desktop
          keeps the sidebar, so it's lg:hidden. */}
      <Link
        href={`/dashboard/${eventId}`}
        aria-label="Back to dashboard home"
        className="fixed left-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-50 inline-flex h-9 w-9 items-center justify-center rounded-full bg-cream/95 text-ink/70 shadow-[0_4px_14px_-6px_rgba(30,34,41,0.5)] ring-1 ring-ink/10 backdrop-blur transition-colors hover:bg-cream hover:text-ink lg:hidden"
      >
        <X className="h-5 w-5" strokeWidth={2} aria-hidden />
      </Link>
      {/* Header is DESKTOP-ONLY (owner directive 2026-06-03 — "remove GUEST
          LIST / N guests since we already have Summary below"). On mobile the
          carousel's Summary panel carries the count; the top is just the list. */}
      <header className="hidden flex-col gap-3 lg:flex lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            Guest list
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {stats.total} {stats.total === 1 ? 'guest' : 'guests'}
          </h1>
        </div>
        <div className="hidden flex-col gap-2 self-start lg:flex lg:flex-row lg:self-auto">
          <Link
            href={`/dashboard/${eventId}/guests/import`}
            className="button-secondary"
          >
            Import CSV
          </Link>
          <Link
            href={`/dashboard/${eventId}/guests/quick`}
            className="button-secondary"
          >
            Quick add list
          </Link>
          <OpenQuickAddButton />
        </div>
      </header>

      {flash ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {flash}
        </p>
      ) : null}

      {search.error ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {decodeURIComponent(search.error)}
        </p>
      ) : null}

      {/* Desktop-only chrome — owner directive 2026-06-02: on mobile the top
          is JUST the guest list. The Team segment, RSVP stats strip, seating
          shortcut, share-invite link, and the search/sort toolbar all move to
          lg+ only. On mobile the counts + search/sort/add/filters all live in
          the lower-third MobileGuestCarousel (Summary · Search & sort · Add ·
          Customize); seating + share stay reachable from the planning nav /
          QR surfaces. */}
      <div className="hidden space-y-6 lg:block">
        <TeamSegment
          eventId={eventId}
          team={teamFilter}
          counts={teamCounts}
          search={search}
        />

        <StatsStrip stats={stats} eventId={eventId} active={rsvpFilter} />

      <Link
        href={`/dashboard/${eventId}/seating`}
        className="group inline-flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream px-4 py-3 transition-colors hover:border-terracotta/40 hover:bg-terracotta/5"
      >
        <span className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-terracotta/10 text-terracotta">
            <LayoutGrid aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="flex flex-col">
            <span className="text-base font-semibold text-ink">Seating chart</span>
            <span className="text-xs text-ink/55">
              Tables, floor plan, who sits where
            </span>
          </span>
        </span>
        <ArrowRight
          aria-hidden
          className="h-4 w-4 text-ink/40 transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta"
          strokeWidth={1.75}
        />
      </Link>

      {joinUrl ? <ShareInvite joinUrl={joinUrl} /> : null}

        {/* inline search + sort — desktop only; mobile uses the carousel's
            Search & sort panel. */}
        <Toolbar eventId={eventId} q={q} sort={sort} search={search} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <FacetsSidebar
          eventId={eventId}
          view={view}
          tagFilter={tagFilter}
          tags={allTags}
          search={search}
          groups={groups}
          currentGroupId={currentGroupId}
        />

        <div className="min-w-0 space-y-4">
          {visible.length === 0 ? (
            <EmptyState hasGuests={stats.total > 0} eventId={eventId} />
          ) : (
            <GuestListMultiselect
              eventId={eventId}
              guests={visible}
              palette={palette}
              groups={groups}
              groupMemberships={groupMemberships}
              currentGroupId={currentGroupId}
              photoDisplayUrls={photoDisplayUrls}
            />
          )}
        </div>
      </div>

      <QuickAddSheet
        eventId={eventId}
        existingGuests={quickAddPool}
        groups={quickAddGroups}
      />

      {/* mobile/tablet only — lower-third 4-panel carousel (summary /
          search&sort / add / customize) docked above the bottom nav. It
          renders its own in-flow spacer so the guest list clears the fixed
          carousel. The Summary panel carries the [Total][Attending][Pending]
          [Declined] counts (animated) that used to sit in the top StatsStrip
          — each box is also an RSVP filter link, so mobile keeps RSVP
          filtering. */}
      {/* Suspense required: MobileGuestCarousel uses useSearchParams() which
          must be wrapped in a Suspense boundary in a Server Component parent
          (Next.js 15 hard requirement — without it the route throws a 500). */}
      <Suspense fallback={null}>
        <MobileGuestCarousel
          eventId={eventId}
          q={q}
          sorts={SORT_OPTIONS.map((o) => ({ key: o.value, label: o.label }))}
          currentSort={sort}
          views={VIEW_FILTERS}
          activeView={currentGroupId ? '' : view}
          groups={groups}
          currentGroupId={currentGroupId}
          tags={allTags}
          activeTag={tagFilter}
          allVisibleIds={visible.map((g) => g.guest_id)}
          total={stats.total}
          attending={stats.attending}
          pending={stats.pending}
          declined={stats.declined}
          teamFilter={teamFilter}
        />
      </Suspense>
    </section>
  );
}

const SIDE_SORT_RANK: Record<GuestSide, number> = { bride: 0, groom: 1, both: 2 };

function lastNameThenFirst(a: GuestRow, b: GuestRow): number {
  return (
    a.last_name.localeCompare(b.last_name) ||
    a.first_name.localeCompare(b.first_name)
  );
}

function sortCompare(
  a: GuestRow,
  b: GuestRow,
  sort: SortKey,
  groupKey?: Map<string, string>,
): number {
  const rsvpRank: Record<RsvpStatus, number> = {
    attending: 0,
    pending: 1,
    maybe: 2,
    declined: 3,
  };
  switch (sort) {
    case 'first_name':
      return a.first_name.localeCompare(b.first_name);
    case 'side':
      return (
        SIDE_SORT_RANK[a.side] - SIDE_SORT_RANK[b.side] || lastNameThenFirst(a, b)
      );
    case 'group': {
      // Ungrouped guests sort last (after every group), then by name.
      const ka = groupKey?.get(a.guest_id);
      const kb = groupKey?.get(b.guest_id);
      if (ka === undefined && kb === undefined) return lastNameThenFirst(a, b);
      if (ka === undefined) return 1;
      if (kb === undefined) return -1;
      return ka.localeCompare(kb) || lastNameThenFirst(a, b);
    }
    case 'rsvp':
      return rsvpRank[a.rsvp_status] - rsvpRank[b.rsvp_status];
    case 'role':
      return a.role.localeCompare(b.role);
    case 'newest':
      return b.created_at.localeCompare(a.created_at);
    case 'last_name':
    default:
      return lastNameThenFirst(a, b);
  }
}

// First (alphabetical) custom-group label per guest, lowercased, for the
// Group sort. Guests in no group get no entry → sorted last by the caller.
function buildGroupSortKey(
  groups: GuestGroupWithCount[],
  membershipsMap: Map<string, string[]>,
): Map<string, string> {
  const labelById = new Map(
    groups.map((g) => [g.group_id, g.label.toLowerCase()]),
  );
  const out = new Map<string, string>();
  for (const [guestId, groupIds] of membershipsMap.entries()) {
    let best: string | undefined;
    for (const gid of groupIds) {
      const label = labelById.get(gid);
      if (label && (best === undefined || label < best)) best = label;
    }
    if (best !== undefined) out.set(guestId, best);
  }
  return out;
}

function uniqueTags(guests: GuestRow[]): string[] {
  const set = new Set<string>();
  for (const g of guests) for (const t of g.custom_tags) set.add(t);
  return Array.from(set).sort();
}

async function fetchJoinUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('event_join_tokens')
    .select('token')
    .eq('event_id', eventId)
    .maybeSingle();
  // Surface silent errors so a future event_join_tokens column rename
  // / RLS regression doesn't quietly hide the share-invite affordance
  // from every host until someone notices. The null fallback keeps the
  // page rendering with no Share-invite link.
  if (error) {
    logQueryError(
      'GuestsPage (event_join_tokens)',
      error,
      { event_id: eventId },
      'graceful_degrade',
    );
  }
  if (!data?.token) return null;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  return `${appUrl}/join/${eventId}?token=${data.token}`;
}

function pickFlash(search: {
  added?: string;
  saved?: string;
  removed?: string;
  imported?: string;
  skipped?: string;
  duplicates?: string;
  bulk_assigned?: string;
  bulk_grouped?: string;
  bulk_sided?: string;
  bulk_deleted?: string;
  group_created?: string;
  group_saved?: string;
  group_deleted?: string;
  group_member_removed?: string;
}): string | null {
  if (search.added) {
    const n = Number(search.added);
    if (Number.isFinite(n) && n > 1) return `Added ${n} guests.`;
    return 'Guest added.';
  }
  if (search.saved) return 'Saved.';
  if (search.removed) return 'Guest removed.';
  if (search.imported) {
    const n = Number(search.imported);
    const s = Number(search.skipped ?? 0);
    const d = Number(search.duplicates ?? 0);
    const parts = [`Imported ${n} guest${n === 1 ? '' : 's'}`];
    if (d > 0) parts.push(`skipped ${d} duplicate${d === 1 ? '' : 's'}`);
    if (s > 0) parts.push(`skipped ${s} invalid row${s === 1 ? '' : 's'}`);
    return parts.join(' · ') + '.';
  }
  if (search.bulk_assigned) {
    const n = Number(search.bulk_assigned);
    return `Role assigned to ${n} guest${n === 1 ? '' : 's'}.`;
  }
  if (search.bulk_grouped) {
    const n = Number(search.bulk_grouped);
    return `Added ${n} guest${n === 1 ? '' : 's'} to the group.`;
  }
  if (search.bulk_sided) {
    const n = Number(search.bulk_sided);
    return `Side updated for ${n} guest${n === 1 ? '' : 's'}.`;
  }
  if (search.bulk_deleted) {
    const n = Number(search.bulk_deleted);
    return `Removed ${n} guest${n === 1 ? '' : 's'} · seats opened up.`;
  }
  if (search.group_created) return 'Group created.';
  if (search.group_saved) return 'Group saved.';
  if (search.group_deleted) return 'Group deleted.';
  if (search.group_member_removed) return 'Removed from group.';
  return null;
}

function StatsStrip({
  stats,
  eventId,
  active,
}: {
  stats: GuestStats;
  eventId: string;
  active: RsvpStatus | '';
}) {
  const cards: {
    key: RsvpStatus | 'plus_ones' | 'total';
    label: string;
    count: number;
    tint: string;
  }[] = [
    { key: 'total', label: 'Invited', count: stats.total, tint: 'bg-ink/5 text-ink' },
    { key: 'attending', label: 'Attending', count: stats.attending, tint: 'bg-emerald-100 text-emerald-800' },
    { key: 'pending', label: 'Pending', count: stats.pending, tint: 'bg-amber-100 text-amber-800' },
    { key: 'declined', label: 'Declined', count: stats.declined, tint: 'bg-rose-100 text-rose-800' },
    { key: 'plus_ones', label: 'Plus-ones', count: stats.plus_ones, tint: 'bg-terracotta/10 text-terracotta-700' },
  ];

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => {
        const href =
          card.key === 'total' || card.key === 'plus_ones'
            ? `/dashboard/${eventId}/guests`
            : `/dashboard/${eventId}/guests?rsvp=${card.key}`;
        const isActive = (card.key === 'total' && !active) || card.key === active;
        return (
          <li key={card.key}>
            <Link
              href={href}
              className={`flex flex-col rounded-lg border px-3 py-2.5 transition-colors ${
                isActive
                  ? 'border-terracotta bg-terracotta/5'
                  : 'border-ink/10 hover:border-ink/25'
              }`}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                {card.label}
              </span>
              <span
                className={`mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-base font-semibold ${card.tint}`}
              >
                {card.count}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ShareInvite({ joinUrl }: { joinUrl: string }) {
  return (
    <details className="rounded-lg border border-ink/10 bg-cream">
      <summary className="cursor-pointer list-none px-4 py-3 text-base font-medium">
        <span className="inline-flex select-none items-center gap-2 text-ink">
          <Link2 aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          Share invite link
        </span>
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
          anyone with the link can sign up and join
        </span>
      </summary>
      <div className="border-t border-ink/10 p-4">
        <p className="mb-2 text-xs text-ink/60">
          Send this to guests via text or email. They&rsquo;ll sign in, pick a role, and
          land on the guest list.
        </p>
        <code className="block break-all rounded bg-ink/5 p-3 font-mono text-[11px] leading-relaxed text-ink/80">
          {joinUrl}
        </code>
      </div>
    </details>
  );
}

function Toolbar({
  eventId,
  q,
  sort,
  search,
}: {
  eventId: string;
  q: string;
  sort: SortKey;
  search: { rsvp?: string; view?: string; tag?: string };
}) {
  // Search input is a CLIENT ISLAND (owner directive 2026-05-23 — "no
  // need to press enter"). It owns its own state + debounces URL
  // updates so typing filters live. Sort + Apply remain in a native
  // form because sort changes are infrequent and the existing
  // form-submit pattern is fine for them.
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {/* Suspense required: LiveSearch uses useSearchParams() */}
      <Suspense fallback={null}>
        <LiveSearch
          initialValue={q}
          placeholder="Search names, roles, groups, RSVP…"
        />
      </Suspense>
      <form
        action={`/dashboard/${eventId}/guests`}
        method="get"
        className="flex items-center gap-2"
      >
        {q ? <input type="hidden" name="q" value={q} /> : null}
        {search.rsvp ? <input type="hidden" name="rsvp" value={search.rsvp} /> : null}
        {search.view ? <input type="hidden" name="view" value={search.view} /> : null}
        {search.tag ? <input type="hidden" name="tag" value={search.tag} /> : null}
        <select
          name="sort"
          defaultValue={sort}
          className="input-field appearance-none bg-cream pr-8 sm:w-56"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </select>
        <button className="button-secondary" type="submit">
          Apply
        </button>
      </form>
    </div>
  );
}

function FacetsSidebar({
  eventId,
  view,
  tagFilter,
  tags,
  search,
  groups,
  currentGroupId,
}: {
  eventId: string;
  view: string;
  tagFilter: string;
  tags: string[];
  search: { q?: string; rsvp?: string; sort?: string };
  groups: GuestGroupWithCount[];
  currentGroupId: string | null;
}) {
  const baseQuery = new URLSearchParams();
  if (search.q) baseQuery.set('q', search.q);
  if (search.rsvp) baseQuery.set('rsvp', search.rsvp);
  if (search.sort) baseQuery.set('sort', search.sort);

  const buildHref = (overrides: Record<string, string | null>) => {
    const q = new URLSearchParams(baseQuery);
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) q.delete(key);
      else q.set(key, value);
    }
    const qs = q.toString();
    return `/dashboard/${eventId}/guests${qs ? `?${qs}` : ''}`;
  };

  // The locked role-group view is "active" only when the host is on
  // one of those keys — custom-group views (view === "group:<uuid>")
  // should leave the role-group strip in neutral state.
  const activeRoleView = currentGroupId ? '' : view;

  return (
    <aside className="hidden space-y-6 self-start lg:sticky lg:top-24 lg:block">
      <FacetGroup label="View">
        <ul className="space-y-1">
          {VIEW_FILTERS.map((v) => (
            <li key={v.key}>
              <Link
                href={buildHref({ view: v.key === 'all' ? null : v.key })}
                className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                  activeRoleView === v.key
                    ? 'bg-terracotta/10 font-medium text-terracotta-700'
                    : 'text-ink/70 hover:bg-ink/5'
                }`}
              >
                {v.label}
              </Link>
            </li>
          ))}
        </ul>
      </FacetGroup>

      {/* 7th-pass hotfix 2026-05-23 — pre-compute per-group hrefs on the
          server side and pass as a plain Record<string,string> instead
          of the previous `buildHref` callback. React Server Components
          can't serialize functions across the RSC → Client boundary
          (GroupsSidebar is `'use client'`), so passing the arrow
          function crashed with "Functions cannot be passed directly to
          Client Components" — Sentry digest 3284377371 that PRs #380 ·
          #390 · #404 · #413 · #416 · #417 all chased through the data
          layer in vain. Sweep #4 of the 5-way parallel sweep pulled the
          actual stack trace from Vercel function logs and identified
          this surface as the root cause. */}
      <GroupsSidebar
        eventId={eventId}
        groups={groups}
        currentGroupId={currentGroupId}
        hrefByGroupId={Object.fromEntries(
          groups.map((g) => [
            g.group_id,
            buildHref({ view: `group:${g.group_id}` }),
          ]),
        )}
      />

      {tags.length > 0 ? (
        <FacetGroup label="Custom tags">
          <ul className="flex flex-wrap gap-2">
            {tagFilter ? (
              <li>
                <Link
                  href={buildHref({ tag: null })}
                  className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-1 text-xs text-ink/70 hover:bg-ink/10"
                >
                  <X aria-hidden className="h-3 w-3" strokeWidth={2} />
                  Clear
                </Link>
              </li>
            ) : null}
            {tags.map((t) => (
              <li key={t}>
                <Link
                  href={buildHref({ tag: t })}
                  className={`rounded-full px-2 py-1 text-xs ${
                    tagFilter === t
                      ? 'bg-terracotta text-cream'
                      : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
                  }`}
                >
                  {t}
                </Link>
              </li>
            ))}
          </ul>
        </FacetGroup>
      ) : null}
    </aside>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
        {label}
      </h3>
      {children}
    </section>
  );
}

function EmptyState({ hasGuests, eventId }: { hasGuests: boolean; eventId: string }) {
  if (hasGuests) {
    return (
      <div className="rounded-lg border border-dashed border-ink/15 bg-cream p-6 text-center text-ink/60">
        No guests match your filters.
        <div className="mt-3">
          <Link href={`/dashboard/${eventId}/guests`} className="button-secondary">
            Clear filters
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-ink/15 bg-cream p-8 text-center">
      <p className="text-base text-ink/70">
        No guests yet. Start by adding the couple&rsquo;s first invite.
      </p>
      <div className="mt-4">
        <Link href={`/dashboard/${eventId}/guests/new`} className="button-primary">
          + Add your first guest
        </Link>
      </div>
    </div>
  );
}

// Team Bride / Team Groom / Everyone — side filter (iteration 0001,
// 2026-06-02). Orthogonal to the role-group `view` filter: a guest can
// be Team Bride AND a Principal Sponsor. Server-rendered Links so the
// filter works with no client JS; preserves the other active params.
function TeamSegment({
  eventId,
  team,
  counts,
  search,
}: {
  eventId: string;
  team: 'all' | 'bride' | 'groom';
  counts: { all: number; bride: number; groom: number };
  search: { q?: string; rsvp?: string; view?: string; sort?: string; tag?: string };
}) {
  const buildHref = (value: 'all' | 'bride' | 'groom') => {
    const params = new URLSearchParams();
    if (search.q) params.set('q', search.q);
    if (search.rsvp) params.set('rsvp', search.rsvp);
    if (search.view) params.set('view', search.view);
    if (search.sort) params.set('sort', search.sort);
    if (search.tag) params.set('tag', search.tag);
    if (value !== 'all') params.set('team', value);
    const qs = params.toString();
    return `/dashboard/${eventId}/guests${qs ? `?${qs}` : ''}`;
  };

  const segs: {
    key: 'all' | 'bride' | 'groom';
    label: string;
    count: number;
    dot?: string;
    on: string;
  }[] = [
    { key: 'all', label: 'Everyone', count: counts.all, on: 'bg-ink text-cream' },
    {
      key: 'bride',
      label: 'Team Bride',
      count: counts.bride,
      dot: 'bg-rose-500',
      on: 'bg-rose-600 text-cream',
    },
    {
      key: 'groom',
      label: 'Team Groom',
      count: counts.groom,
      dot: 'bg-sky-600',
      on: 'bg-sky-700 text-cream',
    },
  ];

  return (
    <div className="flex gap-2">
      {segs.map((s) => {
        const active = team === s.key;
        return (
          <Link
            key={s.key}
            href={buildHref(s.key)}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-sm font-medium transition-colors sm:max-w-[170px] sm:flex-none ${
              active
                ? `border-transparent ${s.on}`
                : 'border-ink/15 text-ink/70 hover:border-ink/30'
            }`}
          >
            {s.dot ? <span className={`h-2 w-2 rounded-full ${s.dot}`} /> : null}
            {s.label}
            <span
              className={`text-xs font-semibold ${active ? 'opacity-80' : 'text-ink/40'}`}
            >
              {s.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}


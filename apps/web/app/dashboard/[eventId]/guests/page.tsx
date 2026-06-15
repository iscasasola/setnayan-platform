import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Link2, X, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import {
  computeGuestStats,
  computePaxProgress,
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
  type PaxProgress,
  type RsvpStatus,
} from '@/lib/guests';
import {
  filterByRoleGroup,
  ROLE_GROUP_LABELS,
  roleImportanceRank,
} from '@/lib/role-groups';
import { sanitizeRolePalette, type RolePalette } from '@/lib/mood-board';
import { ensureFinalized } from '@/lib/pax';
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
import { LifecycleRibbon } from './_components/lifecycle-ribbon';
import { GuestsViewSwitcher } from './_components/view-switcher';
import { GuestMindMap } from './_components/guest-mind-map';
import { ActiveFilters } from './_components/active-filters';

export const metadata = { title: 'Guests' };

const SORT_OPTIONS = [
  // Importance — owner directive 2026-06-05 ("guest is always arranged based on
  // their importance in the wedding. Bride will always be #1 then groom. then
  // everyone else follows depending on their role."). The DEFAULT arrangement;
  // bride/groom are pinned first under EVERY sort (see sortCompare).
  { value: 'importance', label: 'Importance' },
  { value: 'last_name', label: 'Last name (A–Z)' },
  { value: 'first_name', label: 'First name (A–Z)' },
  // Side / Group — owner directive 2026-06-03 ("sort by side, role or group").
  // The old alphabetical-by-enum "role" sort was retired 2026-06-05 in favor of
  // the importance sort above — that IS what "by role" meaningfully means for a
  // wedding (a curated hierarchy, not A–Z by enum string).
  { value: 'side', label: 'Side' },
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
    group?: string;
    gview?: string;
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
  const [guests, eventRow, groups, membershipsMap, joinUrl, pendingClaims, unsentInvites, seated, arrived] =
    await Promise.all([
      fetchGuestsByEvent(supabase, eventId),
      supabase
        .from('events')
        .select('role_palette, estimated_pax')
        .eq('event_id', eventId)
        .maybeSingle(),
      fetchGuestGroupsByEvent(supabase, eventId),
      fetchGroupMembershipsByEvent(supabase, eventId),
      fetchJoinUrl(supabase, eventId),
      // Guest invite-claims awaiting the couple (migration 20261021). RLS scopes
      // this to couples; a head+count read keeps it cheap.
      supabase
        .from('guest_claims')
        .select('claim_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .in('status', ['pending_review', 'otp_sent']),
      // Lifecycle-ribbon live progress (Phase 3) — three more head+count reads
      // in the same batch (no extra RTT cost beyond the parallel fan-out).
      // invitation_sent_at isn't part of GUEST_FIELDS, so unsent is counted
      // here rather than widening the shared GuestRow contract.
      supabase
        .from('guests')
        .select('guest_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .is('deleted_at', null)
        .is('invitation_sent_at', null)
        .neq('rsvp_status', 'declined'),
      supabase
        .from('event_seat_assignments')
        .select('assignment_id', { count: 'exact', head: true })
        .eq('event_id', eventId),
      supabase
        .from('guest_checkins')
        .select('checkin_id', { count: 'exact', head: true })
        .eq('event_id', eventId),
    ]);
  const pendingClaimsCount = pendingClaims.count ?? 0;
  const unsentCount = unsentInvites.count ?? 0;
  const seatedCount = seated.count ?? 0;
  const arrivedCount = arrived.count ?? 0;
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
  // Back-compat: the pre-2026-06-13 scheme encoded a custom group by
  // overloading `view` as "group:<id>" (mutually exclusive with role
  // views). Custom groups now ride their own `group` param so they can
  // stack with a role view. A stale "view=group:<id>" link/bookmark is
  // mapped onto the new param here so it still resolves.
  const rawView = search.view ?? 'all';
  const legacyGroup = rawView.startsWith('group:')
    ? rawView.slice('group:'.length)
    : null;
  const view = legacyGroup ? 'all' : rawView;
  const gview: 'list' | 'map' = search.gview === 'map' ? 'map' : 'list';
  const teamRaw = search.team ?? 'all';
  const teamFilter: 'all' | 'bride' | 'groom' =
    teamRaw === 'bride' || teamRaw === 'groom' ? teamRaw : 'all';
  const tagFilter = (search.tag ?? '').trim();
  const sort = (search.sort ?? 'importance') as SortKey;

  // Custom-group filter — its OWN `group` param now (see back-compat note
  // above), independent of the role-group `view`, so a host can stack
  // "Wedding Party" AND "Cousins" at once.
  const currentGroupId = (search.group ?? '').trim() || legacyGroup || null;
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
  // Role-view + custom-group now COMBINE (2026-06-13) — the group-member
  // filter ran in the loop above; the role-group filter runs here
  // unconditionally. `view` is 'all' (a no-op) when no role view is
  // active, so this is safe whether a group, a view, or both are set.
  visible = filterByRoleGroup(visible, view);
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
  // Pax-target progress (Adaptive Pax Pricing Phase 2) — sure-attending vs the
  // couple's minimum pax (events.estimated_pax). null when no target is set.
  // Read-only here; the vendor-facing pushes land in later phases.
  const paxProgress = computePaxProgress(
    stats,
    eventRow.data?.estimated_pax ?? null,
  );
  // Auto-finalize check (Adaptive Pax Pricing Phase 7) — lazily locks the count
  // once the guest-list edit deadline passes (default 14d before the event), so
  // the meter + vendor costs freeze. Surfaces the finalized banner below.
  const finalize = await ensureFinalized(supabase, eventId);
  const allTags = uniqueTags(guests);
  const flash = pickFlash(search);
  // Any filter active across ANY dimension — gates the mobile sticky
  // active-filters strip so it never renders as an empty bar.
  const hasAnyFilter = Boolean(
    q ||
      rsvpFilter ||
      (view && view !== 'all') ||
      currentGroupId ||
      tagFilter ||
      teamFilter !== 'all',
  );

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
    <section className="-mt-6 space-y-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:pt-0">
      <style>{`.shell-topbar{display:none}`}</style>

      {/* The floating focus-mode "back X" (top-left) was REMOVED 2026-06-15
          (nav-surfaces follow-up to #1470): the global journey bottom nav is now
          ALWAYS present on this surface — the Guests sub-views moved to top-of-
          page `.sn-seg` tabs (MobileGuestCarousel) rather than a second bottom
          bar — so a dedicated "back to home" affordance is vestigial. The safe-
          area top padding is kept (the top bar is still hidden on mobile via the
          <style> above) but no longer reserves the extra 3.25rem the X needed. */}
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
        <div className="hidden flex-col gap-2 self-start lg:flex lg:flex-row lg:items-center lg:self-auto">
          {joinUrl ? <ShareDropdown joinUrl={joinUrl} /> : null}
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

      {pendingClaimsCount > 0 ? (
        <Link
          href={`/dashboard/${eventId}/guests/claims`}
          className="group flex items-center justify-between gap-3 rounded-xl border border-terracotta/30 bg-terracotta/5 px-4 py-3 transition-colors hover:border-terracotta/50 hover:bg-terracotta/10"
        >
          <span className="text-sm text-ink">
            <span className="font-semibold text-terracotta-700">
              {pendingClaimsCount} guest {pendingClaimsCount === 1 ? 'request' : 'requests'}
            </span>{' '}
            waiting for you to confirm
          </span>
          <ArrowRight
            aria-hidden
            className="h-4 w-4 shrink-0 text-terracotta/60 transition-transform group-hover:translate-x-0.5"
            strokeWidth={1.75}
          />
        </Link>
      ) : null}

      {/* Guest list finalized (Adaptive Pax Pricing Phase 7) — the edit deadline
          passed; the binding count is frozen so late changes no longer move
          vendor costs. Shown on desktop + mobile. */}
      {finalize.locked ? (
        <p className="rounded-xl border border-ink/15 bg-ink/[0.03] px-4 py-3 text-sm text-ink/70">
          <span className="font-semibold text-ink">Guest list finalized</span>
          {finalize.finalPax ? ` · ${finalize.finalPax} guests locked in` : ''}. Changes
          after your guest‑list deadline no longer change vendor costs.
        </p>
      ) : null}

      {/* Desktop-only chrome — owner directive 2026-06-02 (mobile top = just
          the guest list; the carousel carries the counts/search/add/filters).
          Consolidated 2026-06-13 from 8 stacked blocks into 4 compact rows so
          the guest list rises above the fold: a slim summary strip (the RSVP
          counts ARE the filter), the lifecycle ribbon, one filter bar (search
          · sort · list/map view switch), and the always-visible active-filters
          chip row. Side moved into the rail; the duplicate "Invited" stat card
          and the standalone "Seating chart" card were removed (the ribbon's
          Seat step + the left nav already reach seating); Share moved to the
          header. */}
      <div className="hidden space-y-3 lg:block">
        <SummaryStrip
          stats={stats}
          eventId={eventId}
          active={rsvpFilter}
          search={search}
          paxProgress={paxProgress}
        />

        <LifecycleRibbon
          eventId={eventId}
          active="build"
          pendingClaims={pendingClaimsCount}
          unsent={unsentCount}
          unseated={Math.max(0, stats.attending - seatedCount)}
          arrived={arrivedCount}
        />

        {/* inline search + sort + list/map switch — desktop only; mobile uses
            the carousel's Search panel + Journey view switch. */}
        <Toolbar
          eventId={eventId}
          q={q}
          sort={sort}
          search={search}
          gview={gview}
        />

        <ActiveFilters eventId={eventId} search={search} groups={groups} />
      </div>

      {/* Active filters — mobile sticky strip (lg:hidden). The always-visible
          twin of the desktop chip row + the carousel's filter dot, so a couple
          can SEE and drop individual filters without opening the filter sheet
          (2026-06-13). Gated on hasAnyFilter so it never shows as an empty bar.
          (pl-11 left-pad dropped 2026-06-15 — the fixed back-X it cleared is
          gone, so the strip uses symmetric padding.) */}
      {hasAnyFilter ? (
        <div className="sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-40 -mt-2 flex gap-2 overflow-x-auto rounded-xl border border-ink/10 bg-cream/95 px-3 py-2 backdrop-blur lg:hidden">
          <ActiveFilters
            eventId={eventId}
            search={search}
            groups={groups}
            className="flex-nowrap whitespace-nowrap"
          />
        </div>
      ) : null}

      {/* mobile/tablet only — TOP-OF-PAGE 5-tab control surface (FIX B
          2026-06-15): Summary · Search · Add · Customize · Journey as `.sn-seg`
          pill tabs with the active panel below, rendered IN-FLOW above the
          guest list (replaces the former bottom-docked sheet so the page has a
          single bottom bar — the global journey nav). The Summary panel carries
          the [Total][Attending][Pending][Declined] counts (animated); each box
          is also an RSVP filter link, so mobile keeps RSVP filtering. */}
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
          activeView={view}
          groups={groups}
          currentGroupId={currentGroupId}
          tags={allTags}
          activeTag={tagFilter}
          allVisibleIds={visible.map((g) => g.guest_id)}
          total={stats.total}
          attending={stats.attending}
          pending={stats.pending}
          declined={stats.declined}
          paxProgress={paxProgress}
          teamFilter={teamFilter}
          pendingClaims={pendingClaimsCount}
          unsent={unsentCount}
          unseated={Math.max(0, stats.attending - seatedCount)}
          arrived={arrivedCount}
        />
      </Suspense>

      {/* Mind-map view (redesign Phase 2) — the full editor over the SAME
          records as the list. The component splits responsively itself:
          desktop = node/edge canvas, mobile = vertical expand/collapse tree.
          Mobile reaches map mode only via the carousel's Journey panel (a
          deliberate choice — the default stays "just the list"). */}
      {gview === 'map' ? (
        <GuestMindMap
          eventId={eventId}
          guests={guests.map((g) => ({
            guest_id: g.guest_id,
            first_name: g.first_name,
            last_name: g.last_name,
            display_name: g.display_name,
            side: g.side,
            role: g.role,
            extra_roles: g.extra_roles ?? [],
            plus_one_name: g.plus_one_name,
          }))}
          groups={groups}
          groupMemberships={groupMemberships}
        />
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <FacetsSidebar
          eventId={eventId}
          view={view}
          team={teamFilter}
          teamCounts={teamCounts}
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
              groupMode={
                sort === 'side'
                  ? 'side'
                  : sort === 'group'
                    ? 'group'
                    : sort === 'importance'
                      ? 'importance'
                      : 'flat'
              }
            />
          )}
        </div>
      </div>
      )}

      <QuickAddSheet
        eventId={eventId}
        existingGuests={quickAddPool}
        groups={quickAddGroups}
      />
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

// Bride first, groom second, everyone else after — the couple is the event
// foundation and is pinned first under EVERY sort (owner 2026-06-05).
function coupleRank(g: GuestRow): number {
  return g.role === 'bride' ? 0 : g.role === 'groom' ? 1 : 2;
}

// A guest's wedding-importance rank = their MOST important role (primary or
// extra), so a Bridesmaid who's also a Principal Sponsor ranks by the higher
// of the two. Lower = more important. See ROLE_IMPORTANCE in role-groups.
function guestImportanceRank(g: GuestRow): number {
  return Math.min(...[g.role, ...(g.extra_roles ?? [])].map(roleImportanceRank));
}

function sortCompare(
  a: GuestRow,
  b: GuestRow,
  sort: SortKey,
  groupKey?: Map<string, string>,
): number {
  // Bride/Groom are pinned first under EVERY sort — only when neither row is
  // the couple does the chosen sort decide order (owner 2026-06-05 "Bride will
  // always be #1 then groom").
  const ca = coupleRank(a);
  const cb = coupleRank(b);
  if (ca !== cb) return ca - cb;

  const rsvpRank: Record<RsvpStatus, number> = {
    attending: 0,
    pending: 1,
    maybe: 2,
    declined: 3,
  };
  switch (sort) {
    case 'importance':
      return (
        guestImportanceRank(a) - guestImportanceRank(b) ||
        lastNameThenFirst(a, b)
      );
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

// Summary strip (redesign 2026-06-13) — replaces the old StatsStrip's
// progress bar + FIVE stat cards. The total no longer gets its own
// "Invited" card (it already headlines the H1 + the "of N" caption — the
// duplication the owner flagged); instead the four RSVP states ARE the
// filter, as toggle pills (tap an active pill to clear it). Plus-ones is
// kept as a caption so the count isn't lost. Pill links preserve every
// other active param so RSVP combines with side / view / group / tag.
function SummaryStrip({
  stats,
  eventId,
  active,
  search,
  paxProgress,
}: {
  stats: GuestStats;
  eventId: string;
  active: RsvpStatus | '';
  search: Record<string, string | undefined>;
  paxProgress: PaxProgress | null;
}) {
  const buildHref = (rsvp: RsvpStatus | null) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(search)) {
      if (k === 'rsvp' || !v) continue;
      p.set(k, v);
    }
    if (rsvp) p.set('rsvp', rsvp);
    const qs = p.toString();
    return `/dashboard/${eventId}/guests${qs ? `?${qs}` : ''}`;
  };

  const responded = stats.total - stats.pending;
  const pct = stats.total > 0 ? Math.round((responded / stats.total) * 100) : 0;
  const seg = (n: number) => (stats.total > 0 ? (n / stats.total) * 100 : 0);

  const pills: {
    key: RsvpStatus;
    label: string;
    count: number;
    tint: string;
  }[] = [
    { key: 'attending', label: 'Attending', count: stats.attending, tint: 'bg-emerald-100 text-emerald-800' },
    { key: 'pending', label: 'Pending', count: stats.pending, tint: 'bg-amber-100 text-amber-800' },
    { key: 'declined', label: 'Declined', count: stats.declined, tint: 'bg-rose-100 text-rose-800' },
    { key: 'maybe', label: 'Maybe', count: stats.maybe, tint: 'bg-sky-100 text-sky-800' },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream px-4 py-3 lg:flex-row lg:items-center lg:gap-5">
      <div className="min-w-0 flex-1">
        {paxProgress ? (
          <div className="mb-2.5">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-mono uppercase tracking-[0.15em] text-terracotta">
                {paxProgress.exceeded ? 'Now planning for' : 'Guest target'}
              </span>
              <span className="tabular-nums text-ink/70">
                {paxProgress.exceeded ? (
                  <>
                    {paxProgress.headcount} guests · {paxProgress.overBy} over your{' '}
                    {paxProgress.target} minimum
                  </>
                ) : (
                  <>
                    {paxProgress.headcount} of {paxProgress.target} pax ·{' '}
                    {paxProgress.progressPct}%
                  </>
                )}
              </span>
            </div>
            <div
              role="img"
              aria-label={
                paxProgress.exceeded
                  ? `Now planning for ${paxProgress.headcount} attending guests, ${paxProgress.overBy} over the ${paxProgress.target} minimum pax`
                  : `${paxProgress.headcount} attending of a ${paxProgress.target} minimum pax target, ${paxProgress.progressPct}%`
              }
              className="mt-1 h-2 overflow-hidden rounded-full bg-ink/10"
            >
              <div
                className={`h-full rounded-full ${paxProgress.exceeded ? 'bg-terracotta-700' : 'bg-terracotta'}`}
                style={{ width: `${paxProgress.exceeded ? 100 : paxProgress.progressPct}%` }}
              />
            </div>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between text-xs text-ink/55">
          <span className="font-mono uppercase tracking-[0.15em]">Confirmations</span>
          <span className="tabular-nums">
            {responded} of {stats.total} responded · {pct}%
            {stats.plus_ones > 0 ? ` · ${stats.plus_ones} plus-ones` : ''}
          </span>
        </div>
        <div
          role="img"
          aria-label={`${responded} of ${stats.total} guests have responded (${stats.attending} attending, ${stats.maybe} maybe, ${stats.declined} declined, ${stats.pending} pending)`}
          className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-ink/10"
        >
          <div className="h-full bg-emerald-400" style={{ width: `${seg(stats.attending)}%` }} />
          <div className="h-full bg-amber-300" style={{ width: `${seg(stats.maybe)}%` }} />
          <div className="h-full bg-rose-300" style={{ width: `${seg(stats.declined)}%` }} />
        </div>
      </div>
      <ul className="grid grid-cols-4 gap-2 lg:flex lg:shrink-0">
        {pills.map((pill) => {
          const isActive = pill.key === active;
          // Tap an active pill to clear the RSVP filter (toggle); otherwise
          // apply it. Either way the other active filters are preserved.
          const href = isActive ? buildHref(null) : buildHref(pill.key);
          return (
            <li key={pill.key}>
              <Link
                href={href}
                aria-current={isActive ? 'true' : undefined}
                title={isActive ? `Clear ${pill.label} filter` : `Show only ${pill.label}`}
                className={`flex min-w-[4.25rem] flex-col rounded-lg border px-3 py-1.5 transition-colors ${
                  isActive
                    ? 'border-terracotta bg-terracotta/5'
                    : 'border-ink/10 hover:border-ink/25'
                }`}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
                  {pill.label}
                </span>
                <span
                  className={`mt-0.5 inline-flex w-fit rounded-full px-2 py-0.5 text-base font-semibold ${pill.tint}`}
                >
                  {pill.count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Share invite link — a compact header dropdown (2026-06-13). Was a
// full-width collapsible row in the desktop chrome stack; folding it into
// the header keeps the share affordance one tap away without spending a
// stacked row above the guest list. Native <details> so it needs no
// client JS; the panel is absolutely positioned under the summary.
function ShareDropdown({ joinUrl }: { joinUrl: string }) {
  return (
    <details className="group relative">
      <summary className="button-secondary inline-flex cursor-pointer list-none select-none items-center gap-2">
        <Link2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Share
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-ink/15 bg-cream p-4 shadow-[0_12px_32px_-12px_rgba(30,34,41,0.4)]">
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
  gview,
}: {
  eventId: string;
  q: string;
  sort: SortKey;
  search: {
    rsvp?: string;
    view?: string;
    group?: string;
    team?: string;
    tag?: string;
    gview?: string;
  };
  gview: 'list' | 'map';
}) {
  // Search input is a CLIENT ISLAND (owner directive 2026-05-23 — "no
  // need to press enter"). It owns its own state + debounces URL
  // updates so typing filters live. Sort + Apply remain in a native
  // form because sort changes are infrequent and the existing
  // form-submit pattern is fine for them. The List/Mind-map switch (was
  // its own stacked row pre-2026-06-13) now lives at the right of this
  // bar.
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
        {search.group ? <input type="hidden" name="group" value={search.group} /> : null}
        {search.team ? <input type="hidden" name="team" value={search.team} /> : null}
        {search.tag ? <input type="hidden" name="tag" value={search.tag} /> : null}
        {search.gview ? <input type="hidden" name="gview" value={search.gview} /> : null}
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
      <div className="sm:ml-auto">
        <GuestsViewSwitcher eventId={eventId} active={gview} search={search} />
      </div>
    </div>
  );
}

function FacetsSidebar({
  eventId,
  view,
  team,
  teamCounts,
  tagFilter,
  tags,
  search,
  groups,
  currentGroupId,
}: {
  eventId: string;
  view: string;
  team: 'all' | 'bride' | 'groom';
  teamCounts: { all: number; bride: number; groom: number };
  tagFilter: string;
  tags: string[];
  search: { q?: string; rsvp?: string; sort?: string };
  groups: GuestGroupWithCount[];
  currentGroupId: string | null;
}) {
  // baseQuery now carries EVERY active dimension (2026-06-13) — not just
  // q/rsvp/sort — so toggling any one facet preserves the rest. This is
  // what lets a role-view, a custom group, a side, an RSVP, and a tag all
  // stack: every link rebuilds from the full current state and overrides a
  // single key.
  const baseQuery = new URLSearchParams();
  if (search.q) baseQuery.set('q', search.q);
  if (search.rsvp) baseQuery.set('rsvp', search.rsvp);
  if (search.sort) baseQuery.set('sort', search.sort);
  if (view && view !== 'all') baseQuery.set('view', view);
  if (team !== 'all') baseQuery.set('team', team);
  if (tagFilter) baseQuery.set('tag', tagFilter);
  if (currentGroupId) baseQuery.set('group', currentGroupId);

  const buildHref = (overrides: Record<string, string | null>) => {
    const q = new URLSearchParams(baseQuery);
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) q.delete(key);
      else q.set(key, value);
    }
    const qs = q.toString();
    return `/dashboard/${eventId}/guests${qs ? `?${qs}` : ''}`;
  };

  // Role-view + custom-group are independent now, so the role-view strip
  // reflects `view` directly (no longer blanked when a group is active).
  const activeRoleView = view;

  // Side facet — moved into the rail (2026-06-13) from the old full-width
  // segment row. Same `team` param + "both counts to both sides" rule.
  const sideOptions: {
    key: 'all' | 'bride' | 'groom';
    label: string;
    count: number;
    dot?: string;
  }[] = [
    { key: 'all', label: 'Everyone', count: teamCounts.all },
    { key: 'bride', label: 'Bride', count: teamCounts.bride, dot: 'bg-rose-500' },
    { key: 'groom', label: 'Groom', count: teamCounts.groom, dot: 'bg-sky-600' },
  ];

  return (
    <aside className="hidden space-y-6 self-start lg:sticky lg:top-24 lg:block">
      <FacetGroup label="Side">
        <ul className="space-y-1">
          {sideOptions.map((s) => (
            <li key={s.key}>
              <Link
                href={buildHref({ team: s.key === 'all' ? null : s.key })}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  team === s.key
                    ? 'bg-terracotta/10 font-medium text-terracotta-700'
                    : 'text-ink/70 hover:bg-ink/5'
                }`}
              >
                {s.dot ? (
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                ) : null}
                <span className="flex-1">{s.label}</span>
                <span className="text-[10px] text-ink/40">{s.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </FacetGroup>

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
            // Own `group` param now (2026-06-13) so the chosen group
            // stacks with any active role view instead of replacing it.
            buildHref({ group: g.group_id }),
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


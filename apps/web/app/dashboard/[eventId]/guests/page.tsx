import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Link2, ArrowRight, Send, LayoutGrid } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveRoleSetKeyForEvent } from '@/lib/event-type-profile';
import { getCurrentUser } from '@/lib/auth';
import { publicEventPath, resolveEventOwnerSlug } from '@/lib/public-event-url';
import {
  computeGuestStats,
  computePaxProgress,
  fetchGroupMembershipsByEvent,
  fetchGuestGroupsByEvent,
  fetchGuestsByEvent,
  guestDisplayName,
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
import { SIDE_DOT } from '@/lib/side-colors';
import { fetchAssignments, fetchFloorPlan, fetchTables } from '@/lib/seating';
import { suggestTableFor } from '@/lib/seat-suggest';
import { ensureFinalized } from '@/lib/pax';
import { eventSkuActive } from '@/lib/entitlements';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { GuestListMultiselect } from './_components/guest-list-multiselect';
import { CaptureBar } from './_components/capture-bar';
import { GroupsSidebar } from './_components/groups-sidebar';
import { GuestsSearch } from './_components/guests-search';
import { MobileGuestCarousel } from './_components/mobile-guest-carousel';
import {
  OpenQuickAddButton,
  QuickAddSheet,
} from './_components/quick-add-sheet';
import { SortSelect } from './_components/sort-select';
import { GuestsViewSwitcher } from './_components/view-switcher';
import { GuestMindMap } from './_components/guest-mind-map';
import { ActiveFilters } from './_components/active-filters';
import { UndoToastHost } from './_components/undo-toast';
import { GuestDrawerHost } from './_components/guest-drawer';
import { GuestDetailBody } from './_components/guest-detail-body';
import {
  InspectorColumn,
  InspectorLayout,
} from '@/app/_components/inspector/inspector-column';

export const metadata = { title: 'Guests' };

// The `?inspect=` selection param is read by the inspector shell (useSearchParams);
// cookie-scoped auth already makes this route dynamic, but the explicit flag keeps
// the search-param read off any static path (mirrors the Studio hub consumer).
export const dynamic = 'force-dynamic';

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
const ALL_VIEW_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All guests' },
  { key: 'vip_family', label: ROLE_GROUP_LABELS.vip_family },
  // Nikah principals — only applies to muslim weddings.
  { key: 'muslim_principals', label: ROLE_GROUP_LABELS.muslim_principals },
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

// The Catholic-Filipino role filters that have no Nikah equivalent. Keep the
// View sidebar ceremony-correct: a muslim wedding shows 'Nikah Principals' and
// hides these; every other wedding hides 'Nikah Principals'. (Avoids a couple
// ever seeing an always-empty wrong-faith filter row.)
const CATHOLIC_ONLY_VIEW_FILTERS = new Set([
  'principal_sponsors',
  'secondary_sponsors',
  'bearers_flower_girl',
]);

function viewFiltersFor(
  roleSetKey: string | null | undefined,
): { key: string; label: string }[] {
  const isMuslim = roleSetKey === 'wedding_muslim';
  return ALL_VIEW_FILTERS.filter((f) => {
    if (f.key === 'muslim_principals') return isMuslim;
    if (CATHOLIC_ONLY_VIEW_FILTERS.has(f.key)) return !isMuslim;
    return true;
  });
}

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
    inspect?: string;
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
  // Per-event-type role set for the quick-add picker (iteration 0053 P2),
  // ceremony-aware so muslim weddings offer the Nikah roles (resolveRoleSetKeyForEvent
  // returns 'wedding_muslim' for them) and Catholic weddings keep 'wedding'.
  const guestRoleSetKey = await resolveRoleSetKeyForEvent(eventId);
  // Ceremony-aware View-sidebar filters: muslim weddings get the Nikah-principals
  // filter and not the Catholic sponsor/bearer ones, and vice-versa.
  const viewFilters = viewFiltersFor(guestRoleSetKey);
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // All reads fire in ONE parallel batch — including the share-invite token,
  // which used to run as a 5th *sequential* round-trip after this block (owner
  // perf pass 2026-06-03). Folding it in drops one Singapore RTT off every
  // visit to the Guests tab.
  const [guests, eventRow, groups, membershipsMap, joinUrl, pendingClaims, unsentInvites, assignments, tables, arrived, floorPlan, brandedQrActive] =
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
      // Unlisted joiners awaiting the couple's reconcile (Invite/Join v2,
      // 0000 ADDENDUM 2026-06-25). These are real guest rows optimistically
      // admitted whose name didn't match the list. RLS scopes this to couples.
      // Living Roster P2: fetch their IDS (not just a head+count) so the roster
      // can surface them INLINE as blush "needs you" rows — the /guests/claims
      // deep route stays for the merge-into-existing (Link) flow. `count:exact`
      // keeps the banner/count while also returning the rows.
      supabase
        .from('guests')
        .select('guest_id', { count: 'exact' })
        .eq('event_id', eventId)
        .eq('entry_source', 'self_added_unlisted')
        .is('deleted_at', null),
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
      // Living Roster P3 — the per-guest seat READ. `fetchAssignments` returns the
      // live seat rows (its length also gives the aggregate seatedCount the mobile
      // carousel wants), and `fetchTables` gives each assignment's table_label +
      // the pool the pure suggestion heuristic drafts unseated guests into. Both
      // are couple-RLS-scoped reads that fold into the same parallel fan-out.
      // …guarded like every other read in this fan-out: fetchAssignments/
      // fetchTables THROW on error (unlike the head+count reads they replaced),
      // and this Promise.all must never take down the whole Guests tab (the
      // roster/RSVP/invites) over a transient seat-read blip — the documented
      // "log loudly, return empty, never throw" invariant (Sentry 3284377371).
      // On failure seats degrade to 0/suggested exactly as before. Mirrors the
      // dashboard overview's fetchTables(...).catch(() => []).
      fetchAssignments(supabase, eventId).catch(
        () => [] as Awaited<ReturnType<typeof fetchAssignments>>,
      ),
      fetchTables(supabase, eventId).catch(
        () => [] as Awaited<ReturnType<typeof fetchTables>>,
      ),
      supabase
        .from('guest_checkins')
        .select('checkin_id', { count: 'exact', head: true })
        .eq('event_id', eventId),
      // Living Roster P4 — the event's real stage anchor, so the reactive seat
      // SUGGESTION ranks tables from where the couple actually placed the stage
      // (matching Auto-Arrange), not the hardcoded top-center default. Folds into
      // this same parallel fan-out (fetchFloorPlan is a fast PK-indexed singleton,
      // never the slowest read) and is guarded like the other seat reads: a blip
      // degrades to the default anchor rather than taking down the Guests tab.
      fetchFloorPlan(supabase, eventId).catch(() => null),
      // Living Roster QR doorway (2026-07-15) — is the paid CUSTOM_QR_GUEST
      // upgrade admin-APPROVED for this event? Drives the guest drawer's QR
      // section: when active it offers the real branded PNG download (the same
      // gated /api/website/qr/guest/[guestId] route the Invitation surface uses);
      // when not, the drawer routes to the Invitation page (where every guest's
      // free default scannable QR always renders) + the Custom-QR studio. Read
      // with the admin client because ownership is an EVENT fact while orders RLS
      // is purchaser-scoped (a co-host who didn't place the order would be
      // mis-gated) — exactly like the Invitation page + the PNG endpoint. Folds
      // into this parallel fan-out; eventSkuActive throws on a non-graceful DB
      // error, so degrade to the default (no branded download) rather than
      // taking down the whole Guests tab.
      eventSkuActive(createAdminClient(), eventId, 'CUSTOM_QR_GUEST').catch(
        () => false,
      ),
    ]);
  // Self-join reconcile queue — the ids feed the inline blush roster rows; the
  // count still drives the /guests/claims banner + the mobile carousel badge.
  const selfJoinIds = ((pendingClaims.data ?? []) as { guest_id: string }[]).map(
    (r) => r.guest_id,
  );
  const pendingClaimsCount = pendingClaims.count ?? selfJoinIds.length;
  const unsentCount = unsentInvites.count ?? 0;
  // Seated count now derives from the seat rows we already fetched (P3) rather
  // than a separate head+count round-trip — one fewer Singapore RTT.
  const seatedCount = assignments.length;
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

  // Living Roster P3 — the reactive seat column. Each rendered row resolves to
  // one of three states: PLACED (a live assignment → its table label), DECLINED
  // (handled client-side off the rsvp), or SUGGESTED (a pure per-row hint the
  // seat plan self-drafts from role + side, via `suggestTableFor`). Built over
  // the FILTERED `visible` set (the rows the roster actually renders) so it stays
  // in lockstep with the filtered-vs-full split. DEGRADED by design: no persisted
  // "held" state exists, so there's no held chip and no release-bar (P4/schema).
  const tableLabelById = new Map(tables.map((t) => [t.table_id, t.table_label]));
  const placedByGuest = new Map<string, string>();
  for (const a of assignments) {
    const label = tableLabelById.get(a.table_id);
    if (label) placedByGuest.set(a.guest_id, label);
  }
  // The event's real stage anchor for the suggestion heuristic (P4) — the actual
  // floor-plan stage the couple placed, so "~T#" hints rank from the same point
  // Auto-Arrange does. Falls back to suggestTableFor's default when no floor plan
  // row exists yet (undefined → the param default kicks in).
  const stage = floorPlan ? { x: floorPlan.stage_x, y: floorPlan.stage_y } : undefined;
  const seatByGuest: Record<string, { placed: string | null; suggested: string | null }> =
    Object.fromEntries(
      visible.map((g) => {
        const placed = placedByGuest.get(g.guest_id) ?? null;
        // Only compute a suggestion for the state that actually renders it — a
        // seated or declined guest never shows the dashed hint.
        const suggested =
          placed || g.rsvp_status === 'declined'
            ? null
            : suggestTableFor(g, tables, assignments, stage);
        return [g.guest_id, { placed, suggested }];
      }),
    );

  // Convert the Map<guest_id, group_id[]> to a plain object so it
  // serializes cleanly across the server/client component boundary.
  const groupMemberships: Record<string, string[]> = Object.fromEntries(
    membershipsMap.entries(),
  );

  // Desktop inspector selection (Inspector P2) — resolve `?inspect=<guestId>` to a
  // guest ALREADY in this page's fetched roster (no extra query). An unknown or
  // stale id renders the inspector closed (hasSelection=false), never a blank
  // rail. The body is the SAME <GuestDetailBody> the mobile sheet renders — one
  // body, two frames — so the desktop column can't diverge from the sheet.
  const inspectId = typeof search.inspect === 'string' ? search.inspect : null;
  const inspectedGuest = inspectId
    ? (guests.find((g) => g.guest_id === inspectId) ?? null)
    : null;
  const groupLabelById = new Map(groups.map((g) => [g.group_id, g.label] as const));
  const inspectedGroupLabels = inspectedGuest
    ? (membershipsMap.get(inspectedGuest.guest_id) ?? [])
        .map((id) => groupLabelById.get(id))
        .filter((l): l is string => Boolean(l))
    : [];
  const inspectorBody = inspectedGuest ? (
    <InspectorColumn
      eyebrow="Guest"
      title={guestDisplayName(inspectedGuest)}
      fullHref={`/dashboard/${eventId}/guests/${inspectedGuest.guest_id}`}
      fullLabel="Open full details"
      swapKey={inspectedGuest.guest_id}
      ariaLabel={`${guestDisplayName(inspectedGuest)} details`}
    >
      <GuestDetailBody
        guest={inspectedGuest}
        groupLabels={inspectedGroupLabels}
        eventId={eventId}
        brandedQrActive={brandedQrActive}
        showFullDetailsLink={false}
      />
    </InspectorColumn>
  ) : null;

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
  // Roster lens-swap key (Glass PR-3) — a stable digest of the active filter
  // dimensions. When any facet changes the key changes, remounting the roster
  // wrapper so `.sn-lens-swap` cross-fades the new result set (§2d "tab/lens/
  // filter body swaps: never a hard cut"). Sort/gview are display-only and are
  // deliberately excluded (a re-sort isn't a lens change). The Living Roster's
  // selection + optimistic state live in module-singleton stores, so the
  // remount is presentational — no data/action/selection is lost.
  const rosterLensKey = [q, rsvpFilter, view, currentGroupId ?? '', teamFilter, tagFilter].join(
    '|',
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

  const master = (
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
      <header className="sn-reveal hidden flex-col gap-3 lg:flex lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="sn-eye">Guest list</p>
          <h1 className="sn-h1 mt-1.5">
            <span className="font-mono">{stats.total}</span>{' '}
            <span className="sn-h1-tail">
              {stats.total === 1 ? 'guest' : 'guests'}
            </span>
          </h1>
        </div>
        <div className="hidden flex-col gap-2 self-start lg:flex lg:flex-row lg:items-center lg:self-auto">
          {/* Invite doorway (2026-07-15) — the Invite journey stage (/guests/invite:
              the one join link + QR) was orphaned when the Living Roster reskin
              dropped the lifecycle ribbon; this restores its desktop entry point.
              Same button-secondary weight as the Share affordance beside it —
              discoverable, not shouty. Share stays; the add paths (primary add,
              CSV import, quick-add list, full form) live in the capture bar. */}
          <Link
            href={`/dashboard/${eventId}/guests/invite`}
            className="button-secondary inline-flex items-center gap-2"
          >
            <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Invite guests
          </Link>
          {/* Seat-plan doorway (2026-07-15) — the Seat journey stage
              (/seating: the "Arrange the room" editor, authoring truth for the
              3D plan) was reachable ONLY from the mobile carousel's journey pill;
              the desktop Guests page had no door to it. Same disease the Invite
              door (beside) just cured. Same button-secondary weight — the proto's
              `.gseat` glass pill. */}
          <Link
            href={`/dashboard/${eventId}/seating`}
            className="button-secondary inline-flex items-center gap-2"
          >
            <LayoutGrid aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Arrange the room
          </Link>
          {joinUrl ? <ShareDropdown joinUrl={joinUrl} /> : null}
        </div>
      </header>

      {flash ? (
        <p
          role="status"
          className="rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800"
        >
          {flash}
        </p>
      ) : null}

      {search.error ? (
        <p
          role="alert"
          className="rounded-md border border-danger-300/60 bg-danger-50 px-4 py-3 text-sm text-danger-800"
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

      {/* Desktop-only chrome — Living Roster reskin (P0 · 2026-07-11). The old
          split-brain of a stat strip (GUEST TARGET / PAX POOL / CONFIRMATIONS)
          up top + a SIDE / VIEW / GROUPS facet rail down the left is folded into
          ONE horizontal summary-facet bar: the live counts now sit ON the filter
          pills themselves (Side / RSVP / View / Group each a labelled row of
          count-bearing pills), with the pax + confirmations meters as the bar's
          header and the active-filter breadcrumb at its foot. The Build ▸ Invite
          ▸ Confirm ▸ Seat ▸ Day-of stage-nav stepper (lifecycle ribbon) is
          RETIRED — its steps live in the left nav + the roster's own affordances.
          Same filter params, same server actions: this is presentation only.
          (Mobile top stays just the list; the carousel carries its own chrome.) */}
      <div className="gl-settle hidden space-y-3 lg:block">
        {/* Capture-first (Living Roster P2): the CaptureBar heads the chrome as
            the ADD doorway — parses "Ana Cruz +1 groom vip #Barkada" and lands
            it inline. A new guest inherits the active Side lens. FIND lives in
            the SummaryFacetBar query row now (search consolidation 2026-07-13),
            not behind a mode toggle here. */}
        <CaptureBar
          eventId={eventId}
          defaultSide={teamFilter === 'all' ? 'both' : teamFilter}
        />

        {/* The single facet instrument. Search + Sort + List/Mind-map fold into
            its query row (they were a separate Toolbar block pre-2026-07-13);
            desktop chrome is now two blocks, not three. Desktop only — mobile
            uses the carousel's own compose-row + Journey switch. */}
        <SummaryFacetBar
          stats={stats}
          eventId={eventId}
          search={search}
          q={q}
          sort={sort}
          sortOptions={SORT_OPTIONS}
          gview={gview}
          paxProgress={paxProgress}
          rsvpActive={rsvpFilter}
          teamActive={teamFilter}
          teamCounts={teamCounts}
          view={view}
          views={viewFilters}
          groups={groups}
          currentGroupId={currentGroupId}
          tagFilter={tagFilter}
          tags={allTags}
        />
      </div>

      {/* Active filters — mobile sticky strip (lg:hidden). The always-visible
          twin of the desktop chip row + the carousel's filter dot, so a couple
          can SEE and drop individual filters without opening the filter sheet
          (2026-06-13). Gated on hasAnyFilter so it never shows as an empty bar.
          (pl-11 left-pad dropped 2026-06-15 — the fixed back-X it cleared is
          gone, so the strip uses symmetric padding.) */}
      {hasAnyFilter ? (
        <div className="sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-40 -mt-2 flex gap-2 overflow-x-auto rounded-xl border border-white/60 bg-white/55 px-3 py-2 backdrop-blur-xl lg:hidden">
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
          views={viewFilters}
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
          roleSetKey={guestRoleSetKey}
          joinUrl={joinUrl}
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
      /* Roster-as-hero — full-width (Living Roster P0). The left facet rail is
         gone: Side / View / Groups filtering now rides the summary-facet bar
         above, so the list gets the whole width instead of a cramped 240px
         column beside it. `gl-settle-delayed` eases the roster in a beat after
         the bar on first load (frozen under prefers-reduced-motion). */
      <div key={rosterLensKey} className="gl-settle-delayed sn-lens-swap min-w-0 space-y-4">
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
              selfJoinIds={selfJoinIds}
              seatByGuest={seatByGuest}
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
              roleSetKey={guestRoleSetKey}
              recentlyDeleted={search.bulk_deleted}
              recentlyApplied={Boolean(
                search.bulk_assigned ||
                  search.bulk_grouped ||
                  search.bulk_sided,
              )}
            />
          )}
      </div>
      )}

      <QuickAddSheet
        eventId={eventId}
        existingGuests={quickAddPool}
        groups={quickAddGroups}
        roleSetKey={guestRoleSetKey}
      />

      {/* Living Roster P1 · in-page overlay hosts. UndoToastHost is the single
          bottom snackbar for optimistic deletes; GuestDrawerHost is the right
          slide-in quick-view a roster row opens. Both are portal-rendered
          client islands that sit idle until acted on. */}
      <UndoToastHost />
      <GuestDrawerHost eventId={eventId} brandedQrActive={brandedQrActive} />
    </section>
  );

  // Finder-style master ▸ detail (Inspector P2): at ≥xl the roster reflows to
  // leave room for the sticky guest inspector rail; below xl the rail is hidden
  // and the name triggers navigate to the standalone detail route (mobile
  // unchanged). The whole page is the master so the rail sits beside all of the
  // roster chrome (facet bar, capture bar, header actions), exactly like Studio.
  return (
    <InspectorLayout
      paramKey="inspect"
      hasSelection={Boolean(inspectedGuest)}
      master={master}
      inspector={inspectorBody}
    />
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
  const [{ data, error }, { data: ev }] = await Promise.all([
    supabase.from('event_join_tokens').select('token').eq('event_id', eventId).maybeSingle(),
    supabase.from('events').select('slug').eq('event_id', eventId).maybeSingle(),
  ]);
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
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  // Branded invite link when the event has a public slug (e.g. /cale-ice/invite).
  // The /[slug]/invite route resolves the join token server-side, so it never
  // appears in the shared URL. Fall back to the opaque token URL otherwise.
  const slug = (ev?.slug as string | null) ?? null;
  if (slug) {
    // Nested /u/ under the cutover flag, bare root otherwise (self-noops OFF).
    const ownerSlug = await resolveEventOwnerSlug(createAdminClient(), eventId);
    return `${appUrl}${publicEventPath(slug, ownerSlug)}/invite`;
  }
  if (!data?.token) return null;
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

// -----------------------------------------------------------------------
// SummaryFacetBar · Living Roster P0 (2026-07-11). The old two-piece chrome
// — a stat strip (GUEST TARGET / PAX POOL / CONFIRMATIONS) stacked over a
// left SIDE / VIEW / GROUPS facet RAIL — is folded into ONE horizontal bar:
//
//   ┌ meters (pax + confirmations progress) ──────────────────────────┐
//   │ Side   [Everyone · N] [Bride · N] [Groom · N]                    │
//   │ RSVP   [Attending · N] [Pending · N] [Declined · N] [Maybe · N]  │
//   │ View   [All] [VIP Family] [Wedding Party] …                      │
//   │ Group  [Katropa · 3] [College Friends · 4]  + New group          │
//   │ Tags   … (only when the couple has custom tags)                  │
//   │ Filters: «q» ✕  Bride ✕  Attending ✕   Clear all                 │
//   └──────────────────────────────────────────────────────────────────┘
//
// The live counts now sit ON the filter pills (per the prototype). Every
// pill is a plain server-rendered <Link> that rewrites the SAME URL params
// the old rail/strip used (q · rsvp · view · group · team · tag · sort ·
// gview), so filtering behaviour + results are byte-for-byte unchanged —
// this is presentation only. Group management (create / rename / delete)
// keeps its full behaviour via the same GroupsSidebar client component,
// now laid out inline (`layout="inline"`).
const SUMMARY_FILTER_KEYS = [
  'q',
  'rsvp',
  'view',
  'group',
  'team',
  'tag',
  'sort',
  'gview',
] as const;

function SummaryFacetBar({
  stats,
  eventId,
  search,
  q,
  sort,
  sortOptions,
  gview,
  paxProgress,
  rsvpActive,
  teamActive,
  teamCounts,
  view,
  views,
  groups,
  currentGroupId,
  tagFilter,
  tags,
}: {
  stats: GuestStats;
  eventId: string;
  search: Record<string, string | undefined>;
  q: string;
  sort: SortKey;
  sortOptions: readonly { value: string; label: string }[];
  gview: 'list' | 'map';
  paxProgress: PaxProgress | null;
  rsvpActive: RsvpStatus | '';
  teamActive: 'all' | 'bride' | 'groom';
  teamCounts: { all: number; bride: number; groom: number };
  view: string;
  views: { key: string; label: string }[];
  groups: GuestGroupWithCount[];
  currentGroupId: string | null;
  tagFilter: string;
  tags: string[];
}) {
  // One href builder for every pill: seed from the current filter params,
  // then override the single dimension this pill owns (null = drop it). This
  // is the SAME "preserve everything, toggle one" contract the old
  // SummaryStrip + FacetsSidebar each implemented — unified so every facet
  // stacks cleanly.
  const buildHref = (overrides: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const k of SUMMARY_FILTER_KEYS) {
      const v = search[k];
      if (v) p.set(k, v);
    }
    // Normalize the legacy `?view=group:<id>` encoding (pre-2026-06-13 bookmarks)
    // to the clean `group` param before applying overrides. Seeding view/group
    // from the server-NORMALIZED props (not raw search) is what keeps a View-pill
    // click — which overrides `view` — from silently dropping the group filter;
    // this mirrors the old FacetsSidebar baseQuery.
    if (view && view !== 'all') p.set('view', view);
    else p.delete('view');
    if (currentGroupId) p.set('group', currentGroupId);
    else p.delete('group');
    for (const [k, val] of Object.entries(overrides)) {
      if (val === null) p.delete(k);
      else p.set(k, val);
    }
    const qs = p.toString();
    return `/dashboard/${eventId}/guests${qs ? `?${qs}` : ''}`;
  };

  const responded = stats.total - stats.pending;
  const pct = stats.total > 0 ? Math.round((responded / stats.total) * 100) : 0;
  const seg = (n: number) => (stats.total > 0 ? (n / stats.total) * 100 : 0);

  // Side facet — same `team` param + "both counts to both sides" rule as the
  // old rail (Everyone clears; Bride / Groom set). Dot cue matches the roster.
  const sideOptions: {
    key: 'all' | 'bride' | 'groom';
    label: string;
    count: number;
    dot?: string;
  }[] = [
    { key: 'all', label: 'Everyone', count: teamCounts.all },
    { key: 'bride', label: 'Bride', count: teamCounts.bride, dot: SIDE_DOT.bride },
    { key: 'groom', label: 'Groom', count: teamCounts.groom, dot: SIDE_DOT.groom },
  ];

  // RSVP facet — toggle pills (tap an active one to clear), preserved from the
  // old SummaryStrip. The four states carry the live counts.
  const rsvpOptions: { key: RsvpStatus; label: string; count: number }[] = [
    { key: 'attending', label: 'Attending', count: stats.attending },
    { key: 'pending', label: 'Pending', count: stats.pending },
    { key: 'declined', label: 'Declined', count: stats.declined },
    { key: 'maybe', label: 'Maybe', count: stats.maybe },
  ];

  return (
    <div
      className="gl-settle rounded-tile border"
      style={{
        background: 'var(--sn-glass-bg)',
        borderColor: 'var(--sn-glass-line)',
        backdropFilter: 'var(--sn-glass-blur)',
        WebkitBackdropFilter: 'var(--sn-glass-blur)',
        boxShadow: 'var(--sn-sh-tile)',
      }}
    >
      {/* Root has NO overflow-hidden: the inline group pills' rename/delete kebab
          opens downward and would otherwise be clipped past the bar's bottom edge.
          Glass panel (§1.2 .sn-tile recipe, inline so the sectioned px-4/py-3
          layout keeps its own padding). ONE blurred panel — within the §1.6 budget.
          Meters — the pax target + confirmations progress that headlined the old
          stat strip, kept verbatim (data-display only). */}
      <div className="border-b border-ink/[0.07] px-4 py-3">
        {paxProgress ? (
          <div className="mb-2.5">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-mono uppercase tracking-[0.15em] text-terracotta">
                {paxProgress.exceeded ? 'Now planning for' : 'Guest target'}
              </span>
              <span className="font-mono tabular-nums text-ink/70">
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
              className="sn-bar mt-1 h-2 overflow-hidden rounded-full bg-ink/10"
            >
              <i
                className={paxProgress.exceeded ? 'bg-terracotta-700' : 'bg-terracotta'}
                style={{ width: `${paxProgress.exceeded ? 100 : paxProgress.progressPct}%` }}
              />
            </div>
            {/* Unassigned-pax pool (S1) — fills as guests are LISTED, distinct
                from the sure-attending meter above. */}
            <div className="mt-1.5 flex items-baseline justify-between text-[11px] text-ink/55">
              <span className="font-mono uppercase tracking-[0.12em]">Pax pool</span>
              <span className="font-mono tabular-nums">
                {paxProgress.overListed > 0
                  ? `${paxProgress.listed} listed · ${paxProgress.overListed} over target`
                  : `${paxProgress.unassigned} unassigned · ${paxProgress.listed} of ${paxProgress.target} listed`}
              </span>
            </div>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between text-xs text-ink/55">
          <span className="font-mono uppercase tracking-[0.15em]">Confirmations</span>
          <span className="font-mono tabular-nums">
            {responded} of {stats.total} responded · {pct}%
            {stats.plus_ones > 0 ? ` · ${stats.plus_ones} plus-ones` : ''}
          </span>
        </div>
        <div
          role="img"
          aria-label={`${responded} of ${stats.total} guests have responded (${stats.attending} attending, ${stats.maybe} maybe, ${stats.declined} declined, ${stats.pending} pending)`}
          className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-ink/10"
        >
          <div className="h-full bg-success-400" style={{ width: `${seg(stats.attending)}%` }} />
          <div className="h-full bg-warn-300" style={{ width: `${seg(stats.maybe)}%` }} />
          <div className="h-full bg-danger-300" style={{ width: `${seg(stats.declined)}%` }} />
        </div>
      </div>

      {/* Query row — the always-visible search + instant Sort + List/Mind-map
          switch (search consolidation 2026-07-13, absorbed from the retired
          Toolbar so search is never behind a toggle). Search + Sort are
          Suspense-wrapped client islands (they read useSearchParams); the facet
          bar itself stays a Server Component. */}
      <div className="flex items-center gap-2 border-b border-ink/[0.07] px-4 py-3">
        <Suspense fallback={null}>
          <GuestsSearch initialValue={q} />
        </Suspense>
        <div className="flex shrink-0 items-center gap-2">
          <Suspense fallback={null}>
            <SortSelect value={sort} options={sortOptions} />
          </Suspense>
          <GuestsViewSwitcher eventId={eventId} active={gview} search={search} />
        </div>
      </div>

      {/* Facet lens rows — the counts ride the filter pills. */}
      <div className="flex flex-col gap-2.5 px-4 py-3">
        <FacetRow label="Side">
          {sideOptions.map((s) => (
            <LensPill
              key={s.key}
              href={buildHref({ team: s.key === 'all' ? null : s.key })}
              active={teamActive === s.key}
              count={s.count}
              dot={s.dot}
            >
              {s.label}
            </LensPill>
          ))}
        </FacetRow>

        <FacetRow label="RSVP">
          {rsvpOptions.map((r) => {
            const isActive = rsvpActive === r.key;
            return (
              <LensPill
                key={r.key}
                href={buildHref({ rsvp: isActive ? null : r.key })}
                active={isActive}
                count={r.count}
                title={isActive ? `Clear ${r.label} filter` : `Show only ${r.label}`}
              >
                {r.label}
              </LensPill>
            );
          })}
        </FacetRow>

        <FacetRow label="View">
          {views.map((v) => (
            <LensPill
              key={v.key}
              href={buildHref({ view: v.key === 'all' ? null : v.key })}
              active={view === v.key}
            >
              {v.label}
            </LensPill>
          ))}
        </FacetRow>

        <FacetRow label="Group">
          <GroupsSidebar
            eventId={eventId}
            groups={groups}
            currentGroupId={currentGroupId}
            layout="inline"
            hrefByGroupId={Object.fromEntries(
              groups.map((g) => [g.group_id, buildHref({ group: g.group_id })]),
            )}
          />
        </FacetRow>

        {tags.length > 0 ? (
          <FacetRow label="Tags">
            {tags.map((t) => {
              const isActive = tagFilter === t;
              return (
                <LensPill
                  key={t}
                  href={buildHref({ tag: isActive ? null : t })}
                  active={isActive}
                >
                  {t}
                </LensPill>
              );
            })}
          </FacetRow>
        ) : null}

        {/* Active-filter breadcrumb — the always-visible "what am I looking
            at" chip row, now the foot of the bar (renders null when clean). */}
        <ActiveFilters eventId={eventId} search={search} groups={groups} />
      </div>
    </div>
  );
}

// A labelled row of facet pills: a mono uppercase lens label + its pills,
// wrapping together.
function FacetRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
        {label}
      </span>
      {children}
    </div>
  );
}

// One facet pill (a filter <Link>). Idle = hairline outline; active = the
// champagne-gold wash (terracotta token). An optional side-dot + count ride
// inside, per the prototype's lens pills.
function LensPill({
  href,
  active,
  children,
  count,
  dot,
  title,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  count?: number;
  dot?: string;
  title?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-[background-color,transform,color] ${
        active
          ? 'sn-chip-pop border-transparent bg-terracotta font-bold text-cream'
          : 'border-white/60 bg-white/55 text-ink/70 hover:bg-white/85'
      }`}
    >
      {dot ? <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} /> : null}
      <span className="whitespace-nowrap">{children}</span>
      {typeof count === 'number' ? (
        <span
          className={`font-mono tabular-nums ${active ? 'text-cream/75' : 'text-ink/40'}`}
        >
          {count}
        </span>
      ) : null}
    </Link>
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
      {/* Lead with the one-tap quick-add sheet (name + side, done) — the heavy
          detailed form stays one click away for power users. Inviting is THE
          zero-state action, so the Invite doorway (2026-07-15) sits right here
          beside adding names — share one link and let guests self-add. */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <OpenQuickAddButton label="+ Add your first guest" />
        <Link
          href={`/dashboard/${eventId}/guests/invite`}
          className="button-secondary inline-flex items-center gap-2"
        >
          <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Invite guests
        </Link>
        <Link
          href={`/dashboard/${eventId}/guests/new`}
          className="text-xs text-ink/55 underline underline-offset-2 hover:text-ink"
        >
          or use the full form
        </Link>
      </div>
    </div>
  );
}


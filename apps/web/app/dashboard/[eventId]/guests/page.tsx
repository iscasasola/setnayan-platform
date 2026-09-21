import { Suspense } from 'react';
import { eventNoun } from '@/lib/event-noun';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Link2, ArrowRight, Send, LayoutGrid, ListOrdered } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchEventViewer, isDelegateWithoutArea } from '@/lib/event-viewer.server';
import { NotSharedWithYou } from '../_components/not-shared-with-you';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveProfileByEvent, resolveRoleSetKeyForEvent } from '@/lib/event-type-profile';
import { getCurrentUser } from '@/lib/auth';
import { publicEventPath, resolveEventOwnerSlug } from '@/lib/public-event-url';
import { sharedJoinLinkState } from '@/lib/shared-join-link';
import {
  computeGuestStats,
  computePaxProgress,
  fetchGroupMembershipsByEvent,
  fetchGuestGroupsByEvent,
  fetchGuestsByEventMeasured,
  guestDisplayName,
  GROUP_CATEGORY_LABELS,
  ROLE_LABELS,
  RSVP_LABELS,
  SIDE_LABELS,
  SIDE_ORDER,
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
  honoreeRank,
  roleGroupOf,
  ROLE_GROUP_LABELS,
  roleImportanceRank,
} from '@/lib/role-groups';
import {
  compareByKeys,
  groupingFromParams,
  orderingKeysOf,
  type ArrangeCtx,
  type ArrangeKey,
} from '@/lib/roster-arrangement';
import { resolveRoleSet } from '@/lib/role-sets';
import { ENTOURAGE_ROLES } from '@/lib/entourage';
import { sanitizeRolePalette, type RolePalette } from '@/lib/mood-board';
import { SIDE_DOT } from '@/lib/side-colors';
import { fetchAssignments, fetchFloorPlan, fetchTables } from '@/lib/seating';
import { suggestTableFor } from '@/lib/seat-suggest';
import { ensureFinalized } from '@/lib/pax';
import { getMenuLifecyclePhase } from '@/lib/day-of-mode';
import { eventSkuActive } from '@/lib/entitlements';
import { logQueryError } from '@/lib/supabase/error-detect';
import { guestPhotoDisplayUrls } from '@/lib/uploads';
import { accountPhotoRefsByGuest } from '@/lib/guest-account-photos';
import {
  GuestListMultiselect,
  ROLE_SECTION_ORDER,
} from './_components/guest-list-multiselect';
import { CaptureBar } from './_components/capture-bar';
import { FilterPopover } from './_components/filter-popover';
import { FindAddRow } from './_components/find-add-row';
import { RosterMeters } from './_components/roster-meters';
import { RosterTabs } from './_components/roster-tabs';
import { InvitePanel } from './invite/_components/invite-panel';
import {
  AddFromPeopleSheet,
  OpenAddFromPeopleButton,
} from './_components/add-from-people-sheet';
import { GroupsSidebar } from './_components/groups-sidebar';
import { GuestsSearch } from './_components/guests-search';
import { EntourageOrderPanel } from './_components/entourage-order-panel';
import { MobileGuestCarousel } from './_components/mobile-guest-carousel';
import {
  OpenQuickAddButton,
  QuickAddSheet,
} from './_components/quick-add-sheet';
import { GuestsViewSwitcher } from './_components/view-switcher';
import { GuestMindMap } from './_components/guest-mind-map';
import { ActiveFilters } from './_components/active-filters';
import { LensPill } from './_components/lens-pill';
import { UndoToastHost } from './_components/undo-toast';
import { GuestDrawerHost } from './_components/guest-drawer';
import { GuestDetailBody } from './_components/guest-detail-body';
import { PageMasthead } from '@/app/_components/page-masthead';
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
  // Added 2026-09-20 with the header controls: every column a host can GROUP
  // by should also be one they can ORDER by, or the Seat header is the only
  // one whose label does nothing when clicked.
  { value: 'seat', label: 'Seat' },
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
  // Split 2026-09-14, same as the roster sections and the bulk picker — a VIEW
  // lens that still said "Wedding Party" would filter to a group the list no
  // longer draws.
  { key: 'groomsmen', label: ROLE_GROUP_LABELS.groomsmen },
  { key: 'bridesmaids', label: ROLE_GROUP_LABELS.bridesmaids },
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

  // 🔑 A LENS THE EVENT HAS NO ROLES FOR IS NOT A LENS. Owner 2026-09-14:
  // "this guestlist works for weddings. but does not apply to other events."
  // This function only ever asked Muslim-or-Catholic, so a BIRTHDAY — whose
  // role set offers guest/host/vip/family/helper and nothing else — was still
  // shown "Groomsmen", "Principal Sponsors" and "Bearers & Flower Girl". Every
  // one of them filters to an empty roster, because no birthday guest can hold
  // those roles.
  //
  // DERIVED, NOT HAND-LISTED: a lens survives only if this event's role set
  // actually offers at least one role in its group. That answer comes from
  // `resolveRoleSet(...).offeredRoles`, so a future event type gets the right
  // lenses the day it is added — and a hand-kept "wedding-only" list, which is
  // what produced this, cannot drift again.
  const offered = resolveRoleSet(roleSetKey).offeredRoles;
  const groupsWithRoles = new Set(offered.map((r) => roleGroupOf(r)));

  return ALL_VIEW_FILTERS.filter((f) => {
    // 'all' is not a role group; it is always meaningful.
    if (f.key === 'all') return true;
    if (f.key === 'muslim_principals') return isMuslim;
    if (CATHOLIC_ONLY_VIEW_FILTERS.has(f.key) && isMuslim) return false;
    return groupsWithRoles.has(f.key as ReturnType<typeof roleGroupOf>);
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
    /** `saved` | `error` — the look picker's result, on the Share the link tab. */
    theme?: string;
    team?: string;
    tag?: string;
    sort?: string;
    /** Ordered grouping keys, e.g. `side,role`. ABSENT and EMPTY differ — see
     *  groupingFromParams. */
    by?: string;
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
  bulk_hosted?: string;
  bulk_unhosted?: string;
    bulk_deleted?: string;
    // pair-actions.ts. These arrived with the pairing feature and were not
    // registered here, so a finished pair produced no confirmation AND left
    // the floating SelectionBar holding two guests it had already acted on.
    paired?: string;
    unpaired?: string;
    // entourage-order-actions.ts — a per-ROW control, so these get a flash but
    // deliberately do NOT feed `recentlyApplied`: reordering one name must not
    // discard a multi-select the host is still assembling.
    reordered?: string;
    order_cleared?: string;
    group_created?: string;
    group_saved?: string;
    group_deleted?: string;
    group_member_removed?: string;
  }>;
};


/**
 * Turn an `?error=` value into something a host can act on.
 *
 * This banner used to render `decodeURIComponent(search.error)` directly, so a
 * server action that redirected with a CODE put the CODE on screen — a host
 * assigning "Bride's Parents" in the bulk bar was shown the literal word
 * `invalid_role` (reported 2026-09-14). Meanwhile some actions redirect with
 * ready-made prose (the one-Bride-per-event message), which must pass through
 * untouched.
 *
 * So: known codes map to a sentence; anything else falls through as-is when it
 * reads like prose, and degrades to a neutral line when it reads like an
 * unmapped code. A raw snake_case token must never reach a couple's screen.
 */
function guestListErrorCopy(raw: string): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      // A malformed %-sequence throws; the raw value is still better than a crash.
      return raw;
    }
  })();

  const COPY: Record<string, string> = {
    invalid_role: "That role isn't available for this celebration — pick one from the list.",
    invalid_side: 'Pick Bride, Groom, or Both.',
    no_selection: 'Select at least one guest first.',
    missing_name: 'Please enter both a first and last name.',
    missing_side: 'Pick a side first.',
    missing_group: 'Pick a group first.',
    not_found: "We couldn't find that guest — it may have been removed.",
    forbidden: "You don't have access to change that.",
  };
  if (COPY[decoded]) return COPY[decoded] as string;

  // Prose (has a space) is a message an action wrote for the host — show it.
  // A bare token is an unmapped code and is never shown as-is.
  return decoded.includes(' ')
    ? decoded
    : "That didn't go through — please try again.";
}

export default async function GuestsPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  // Per-event-type role set for the quick-add picker (iteration 0053 P2),
  // ceremony-aware so muslim weddings offer the Nikah roles (resolveRoleSetKeyForEvent
  // returns 'wedding_muslim' for them) and Catholic weddings keep 'wedding'.
  const guestRoleSetKey = await resolveRoleSetKeyForEvent(eventId);
  // The mind map's root reads "Your wedding" when no bride+groom are on the
  // list — which is EVERY debut or birthday. Same cached profile read as above.
  const eventWord = eventNoun((await resolveProfileByEvent(eventId)).eventType);
  // Ceremony-aware View-sidebar filters: muslim weddings get the Nikah-principals
  // filter and not the Catholic sponsor/bearer ones, and vice-versa.
  const viewFilters = viewFiltersFor(guestRoleSetKey);

  /*
    ⚖ DOES THIS CELEBRATION EVEN HAVE A PROCESSIONAL? A generic event's roles
    are guest · host · vip · family · helper — not one of them walks down an
    aisle. Offering "Wedding March" on a birthday guest list would be wrong
    twice over: wrong word, and a view with nothing in it.

    🔑 DERIVED, NOT A LIST OF EVENT TYPES. Asking whether this event's own role
    set offers any role the invitation prints means a new event type answers
    correctly the day it is added, and a wedding that loses a role still says
    yes. A hard-coded `=== 'wedding'` would be right until the next profile.
  */
  const hasProcessional = resolveRoleSet(guestRoleSetKey).offeredRoles.some((r) =>
    (ENTOURAGE_ROLES as readonly string[]).includes(r),
  );
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // A delegate the host never shared the guest list with reads ZERO guest rows
  // — an RLS refusal and an empty event are the same value — so without this
  // the page would tell a coordinator the couple has invited nobody. Say what
  // is true instead. The couple never reach this branch.
  const viewer = await fetchEventViewer(supabase, eventId, user.id);
  if (isDelegateWithoutArea(viewer, 'guest_list')) {
    return <NotSharedWithYou title="Guests" thing="guest list" />;
  }

  // All reads fire in ONE parallel batch — including the share-invite token,
  // which used to run as a 5th *sequential* round-trip after this block (owner
  // perf pass 2026-06-03). Folding it in drops one Singapore RTT off every
  // visit to the Guests tab.
  const [guestsRead, eventRow, groups, membershipsMap, joinUrl, pendingClaims, assignments, tables, arrived, floorPlan, brandedQrActive] =
    await Promise.all([
      fetchGuestsByEventMeasured(supabase, eventId),
      supabase
        .from('events')
        // ⚠ THIS PAGE DID NOT READ THE EVENT'S DATE AT ALL. Owner, the morning
        // after his Movie Night: *"i can still invite"*. It could not have known
        // otherwise — nothing here asked when the celebration was, so every
        // affordance on it addressed a party that had not happened yet.
        .select('role_palette, estimated_pax, event_date, event_end_date, cleared_at, timezone, slug')
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
      // 🚨 THE "N TO SEND" READ USED TO SIT HERE AND IT COULD NEVER FALL.
      // It counted guests with `invitation_sent_at IS NULL` — a column with
      // ZERO writers anywhere: not in this repo, not in a migration, and not in
      // any function in the production schema (checked all three; 0 of 35 live
      // guests are stamped). There is no per-guest send in this product to
      // stamp it: the Invite stage hands out ONE link for everybody. So the pill
      // read "32 to send" and would have read "32 to send" forever, next to
      // three siblings whose numbers move.
      //
      // 🔑 The column was not written because the feature was never built — the
      // save-the-date fan-out has its own `std_email_sent_at`, and its migration
      // says this one is for "the later formal RSVP invitation". Stamping it
      // would have been a lie in the other direction. The step now reports the
      // one thing that stage genuinely has: whether the link can be handed out.
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

  // `measured: false` means the guest read was REFUSED — the rows are unknown,
  // NOT empty. Every count, meter and zero-state below is computed from
  // `guests`, so without this flag each of them states a fact about somebody's
  // wedding that nobody actually measured.
  const guests = guestsRead.rows;
  const guestsMeasured = guestsRead.measured;
  // Self-join reconcile queue — the ids feed the inline blush roster rows; the
  // count still drives the /guests/claims banner + the mobile carousel badge.
  const selfJoinIds = ((pendingClaims.data ?? []) as { guest_id: string }[]).map(
    (r) => r.guest_id,
  );
  const pendingClaimsCount = pendingClaims.count ?? selfJoinIds.length;
  // Seated count now derives from the seat rows we already fetched (P3) rather
  // than a separate head+count round-trip — one fewer Singapore RTT.
  const seatedCount = assignments.length;
  const arrivedCount = arrived.count ?? 0;
  /*
    ─── HAS THIS CELEBRATION ALREADY HAPPENED? ──────────────────────────────

    Owner, 2026-08-21, the morning after his Movie Night: *"nothing changed.
    i can still invite."* He was right, and the reason is one line up in the
    query above: this page never read the event's date, so it could not have
    known. Every affordance on it — the name box, "Invite guests", "+ Add your
    first guest", "Arrange the room" — addressed a party still to come.

    🔒 NOTHING IS DISABLED BY THIS. A host adding the cousin who turned up
    unannounced, or recording who actually came, must still be able to. What
    changes is what the page LEADS with; the add paths recede one line down,
    exactly as the day-of takeover already recedes the planning stack.

    🔑 ONE RESOLVER. The boundary is `getMenuLifecyclePhase` — the same call
    the Overview, the rail and the bottom bar make — passed the venue's own
    clock and the event's LAST day. A second "is it past?" comparison here is
    how the guest list and the dashboard would come to disagree about whether
    the wedding happened.
  */
  const finished =
    getMenuLifecyclePhase(
      (eventRow.data as { event_date?: string | null } | null)?.event_date ?? null,
      (eventRow.data as { cleared_at?: string | null } | null)?.cleared_at ?? null,
      (eventRow.data as { timezone?: string | null } | null)?.timezone ?? undefined,
      undefined,
      (eventRow.data as { event_end_date?: string | null } | null)?.event_end_date ?? null,
    ) === 'after';
  // ⚠ `arrived.count` is null when the read was REFUSED, and `arrivedCount`
  // above collapses that to 0. Fine for a meter; NOT fine for a sentence that
  // tells somebody how many people came to their wedding. This keeps the
  // distinction so the wrap strip can stay silent rather than say "0 came".
  const arrivedMeasured = !arrived.error;
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
  const gview: 'list' | 'map' | 'walk' | 'share' =
    search.gview === 'map'
      ? 'map'
      : search.gview === 'walk'
        ? 'walk'
        : search.gview === 'share'
          ? 'share'
          : 'list';
  const teamRaw = search.team ?? 'all';
  const teamFilter: 'all' | 'bride' | 'groom' =
    teamRaw === 'bride' || teamRaw === 'groom' ? teamRaw : 'all';
  const tagFilter = (search.tag ?? '').trim();
  const sort = (search.sort ?? 'importance') as SortKey;
  // ⚖ Owner 2026-09-20 — grouping is its own question now, and its own param.
  // ⚠ `search.by` is passed THROUGH as possibly-undefined on purpose: absent
  // derives the old sort-driven sectioning (so every bookmarked ?sort=side
  // still renders sections), while an EMPTY `?by=` means "no headings". They
  // are different answers and `?? ''` would have collapsed them into one.
  const grouping = groupingFromParams(search.by, sort);

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
      // NAMED FOR WHAT IT IS. `lib/entourage` exports a `roleLabel` too, built
      // from the entourage's own printed wording; this is the roster's
      // ROLE_LABELS, used only to make a role searchable. Two rules, so two
      // names — a shared identifier would hide that they differ.
      const roleSearchLabel = ROLE_LABELS[g.role];
      const roleEnumNormalized = g.role.replace(/_/g, ' ');
      const groupBlob = groupBlobByGuestId.get(g.guest_id) ?? '';
      const haystack = [
        g.first_name,
        g.last_name,
        g.display_name ?? '',
        g.email ?? '',
        g.mobile ?? '',
        g.custom_tags.join(' '),
        roleSearchLabel,
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
  // The same lookup, needed whenever Groups is one of the ORDERING ticks too.
  const arrangeGroupKey =
    sortGroupKey ??
    (grouping.includes('group') ? buildGroupSortKey(groups, membershipsMap) : undefined);
  // 🪤 THE SORT MOVED DOWN, past `seatByGuest`. Sorting by Seat needs each
  // guest's table, and that lookup is built below over the same `visible` set.
  // Nothing between here and there reads the ORDER of `visible` — only its
  // membership — so moving the sort changes no other output. (Sorting before
  // and passing an undefined map would have made `?sort=seat` silently
  // fall through to last-name, which reads exactly like a working sort.)

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

  /**
   * ⚖ EVERY TICKED COLUMN AFTER THE FIRST ONLY ORDERS (owner 2026-09-20:
   * *"first one only groups[,] the second and succeeding just arranges and
   * does not group"*). They are applied BEFORE the chosen `?sort=`, because a
   * host who ticked Role after Side asked for role order inside a side — if
   * `?sort=` ran first, the ticks would only ever break its ties and would
   * look inert on any list where two guests differ by name.
   *
   * 🔑 The honoree pin still runs ahead of all of it, inside sortCompare.
   */
  const orderingKeys = orderingKeysOf(grouping);
  const arrangeCtx: ArrangeCtx<GuestRow> = {
    lastName: (g) => g.last_name,
    sideLabel: (g) => SIDE_LABELS[g.side],
    roleGroupLabel: (g) => {
      const grp = roleGroupOf(g.role);
      return grp === 'guest' ? 'Guests' : ROLE_GROUP_LABELS[grp];
    },
    groupLabel: (g) => arrangeGroupKey?.get(g.guest_id) ?? null,
    rsvpLabel: (g) => RSVP_LABELS[g.rsvp_status],
    seatLabel: (g) => {
      const seat = seatByGuest[g.guest_id];
      if (seat?.placed) return `Table ${seat.placed}`;
      if (seat?.suggested) return `Suggested ${seat.suggested}`;
      return null;
    },
    seatRank: (g) => seatSortRank(g, seatByGuest),
  };
  visible.sort(
    (a, b) =>
      honoreeRank(a.role) - honoreeRank(b.role) ||
      compareByKeys(orderingKeys, a, b, arrangeCtx, knownArrangeOrder) ||
      sortCompare(a, b, sort, sortGroupKey, seatByGuest),
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
  // ⚠ RESOLVED BEFORE THE INSPECTOR, not after: the inspector body reads
  // this map, and it used to be declared below it.
  // Resolve each guest's stored photo ref → a display URL once on the server:
  // a 24h presigned GET for r2:// refs, or the raw Google avatar URL passed
  // through verbatim (oauth_google). Keyed by the stored value so the client
  // grid looks each card up — the same `initialDisplayUrls` contract
  // <FileUpload> uses. Resolved over the FULL guest list (not `visible`) so
  // re-filtering/sorting never re-signs; signing runs in parallel per the
  // displayUrlForStoredAsset doc guidance.
  // The base every guest's own invitation link (and NFC tag) is built from.
  const invitationBase = await fetchInvitationBase(
    eventId,
    (eventRow.data as { slug?: string | null } | null)?.slug ?? null,
  );

  const photoDisplayUrls = await guestPhotoDisplayUrls(guests);

  /* ⚖ Owner 2026-09-20: "so when users create their accounts, when they have a
     profile photo, it will show here too". A guest whose row is linked to an
     account falls back to that account's photo — the couple's own upload still
     wins. Resolved through the SAME resolver, because the stored value is an
     `r2://` ref, not a URL. */
  const accountRefByGuest = await accountPhotoRefsByGuest(supabase, eventId);
  const accountRefUrls = await guestPhotoDisplayUrls(
    Object.values(accountRefByGuest).map((ref) => ({ photo_url: ref })),
  );
  const accountFaceByGuest: Record<string, string> = Object.fromEntries(
    Object.entries(accountRefByGuest)
      .map(([guestId, ref]) => [guestId, accountRefUrls[ref]] as const)
      .filter((e): e is [string, string] => Boolean(e[1])),
  );

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
        invitationBase={invitationBase}
        guest={inspectedGuest}
        groupLabels={inspectedGroupLabels}
        eventId={eventId}
        brandedQrActive={brandedQrActive}
        showFullDetailsLink={false}
        photoDisplayUrl={
          photoDisplayUrls[inspectedGuest.photo_url ?? ''] ??
          accountFaceByGuest[inspectedGuest.guest_id] ??
          null
        }
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
    /* 🔴 THE SHELL'S TOP NAV COMES BACK ON GUESTS (owner 2026-08-21, two
       screenshots: *"the top nav disappeared also … we still want to have the
       same top nav of the shell"*).

       This page injected `.shell-topbar{display:none}` under a 2026-06-01
       directive — written when that class was `SidebarShell`'s own event-tree
       chrome, so hiding it cost the page a duplicated event header and nothing
       else. The one-shell move (2026-08-14/15) handed the SAME class the
       product's ONLY top bar: identity, the ⌘K palette, the bell and the
       account switcher — the surface's only route to sign-out and profile.
       From that day the rule stopped meaning "no event chrome on Guests" and
       started meaning "no way out of Guests", at EVERY width, because the
       injected rule carries no media query. A directive is scoped to the thing
       it was written about; this one outlived it.

       The `-mt-6` and the safe-area top padding existed only to fill the hole
       the hidden bar left, so they go with it — leaving them would push the
       page up UNDER the bar that is now there.

       ⚠ Vendors keeps its own `.shell-topbar` hide. That one is a full-screen
       takeover and it is scoped `@media (max-width:1023px)`; it is not this. */
    <section className="sn-col space-y-6">

      {/* The floating focus-mode "back X" (top-left) was REMOVED 2026-06-15
          (nav-surfaces follow-up to #1470): the global journey bottom nav is now
          ALWAYS present on this surface — the Guests sub-views moved to top-of-
          page `.sn-seg` tabs (MobileGuestCarousel) rather than a second bottom
          bar — so a dedicated "back to home" affordance is vestigial.
          ⚠ THE SENTENCE THAT USED TO FOLLOW HERE OUTLIVED BOTH ITS REFERENTS:
          it said the safe-area top padding was kept "because the top bar is
          still hidden on mobile via the <style> above". The <style> is gone
          (owner 2026-08-21) and so is the padding — the shared bar owns that
          space now. Prose that names a deleted mechanism is how the next reader
          gets it wrong. */}
      {/* Header is DESKTOP-ONLY (owner directive 2026-06-03 — "remove GUEST
          LIST / N guests since we already have Summary below"). On mobile the
          carousel's Summary panel carries the count; the top is just the list. */}
      <PageMasthead
        titleNode={
          guestsMeasured ? (
            <>
              <span className="font-mono">{stats.total}</span>{' '}
              <span className="sn-h1-tail">
                {stats.total === 1 ? 'guest' : 'guests'}
              </span>
            </>
          ) : (
            // A refused read must never render as a headcount of zero.
            <span className="sn-h1-tail">Guests</span>
          )
        }
      />
      {/* ⚖ THE MASTHEAD'S DOORS BECAME ONE ROW — owner 2026-09-20: "these row
          can be 1 row". Every door keeps the exact condition it had here
          (Check-in after · Invite/Arrange/Wedding March before · Share with a
          link); RosterTabs' docblock lists them. The one thing removed is the
          duplicate: before the event "Invite guests" and the Share dropdown
          both handed out the same link, and are one "Share the link" tab now.
          Desktop only, exactly as the actions were (`hidden … lg:flex`) —
          phones keep the carousel's own header. */}
      <div className="hidden lg:block">
        <RosterTabs
          eventId={eventId}
          view={gview}
          finished={finished}
          hasProcessional={hasProcessional}
          hasJoinLink={Boolean(joinUrl)}
          shareMenu={joinUrl ? <ShareDropdown joinUrl={joinUrl} /> : null}
          viewSwitch={<GuestsViewSwitcher eventId={eventId} active={gview} search={search} />}
        />
      </div>

      {/* ─── THE CELEBRATION HAPPENED: LEAD WITH THE RECORD, NOT THE PLAN ───
           One line, because the page header is one line (owner-locked) and this
           is the same idea one level down. It states the fact first, then hands
           over the two things that are still worth doing with a guest list
           afterwards: the arrivals record and the story.

           ⚠ THE ARRIVALS FIGURE IS OMITTED WHEN IT WAS NOT MEASURED, not
           printed as 0. Telling somebody nobody came to their wedding because
           a query was refused is the worst version of this whole page. */}
      {finished ? (
        <div className="flex flex-col gap-2 rounded-xl border border-terracotta/25 bg-terracotta/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink/75">
            <span className="font-semibold text-ink">That&rsquo;s a wrap.</span>{' '}
            {arrivedMeasured && arrivedCount > 0
              ? `${arrivedCount} ${arrivedCount === 1 ? 'person' : 'people'} checked in on the day.`
              : guestsMeasured && stats.total === 0
                ? 'Nobody was added to this one.'
                : 'This is the list as it stood.'}
          </p>
          <span className="flex flex-wrap items-center gap-3">
            <Link
              href={`/dashboard/${eventId}/guests/checkin`}
              className="text-sm font-medium text-mulberry underline underline-offset-2"
            >
              Who came
            </Link>
            <Link
              href={`/dashboard/${eventId}/story`}
              className="text-sm font-medium text-mulberry underline underline-offset-2"
            >
              Write the story
            </Link>
          </span>
        </div>
      ) : null}

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
          {guestListErrorCopy(search.error)}
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
            /* terracotta-700, not terracotta/60: gold at 60% over this row's own
               gold/5 tint measures 1.94:1 — under even the 3:1 non-text bar the
               bill invoked to sanction it. The arrow is the only thing marking
               this "N guests waiting for you" row as somewhere to go. */
            className="h-4 w-4 shrink-0 text-terracotta-700 transition-transform group-hover:translate-x-0.5"
            strokeWidth={1.75}
          />
        </Link>
      ) : null}

      {/* Guest list finalized (Adaptive Pax Pricing Phase 7) — the edit deadline
          passed; the binding count is frozen so late changes no longer move
          vendor costs. Shown on desktop + mobile. */}
      {finalize.locked ? (
        /*
          ⚠ IT SAID "2 GUESTS LOCKED IN" ON A LIST WITH NOBODY ON IT.

          The frozen figure is `max(estimated_pax, headcount)` — for an event
          where nobody was ever added it is simply the head count the couple
          typed at sign-up. Calling that "guests locked in" put a number that
          contradicts the list, in bold, at the top of the list. The owner's own
          screen read "0 guests" and "2 guests locked in" and "0 of 2 pax" at
          once.

          🔑 SAY WHAT THE NUMBER IS FOR. It is the head count suppliers price
          against, and that sentence is true whether the list has nobody on it
          or three hundred — so it is ONE wording, not a conditional that has to
          decide which case it is in.
        */
        <p className="rounded-xl border border-ink/15 bg-ink/[0.03] px-4 py-3 text-sm text-ink/70">
          <span className="font-semibold text-ink">Guest list finalized</span>
          {finalize.finalPax
            ? ` · your suppliers price for ${finalize.finalPax} ${finalize.finalPax === 1 ? 'head' : 'heads'}`
            : ''}
          . Changes after your guest‑list deadline no longer change what your
          suppliers charge, and your guests can no longer reply on your event
          page.
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
        {/* ⚖ THE SHELL — owner 2026-09-20. The CaptureBar no longer heads the
            chrome on its own: it is the ADD half of one shared row (FindAddRow),
            with FIND on the other end, and whichever is not in use folds to an
            icon.
            ⚠ THE NAME BOX IS STILL THE THING THE OWNER POINTED AT after the
            event — it invites you to type a guest into a celebration that is
            over. It stays RECEDED, not removed: somebody who turned up
            unannounced still belongs on the list. It used to recede into a
            <details>; it now recedes behind the row's "+", and never opens on
            its own once the event has passed (`startAdding`). */}
        <SummaryFacetBar
          stats={stats}
          measured={guestsMeasured}
          eventId={eventId}
          search={search}
          q={q}
          paxProgress={paxProgress}
          finished={finished}
          // After the event the add box still exists — someone who turned up
          // unannounced belongs on the list — but it never opens on its own;
          // it waits behind the "+" (receded, not removed).
          addBar={
            <CaptureBar
              eventId={eventId}
              defaultSide={teamFilter === 'all' ? 'both' : teamFilter}
            />
          }
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
        /* ⚠ THE OFFSET CLEARS THE SHARED TOP BAR, WHICH THIS PAGE USED TO
            HIDE. It was `env(safe-area-inset-top)+0.5rem` — correct only while
            the injected `.shell-topbar{display:none}` meant nothing was above
            it. With the bar restored (owner 2026-08-21) that offset parks this
            strip UNDERNEATH it on a phone. `--fd-bar` is the shell's own
            measured bar height (61px in the app variant), read from the
            ancestor it is declared on, so the two can never drift; the `0px`
            fallback is what any surface outside that shell gets. */
        <div className="sticky top-[calc(var(--fd-bar,0px)+0.5rem)] z-40 -mt-2 flex gap-2 overflow-x-auto rounded-xl border border-ink/15 bg-white/55 px-3 py-2 backdrop-blur-xl lg:hidden">
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
          measured={guestsMeasured}
          total={stats.total}
          attending={stats.attending}
          pending={stats.pending}
          declined={stats.declined}
          paxProgress={paxProgress}
          teamFilter={teamFilter}
          pendingClaims={pendingClaimsCount}
          inviteLinkReady={Boolean(joinUrl)}
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
      {/* ⚖ Owner 2026-09-20: "so how to launch it on the guestlist?" — Walking
          order is its own view, reached from the same segmented control as List
          and Mind map. It is not a banner above the roster: the whole
          processional on top of the guest list would push the list down the
          page on every visit, for a job done a handful of times. */}
      {gview === 'share' ? (
        // ⚖ The Share the link TAB — the invite page's own panel in this page's
        // body, so the header, tabs and meters stay put (owner 2026-09-21:
        // "should not clear the whole page. only the body."). The panel checks
        // for the couple itself; see its note.
        <InvitePanel
          eventId={eventId}
          themeNotice={search.theme === 'saved' ? 'saved' : search.theme === 'error' ? 'error' : null}
          returnTo="guests-share"
        />
      ) : gview === 'walk' ? (
        <EntourageOrderPanel eventId={eventId} view={view} />
      ) : gview === 'map' ? (
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
          eventWord={eventWord}
        />
      ) : (
      /* Roster-as-hero — full-width (Living Roster P0). The left facet rail is
         gone: Side / View / Groups filtering now rides the summary-facet bar
         above, so the list gets the whole width instead of a cramped 240px
         column beside it. `gl-settle-delayed` eases the roster in a beat after
         the bar on first load (frozen under prefers-reduced-motion). */
      <div key={rosterLensKey} className="gl-settle-delayed sn-lens-swap min-w-0 space-y-4">
          {visible.length === 0 ? (
            <EmptyState
              finished={finished}
              hasGuests={stats.total > 0}
              eventId={eventId}
              measured={guestsMeasured}
            />
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
              accountFaceByGuest={accountFaceByGuest}
              grouping={grouping}
              sort={sort}
              roleSetKey={guestRoleSetKey}
              recentlyDeleted={search.bulk_deleted}
              recentlyApplied={Boolean(
                search.bulk_assigned ||
                  search.bulk_grouped ||
                  search.bulk_sided ||
                  search.bulk_hosted ||
                  search.bulk_unhosted ||
                  // Pairing acts on the SELECTED two and finishes the task, so
                  // it retracts the bar exactly like an Apply. `unpaired` is
                  // deliberately absent: it comes from a single row's own
                  // control, not from the selection, so it must not silently
                  // discard a selection the host is still building.
                  search.paired,
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

      {/* The second add doorway (owner 2026-08-21): pick from the people
          Setnayan already knows for you rather than retyping them. Mounted
          beside QuickAddSheet and idle until a trigger fires — it reads its
          candidates ON OPEN, so a guest list nobody opens this on costs
          nothing. Its own header carries the privacy reasoning. */}
      <AddFromPeopleSheet
        eventId={eventId}
        defaultSide={teamFilter === 'all' ? 'both' : teamFilter}
      />

      {/* Living Roster P1 · in-page overlay hosts. UndoToastHost is the single
          bottom snackbar for optimistic deletes; GuestDrawerHost is the right
          slide-in quick-view a roster row opens. Both are portal-rendered
          client islands that sit idle until acted on. */}
      <UndoToastHost />
      <GuestDrawerHost
        invitationBase={invitationBase}
        eventId={eventId}
        brandedQrActive={brandedQrActive}
        photoDisplayUrls={photoDisplayUrls}
        accountFaceByGuest={accountFaceByGuest}
      />
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

// Derived from the one order (lib/guests SIDE_ORDER, owner 2026-09-20), so the
// rows can never run in a different order from the headings above them.
const SIDE_SORT_RANK: Record<GuestSide, number> = Object.fromEntries(
  SIDE_ORDER.map((s, i) => [s, i]),
) as Record<GuestSide, number>;

function lastNameThenFirst(a: GuestRow, b: GuestRow): number {
  return (
    a.last_name.localeCompare(b.last_name) ||
    a.first_name.localeCompare(b.first_name)
  );
}

// The person the celebration is FOR comes first, under every sort — bride then
// groom at a wedding (owner 2026-06-05), the celebrant at everything else
// (owner 2026-09-20). The rule itself lives in lib/role-groups so it can be
// executed by a test rather than read in a server component.
function coupleRank(g: GuestRow): number {
  return honoreeRank(g.role);
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
  seatKey?: Record<string, { placed: string | null; suggested: string | null }>,
): number {
  // The honoree is pinned first under EVERY sort — only when neither row is
  // the honoree does the chosen sort decide order (owner 2026-06-05 "Bride
  // will always be #1 then groom"; owner 2026-09-20 "the first one will always
  // be the celebrant").
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
    case 'seat': {
      // A placed table beats a suggested one, and "no table yet" sorts last —
      // the same three tiers the Seat cell already draws. Table labels are
      // short strings ('3', '12A'), so numeric-aware compare keeps 3 before 12.
      const ra = seatSortRank(a, seatKey);
      const rb = seatSortRank(b, seatKey);
      if (ra[0] !== rb[0]) return ra[0] - rb[0];
      return ra[1].localeCompare(rb[1], undefined, { numeric: true }) || lastNameThenFirst(a, b);
    }
    case 'newest':
      return b.created_at.localeCompare(a.created_at);
    case 'last_name':
    default:
      return lastNameThenFirst(a, b);
  }
}

/** The known order per column — the same one the headings use. */
function knownArrangeOrder(key: ArrangeKey): readonly string[] {
  if (key === 'side') return SIDE_ORDER.map((s) => SIDE_LABELS[s]);
  if (key === 'rsvp')
    return [
      RSVP_LABELS.attending,
      RSVP_LABELS.pending,
      RSVP_LABELS.maybe,
      RSVP_LABELS.declined,
    ];
  if (key === 'role') return ROLE_SECTION_ORDER;
  return [];
}

/** [tier, label] — 0 placed · 1 suggested · 2 none, then the table's own name. */
function seatSortRank(
  g: GuestRow,
  seatKey?: Record<string, { placed: string | null; suggested: string | null }>,
): [number, string] {
  const seat = seatKey?.[g.guest_id];
  if (seat?.placed) return [0, seat.placed];
  if (seat?.suggested) return [1, seat.suggested];
  return [2, ''];
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
  const [{ data, error }, { data: ev, error: evError }] = await Promise.all([
    supabase
      .from('event_join_tokens')
      .select('token, revoked_at, expires_at')
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('events')
      .select('slug, landing_page_visibility, scheduled_launch_at, std_launched_at')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);
  if (evError) {
    logQueryError('GuestListPage.ev', evError, { event_id: eventId }, 'graceful_degrade');
  }
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
  // ⚠ A LINK NOBODY CAN OPEN IS NOT A SHARE AFFORDANCE. On a PRIVATE event both
  // doors refuse — the branded /{slug}/invite page and the opaque /join token
  // action alike — so Share-invite was handing the host a link that answers
  // "Link not found" to every guest. Returning null hides the control, and the
  // guest-invite page (linked right beside it) says why. See
  // lib/shared-join-link.ts.
  if (
    !sharedJoinLinkState({
      event: (ev ?? {}) as Parameters<typeof sharedJoinLinkState>[0]['event'],
      tokenValid:
        !!data?.token &&
        !(data as { revoked_at?: string | null }).revoked_at &&
        (!(data as { expires_at?: string | null }).expires_at ||
          new Date((data as { expires_at: string }).expires_at) > new Date()),
    }).usable
  ) {
    return null;
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

/**
 * The event's public address WITHOUT a guest token — `…/u/<owner>/<slug>` or
 * `…/<slug>`. A guest's own invitation link is this plus `?invite=<token>`,
 * the same string `buildInvitationUrl` produces for their QR, and the string
 * an NFC tag holds. Null before the event has a slug.
 */
async function fetchInvitationBase(eventId: string, slug: string | null): Promise<string | null> {
  if (!slug) return null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const ownerSlug = await resolveEventOwnerSlug(createAdminClient(), eventId);
  return `${appUrl}${publicEventPath(slug, ownerSlug)}`;
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
  bulk_hosted?: string;
  bulk_unhosted?: string;
  bulk_deleted?: string;
  paired?: string;
  unpaired?: string;
  reordered?: string;
  order_cleared?: string;
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
  if (search.bulk_hosted) {
    // The count is what was WRITTEN, not what was selected — the action drops
    // guests who already wore the hat, so this never claims a change that did
    // not happen.
    const n = Number(search.bulk_hosted);
    return `${n} guest${n === 1 ? ' is' : 's are'} part of the host now.`;
  }
  if (search.bulk_unhosted) {
    const n = Number(search.bulk_unhosted);
    return `${n} guest${n === 1 ? ' is' : 's are'} no longer part of the host.`;
  }
  if (search.bulk_deleted) {
    const n = Number(search.bulk_deleted);
    return `Removed ${n} guest${n === 1 ? '' : 's'} · seats opened up.`;
  }
  if (search.paired) return 'Paired — they walk in together.';
  if (search.unpaired) return 'Pair removed.';
  if (search.reordered) return 'Wedding March saved.';
  if (search.order_cleared) return 'Back to alphabetical order.';
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
  measured,
  eventId,
  search,
  q,
  finished,
  addBar,
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
  /** False when the guest read was refused — every figure here is then unknown. */
  measured: boolean;
  eventId: string;
  search: Record<string, string | undefined>;
  q: string;
  /** The event has happened — the add box then never opens on its own. */
  finished: boolean;
  /** The quick-add bar, rendered by the page (it knows the Side lens). */
  addBar: React.ReactNode;
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

  // Group chips for the side the host is standing in (owner 2026-09-14:
  // "when i press team groom, it will only show groups of the groom"). A
  // 'both'-sided group belongs to either lens; the ACTIVE group is always kept
  // so switching side can never hide a chip whose filter is still applied.
  const groupsForSide =
    teamActive === 'all'
      ? groups
      : groups.filter(
          (g) =>
            g.team_side === teamActive ||
            g.team_side === 'both' ||
            g.group_id === currentGroupId,
        );


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

  // ⚖ Owner 2026-09-20 — the prototype shell. Three blocks became one row
  // plus a meter strip: RosterMeters (two meters, one row) · FindAddRow
  // (search ↔ add sharing one row) · the five facet rows folded into a
  // FilterPopover. The rows below are MOVED, NOT REWRITTEN: their links,
  // counts and honesty rules (a count it could not measure is hidden, never a
  // confident zero) are the same text they were.
  const activeFilters =
    (teamActive !== 'all' ? 1 : 0) +
    (rsvpActive ? 1 : 0) +
    (view && view !== 'all' ? 1 : 0) +
    (currentGroupId ? 1 : 0) +
    (tagFilter ? 1 : 0);

  return (
    <div className="gl-settle">
      <RosterMeters paxProgress={paxProgress} stats={stats} measured={measured} />

      <FindAddRow
        // An EMPTY list opens on Add — there is nobody yet to find. Never
        // after the event: the name box there is receded on purpose (the
        // owner pointed at it inviting guests into a celebration that is over).
        startAdding={!finished && measured && stats.total === 0}
        // ⚖ The phrase is the old disclosure's, kept on purpose: after the day
        // the add path RECEDES rather than disappears, because the cousin who
        // turned up unannounced still belongs on the list — and it must say
        // so, not just exist.
        addLabel={finished ? 'Still adding someone? — the list is open' : 'Add a guest'}
        search={
          <Suspense fallback={null}>
            <GuestsSearch initialValue={q} />
          </Suspense>
        }
        filter={
          <FilterPopover activeCount={activeFilters}>
            {/* ⚖ No Sort row — owner 2026-09-21: "remove the filter on search since
                we already have a sort on the table itself", then, asked what
                the popup ALSO held: keep it, drop only its Sort. The table
                header sorts (the label) and groups (the box). Two orders had
                no column to click — First name, Newest first — and left the
                desktop with this row, by that choice. */}

          <FacetRow label="Side">
            {sideOptions.map((s) => (
              <LensPill
                key={s.key}
                href={buildHref({ team: s.key === 'all' ? null : s.key })}
                active={teamActive === s.key}
                // Seven confident zeros beside one small "not loaded" line reads
                // as "we could not measure it, and it is zero" — the hedge loses.
                // LensPill hides the badge entirely when the count is undefined,
                // so the filter still works and only the invented number goes.
                count={measured ? s.count : undefined}
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
                  count={measured ? r.count : undefined}
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

          {/* Owner 2026-09-14: "groups will be filtered depending on what side as
              well. so when i press team groom, it will only show groups of the
              groom". Groups already carry `team_side`, and a roster with a
              "Family" on each side showed BOTH chips under every lens — two
              identical-looking pills the host had to tell apart by a dot.

              'both'-sided groups always show: they belong to whichever side you
              are standing in. And the ACTIVE group always shows even when it does
              not match the lens — otherwise switching side would hide the chip
              while its filter stayed applied, leaving a roster narrowed by
              something invisible. */}
          <FacetRow label="Group">
            <GroupsSidebar
              eventId={eventId}
              groups={groupsForSide}
              currentGroupId={currentGroupId}
              layout="inline"
              hrefByGroupId={Object.fromEntries(
                groupsForSide.map((g) => [g.group_id, buildHref({ group: g.group_id })]),
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
          </FilterPopover>
        }
        add={addBar}
      />

      {/* What is applied stays on screen with the rows folded away — the only
          place an active filter is visible besides the number on the button. */}
      <ActiveFilters eventId={eventId} search={search} groups={groups} />
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

// LensPill MOVED to _components/lens-pill.tsx and is now a CLIENT component.
// It warms its RSC payload on hover/focus so a facet click lands on a cache
// instead of starting a full server navigation — the roster query is 1.2 ms, so
// the wait the owner reported is the round trip, not the database. See that
// file for why hover rather than `prefetch` (every pill is on screen at once,
// so viewport prefetching would fire ~25 renders and slow the first paint).

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

function EmptyState({
  hasGuests,
  eventId,
  measured,
  finished = false,
}: {
  hasGuests: boolean;
  eventId: string;
  /** False when the guest read was refused — see fetchGuestsByEventMeasured. */
  measured: boolean;
  /** The celebration has already happened. "Start by adding the couple's first
   *  invite" is then a sentence about a party that is over — it is the copy the
   *  owner was reading the morning after his Movie Night. The add paths STAY
   *  (a late name still belongs on the list); only the framing changes. */
  finished?: boolean;
}) {
  // THE READ WAS REFUSED. "No guests yet" here is not a neutral default, it is
  // a statement about their wedding built on a query that never came back —
  // and it renders BYTE-IDENTICAL for a couple with 180 names. Three beats,
  // the shape ErrorState uses elsewhere: what broke, what SURVIVED, what to do.
  // Survived leads, because an error that only says what broke reads as loss.
  if (!measured) {
    return (
      <div
        role="status"
        className="rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-6 text-center"
      >
        <p className="text-base font-extrabold tracking-tight text-ink">
          We couldn&rsquo;t load your guest list.
        </p>
        <p className="mt-2 text-sm text-ink/70">
          Nothing has been lost &mdash; everyone you have added is still there.
          We just couldn&rsquo;t reach it this time.
        </p>
        {/* A plain anchor, not a Link: this needs a real round trip to the
            server, which a client-side navigation to the same URL may not do. */}
        <a
          href={`/dashboard/${eventId}/guests`}
          className="button-secondary mt-4 inline-flex items-center"
        >
          Try again
        </a>
      </div>
    );
  }
  if (hasGuests) {
    return (
      /* Unframed (owner 2026-08-21) — a dashed rectangle around one sentence
         reads as a drop zone, which this has never been. */
      <div className="p-6 text-center text-ink/60">
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
    /* Unframed (owner 2026-08-21). The dashed box made the emptiest state on
       the page the most heavily drawn thing on it. The sentence and the two
       doors carry it; the error state above KEEPS its edge, deliberately —
       that one is a refusal and has to stop the eye. */
    <div className="p-8 text-center">
      <p className="text-base text-ink/70">
        {finished
          ? 'No guests were added to this one. You can still add anybody who came.'
          : 'No guests yet. Start by adding the couple’s first invite.'}
      </p>
      {/* Lead with the one-tap quick-add sheet (name + side, done) — the heavy
          detailed form stays one click away for power users. Inviting is THE
          zero-state action, so the Invite doorway (2026-07-15) sits right here
          beside adding names — share one link and let guests self-add. */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <OpenQuickAddButton label={finished ? '+ Add someone who came' : '+ Add your first guest'} />
        {/* THE EMPTY STATE IS EXACTLY WHERE THIS DOOR EARNS ITS PLACE. A first
            guest list is the moment somebody is most likely to be retyping
            people they have already given us — and the sheet says so honestly
            when it has nobody to offer yet. */}
        <OpenAddFromPeopleButton />
        {/* Inviting people to a celebration that already happened is the one
            door that stops making sense. Everything else here stays. */}
        {finished ? null : (
          <Link
            href={`/dashboard/${eventId}/guests/invite`}
            className="button-secondary inline-flex items-center gap-2"
          >
            <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Invite guests
          </Link>
        )}
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


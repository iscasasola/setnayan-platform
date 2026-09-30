import { eventNoun } from '@/lib/event-noun';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Link2, ArrowRight, Send, LayoutGrid, ListOrdered, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchEventViewer, isDelegateWithoutArea } from '@/lib/event-viewer.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveProfileByEvent, resolveRoleSetKeyForEvent } from '@/lib/event-type-profile';
import { getCurrentUser } from '@/lib/auth';
import { publicEventPath, resolveEventOwnerSlug } from '@/lib/public-event-url';
import { sharedJoinLinkState } from '@/lib/shared-join-link';
import {
  computeGuestStats,
  countsTowardEvent,
  computePaxProgress,
  fetchGroupMembershipsByEvent,
  fetchGuestGroupsByEvent,
  fetchGuestsByEventMeasured,
  guestDisplayName,
  GROUP_CATEGORY_LABELS,
  guestRoleLabel,
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
  roleGroupLabel,
  roleGroupOf,
  ROLE_GROUP_LABELS,
  roleImportanceRank,
  type RoleGroup,
} from '@/lib/role-groups';
import { loadRoleNames } from '@/lib/role-names.server';
import type { RoleNames } from '@/lib/role-names';
import { RoleNamesProvider } from './_components/role-names-context';
import {
  compareByKeys,
  groupingFromParams,
  orderingKeysOf,
  type ArrangeCtx,
  type ArrangeKey,
} from '@/lib/roster-arrangement';
import { resolveRoleSet } from '@/lib/role-sets';
import { detailsItemHref } from '@/lib/maker-details-items';
import { sanitizeRolePalette, type RolePalette } from '@/lib/mood-board';
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
import { AddDoors, CaptureBar } from './_components/capture-bar';
import { bringerSeatsFrom } from '@/lib/extra-seats';
import { FindAddRow } from './_components/find-add-row';
import { RosterMeters } from './_components/roster-meters';
import { RosterTabs } from './_components/roster-tabs';
import { InvitePanel } from './invite/_components/invite-panel';
import {
  AddFromPeopleSheet,
  OpenAddFromPeopleButton,
} from './_components/add-from-people-sheet';
import { GroupsSidebar } from './_components/groups-sidebar';
import { RosterFilters, RosterSort } from './_components/roster-controls';
import { eventHasSides } from '@/lib/guest-side-question';
import {
  OpenQuickAddButton,
  QuickAddSheet,
} from './_components/quick-add-sheet';
import { GuestsViewSwitcher } from './_components/view-switcher';
import { GuestMindMap } from './_components/guest-mind-map';
import { UndoToastHost } from './_components/undo-toast';
import { GuestCardBody, GUEST_CARD_ERROR_COPY } from './_components/guest-card-body';
import { GuestInviteCell } from './_components/guest-invite-cell';
import { GuestMoreMenu, GuestTicketThumb } from './_components/guest-ticket-parts';
import { loadInviteSetup } from './_components/invite-message-setup';
import { fetchInvitationBase, loadGuestCard } from './_components/guest-card-data';
import { PageMasthead } from '@/app/_components/page-masthead';
// The Guest list's two other parts are the SHIPPED pages, rendered whole in
// this page's body (owner 2026-09-29) — never a second copy of either.
import {
  InspectorColumn,
  InspectorLayout,
} from '@/app/_components/inspector/inspector-column';
import { formatCount } from '@/lib/format-number';
import { loadGuestAccessMap } from '@/lib/guest-access.server';
import type { GuestAccessState } from '@/lib/guest-access';

import { MiniTour } from '@/app/_components/mini-tour';
import { readHubDraft } from '@/lib/hub-draft-store';
import { loadGuestHelperCard } from '@/lib/guest-helper-card.server';
import { GuestHelperAccess } from './_components/guest-helper-access';
import { whoCanReplyBase, type WhoCanReplyDraft } from '@/lib/who-can-reply';
import { WhoCanReplyAsk } from './_components/who-can-reply-ask';
import { GuestsPhoneMenu } from './_components/guests-phone-menu';

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
    team?: string;
    tag?: string;
    sort?: string;
    /** Ordered grouping keys, e.g. `side,role`. ABSENT and EMPTY differ — see
     *  groupingFromParams. */
    by?: string;
    inspect?: string;
    // The card's own invite flash, now that it opens here rather than on its
    // own route (`error` is already declared below).
    invite?: string;
    new_qr?: string;
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
    bulk_seated?: string;
    bulk_unseatable?: string;
    bulk_deleted?: string;
    // pair-actions.ts. These arrived with the pairing feature and were not
    // registered here, so a finished pair produced no confirmation AND left
    // the floating SelectionBar holding two guests it had already acted on.
    paired?: string;
    unpaired?: string;
    swapped?: string;
    sections?: string;
    // entourage-order-actions.ts — a per-ROW control, so these get a flash but
    // deliberately do NOT feed `recentlyApplied`: reordering one name must not
    // discard a multi-select the host is still assembling.
    reordered?: string;
    order_cleared?: string;
    group_created?: string;
    group_saved?: string;
    group_deleted?: string;
    group_member_removed?: string;
    // The Hosts part's own flash (hosts/actions.ts redirects to /hosts, which
    // lands here with every param carried — see `partHref`).
    invite_sent?: string;
    invite_error?: string;
    invite_revoked?: string;
    grant_updated?: string;
    host_removed?: string;
    token?: string;
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
    🚶 THE WEDDING MARCH LIVES IN THE MAKER NOW (owner 2026-09-29, DECISION_LOG
    "THE GUEST LIST KEEPS PEOPLE…"): Details › Your event › the march, in the
    three parts. An old link to the Guest list's march view lands there; the
    order itself (`guests.entourage_order`, `events.entourage_section_order`)
    is untouched and the invitation prints it exactly as before.
  */
  if (search.gview === 'walk' || search.view === 'march') {
    redirect(detailsItemHref(eventId, 'march'));
  }
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  // The couple's own words for roles (owner 2026-09-30) — graceful: the usual words on a refusal.
  const roleNames = await loadRoleNames(supabase, eventId, 'GuestsPage.roleNames');
  // The View lenses say the couple's word too ("Bride's Crew", not "Bridesmaids").
  const viewFiltersNamed = viewFilters.map((f) =>
    f.key === 'all' ? f : { ...f, label: roleGroupLabel(f.key as RoleGroup, roleNames) },
  );

  /*
    ⚖ THE GUESTS · HOSTS · CHECK-IN PARTS ROW IS GONE (owner 2026-09-30,
    DECISION_LOG "GUEST LIST: ACCESS + CHECK-IN BECOME COLUMNS; HOSTS FOLDS INTO
    THE GUEST LIST" (6) — cut LAST, after Hosts' pieces moved). Access and
    Check-in are columns of this list now. Old links still land somewhere true:
      · `?gview=hosts` → `/hosts`, the one router for it: the Guest list for
        anybody who holds it, a helper's own access view for one who does not;
      · `?gview=checkin` → the door crew's standalone desk, `/guests/checkin`.
  */
  if (search.gview === 'hosts') redirect(`/dashboard/${eventId}/hosts`);
  if (search.gview === 'checkin') redirect(`/dashboard/${eventId}/guests/checkin`);

  // A delegate the host never shared the guest list with reads ZERO guest rows
  // — an RLS refusal and an empty event are the same value — so without this
  // the page would tell a coordinator the couple has invited nobody. They land
  // on their OWN access view instead (`/hosts`, read-only: what they may open,
  // never a 404 and never a list that looks empty). The couple never reach this.
  const viewer = await fetchEventViewer(supabase, eventId, user.id);
  if (isDelegateWithoutArea(viewer, 'guest_list')) {
    redirect(`/dashboard/${eventId}/hosts`);
  }

  // All reads fire in ONE parallel batch — including the share-invite token,
  // which used to run as a 5th *sequential* round-trip after this block (owner
  // perf pass 2026-06-03). Folding it in drops one Singapore RTT off every
  // visit to the Guests tab.
  const [guestsRead, eventRow, groups, membershipsMap, joinUrl, pendingClaims, assignments, tables, arrived, floorPlan] =
    await Promise.all([
      // The roster draws requests as their own rows; computeGuestStats leaves them out of every count.
      fetchGuestsByEventMeasured(supabase, eventId, { includeRequests: true, includePassedAway: true }),
      supabase
        .from('events')
        // ⚠ THIS PAGE DID NOT READ THE EVENT'S DATE AT ALL. Owner, the morning
        // after his Movie Night: *"i can still invite"*. It could not have known
        // otherwise — nothing here asked when the celebration was, so every
        // affordance on it addressed a party that had not happened yet.
        .select('role_palette, estimated_pax, event_date, event_end_date, cleared_at, timezone, slug, rsvp_ask_config')
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
      // The guest drawer's QR used to fold a CUSTOM_QR_GUEST ownership read in
      // here. That product folded into Event Hub Pro (owner 2026-09-27): the
      // drawer's PNG route now draws every guest's code in the event's look, so
      // there is nothing left to gate and no read to make.
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
  const phase = getMenuLifecyclePhase(
    (eventRow.data as { event_date?: string | null } | null)?.event_date ?? null,
    (eventRow.data as { cleared_at?: string | null } | null)?.cleared_at ?? null,
    (eventRow.data as { timezone?: string | null } | null)?.timezone ?? undefined,
    undefined,
    (eventRow.data as { event_end_date?: string | null } | null)?.event_end_date ?? null,
  );
  const finished = phase === 'after';
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

  /*
    🚪 "WHO CAN REPLY?" — THE FIRST VISIT ASKS (owner 2026-09-30, DECISION_LOG
    "THE FIRST VISIT TO THE GUEST LIST ASKS WHICH KIND OF LIST"). Asked only
    while the event has no answer, live or drafted (`lib/who-can-reply.ts`);
    the draft is read only then, so an answered event pays no extra read.
  */
  const liveRsvpAsk = (eventRow.data as { rsvp_ask_config?: unknown } | null)?.rsvp_ask_config ?? null;
  let whoCanReplyDraft: WhoCanReplyDraft = { read: 'ok', drafted: false };
  if (viewer.isCouple && !eventRow.error && whoCanReplyBase({ isHost: true, liveMeasured: true, live: liveRsvpAsk, draft: whoCanReplyDraft })) {
    try {
      const draft = await readHubDraft(supabase, eventId);
      whoCanReplyDraft =
        draft && 'rsvp_ask_config' in draft.events
          ? { read: 'ok', drafted: true, value: draft.events.rsvp_ask_config }
          : { read: 'ok', drafted: false };
    } catch (e) {
      // A refused draft read never asks: the post would overwrite drafted switches.
      logQueryError('GuestsPage.whoCanReplyDraft', e, { event_id: eventId }, 'graceful_degrade');
      whoCanReplyDraft = { read: 'refused' };
    }
  }
  const whoCanReply = whoCanReplyBase({
    isHost: viewer.isCouple,
    liveMeasured: !eventRow.error,
    live: liveRsvpAsk,
    draft: whoCanReplyDraft,
  });

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
  const gview: 'list' | 'map' | 'share' =
    search.gview === 'map' ? 'map' : search.gview === 'share' ? 'share' : 'list';
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
      // + the couple's own word for it (owner 2026-09-30), so "crew" finds the Bride's Crew.
      const roleSearchLabel = `${ROLE_LABELS[g.role]} ${guestRoleLabel(g.role, roleNames)}`;
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
  // The Access column (owner 2026-09-28: co-hosts come from the guest list) —
  // every guest's Access, TRUE by construction, from the live seats ("make it
  // true"). ONE read for the whole list; the column writes through the card's
  // own action. A refused read (null) hands the roster NO states, so no cell is
  // drawn — never a list with every co-host silently reading "None".
  const accessMap = await loadGuestAccessMap(
    eventId,
    guests.map((g) => ({ guest_id: g.guest_id, role: g.role })),
  );
  const accessByGuest: Record<string, GuestAccessState> = Object.fromEntries(accessMap ?? []);
  const seatByGuest: Record<string, { placed: string | null; suggested: string | null }> =
    Object.fromEntries(
      visible.map((g) => {
        const placed = placedByGuest.get(g.guest_id) ?? null;
        // Only compute a suggestion for the state that actually renders it — a
        // seated or declined guest never shows the dashed hint.
        const suggested =
          // A request is not seated or suggested a seat until Keep or Link.
          placed || g.rsvp_status === 'declined' || !countsTowardEvent(g)
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
      // ⚠ A SORT KEY, NOT A HEADING — `ROLE_SECTION_ORDER` ranks by these exact
      // words, so the couple's renames are applied where the heading is DRAWN.
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
  // rail. The body is the SAME card the standalone route renders — one body,
  // every frame — so no presentation of a guest can diverge from another.
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
  // …and, beside it, the event's words for every row's Invite (owner
  // 2026-09-30: the Invite column). ONE read for the whole list — the same one
  // the open card below reuses, so a row and the card can never word it apart.
  const [invitationBase, inviteSetup] = await Promise.all([
    fetchInvitationBase(eventId, (eventRow.data as { slug?: string | null } | null)?.slug ?? null),
    loadInviteSetup(supabase, eventId),
  ]);

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
  /* THE CARD, not a quick view (2026-09-22). `?inspect=<guestId>` now server-
     renders the SAME `GuestCardBody` the standalone route renders — the QR,
     every editable field, and the remove path, in one panel that saves itself.
     Before this, selecting a guest showed a read-only summary whose only way
     into the form was a link called "Open full details", i.e. a page navigation
     to change one RSVP.

     `loadGuestCard` is the one extra round trip a selection costs; it is only
     paid when a guest is actually open. */
  const inspectedCard = inspectedGuest
    ? await loadGuestCard(supabase, eventId, inspectedGuest.guest_id)
    : null;
  // A limited helper's grants, colours and record — the Hosts pieces that moved
  // onto their card (F2). Couple only; one more read, only when a card is open.
  const inspectedHelper =
    inspectedGuest && inspectedCard?.canManageAccess
      ? await loadGuestHelperCard({
          eventId,
          guestId: inspectedGuest.guest_id,
          viewerUserId: user.id,
          displayName: guestDisplayName(inspectedGuest),
        })
      : null;
  // Send invite · Copy message: the event's words + the couple's wording —
  // read once above for the Invite column.
  const inspectedInviteSetup = inspectedGuest ? inviteSetup : null;
  const inspectorBody = inspectedGuest && inspectedCard ? (
    <InspectorColumn
      eyebrow="Guest"
      title={guestDisplayName(inspectedGuest)}
      swapKey={inspectedGuest.guest_id}
      ariaLabel={`${guestDisplayName(inspectedGuest)} details`}
    >
      <GuestCardBody
        eventId={eventId}
        data={inspectedCard}
        invitationBase={invitationBase}
        photoDisplayUrl={
          photoDisplayUrls[inspectedGuest.photo_url ?? ''] ??
          accountFaceByGuest[inspectedGuest.guest_id] ??
          null
        }
        variant="panel"
        inviteSetup={inspectedInviteSetup}
        SendInvite={GuestInviteCell}
        TicketThumb={GuestTicketThumb}
        MoreMenu={GuestMoreMenu}
        helperAccess={
          inspectedHelper ? (
            <GuestHelperAccess
              eventId={eventId}
              guestId={inspectedGuest.guest_id}
              firstName={inspectedGuest.first_name}
              helper={inspectedHelper}
            />
          ) : null
        }
        returnTo={`/dashboard/${eventId}/guests?inspect=${inspectedGuest.guest_id}`}
        errorMessage={
          typeof search.error === 'string'
            ? (GUEST_CARD_ERROR_COPY[search.error] ?? decodeURIComponent(search.error))
            : null
        }
        inviteFlash={
          search.new_qr === '1'
            ? { ok: true, msg: 'Done — a new QR and link. The old ones no longer work. Send them the new one.' }
            : null
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
  // ── The counts line (owner 2026-09-30, the Fable rows): guests · attending ·
  // not coming · no reply · to invite · requests. "To invite" = a living guest
  // (never the couple, never a request) whose invitation is not sent yet and
  // who has not said they can't come.
  const hasSides = eventHasSides(resolveRoleSet(guestRoleSetKey));
  const toInvite = guests.filter(
    (g) =>
      g.role !== 'bride' &&
      g.role !== 'groom' &&
      countsTowardEvent(g) &&
      !g.invitation_sent_at &&
      g.rsvp_status !== 'declined',
  ).length;
  const shownCount = visible.filter((g) => countsTowardEvent(g)).length;
  const countsLine = guestsMeasured ? (
    <RosterCountsLine
      filtered={hasAnyFilter}
      shown={shownCount}
      stats={stats}
      toInvite={toInvite}
      requests={pendingClaimsCount}
    />
  ) : null;
  // The Account column — which guests an account holds. Refused → null, and the
  // column says "—" rather than "Not linked" for everybody.
  // The Check-in column (owner 2026-09-30) — only from the event day, when it
  // is a column at all. Refused → null, and the column says "—".
  const checkinOpen = phase !== 'plan';
  const [linkedGuestIds, checkins] = await Promise.all([
    readLinkedGuestIds(supabase, eventId),
    checkinOpen ? readCheckins(supabase, eventId) : Promise.resolve(null),
  ]);

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
  // Requests are in Requests, not in these counts (countsTowardEvent).
  const counted = guests.filter(countsTowardEvent);
  const teamCounts = {
    all: counted.length,
    bride: counted.filter((g) => g.side === 'bride' || g.side === 'both').length,
    groom: counted.filter((g) => g.side === 'groom' || g.side === 'both').length,
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

  // The roster's one row of doors — drawn in the page on a computer and inside
  // the title's ⋯ on a phone (the same element, placed twice by breakpoint).
  const rosterTabs = (
    <RosterTabs
      eventId={eventId}
      view={gview}
      finished={finished}
      hasJoinLink={Boolean(joinUrl)}
      shareMenu={joinUrl ? <ShareDropdown joinUrl={joinUrl} eventId={eventId} /> : null}
      viewSwitch={<GuestsViewSwitcher eventId={eventId} active={gview} search={search} />}
    />
  );

  // The ⋯ — Show · Sort · the doors · the add doors (guests-phone-menu.tsx).
  // ONE element, placed twice by breakpoint: beside the phone's title (frame 2
  // of the approved simple phone app) and at the end of the computer's row.
  const guestsMenu = (
    <GuestsPhoneMenu
      sort={<RosterSort sorts={SORT_OPTIONS.map((o) => ({ key: o.value, label: o.label }))} current={sort} />}
      doors={rosterTabs}
      addDoors={<AddDoors eventId={eventId} rows />}
    />
  );

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
    <section className="sn-col max-w-none space-y-4 lg:space-y-6" data-roster-full-width="">

      {/* The floating focus-mode "back X" (top-left) was REMOVED 2026-06-15
          (nav-surfaces follow-up to #1470): the global journey bottom nav is now
          ALWAYS present on this surface — the Guests sub-views moved to top-of-
          page tabs (now `RosterTabs`, one row at every width) rather than a second bottom
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
              <span className="font-mono">{formatCount(stats.total)}</span>{' '}
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
      {/* ⚖ PHONE: "Guests" + ⋯ — frame 2 of the approved simple phone app
          (owner 2026-10-01, the newest approved design, which wins for the
          phone head). The <h1> above stays the page's heading; this line is
          what the phone shows. A computer keeps no visible title (owner
          2026-08-21, PageMasthead) and has its ⋯ at the end of its row. */}
      <div className="flex items-center justify-between gap-3 lg:hidden" data-guests-phone-title="">
        <span aria-hidden className="font-display text-2xl text-ink">
          Guests
        </span>
        {guestsMenu}
      </div>
      {/* ⚖ THE MASTHEAD'S DOORS BECAME ONE ROW — owner 2026-09-20: "these row
          can be 1 row". Every door keeps the exact condition it had here
          (Check-in after · Invite/Arrange/Wedding March before · Share with a
          link); RosterTabs' docblock lists them. The one thing removed is the
          duplicate: before the event "Invite guests" and the Share dropdown
          both handed out the same link, and are one "Share the link" tab now.
          ⚠ THIS ROW USED TO BE `hidden lg:block`, AND THAT HID THE WEDDING
          MARCH FROM EVERY PHONE. Owner 2026-09-23: *"the guest list on mobile
          mode is different from the desktop mode. seems like the mobile mode
          was not edited properly."* He was right, and it was worse than
          different: `rosterDoors` is the ONLY thing that emits `?gview=walk`,
          and `mobile-guest-carousel.tsx` emits `gview: null` or reads
          `gview === 'map'` — it never links to the walk view at all. So on a
          phone there was no control that could reach the processional; the
          only way in was to type the URL, which is how he got there.
          🔑 THE MOBILE DESIGN ALREADY EXISTED — IT WAS SWITCHED OFF. RosterTabs
          was built for the phone and its docblock says so: the row is a
          snap carousel measured at 380px, with an 8px edge fade so a cut word
          reads as "more", and "Arrange the room" is an icon on mobile because
          the owner asked for exactly that on 2026-09-20 ("just make this an
          icon on mobile same row as roster wedding march and share the link").
          All of that shipped behind `hidden`. */}
      {/* On a phone this row is drawn inside the title's ⋯ instead — the SAME
          `rosterTabs` element, so no door can exist on one and not the other. */}
      <div className="hidden lg:block" data-roster-doors-row="">{rosterTabs}</div>

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
              ? `${formatCount(arrivedCount)} ${arrivedCount === 1 ? 'person' : 'people'} checked in on the day.`
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

      {/* ── REQUESTS TO JOIN (owner 2026-09-30, the Fable rows, frame D) ────
          Someone who opened the event link and typed their name is a REQUEST,
          not a guest yet — in no count until kept. One strip, right under the
          title, is the only place they interrupt the list; they never sit as
          rows between real guests. No requests → no strip. */}
      {pendingClaimsCount > 0 ? (
        <Link
          href={`/dashboard/${eventId}/guests/claims`}
          data-requests-strip=""
          className="group flex items-center gap-3 rounded-2xl border border-mulberry/25 bg-mulberry/[0.05] px-4 py-3 transition-colors hover:bg-mulberry/[0.09]"
        >
          <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-mulberry px-2 text-sm font-semibold text-cream">
            {formatCount(pendingClaimsCount)}
          </span>
          <span className="min-w-0 flex-1 text-sm text-ink">
            <span className="block font-semibold">
              {formatCount(pendingClaimsCount)} {pendingClaimsCount === 1 ? 'request' : 'requests'} to join
            </span>
            <span className="block text-xs text-ink/60">
              From your event link — keep them, or link them to a name you already have.
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-mulberry">
            Review
            <ArrowRight
              aria-hidden
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              strokeWidth={1.75}
            />
          </span>
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
            ? ` · your suppliers price for ${formatCount(finalize.finalPax)} ${finalize.finalPax === 1 ? 'head' : 'heads'}`
            : ''}
          . Changes after your guest‑list deadline no longer change what your
          suppliers charge, and your guests can no longer reply on your event
          page.
        </p>
      ) : null}

      {/* The roster head — Living Roster reskin (P0 · 2026-07-11). The old
          split-brain of a stat strip (GUEST TARGET / PAX POOL / CONFIRMATIONS)
          up top + a SIDE / VIEW / GROUPS facet rail down the left is folded into
          ONE horizontal summary-facet bar: the live counts now sit ON the filter
          pills themselves (Side / RSVP / View / Group each a labelled row of
          count-bearing pills), with the pax + confirmations meters as the bar's
          header and the active-filter breadcrumb at its foot. The Build ▸ Invite
          ▸ Confirm ▸ Seat ▸ Day-of stage-nav stepper (lifecycle ribbon) is
          RETIRED — its steps live in the left nav + the roster's own affordances.
          Same filter params, same server actions: this is presentation only. */}
      {/* ⚖ ONE HEAD AT EVERY WIDTH — owner 2026-09-30, on a live phone
          screenshot: *"the guestlist is not same and fixed like the desktop"*
          · *"Fix E"*. The phone used to draw its OWN head (a second "Guest
          list" title, a second Share the link, its own search and filters) in
          a phone-only component, beside this one hidden behind `lg:`. Two heads
          is how the phone drifted from the computer every time either changed.
          This bar is now the only head: on a phone its filter dropdowns wrap
          to their own line under Add (`FindAddRow`). */}
      <div className="gl-settle space-y-3" data-roster-head="">
        {/* ⚖ THE SHELL — owner 2026-09-20. The CaptureBar no longer heads the
            chrome on its own: it leads the one row (FindAddRow), with Filter and
            Sort after it. Search is the top bar's (owner 2026-09-30).
            ⚠ THE NAME BOX IS STILL THE THING THE OWNER POINTED AT after the
            event — it invites you to type a guest into a celebration that is
            over. It stays RECEDED, not removed: somebody who turned up
            unannounced still belongs on the list. It used to recede into a
            <details>; it now recedes behind the row's "+", and never opens on
            its own once the event has passed (`folded`). */}
        <SummaryFacetBar
          // ⚖ The ⋯ (frame 2 of the approved simple phone app: setup lives
          // behind ⋯). The page has no visible title — owner-locked 2026-08-21,
          // `PageMasthead` — so the ⋯ rides at the end of the one row instead
          // of costing a row of its own; the first guest stays in the top third.
          more={guestsMenu}
          roleNames={roleNames}
          stats={stats}
          measured={guestsMeasured}
          eventId={eventId}
          search={search}
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
          views={viewFiltersNamed}
          groups={groups}
          currentGroupId={currentGroupId}
          tagFilter={tagFilter}
          tags={allTags}
          hasSides={hasSides}
          sorts={SORT_OPTIONS.map((o) => ({ key: o.value, label: o.label }))}
          sort={sort}
        />
      </div>

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
        <InvitePanel eventId={eventId} />
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
          {countsLine}
          {visible.length === 0 ? (
            <EmptyState
              finished={finished}
              hasGuests={stats.total > 0}
              eventId={eventId}
              measured={guestsMeasured}
              total={stats.total}
              filterSentence={filterSentence({
                rsvp: rsvpFilter,
                team: teamFilter,
                viewLabel: view !== 'all' ? (viewFiltersNamed.find((v) => v.key === view)?.label ?? null) : null,
                groupLabel: currentGroupId ? (groups.find((g) => g.group_id === currentGroupId)?.label ?? null) : null,
                tag: tagFilter,
                q,
              })}
            />
          ) : (
            <GuestListMultiselect
              eventId={eventId}
              listFinalized={finalize.locked}
              guests={visible}
              palette={palette}
              groups={groups}
              groupMemberships={groupMemberships}
              currentGroupId={currentGroupId}
              selfJoinIds={selfJoinIds}
              seatByGuest={seatByGuest}
              accessByGuest={accessByGuest}
              // Only a co-host changes Access — the same `couple` gate the
              // card and `setGuestAccess` use; a helper reads the word.
              canManageAccess={viewer.isCouple}
              // The column slots: Check-in from the event day; no Side on a birthday.
              checkins={checkins}
              checkinOpen={checkinOpen}
              hasSides={hasSides}
              // From the FULL roster, before any filter (frame G, 2026-09-29).
              seatsByBringer={bringerSeatsFrom(guests)}
              // The Account column and the bulk bar's Set table ▾.
              linkedGuestIds={linkedGuestIds}
              tables={tables.map((t) => ({ tableId: t.table_id, label: t.table_label }))}
              // The Invite column (owner 2026-09-30): every guest's own link +
              // the event's words, read once. No base → no link → "—".
              invite={
                invitationBase
                  ? { base: invitationBase, facts: inviteSetup.facts, template: inviteSetup.template }
                  : null
              }
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
                  search.bulk_seated ||
                  // Pairing acts on the SELECTED two and finishes the task, so
                  // it retracts the bar exactly like an Apply. `unpaired` is
                  // deliberately absent: it comes from a single row's own
                  // control, not from the selection, so it must not silently
                  // discard a selection the host is still building.
                  search.paired,
              )}
            />
          )}
          {/* ⚖ Owner 2026-09-21: "make the last guest row scroll up to the
              middle of the screen for safety." Half a screen of room after the
              list, so the last guest can always be brought up clear of
              anything pinned to the bottom — the update bar, the selection
              bar, a phone's own toolbar. `dvh` so a phone's collapsing browser
              bar does not change the answer. Empty list: no room needed. */}
          {visible.length > 0 ? <div aria-hidden className="h-[50dvh]" data-roster-runout /> : null}
      </div>
      )}

      {/* ⚖ PHONE: the add box becomes the round + (frame 2 of the approved
          simple phone app). The same quick-add sheet the computer's form door
          opens; it stands above the bottom bar, below the bulk bar. */}
      <div
        className="fixed right-4 z-30 bottom-[calc(var(--sn-bottomdock-h,calc(env(safe-area-inset-bottom)+64px))+0.75rem)] lg:hidden"
        data-guests-add-fab=""
      >
        <OpenQuickAddButton
          ariaLabel={finished ? 'Still adding someone? — the list is open' : 'Add a guest'}
          label={<Plus className="h-6 w-6" strokeWidth={2} aria-hidden />}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-cream shadow-[0_14px_30px_-12px_rgba(26,26,26,0.6)]"
        />
      </div>
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

      {/* UndoToastHost is the single bottom snackbar for optimistic deletes.
          The quick-view sheet host that used to sit beside it is gone: the
          guest card is server-rendered from `?inspect=` and presented by
          InspectorLayout at every width. */}
      <UndoToastHost />

      {/* How the Invite column works, once, on the first visit (owner
          2026-09-30: "and instructions on how to use it"; 2026-09-25: every
          feature gets a first-visit tour — the shipped MiniTour, never a new
          mechanism). */}
      {/* The first visit's one question comes BEFORE the Invite tour: the tour
          is handed to the pop-up and drawn only once it is closed; once it is
          answered the page re-renders without it and the tour stands alone. */}
      {whoCanReply ? (
        <WhoCanReplyAsk eventId={eventId} base={whoCanReply}>
          <MiniTour tourKey="customer_guest_invite_v1" />
        </WhoCanReplyAsk>
      ) : (
        <MiniTour tourKey="customer_guest_invite_v1" />
      )}
    </section>
  );

  // Master ▸ detail at EVERY width (2026-09-22). At ≥xl the roster reflows to
  // leave room for a full-height card column; below xl the same server-rendered
  // card slides in from the right and leaves the roster peeking on the left.
  // `mobileSheet` is what makes a name open the card on a phone instead of
  // leaving the roster for a route — it is opt-in, so Studio/Vendors/Overview
  // keep their standalone routes.
  return (
    // 🏷 The couple's role words reach every client chip and picker below
    // (owner 2026-09-30 — "Bride's Crew"). `role-names-reach-every-screen.test.ts`.
    <RoleNamesProvider names={roleNames}>
      <InspectorLayout
        paramKey="inspect"
        className="sn-inspector-shell--card"
        mobileSheet
        hasSelection={Boolean(inspectorBody)}
        master={master}
        inspector={inspectorBody}
      />
    </RoleNamesProvider>
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
  bulk_seated?: string;
  bulk_unseatable?: string;
  new_qr?: string;
  inspect?: string;
  bulk_deleted?: string;
  paired?: string;
  unpaired?: string;
  swapped?: string;
  sections?: string;
  reordered?: string;
  order_cleared?: string;
  group_created?: string;
  group_saved?: string;
  group_deleted?: string;
  group_member_removed?: string;
}): string | null {
  if (search.added) {
    const n = Number(search.added);
    if (Number.isFinite(n) && n > 1) return `Added ${formatCount(n)} guests.`;
    return 'Guest added.';
  }
  if (search.saved) return 'Saved.';
  if (search.removed) return 'Guest removed.';
  if (search.imported) {
    const n = Number(search.imported);
    const s = Number(search.skipped ?? 0);
    const d = Number(search.duplicates ?? 0);
    const parts = [`Imported ${formatCount(n)} guest${n === 1 ? '' : 's'}`];
    if (d > 0) parts.push(`skipped ${d} duplicate${d === 1 ? '' : 's'}`);
    if (s > 0) parts.push(`skipped ${s} invalid row${s === 1 ? '' : 's'}`);
    return parts.join(' · ') + '.';
  }
  if (search.bulk_assigned) {
    const n = Number(search.bulk_assigned);
    return `Role assigned to ${formatCount(n)} guest${n === 1 ? '' : 's'}.`;
  }
  if (search.bulk_grouped) {
    const n = Number(search.bulk_grouped);
    return `Added ${formatCount(n)} guest${n === 1 ? '' : 's'} to the group.`;
  }
  // ⋯ › New QR from a row (the card says it on the card itself).
  if (search.new_qr === '1' && !search.inspect) {
    return 'Done — a new QR and link. The old ones no longer work. Send them the new one.';
  }
  if (search.bulk_seated) {
    const n = Number(search.bulk_seated);
    const left = Number(search.bulk_unseatable ?? 0);
    return `Table set for ${formatCount(n)} ${n === 1 ? 'guest' : 'guests'}.${
      left > 0 ? ` ${formatCount(left)} not coming or not placed were left as they were.` : ''
    }`;
  }
  if (search.bulk_sided) {
    const n = Number(search.bulk_sided);
    return `Side updated for ${formatCount(n)} guest${n === 1 ? '' : 's'}.`;
  }
  if (search.bulk_deleted) {
    const n = Number(search.bulk_deleted);
    return `Removed ${formatCount(n)} guest${n === 1 ? '' : 's'} · seats opened up.`;
  }
  if (search.paired) return 'Paired — they walk in together.';
  if (search.unpaired) return 'Pair removed.';
  if (search.swapped) return 'Swapped — they traded places.';
  if (search.sections) return search.sections === 'reset' ? 'Sections back in the usual order.' : 'Section order saved.';
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

function SummaryFacetBar({
  more,
  roleNames,
  stats,
  measured,
  eventId,
  search,
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
  hasSides,
  sorts,
  sort,
}: {
  /** The ⋯ — Show · Sort · the doors · the add doors (guests-phone-menu.tsx). */
  more: React.ReactNode;
  /** A birthday has no sides — no Side dropdown. */
  hasSides: boolean;
  /** Sort ▾'s list and the live sort. */
  sorts: { key: string; label: string }[];
  sort: string;
  /** The couple's own words for roles (owner 2026-09-30). */
  roleNames: RoleNames;
  stats: GuestStats;
  /** False when the guest read was refused — every figure here is then unknown. */
  measured: boolean;
  eventId: string;
  search: Record<string, string | undefined>;
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
  return (
    <div className="gl-settle">
      {/* The meters are the computer's extra (frame 2 of the approved simple
          phone app: ONE counts line on a phone — the page's RosterCountsLine,
          above the rows). They carry figures, no controls. */}
      <div className="hidden lg:block" data-roster-meters="">
        <RosterMeters paxProgress={paxProgress} stats={stats} measured={measured} />
      </div>

      <FindAddRow
        // ⚖ The row is ADD only (owner 2026-09-30 — the top bar searches this
        // event's guests now, `guests-top-search.tsx`). After the event the
        // add box waits behind "+": the owner pointed at it inviting guests
        // into a celebration that is over.
        folded={finished}
        // ⚖ The phrase is the old disclosure's, kept on purpose: after the day
        // the add path RECEDES rather than disappears, because the cousin who
        // turned up unannounced still belongs on the list — and it must say
        // so, not just exist.
        addLabel={finished ? 'Still adding someone? — the list is open' : 'Add a guest'}
        filter={
          /* ⚖ Owner 2026-09-30 (the Fable rows, frame F): the five facet rows
             became FOUR dropdowns — RSVP · Side · Role · Group (tags sit at the
             bottom of Group) — plus Sort ▾, each ONE list. An active one says
             its value in gild; there is no separate chip strip. */
          <div className="flex flex-wrap items-center gap-1.5">
            <RosterFilters
              hasSides={hasSides}
              views={views}
              groups={groups}
              tags={tags}
              maybeCount={stats.maybe}
              manageGroups={
                <GroupsSidebar
                  eventId={eventId}
                  groups={groups}
                  currentGroupId={currentGroupId}
                  layout="inline"
                  hrefByGroupId={{}}
                />
              }
            />
          </div>
        }
        // Sort ▾ sits after the four dropdowns — one control, placed by `FindAddRow`.
        sort={<RosterSort sorts={sorts} current={sort} />}
        more={more}
        add={addBar}
      />

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
function ShareDropdown({ joinUrl, eventId }: { joinUrl: string; eventId: string }) {
  return (
    <details className="group relative">
      <summary className="button-secondary inline-flex cursor-pointer list-none select-none items-center gap-2">
        <Link2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Share the link
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-ink/15 bg-cream p-4 shadow-[0_12px_32px_-12px_rgba(30,34,41,0.4)]">
        <p className="mb-2 text-xs text-ink/60">
          The one link for your whole event. Anyone who opens it can ask to join — you keep
          them, or link them to a name you already have.
        </p>
        <code className="block break-all rounded bg-ink/5 p-3 font-mono text-[11px] leading-relaxed text-ink/80">
          {joinUrl}
        </code>
        {/* Each guest their OWN link and QR, one by one (owner 2026-09-29). */}
        <Link
          href={`/dashboard/${eventId}/guests/send`}
          className="mt-3 flex items-center justify-between gap-2 border-t border-ink/10 pt-3 text-sm font-medium text-ink hover:text-terracotta-700"
        >
          Send invites one by one
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </div>
    </details>
  );
}

/**
 * THE COUNTS LINE (owner 2026-09-30, the Fable rows): guests · attending · not
 * coming · no reply · to invite · requests — the last two in wine, because they
 * are the ones that need you. Requests show only above zero. With a filter on,
 * it leads with "N of M shown". Rendered only when the read was MEASURED — a
 * refused read never prints a count (the caller passes nothing).
 */
function RosterCountsLine({
  filtered,
  shown,
  stats,
  toInvite,
  requests,
}: {
  filtered: boolean;
  shown: number;
  stats: GuestStats;
  toInvite: number;
  requests: number;
}) {
  const parts: { n: number; word: string; wine?: boolean }[] = [
    // No total here (the approved rows and frame 2 of the simple phone app:
    // "96 attending · 35 no reply · 58 to invite") — the page's heading carries it.
    { n: stats.attending, word: 'attending' },
    { n: stats.declined, word: 'not coming' },
    { n: stats.pending, word: 'no reply' },
    { n: toInvite, word: 'to invite', wine: true },
    ...(requests > 0 ? [{ n: requests, word: requests === 1 ? 'request' : 'requests', wine: true }] : []),
  ];
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-ink/60" data-roster-counts="">
      {filtered ? (
        <span className="font-medium text-ink">
          {formatCount(shown)} of {formatCount(stats.total)} shown
        </span>
      ) : null}
      {parts.map((p) => (
        <span key={p.word} className={p.wine ? 'text-mulberry' : undefined}>
          <span className={`font-display text-base ${p.wine ? '' : 'text-ink'}`}>{formatCount(p.n)}</span> {p.word}
        </span>
      ))}
    </p>
  );
}

/**
 * Which guests an account holds (`event_members.guest_id`) — the Account column.
 * Read AS THE CALLER: RLS decides whether they may see this event's members.
 * A refusal returns null, and the column then says "—" for everybody rather than
 * a confident "Not linked" nobody measured.
 */
async function readLinkedGuestIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<string[] | null> {
  const { data, error } = await supabase
    .from('event_members')
    .select('guest_id')
    .eq('event_id', eventId)
    .not('guest_id', 'is', null);
  if (error) {
    logQueryError('GuestsPage.linkedGuestIds', error, { eventId }, 'graceful_degrade');
    return null;
  }
  return [...new Set(((data ?? []) as { guest_id: string | null }[]).map((r) => r.guest_id).filter((id): id is string => Boolean(id)))];
}

/**
 * When each guest arrived (`guest_checkins`) — the Check-in column. Read AS THE
 * CALLER, the same read the check-in desk makes. A refusal returns null, and
 * the column says "—" rather than offering "Check in" to guests already inside.
 */
async function readCheckins(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<Record<string, string> | null> {
  const { data, error } = await supabase
    .from('guest_checkins')
    .select('guest_id, checked_in_at')
    .eq('event_id', eventId);
  if (error) {
    logQueryError('GuestsPage.checkins', error, { eventId }, 'graceful_degrade');
    return null;
  }
  return Object.fromEntries(
    ((data ?? []) as { guest_id: string; checked_in_at: string }[]).map((r) => [r.guest_id, r.checked_in_at]),
  );
}

/**
 * "Nobody matches" — the sentence built from the filters in use, so the empty
 * box explains itself (owner 2026-09-30, frame E). Null when there is nothing
 * to build from; the box then keeps the shipped line.
 */
function filterSentence(f: {
  rsvp: RsvpStatus | '';
  team: 'all' | 'bride' | 'groom';
  viewLabel: string | null;
  groupLabel: string | null;
  tag: string;
  q: string;
}): string | null {
  const who = [
    f.team === 'bride' ? "on the bride's side" : f.team === 'groom' ? "on the groom's side" : null,
    f.viewLabel ? `in ${f.viewLabel}` : null,
    f.groupLabel ? `in ${f.groupLabel}` : null,
    f.tag ? `tagged ${f.tag}` : null,
    f.q ? `matching “${f.q}”` : null,
  ].filter(Boolean);
  const where = who.length > 0 ? ` ${who.join(', ')}` : '';
  if (f.rsvp === 'declined') return `No one${where} has said they're not coming. Good news, really.`;
  if (f.rsvp === 'attending') return `No one${where} has said yes yet.`;
  if (f.rsvp === 'pending') return `Everyone${where} has replied.`;
  if (f.rsvp === 'maybe') return `No one${where} has said maybe.`;
  return who.length > 0 ? `No one${where}.` : null;
}

function EmptyState({
  hasGuests,
  eventId,
  measured,
  finished = false,
  total = 0,
  filterSentence: sentence = null,
}: {
  /** Everyone on the list, for "Show all N". */
  total?: number;
  /** The filters, said as a sentence (`filterSentence`); null → the shipped line. */
  filterSentence?: string | null;
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
      <div className="p-6 text-center" data-roster-nobody-matches="">
        <p className="font-display text-xl text-ink">Nobody matches</p>
        <p className="mt-1 text-sm text-ink/60">{sentence ?? 'No guests match your filters.'}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Link href={`/dashboard/${eventId}/guests`} className="button-secondary">
            Clear filters
          </Link>
          <Link href={`/dashboard/${eventId}/guests`} className="text-sm font-medium text-ink/70 underline underline-offset-4">
            Show all {formatCount(total)}
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
      {finished ? (
        <p className="text-base text-ink/70">No guests were added to this one. You can still add anybody who came.</p>
      ) : (
        <>
          <p className="font-display text-xl text-ink">No guests yet</p>
          <p className="mt-1 text-sm text-ink/65">
            Start with the two of you — then add the people you can&rsquo;t get married without.
          </p>
        </>
      )}
      {/* Lead with the one-tap quick-add sheet (name + side, done) — the heavy
          detailed form stays one click away for power users. Inviting is THE
          zero-state action, so the Invite doorway (2026-07-15) sits right here
          beside adding names — share one link and let guests self-add. */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <OpenQuickAddButton label={finished ? '+ Add someone who came' : '+ Add a guest'} />
        {/* "Paste a list" — the shipped import page, where a pasted list or a
            file of names becomes guests. */}
        <Link href={`/dashboard/${eventId}/guests/import`} className="button-secondary inline-flex items-center gap-2">
          Paste a list
        </Link>
        {/* THE EMPTY STATE IS EXACTLY WHERE THIS DOOR EARNS ITS PLACE — a first
            list is when somebody is likeliest to retype people we already hold. */}
        <OpenAddFromPeopleButton />
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


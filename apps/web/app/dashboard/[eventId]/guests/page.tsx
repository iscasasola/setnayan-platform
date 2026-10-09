import { eventNoun } from '@/lib/event-noun';
import { guestMatchesSearch } from '@/lib/guest-search';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchEventViewer, isDelegateWithoutArea } from '@/lib/event-viewer.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveProfileByEvent, resolveRoleSetKeyForEvent } from '@/lib/event-type-profile';
import { getCurrentUser } from '@/lib/auth';
import { publicEventPath, resolveEventOwnerSlug } from '@/lib/public-event-url';
import { sharedJoinLinkState } from '@/lib/shared-join-link';
import {
  countsTowardEvent,
  fetchGroupMembershipsByEvent,
  fetchGuestGroupsByEvent,
  fetchGuestsByEventMeasured,
  guestDisplayName,
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
import { loadRoleNames } from '@/lib/role-names.server';
import type { RoleNames } from '@/lib/role-names';
import { LastSeenCapture } from '@/app/_components/last-seen/last-seen-capture';
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
import { eventHasSides, SIDELESS_SIDE } from '@/lib/guest-side-question';
import { getMenuLifecyclePhase } from '@/lib/day-of-mode';
import { logQueryError } from '@/lib/supabase/error-detect';
import { guestPhotoDisplayUrls } from '@/lib/uploads';
import { accountPhotoRefsByGuest } from '@/lib/guest-account-photos';
import { accountNamesByGuest } from '@/lib/linked-profile-names';
import { withProfileName } from '@/lib/formal-name';
import { ROLE_SECTION_ORDER } from './_components/role-section-order';
import { GuestsScreen } from './_components/guests-screen';
import { mapRootLabel } from '@/lib/guest-roster-view';
import { InvitePanel } from './invite/_components/invite-panel';
import { AddFromPeopleSheet } from './_components/add-from-people-sheet';
import { QuickAddSheet } from './_components/quick-add-sheet';
import { UndoToastHost } from './_components/undo-toast';
import { GuestCardBody, guestCardEyebrow, guestCardReply } from './_components/guest-card-body';
import { GuestInviteCell } from './_components/guest-invite-cell';
import { GuestMoreMenu, GuestTicketThumb } from './_components/guest-ticket-parts';
import { TEMPLATE_KIT } from './_components/guest-card-template-kit';
import { guestCardErrorCopy } from './_components/guest-card-error-copy';
import { guestListErrorCopy } from './_components/guest-list-error-copy';
import { loadInviteSetup } from './_components/invite-message-setup';
import { fetchInvitationBase, loadGuestCard } from './_components/guest-card-data';
import { isUuid } from '@/lib/is-uuid';
import { PageMasthead } from '@/app/_components/page-masthead';
// The Guest list's two other parts are the SHIPPED pages, rendered whole in
// this page's body (owner 2026-09-29) — never a second copy of either.
import {
  InspectorColumn,
  InspectorLayout,
} from '@/app/_components/inspector/inspector-column';
import { formatCount } from '@/lib/format-number';

import { MiniTour } from '@/app/_components/mini-tour';
import { loadGuestHelperCard } from '@/lib/guest-helper-card.server';
import { GuestHelperAccess } from './_components/guest-helper-access';
import { quickAddTips } from '@/lib/quick-add-tips';
import { tableWords } from '@/lib/table-words';
import { AddGuestSheet, OpenAddGuestTextButton } from './_components/add-guest-sheet';

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
  // bulk role picker's ordering (lib/bulk-role-vocabulary.ts) for
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
    /** `to-invite` — Setup's "Pick who": open Select mode over the guests still to invite. */
    select?: string;
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
    updated?: string;
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



export default async function GuestsPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  // Per-event-type role set for the quick-add picker (iteration 0053 P2),
  // ceremony-aware so muslim weddings offer the Nikah roles (resolveRoleSetKeyForEvent
  // returns 'wedding_muslim' for them) and Catholic weddings keep 'wedding'.
  const guestRoleSetKey = await resolveRoleSetKeyForEvent(eventId);
  // ⚖ Sides are a WEDDING idea (owner 2026-09-30: "why is there groom and
  // bride's side for a simple event"). The event-type profile's role set says
  // whether this event has sides at all (lib/guest-side-question.ts), and when
  // it does not, no side control, column, filter or sort renders anywhere on
  // this page. `guests.side` is still WRITTEN (NOT NULL): SIDELESS_SIDE.
  const hasSides = eventHasSides(resolveRoleSet(guestRoleSetKey));
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

  // ⚡ THE OPEN CARD'S READS START NOW, beside the roster's (owner, live iPhone
  // test 2026-10-02: a guest's card took ~7–8 s to open). `?inspect=` used to
  // wait for the whole roster, its photos and its invite setup before the
  // card's own reads even began. Started here, they ride alongside; the result
  // is only USED below once the id is confirmed to be a guest on this list,
  // so an unknown id still renders the card closed. The no-op `catch` stops an
  // early redirect from leaving an unhandled rejection — the real `await`
  // below still throws.
  const inspectParam = typeof search.inspect === 'string' ? search.inspect : null;
  const inspectedCardP =
    inspectParam && isUuid(inspectParam) ? loadGuestCard(supabase, eventId, inspectParam) : null;
  // A limited helper's grants (the Hosts pieces on their card, F2) chain off
  // the card — couple only — instead of waiting for the whole page first.
  const inspectedHelperP = inspectedCardP?.then((card) =>
    card?.canManageAccess
      ? loadGuestHelperCard({
          eventId,
          guestId: card.guest.guest_id,
          viewerUserId: user.id,
          displayName: guestDisplayName(card.guest),
        })
      : null,
  );
  inspectedCardP?.catch(() => undefined);
  inspectedHelperP?.catch(() => undefined);

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
      // The guest drawer's QR used to fold a CUSTOM_QR_GUEST ownership read in
      // here. That product folded into Event Hub Pro (owner 2026-09-27): the
      // drawer's PNG route now draws every guest's code in the event's look, so
      // there is nothing left to gate and no read to make.
    ]);

  // `measured: false` means the guest read was REFUSED — the rows are unknown,
  // NOT empty. Every count, meter and zero-state below is computed from
  // `guests`, so without this flag each of them states a fact about somebody's
  // wedding that nobody actually measured.
  // 👤 A row linked to an account wears that profile's formal name (owner
  // 2026-09-30) — overlaid HERE, once, so the list, the search and the open card
  // read the same name. lib/linked-profile-names.ts holds the gate.
  const profileNames = await accountNamesByGuest(supabase, eventId);
  const guests = guestsRead.rows.map((g) => withProfileName(g, profileNames));
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
    hasSides && (teamRaw === 'bride' || teamRaw === 'groom') ? teamRaw : 'all';
  const tagFilter = (search.tag ?? '').trim();
  const sortRaw = (search.sort ?? 'importance') as SortKey;
  // No sides → no side sort or side sections (an old ?sort=side / ?by=side link
  // on a birthday lands on the default order instead of "Both sides").
  const sort: SortKey = !hasSides && sortRaw === 'side' ? 'importance' : sortRaw;
  // ⚖ Owner 2026-09-20 — grouping is its own question now, and its own param.
  // ⚠ `search.by` is passed THROUGH as possibly-undefined on purpose: absent
  // derives the old sort-driven sectioning (so every bookmarked ?sort=side
  // still renders sections), while an EMPTY `?by=` means "no headings". They
  // are different answers and `?? ''` would have collapsed them into one.
  const groupingRaw = groupingFromParams(search.by, sort);
  const grouping = hasSides ? groupingRaw : groupingRaw.filter((k) => k !== 'side');

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

  // ── THE SEARCH (owner 2026-10-03: "VIP" and "Bestman" found nobody) ──────
  // ONE matcher, `guestMatchesSearch` (lib/guest-search.ts), answers `?q=` —
  // the same `?q=` the top bar's "Search guests" box writes — so the box and
  // the list can never disagree. What is not on the guest row (their groups,
  // table, song requests) is read once here, only while somebody is searching.
  const groupLabelsByGuestId = new Map<string, string[]>();
  const tableLabelByGuestId = new Map<string, string>();
  const songsByGuestId = new Map<string, string[]>();
  // ⚖ READ ALWAYS NOW (Maker PR 4f): the Guests search box filters in the
  // browser as you type, so every guest's groups, table and song requests travel
  // with the list — one query more, and the box never has to wait for the server.
  {
    const groupById = new Map<string, GuestGroupWithCount>(
      groups.map((g) => [g.group_id, g]),
    );
    for (const [guestId, groupIds] of membershipsMap.entries()) {
      const parts: string[] = [];
      for (const gid of groupIds) {
        const grp = groupById.get(gid);
        if (!grp) continue;
        parts.push(grp.label);
        if (hasSides) parts.push(TEAM_SIDE_LABELS[grp.team_side]);
      }
      if (parts.length > 0) groupLabelsByGuestId.set(guestId, parts);
    }
    const tableLabelOf = new Map(tables.map((t) => [t.table_id, t.table_label]));
    for (const a of assignments) {
      const label = tableLabelOf.get(a.table_id);
      if (label) tableLabelByGuestId.set(a.guest_id, label);
    }
    // Their song requests — the host reads their own event's (RLS
    // `event_song_requests_read`). Refused → no song words, the rest still match.
    const { data: songRows, error: songErr } = await supabase
      .from('event_song_requests')
      .select('guest_id, songs(title, artist)')
      .eq('event_id', eventId)
      .eq('origin', 'guest');
    if (songErr) logQueryError('GuestsPage (search · event_song_requests)', songErr, { event_id: eventId }, 'graceful_degrade');
    for (const row of (songRows ?? []) as { guest_id: string | null; songs: unknown }[]) {
      if (!row.guest_id) continue;
      const song = (Array.isArray(row.songs) ? row.songs[0] : row.songs) as
        | { title?: string | null; artist?: string | null }
        | null
        | undefined;
      const words = [song?.title, song?.artist].filter(Boolean).join(' ');
      if (words) songsByGuestId.set(row.guest_id, [...(songsByGuestId.get(row.guest_id) ?? []), words]);
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
    if (
      q &&
      !guestMatchesSearch(q, g, {
        roleNames,
        hasSides,
        groupLabels: groupLabelsByGuestId.get(g.guest_id),
        tableLabel: tableLabelByGuestId.get(g.guest_id) ?? null,
        songRequests: songsByGuestId.get(g.guest_id),
      })
    )
      return false;
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
  // ⚖ NO ACCESS ON THE LIST (owner 2026-10-07: "remove access column since the
  // access will be inside event details"). The list reads and shows none.
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
      if (seat?.placed) return tableWords(seat.placed);
      if (seat?.suggested) return `Suggested ${tableWords(seat.suggested)}`;
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

  // Desktop inspector selection (Inspector P2) — resolve `?inspect=<guestId>` to a
  // guest ALREADY in this page's fetched roster (no extra query). An unknown or
  // stale id renders the inspector closed (hasSelection=false), never a blank
  // rail. The body is the SAME card the standalone route renders — one body,
  // every frame — so no presentation of a guest can diverge from another.
  const inspectId = inspectParam;
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
  const accountRefByGuest = await accountPhotoRefsByGuest(supabase, eventId, user.id);
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
  /* THE CARD, not a quick view (2026-09-22). `?inspect=<guestId>` now server-
     renders the SAME `GuestCardBody` the standalone route renders — the QR,
     every editable field, and the remove path, in one panel that saves itself.
     Before this, selecting a guest showed a read-only summary whose only way
     into the form was a link called "Open full details", i.e. a page navigation
     to change one RSVP.

     `loadGuestCard` is the one extra round trip a selection costs; it is only
     paid when a guest is actually open. */
  const inspectedCard = inspectedGuest && inspectedCardP ? await inspectedCardP : null;
  // A limited helper's grants, colours and record — the Hosts pieces that moved
  // onto their card (F2). Couple only; one more read, only when a card is open.
  const inspectedHelper =
    inspectedGuest && inspectedCard?.canManageAccess && inspectedHelperP ? await inspectedHelperP : null;
  // Send invite · Copy message: the event's words + the couple's wording —
  // read once above for the Invite column.
  const inspectedInviteSetup = inspectedGuest ? inviteSetup : null;
  const inspectorBody = inspectedGuest && inspectedCard ? (
    <InspectorColumn
      eyebrow={guestCardEyebrow(inspectedCard.guest, { hasSides: inspectedCard.hasSides, roleNames: inspectedCard.roleNames })}
      title={guestDisplayName(inspectedGuest)}
      badge={guestCardReply(inspectedCard.guest)}
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
        headerShown
        inviteSetup={inspectedInviteSetup}
        SendInvite={GuestInviteCell}
        TicketThumb={GuestTicketThumb}
        MoreMenu={GuestMoreMenu}
        kit={TEMPLATE_KIT}
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
        errorMessage={typeof search.error === 'string' ? guestCardErrorCopy(search.error) : null}
        inviteFlash={
          search.new_qr === '1'
            ? { ok: true, msg: 'Done — a new QR and link. The old ones no longer work. Send them the new one.' }
            : null
        }
      />
    </InspectorColumn>
  ) : null;

  // The counts were worked out ONCE, with the read (`MeasuredGuests.stats`) — never
  // recounted here, so the meters, the counts line and the header cannot disagree.
  const stats = guestsRead.stats;
  const flash = pickFlash(search);
  // Which guests an account holds — a row's 💬 Message needs one (G35). Refused
  // → null, and no row claims an account nobody measured.
  const linkedGuestIds = await readLinkedGuestIds(supabase, eventId);

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

  // ── GUESTS › LIST AND MAP (Maker PR 4f) — what the client screen needs, read
  // once here. The screen searches, sections and selects in the browser; every
  // save is a shipped action.
  const groupLabelOf = new Map(groups.map((g) => [g.group_id, g.label] as const));
  const groupsByGuest: Record<string, string[]> = Object.fromEntries(
    [...membershipsMap.entries()].map(([gid, ids]) => [
      gid,
      ids
        .map((id) => groupLabelOf.get(id))
        .filter((l): l is string => Boolean(l))
        .sort((x, y) => x.localeCompare(y)),
    ]),
  );
  const tableByGuest: Record<string, string> = Object.fromEntries(
    [...placedByGuest.entries()].map(([id, label]) => [id, tableWords(label)]),
  );
  const songsByGuest: Record<string, string[]> = Object.fromEntries(songsByGuestId.entries());
  const faceByGuest: Record<string, string> = Object.fromEntries(
    guests
      .map((g) => [g.guest_id, photoDisplayUrls[g.photo_url ?? ''] ?? accountFaceByGuest[g.guest_id]] as const)
      .filter((e): e is readonly [string, string] => Boolean(e[1])),
  );
  // Every guest (never a request — those are the Review row), in the page's one
  // order: the honoree first, then importance, then name.
  const rosterAll = guests
    .filter((g) => !selfJoinIds.includes(g.guest_id))
    .sort(
      (a, b) =>
        honoreeRank(a.role) - honoreeRank(b.role) ||
        sortCompare(a, b, 'importance', undefined, seatByGuest),
    );
  // The map's centre: the celebrants' first names ("Maria & Jose"), else the event word.
  const mapRoot = mapRootLabel(rosterAll, eventWord);
  const guestsScreen = (
    <GuestsScreen
      eventId={eventId}
      gview={gview}
      guests={rosterAll}
      measured={guestsMeasured}
      hasSides={hasSides}
      groupsByGuest={groupsByGuest}
      groups={groups.map((g) => ({ group_id: g.group_id, label: g.label }))}
      tables={tables.map((t) => ({ tableId: t.table_id, label: tableWords(t.table_label) }))}
      tableByGuest={tableByGuest}
      songsByGuest={songsByGuest}
      linkedGuestIds={linkedGuestIds}
      faceByGuest={faceByGuest}
      requests={pendingClaimsCount}
      rootLabel={mapRoot}
      // Setup's "☑ Pick who" (PR 4d) lands here: Select mode over "to invite".
      initialQuery={search.select === 'to-invite' ? 'to invite' : (search.q ?? '')}
      initialSelect={search.select === 'to-invite'}
      setup={gview === 'share' ? <InvitePanel eventId={eventId} /> : null}
      empty={
        !guestsMeasured || rosterAll.length === 0 ? (
          <EmptyState finished={finished} hasGuests={false} eventId={eventId} measured={guestsMeasured} total={0} />
        ) : null
      }
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
    /* ⚖ ONE SPACING SCALE (owner 2026-10-03, on a phone screenshot of this
       top: "also fix the spacing here"). It was `space-y-*` — per-element top
       margins — so a block that rendered nothing on a phone still set the gap
       after it, and every block brought its own padding on top. Now the page is
       TWO flex columns: the title group, then — a step further down — every
       block below it, one `gap-4` (16 px) apart. A block that is not drawn is
       not a flex item, so it leaves no orphan gap. */
    <section className="sn-col max-w-none flex flex-col gap-6" data-roster-full-width="">
      <div className="flex flex-col gap-4" data-guests-title-group="">

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
      {/* ⚖ THE PHONE TITLE (Guests + ⋯) AND THE DOORS ROW ARE RETIRED (Maker PR
          4f, G1/G2): the page is ONE segmented control — List · Map · Setup —
          and every tool sits in the thumb row at the bottom (GuestsScreen). The
          four add doors live in the add sheet's "Add another way" dropdown; Sort
          is the thumb row's own dropdown; the Wedding March lives in the Maker. */}
      </div>

      <div className="flex min-w-0 flex-col gap-4" data-guests-blocks="">

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

      {/* REQUESTS TO JOIN — now the first row of the List (GuestsScreen,
          `👤 Review`, G11); the link and its words are unchanged. */}

      {/* FINALIZE LIVES IN SETUP (owner 2026-10-07: "finalize should be inside
          the Setup. not on its current location") — PR 4d mounts it there.
          Nothing sits above the List · Map · Setup switcher. */}

      {/* ⚖ GUESTS › LIST AND MAP (Maker PR 4f, owner 2026-10-07) — the
          prototype `home_and_guests_2026-10-07_fable.html?page=guests`, one
          client screen: the segmented control, the counts and replied meter,
          the sections of the one Sort, the rows, the map, and the thumb row.
          The old head (SummaryFacetBar's Filter ▾ · Show ▾ · Sort ▾), the
          seven-column table and the mind map's two-tab lens are retired with
          it (G17, G22, G38). The third segment is SETUP — until PR 4d builds
          it, the shipped Share panel is its body. */}
      {guestsScreen}
      </div>

      {/* ⚖ ONE WAY TO ADD, AT EVERY WIDTH — the round + in the header, beside
          ⋯ (owner 2026-10-01 "okay keep it similar", then "THE BOTTOM BAR IS
          HOME · GUESTS · SUPPLIERS · HUB · MORE": no floating button at the
          bottom). It opens this sheet: the name box first (Enter adds, the
          shipped CaptureBar), then the other ways in. */}
      <AddGuestSheet
        eventId={eventId}
        defaultSide={teamFilter === 'all' ? 'both' : teamFilter}
        tips={quickAddTips({ hasSides, offeredRoles: resolveRoleSet(guestRoleSetKey).offeredRoles })}
      />
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
        showSides={hasSides}
        defaultSide={!hasSides ? SIDELESS_SIDE : teamFilter === 'all' ? 'both' : teamFilter}
      />

      {/* UndoToastHost is the single toast host (the approved toast, from the top) for optimistic deletes, Undo and the list's results.
          The quick-view sheet host that used to sit beside it is gone: the
          guest card is server-rendered from `?inspect=` and presented by
          InspectorLayout at every width. */}
      <UndoToastHost />

      {/* How the Invite column works, once, on the first visit (owner
          2026-09-30: "and instructions on how to use it"; 2026-09-25: every
          feature gets a first-visit tour — the shipped MiniTour, never a new
          mechanism). */}
      <MiniTour tourKey="customer_guest_invite_v1" />
      {/* The Guest list's own first-visit tour (owner 2026-09-25) — after the
          Invite tour, so the two never stack on one first visit. */}
      <MiniTour tourKey="customer_guest_list_v1" after="customer_guest_invite_v1" />
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
      {/* 💾 The roster is kept on the phone and shown at once on the next
          open, then refreshed (owner 2026-10-02, DECISION_LOG "LAST-SEEN DATA
          SHOWS INSTANTLY, THEN REFRESHES"). A refused guest read is never
          kept — the next open shows the last list that WAS measured. */}
      <LastSeenCapture page="guests" fresh={guestsMeasured}>
        <InspectorLayout
          paramKey="inspect"
          className="sn-inspector-shell--card"
          mobileSheet
          hasSelection={Boolean(inspectorBody)}
          master={master}
          inspector={inspectorBody}
        />
      </LastSeenCapture>
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
  updated?: string;
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
    const u = Number(search.updated ?? 0);
    const parts = [`Imported ${formatCount(n)} guest${n === 1 ? '' : 's'}`];
    if (u > 0) parts.push(`updated ${formatCount(u)}`);
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
  /** The celebration has already happened. "Start by adding your first
   *  guest" is then a sentence about a party that is over — it is the copy the
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
    /* Unframed (owner 2026-08-21). First-timer fix 11 (2026-10-02): ONE line and
       ONE button where the eye lands — the same sheet the header + opens, which
       already holds every other way in (from your people · add with details ·
       import a file · paste many names). Four doors here was four decisions on
       an empty page. */
    <div className="p-8 text-center" data-guests-empty="">
      <p className="text-base text-ink/70">
        {finished ? 'No guests were added to this one.' : 'No guests yet.'}
      </p>
      <div className="mt-4 flex justify-center">
        <OpenAddGuestTextButton label={finished ? 'Add someone who came' : 'Add a guest'} />
      </div>
    </div>
  );
}


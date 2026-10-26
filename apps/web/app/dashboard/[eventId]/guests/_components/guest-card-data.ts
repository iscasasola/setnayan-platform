import 'server-only';
import { getCurrentUser } from '@/lib/auth';
import { eventRowOnce } from '@/lib/event-row-once';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ceremonyMatches, isChineseWedding } from '@/lib/chinese-wedding';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { eventHasSides } from '@/lib/guest-side-question';
import { guestGroupsFor } from '@/lib/role-sets';
import {
  fetchGuestById,
  fetchSingletonRoleHolders,
  INVITED_TO_BLOCKS,
  type GuestGroupCategory,
  type GuestRole,
  type GuestRow,
  type InvitedToBlock,
} from '@/lib/guests';
import { formatRecordedAt } from '@/lib/recorded-at';
import { loadRoleNames } from '@/lib/role-names.server';
import type { RoleNames } from '@/lib/role-names';
import { loadGuestAccessMap } from '@/lib/guest-access.server';
import type { GuestAccessState } from '@/lib/guest-access';
import { createAdminClient } from '@/lib/supabase/admin';
import { publicEventPath, resolveEventOwnerSlug } from '@/lib/public-event-url';
import { readSeatAccount } from '@/lib/seat-unlink';
import { accountNamesByGuest } from '@/lib/linked-profile-names';
import { withProfileName } from '@/lib/formal-name';
import { offersThisIsMe } from '@/lib/creator-couple-row';
import { guestOutfitOf, guestOutfitWords } from '@/lib/guest-outfit';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { resolveDisplayPalette } from '@/lib/room-palette';
import { plusOneOfWords, type PlusOneOf } from '@/lib/plus-one-of';
import { plusOneSeatLines, plusOneSeatPeople } from '@/lib/extra-seats';
import type { RsvpStatus } from '@/lib/guests';
import { guestDisplayName, guestRoleLabel } from '@/lib/guests';
import { guestArriveBy } from '@/lib/role-group-dress-code';
import {
  cameAfterAll,
  effectiveRoleOf,
  holdsARole,
  namedAProxy,
  type RepresentedBy,
  type StandingInFor,
} from '@/lib/guest-proxy';

/**
 * The base every guest's own invitation link (and NFC tag) is built from —
 * the event's public address WITHOUT the guest's token.
 *
 * It lives here rather than beside one of its two callers because BOTH the
 * roster page and the standalone guest route need it, and a second copy is a
 * second answer to "where does this guest's link point".
 */
export async function fetchInvitationBase(
  eventId: string,
  slug: string | null,
): Promise<string | null> {
  if (!slug) return null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const ownerSlug = await resolveEventOwnerSlug(createAdminClient(), eventId);
  return `${appUrl}${publicEventPath(slug, ownerSlug)}`;
}

/**
 * guest-card-data.ts — everything ONE guest card needs, loaded once.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * This is the loader that used to sit inline at the top of
 * `guests/[guestId]/page.tsx`. It moved here unchanged (same queries, same
 * degradation warnings, same derivations) the moment a SECOND frame started
 * rendering the same card: the roster's in-place panel. Two loaders for one
 * card is two places for the same fact to be wrong, so there is one.
 *
 * Every read below degrades rather than throws, and each `logQueryError` call
 * keeps the note about what a refusal would make the screen SAY — those
 * sentences are the reason the calls are there, so do not trim them.
 */

export type GroupChip = { label: string; teamSide: 'bride' | 'groom' | 'both' };
/** `guest_groups.team_side` is NOT NULL, CHECK bride · groom · both (default both) — anything else reads as both. */
const asTeamSide = (v: string | null | undefined): GroupChip['teamSide'] => (v === 'bride' || v === 'groom' ? v : 'both');

export type GuestCardData = {
  guest: GuestRow;
  /** Bride & groom: renamable, never deletable, always attending, role locked. */
  isCouple: boolean;
  /** Sides are a wedding idea — the role set decides whether we ask at all. */
  hasSides: boolean;
  /** Roles this event offers, minus the couple's and minus any already taken. */
  availableRoles: GuestRole[];
  /** The group dropdown's choices — this event type's default groups
   *  (`guestGroupsFor`), plus the guest's own if the type no longer lists it. */
  groupOptions: GuestGroupCategory[];
  /** INC weddings cap non-member principal sponsors at one pair (advisory). */
  isIncWedding: boolean;
  /** Chinese primary rite OR a tea ceremony over another rite. */
  showTeaCeremony: boolean;
  /**
   * 🪑 One line per live +1 seat row, oldest first (`plusOneSeatLines`) — EVERY seat, so a guest who brings two shows
   * two. `[]` = no seat row yet. NULL = THE READ WAS REFUSED: the card says it could not read them, never "no +1 added
   * yet" (a failure is not an emptiness — 2026-10-22, two-seat guests were told they had none).
   */
  plusOneLines: readonly string[] | null;
  /**
   * 🪑 The same seats as people — one tappable card each in Additional Guests (owner-approved prototype
   * `guest_card_groups_and_papic_2026-10-23.html`: avatar · name · "+1 of Rosario · Attending" · ›). `name` is null while the
   * seat waits for its name (`plusOneHasNoName`). Same order as `plusOneLines`; NULL when the read was refused. Optional: a
   * card drawn from elsewhere (the Maker) without it keeps the one-line list.
   */
  plusOnePeople?: readonly { guestId: string; name: string | null; status: RsvpStatus }[] | null;
  /** The oldest seat's row, or null when there is none (or the read was refused). */
  plusOneGuestId: string | null;
  /** The guest's saved invited-to blocks, filtered to values we still know. */
  initialInvited: InvitedToBlock[];
  /** Table label when this guest is seated, else null. */
  seatedAt: string | null;
  /** Custom group memberships, for the read-only Tags row. */
  customGroups: GroupChip[];
  /** When Setnayan learned the answer — already formatted, null when none. */
  recordedAt: string | null;
  /** Their Access (owner 2026-09-28: co-hosts come from the guest list). Null
   *  when the read was refused — the card then shows nothing, never "None". */
  access: GuestAccessState | null;
  /** The viewer is a co-host, so the Access dropdown is theirs to change. */
  canManageAccess: boolean;
  /**
   * 🪪 "This is me" (owner 2026-10-04): the viewer CREATED the event and holds no row,
   * and this is a live, unlinked bride / groom row no other account owns.
   * False on any doubt — the database (`claim_my_couple_row`) re-checks it all.
   */
  offersThisIsMe: boolean;
  /** 🔒 A plus-one who linked their OWN account — their name is shown read-only,
   *  "Linked to their account" (owner 2026-09-29, OWNER ANSWERS (10)). */
  nameLinked: boolean;
  /**
   * 🤝 Whose +1 this row is — the card's title and eyebrow name them (2026-10-20: the card on Rose Marie Buanhug's
   * seat read "+1 · TBA" under "GUEST · BRIDE'S SIDE"). Null for everyone who is not a +1, or when the read failed.
   */
  plusOneOf?: PlusOneOf | null;
  /**
   * The account this row is bound to (`event_members.guest_id`), shown to the
   * couple with an Unlink (lib/seat-unlink.ts). Null when nobody holds it, or
   * when the viewer is not a couple member — the read is another account's.
   */
  linkedAccount: { email: string | null; memberType: string } | null;
  /**
   * 👤 The row is linked to an account whose PROFILE holds a formal name (owner
   * 2026-09-30): `guest` already wears that name, read-only, and `isYou` says the
   * viewer is that person (so the card says "Edit on your profile ›"). Null → the
   * row's own name, as the couple typed it.
   */
  profileName: { isYou: boolean } | null;
  /** The couple's own words for roles (`events.role_names`, owner 2026-09-30). `{}` = the usual words. */
  roleNames: RoleNames;
  /**
   * The Table dropdown, in place (owner 2026-09-30: "Table a dropdown right on
   * the card"). Null when the tables could not be read — the card then shows the
   * seat as text and posts nothing, never a "Not seated" it did not measure.
   */
  tables: { tableId: string; label: string }[] | null;
  /** The table this guest sits at now, or null when unseated. */
  seatTableId: string | null;
  /**
   * Every group of this event and the ones this guest is in — the Groups
   * checkmark dropdown. Null when either read was refused: the card then shows
   * the groups read-only and posts nothing, so a refusal can never unTick them.
   */
  groupChoices: { options: { groupId: string; label: string; teamSide: GroupChip['teamSide'] }[]; memberIds: string[] } | null;
  /**
   * 👗 What they wear in the 3D seat plan, in words — their ROLE'S dress code (owner 2026-10-20: *"the attire depends on
   * the dress code of their role"*), read by the ONE reading Me › What to wear makes (`guestOutfitOf`). Null when the
   * event's dress code could not be read: the card then says nothing, never a "Not set yet" it did not measure.
   */
  outfit: { wear: string; from: string } | null;
  /**
   * 🧍‍♀️➡️🧍 THE PROXY, BOTH WAYS (owner 2026-10-27, DECISION_LOG "A ROLE HOLDER CAN SEND A PROXY"). Optional: a card drawn
   * from elsewhere (the Maker, the lab) without it shows no Proxy row. Every NULL inside means "could not read" — the card then
   * offers nothing it did not measure.
   */
  proxy?: GuestProxyCard | null;
};

export type GuestProxyCard = {
  /** This guest holds a role, so the card offers "Proxy ▾" (owner: "this only works if they have role and not guest"). */
  offer: boolean;
  /** On a ROLE HOLDER: who stands in for them. Null = nobody (or the read was refused — then `unread`). */
  representedBy: RepresentedBy | null;
  /** On a PROXY: the role holder they stand in for, and the role they take on. */
  standingInFor: (StandingInFor & { roleWord: string; callTime: string | null }) | null;
  /** The name the role holder TYPED on their reply ("someone will stand in for me") — the host links or adds them. */
  namedByGuest: string | null;
  /** The holder replied "attending" after the link — "says she can come after all — keep the proxy?". */
  cameAfterAll: boolean;
  /** Who may stand in — this event's living guests who are not the couple, a +1 seat, represented, or a proxy already. */
  choices: { guestId: string; name: string }[] | null;
  /** A link read was refused — the card says so and offers no change. */
  unread: boolean;
};

export async function loadGuestCard(
  supabase: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<GuestCardData | null> {
  /*
    ⚡ ONE ROUND TRIP, NOT TWELVE (owner, live iPhone test 2026-10-02: the card
    took ~7–8 s to open). Every read below used to wait for the one before it —
    the guest, then the profile names, then the singleton holders, the role set,
    the ceremony, the +1, the seat, the groups, the tables, the access, the
    linked account, the role words — although none of them needs another's
    answer. They now leave together; only the three that genuinely depend on an
    earlier answer (the access map and the "is this +1 linked" check need the
    guest row, the linked account needs to know the viewer is a co-host) wait.
    Same queries, same degradations, same log lines.
  */
  const [
    stored,
    profileNames,
    viewerId,
    singletonHolders,
    roleSet,
    { data: ceremonyRow, error: ceremonyRowError },
    { data: plusOneRows, error: plusOneRowError },
    { data: seatRow, error: seatRowError },
    { data: groupRows, error: groupRowsError },
    { data: tableRows, error: tableRowsError },
    { data: eventGroupRows, error: eventGroupRowsError },
    roleNames,
    { data: dressRow, error: dressRowError },
    { data: holderRow, error: holderRowError },
  ] = await Promise.all([
    fetchGuestById(supabase, eventId, guestId),
    // 👤 Linked to an account with a formal name → the card wears the profile's
    // name, exactly as the list does (lib/linked-profile-names.ts).
    accountNamesByGuest(supabase, eventId),
    // The request's ONE verified user (`getCurrentUser`, cache()d) — never a second auth-server trip.
    getCurrentUser().then((u) => u?.id ?? null),
    // Hide bride/groom from the role dropdown if someone else already has
    // them — DB partial unique indexes enforce this regardless, but the UI
    // shouldn't offer an option that will fail on save.
    fetchSingletonRoleHolders(supabase, eventId, guestId),
    resolveRoleSetForEvent(eventId),
    // `secondary_ceremony_type` too: the common Tsinoy case is a CHURCH wedding
    // with a tea ceremony as the OVERLAY rite, and `isChineseWedding` matches
    // primary OR secondary. Reading only the primary would hide the tea-ceremony
    // field from exactly the couples who need it.
    // 🗂 From the dashboard's one read of the row when this render opened it (lib/event-row-once.ts).
    eventRowOnce(supabase, eventId, 'ceremony_type, secondary_ceremony_type', () =>
      supabase.from('events').select('ceremony_type, secondary_ceremony_type').eq('event_id', eventId).maybeSingle(),
    ),
    supabase
      .from('guests')
      // 🪑 EVERY seat row — never `.maybeSingle()`: two seats were an error that drew "no +1 added yet" (2026-10-22).
      .select('guest_id, first_name, last_name, plus_one_name_confirmed_at, created_at, rsvp_status')
      .eq('event_id', eventId)
      .eq('plus_one_of_guest_id', guestId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('event_seat_assignments')
      // 🔴 `table_label`, NOT `label`. There is no `label` column on
      // `event_tables` — PostgREST answers 42703 and REFUSES THE WHOLE QUERY.
      .select('table_id, event_tables(table_label)')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .maybeSingle(),
    supabase
      .from('guest_group_memberships')
      .select('group_id, guest_groups(label, team_side)')
      .eq('guest_id', guestId),
    // The Table and Groups dropdowns' choices — this event's tables and groups.
    supabase.from('event_tables').select('table_id, table_label').eq('event_id', eventId),
    supabase.from('guest_groups').select('group_id, label, team_side').eq('event_id', eventId),
    // The couple's words for roles — its own read, graceful (usual words on a refusal).
    loadRoleNames(supabase, eventId, 'loadGuestCard.roleNames'),
    // 👗 The dress code the Seat fold's "Attire · 3D seat plan" line reads — its OWN read, so a refusal drops only that
    // line and never the ceremony context above.
    // (And from the one row too — if THAT read is refused, this one is sent on its own, as before.)
    eventRowOnce(supabase, eventId, 'dress_code_config, role_palette', () =>
      supabase.from('events').select('dress_code_config, role_palette').eq('event_id', eventId).maybeSingle(),
    ),
    // 🧍 The role holder THIS guest stands in for, if any (the link lives on the holder's row).
    supabase
      .from('guests')
      .select('guest_id, first_name, last_name, display_name, role, extra_roles')
      .eq('event_id', eventId)
      .eq('represented_by_guest_id', guestId)
      .is('deleted_at', null)
      .maybeSingle(),
  ]);
  if (!stored) return null;
  const guest = withProfileName(stored, profileNames);
  const linkedProfile = profileNames[guestId];

  const isCouple = guest.role === 'bride' || guest.role === 'groom';
  const hasSides = eventHasSides(roleSet);
  const availableRoles = roleSet.offeredRoles.filter(
    (r) => !roleSet.coupleRoles.has(r) && !(r in singletonHolders),
  );

  // ⚠ the ceremony context this card reads against. Refused, it degrades silently.
  if (ceremonyRowError) {
    logQueryError('loadGuestCard.ceremonyRow', ceremonyRowError, { eventId, guestId }, 'graceful_degrade');
  }
  const showTeaCeremony = isChineseWedding(ceremonyRow);
  // Both rite columns — a mixed wedding with an INC side reads as INC here too.
  const isIncWedding = ceremonyMatches(ceremonyRow, 'inc');

  // ⚠ 🚨 A FALSE STATEMENT ABOUT A GUEST. Refused, this once rendered "Allowed, but no +1
  // ⚠ added yet" — telling the couple their guest has no plus-one when they may well have.
  // ⚠ Not an empty list: a claim about a person. So a refusal is `plusOneLines: null`, which
  // ⚠ the card draws as "couldn't read", never as the empty state.
  if (plusOneRowError) {
    logQueryError('loadGuestCard.plusOneRow', plusOneRowError, { eventId, guestId }, 'graceful_degrade');
  }
  const plusOneRowList = (plusOneRows ?? []) as Array<{
    guest_id: string;
    first_name: string | null;
    last_name: string | null;
    plus_one_name_confirmed_at: string | null;
    created_at: string | null;
    rsvp_status: RsvpStatus | null;
  }>;
  const plusOneLines = plusOneRowError ? null : plusOneSeatLines(guestId, plusOneRowList);
  const plusOnePeople = plusOneRowError ? null : plusOneSeatPeople(guestId, plusOneRowList);

  // Filter to known valid InvitedToBlock values — schema column is
  // string[] so legacy data could contain stale block names.
  const initialInvited = (guest.invited_to_blocks ?? []).filter(
    (b): b is InvitedToBlock => (INVITED_TO_BLOCKS as readonly string[]).includes(b),
  );

  // ⚠ A SEATED GUEST READS AS UNSEATED. `seatedAt` falls to null on a refused read,
  // ⚠ so a guest the couple placed at a table shows no seat at all — and seating is
  // ⚠ some of the most laborious work in the product.
  if (seatRowError) {
    logQueryError('loadGuestCard.seatRow', seatRowError, { eventId, guestId }, 'graceful_degrade');
  }
  const seatedAt =
    seatRow && seatRow.event_tables
      ? // event_tables embed may come back as object OR array depending
        // on PostgREST's FK resolution; handle both shapes defensively.
        Array.isArray(seatRow.event_tables)
        ? ((seatRow.event_tables[0] as { table_label?: string } | undefined)?.table_label ?? null)
        : ((seatRow.event_tables as { table_label?: string }).table_label ?? null)
      : null;

  // ⚠ the guest's group memberships. Refused, they read as belonging to no group,
  // ⚠ which is how a couple loses track of who is with whom.
  if (groupRowsError) {
    logQueryError('loadGuestCard.groupRows', groupRowsError, { eventId, guestId }, 'graceful_degrade');
  }
  const customGroups: GroupChip[] = (groupRows ?? [])
    .map((row) => {
      const gg = row.guest_groups;
      const single = Array.isArray(gg) ? gg[0] : gg;
      if (!single || typeof single !== 'object') return null;
      return {
        label: (single as { label?: string }).label ?? '',
        teamSide:
          ((single as { team_side?: string }).team_side as GroupChip['teamSide']) ?? 'both',
      };
    })
    .filter((g): g is GroupChip => g !== null && g.label !== '');

  // ⚠ Refused → the Table dropdown is not drawn (the seat shows as text), so a
  // ⚠ refusal can never offer "Not seated" as if it were the truth.
  if (tableRowsError) {
    logQueryError('loadGuestCard.tableRows', tableRowsError, { eventId, guestId }, 'graceful_degrade');
  }
  // ⚠ Refused → Groups show read-only, and the form posts no groups at all.
  if (eventGroupRowsError) {
    logQueryError('loadGuestCard.eventGroupRows', eventGroupRowsError, { eventId, guestId }, 'graceful_degrade');
  }
  const tables =
    tableRowsError || seatRowError
      ? null
      : ((tableRows ?? []) as { table_id: string; table_label: string | null }[])
          .map((t) => ({ tableId: t.table_id, label: t.table_label?.trim() || 'Table' }))
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const groupChoices =
    eventGroupRowsError || groupRowsError
      ? null
      : {
          options: ((eventGroupRows ?? []) as { group_id: string; label: string | null; team_side?: string | null }[])
            .map((g) => ({ groupId: g.group_id, label: g.label?.trim() || 'Group', teamSide: asTeamSide(g.team_side) }))
            .sort((a, b) => a.label.localeCompare(b.label)),
          memberIds: ((groupRows ?? []) as { group_id?: string }[])
            .map((r) => r.group_id)
            .filter((id): id is string => typeof id === 'string'),
        };

  // Access (co-host / limited helper) and whether the viewer may change it —
  // plus, beside them, whether a +1 holds their own account (needs the row).
  const offerProxy = holdsARole(guest) && !guest.plus_one_of_guest_id && !holderRow;
  const [accessMap, viewerMembership, nameLinked, plusOneOf, proxyRead, choiceRead] = await Promise.all([
    loadGuestAccessMap(eventId, [{ guest_id: guest.guest_id, role: guest.role }]),
    (async () => {
      if (!viewerId) return null;
      const { data: me, error: meError } = await supabase
        .from('event_members')
        .select('member_type, guest_id, joined_via')
        .eq('event_id', eventId)
        .eq('user_id', viewerId)
        .eq('member_type', 'couple')
        .maybeSingle();
      // Refused → no dropdown (fail closed: showing a control the action would
      // refuse is worse than showing the level read-only). Logged, not silent.
      if (meError) {
        logQueryError('loadGuestCard.canManageAccess', meError, { eventId, guestId }, 'graceful_degrade');
      }
      const m = me as { guest_id: string | null; joined_via: string | null } | null;
      return m ? { holdsRow: Boolean(m.guest_id), isCreator: m.joined_via === 'created_event' } : null;
    })(),
    guest.plus_one_of_guest_id
      ? (async () => {
          const { data, error } = await createAdminClient()
            .from('event_members')
            .select('id')
            .eq('event_id', eventId)
            .eq('guest_id', guest.guest_id)
            .limit(1)
            .maybeSingle();
          if (error) logQueryError('loadGuestCard.nameLinked', error, { eventId, guestId }, 'graceful_degrade');
          return Boolean(data);
        })()
      : Promise.resolve(false),
    // 🤝 The guest who brings them, and that guest's seats in order — the card names the seat as the List does.
    guest.plus_one_of_guest_id
      ? (() => {
          // Both reads leave together, beside the access pair (no extra wait: `.then`, never a queued `await`).
          const hostId = guest.plus_one_of_guest_id as string;
          return Promise.all([
            supabase
              .from('guests')
              .select('guest_id, first_name, last_name, display_name, side')
              .eq('event_id', eventId)
              .eq('guest_id', hostId)
              .is('deleted_at', null)
              .maybeSingle(),
            supabase
              .from('guests')
              .select('guest_id')
              .eq('event_id', eventId)
              .eq('plus_one_of_guest_id', hostId)
              .is('deleted_at', null)
              .order('created_at', { ascending: true }),
          ]).then(([{ data: host, error: hostErr }, { data: seatIds, error: seatErr }]) => {
            if (hostErr || seatErr) {
              logQueryError('loadGuestCard.plusOneOf', hostErr ?? seatErr, { eventId, guestId }, 'graceful_degrade');
              return null;
            }
            if (!host) return null;
            const seatIndex = ((seatIds ?? []) as { guest_id: string }[]).findIndex((r) => r.guest_id === guest.guest_id);
            return plusOneOfWords(guest, host as never, Math.max(0, seatIndex));
          });
        })()
      : Promise.resolve(null),
    // 🧍 The proxy who stands in for THIS role holder.
    guest.represented_by_guest_id
      ? supabase
          .from('guests')
          .select('guest_id, first_name, last_name, display_name, rsvp_status')
          .eq('event_id', eventId)
          .eq('guest_id', guest.represented_by_guest_id)
          .is('deleted_at', null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    // 🧍 Who may stand in — only read for a guest the card offers "Proxy ▾" to.
    offerProxy
      ? supabase
          .from('guests')
          .select('guest_id, first_name, last_name, display_name, role, plus_one_of_guest_id, represented_by_guest_id, entry_source, passed_away')
          .eq('event_id', eventId)
          .is('deleted_at', null)
          .neq('guest_id', guestId)
          .order('first_name', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const canManageAccess = viewerMembership !== null;

  // Who holds this row — read only for the couple (another account's email) —
  // and, beside it (never behind it), 🪪 the two facts "This is me" needs, read
  // only on a couple row while the viewer is the creator holding no row.
  const askThisIsMe =
    viewerMembership !== null &&
    viewerMembership.isCreator &&
    !viewerMembership.holdsRow &&
    isCouple &&
    guest.passed_away !== true;
  const [linkedAccount, rowFacts] = canManageAccess
    ? await Promise.all([
        readSeatAccount(eventId, guest.guest_id),
        askThisIsMe ? readCoupleRowHolders(eventId, guest.guest_id, viewerId) : Promise.resolve(null),
      ])
    : [null, null];
  // A refused read (null) offers nothing.
  const thisIsMe =
    rowFacts !== null &&
    offersThisIsMe({
      viewerIsCreator: viewerMembership?.isCreator === true,
      viewerHoldsARow: viewerMembership?.holdsRow ?? true,
      rowIsCouple: isCouple,
      rowIsLinked: rowFacts.linked || linkedAccount !== null,
      rowPassedAway: guest.passed_away === true,
      rowOwnedByAnotherAccount: rowFacts.ownedByAnother,
    });

  // ⚠ The dress code the card's "Attire · 3D seat plan" line reads. Refused → no line (never a "Not set yet" it did not measure).
  if (dressRowError) {
    logQueryError('loadGuestCard.dressRow', dressRowError, { eventId, guestId }, 'graceful_degrade');
  }
  const dress = (dressRow ?? null) as { dress_code_config?: unknown; role_palette?: unknown } | null;
  /* No row at all (the event hidden from this reader) is not "nothing picked" either — no line. */
  // 🧍 The role this guest DRESSES as — a proxy wears the role they stand in for (`effectiveRoleOf`).
  if (holderRowError) logQueryError('loadGuestCard.standingInFor', holderRowError, { eventId, guestId }, 'graceful_degrade');
  const holder = (holderRow ?? null) as
    | { guest_id: string; first_name: string; last_name: string; display_name: string | null; role: GuestRole; extra_roles: GuestRole[] | null }
    | null;
  const standingInFor: StandingInFor | null = holder
    ? { guestId: holder.guest_id, name: guestDisplayName(holder), role: holder.role, extra_roles: holder.extra_roles ?? [] }
    : null;
  const dressRole = effectiveRoleOf(guest, standingInFor);
  const outfit = dressRowError || !dress
    ? null
    : guestOutfitWords(
        guestOutfitOf({
          role: dressRole,
          dressCodeConfig: dress?.dress_code_config ?? null,
          palette: resolveDisplayPalette(sanitizeRolePalette(dress?.role_palette)),
          roleNames,
          person: { name_prefix: guest.name_prefix ?? null, display_name: guest.display_name ?? null, gender: guest.gender ?? null, attire: guest.attire },
        }),
      );

  const { data: proxyRow, error: proxyErr } = proxyRead as { data: unknown; error: unknown };
  const { data: choiceRows, error: choiceErr } = choiceRead as { data: unknown; error: unknown };
  if (proxyErr) logQueryError('loadGuestCard.representedBy', proxyErr, { eventId, guestId }, 'graceful_degrade');
  if (choiceErr) logQueryError('loadGuestCard.proxyChoices', choiceErr, { eventId, guestId }, 'graceful_degrade');
  const proxyGuest = (proxyRow ?? null) as
    | { guest_id: string; first_name: string; last_name: string; display_name: string | null; rsvp_status: RsvpStatus }
    | null;
  const proxy: GuestProxyCard = {
    offer: offerProxy,
    representedBy: proxyGuest ? { guestId: proxyGuest.guest_id, name: guestDisplayName(proxyGuest), rsvp: proxyGuest.rsvp_status } : null,
    standingInFor: standingInFor
      ? {
          ...standingInFor,
          roleWord: guestRoleLabel(dressRole, roleNames),
          callTime: dress && !dressRowError ? guestArriveBy({ role: dressRole, config: dress.dress_code_config ?? null, general: null }) : null,
        }
      : null,
    namedByGuest: namedAProxy(guest),
    cameAfterAll: cameAfterAll(guest),
    choices: choiceErr
      ? null
      : withoutTakenProxies((choiceRows ?? []) as {
          guest_id: string;
          first_name: string;
          last_name: string;
          display_name: string | null;
          role: GuestRole;
          plus_one_of_guest_id: string | null;
          represented_by_guest_id: string | null;
          entry_source: string | null;
          passed_away: boolean | null;
        }[])
          .filter(
            (g) =>
              g.role !== 'bride' &&
              g.role !== 'groom' &&
              !g.plus_one_of_guest_id &&
              !g.represented_by_guest_id &&
              g.entry_source !== 'self_added_unlisted' &&
              g.passed_away !== true,
          )
          .map((g) => ({ guestId: g.guest_id, name: guestDisplayName(g) })),
    unread: Boolean(holderRowError || proxyErr || (guest.represented_by_guest_id && !proxyGuest)),
  };

  return {
    proxy,
    outfit: outfit ? { wear: outfit.wear, from: outfit.from } : null,
    roleNames,
    tables,
    seatTableId: (seatRow?.table_id as string | null | undefined) ?? null,
    groupChoices,
    guest,
    isCouple,
    hasSides,
    availableRoles,
    groupOptions: [
      ...guestGroupsFor(roleSet.key),
      ...(guestGroupsFor(roleSet.key).includes(guest.group_category) ? [] : [guest.group_category]),
    ],
    isIncWedding,
    showTeaCeremony,
    plusOneLines,
    plusOnePeople,
    plusOneGuestId: plusOneRowError ? null : (plusOneRowList[0]?.guest_id ?? null),
    initialInvited,
    seatedAt,
    customGroups,
    recordedAt: formatRecordedAt(guest.rsvp_responded_at),
    access: accessMap?.get(guest.guest_id) ?? null,
    canManageAccess,
    offersThisIsMe: thisIsMe,
    nameLinked,
    plusOneOf,
    linkedAccount,
    profileName: linkedProfile ? { isYou: linkedProfile.userId === viewerId } : null,
  };
}

/**
 * 🪪 The two facts `claim_my_couple_row` refuses on: does any account hold this
 * row, and is its person another account's? Admin client (another account's
 * link is not the viewer's to read); the caller has already passed the host
 * gate. NULL ON ANY DOUBT: a refused read must not offer an action.
 */
async function readCoupleRowHolders(
  eventId: string,
  guestId: string,
  viewerId: string | null,
): Promise<{ linked: boolean; ownedByAnother: boolean } | null> {
  if (!viewerId) return null;
  const admin = createAdminClient();
  const [held, row] = await Promise.all([
    admin.from('event_members').select('id').eq('event_id', eventId).eq('guest_id', guestId).limit(1),
    admin.from('guests').select('person_id').eq('event_id', eventId).eq('guest_id', guestId).maybeSingle(),
  ]);
  if (held.error || row.error) {
    logQueryError('loadGuestCard.thisIsMe', held.error ?? row.error, { eventId, guestId }, 'graceful_degrade');
    return null;
  }
  if (!row.data) return null;
  const personId = (row.data as { person_id: string | null }).person_id;
  let owner: string | null = null;
  if (personId) {
    const { data: person, error } = await admin
      .from('people')
      .select('claimed_by_user_id')
      .eq('person_id', personId)
      .maybeSingle();
    if (error) {
      logQueryError('loadGuestCard.thisIsMe.person', error, { eventId, guestId }, 'graceful_degrade');
      return null;
    }
    owner = (person as { claimed_by_user_id: string | null } | null)?.claimed_by_user_id ?? null;
  }
  return { linked: (held.data ?? []).length > 0, ownedByAnother: owner !== null && owner !== viewerId };
}

/** 🧍 A guest who already stands in for someone (named in another row's `represented_by_guest_id`) is not offered again. */
function withoutTakenProxies<T extends { guest_id: string; represented_by_guest_id: string | null }>(rows: T[]): T[] {
  const taken = new Set(rows.map((r) => r.represented_by_guest_id).filter((id): id is string => Boolean(id)));
  return rows.filter((r) => !taken.has(r.guest_id));
}

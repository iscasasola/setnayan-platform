/**
 * people-with-access.ts — WHO CAN OPEN THIS EVENT, AND WHAT EACH OF THEM CAN
 * DO IN EACH AREA, as one pure function.
 *
 * ⚖ Owner 2026-10-03 (DECISION_LOG, Sunday plan "PEOPLE WITH ACCESS"): access
 * is set PER PERSON, PER AREA, as Edit · View · Off (one dropdown per area). It
 * lives in Event Details as "People with access", one row per person — the
 * co-hosts, the coordinator, the helpers and each booked supplier. A
 * delegate's access ends 7 days after the event; the hosts' never does.
 *
 * 🔑 NOTHING HERE IS A SECOND SOURCE OF TRUTH. Every level is
 * `resolveAreaLevel` (the TS mirror of `public.moderator_area_level`) over the
 * seat's own `permissions_json`; every co-host / helper word is
 * `guestAccessState` (the guest list's own rule); the window is
 * `delegate-access-window`. This module only arranges them into rows, so the
 * section and the readers that enforce it can never disagree.
 *
 * No I/O: the reads are `people-with-access.server.ts`.
 */
import {
  COORDINATOR_AREAS,
  DELEGATE_AREAS,
  DELEGATE_AREA_LABEL,
  FIXED_AREA_LEVEL,
  areaChoices,
  choiceOfLevel,
  resolveAreaLevel,
  type AreaChoice,
  type DelegateArea,
  type ModeratorPermissions,
} from './delegate-areas';
import { delegateAccessHasExpired, delegateAccessLastDay } from './delegate-access-window';
import { ACCESS_LEVEL_LABEL, CREATOR_WORD, guestAccessState, seatIsFullCohost, type GuestAccessState } from './guest-access';
import { LEVEL_WORD, levelOf, type CoordinatorAccessLevel, type LevelledPermissions } from './coordinator-access-level';

/** The hired planner's seat kind (`lib/planner-seats.ts` PLANNER_SEAT_ROLE). */
const PLANNER_ROLE = 'wedding_planner_external';

export { PEOPLE_WITH_ACCESS_ANCHOR, peopleWithAccessHref } from './people-with-access-href';

export type SeatInput = {
  moderatorId: string;
  userId: string | null;
  guestId: string | null;
  roleSubtype: string;
  displayLabel: string | null;
  invitationEmail: string | null;
  invitationToken: string | null;
  invitationExpiresAt: string | null;
  permissions: ModeratorPermissions | null;
};

/** A `couple` member of the event (a host). */
export type HostInput = { userId: string; name: string; isCreator: boolean };

/** The guest row a seat points at (its name and role decide the Access line). */
export type SeatGuestInput = { guestId: string; name: string; firstName: string; role: string };

export type SupplierInput = { vendorId: string; name: string; categoryLabel: string; isPlanner: boolean };

export type PersonKind = 'co_host' | 'coordinator' | 'helper' | 'supplier';

export type AreaCell = {
  area: DelegateArea;
  label: string;
  /** What this person holds in the area now. */
  choice: AreaChoice;
  /** What the host may set it to — null: not settable yet (shown as a word). */
  choices: readonly AreaChoice[] | null;
};

export type PersonRow = {
  key: string;
  kind: PersonKind;
  name: string;
  /** Co-host · Coordinator · Limited helper · the supplier's category. */
  roleWord: string;
  moderatorId: string | null;
  guestId: string | null;
  /** For a seat reached from the guest list: the Access line's own state
   *  (drives the Co-host · Helper · No access dropdown). Null otherwise. */
  access: GuestAccessState | null;
  /** Joined and live (a waiting seat is false). */
  live: boolean;
  /** One cell per area for a delegate; null for a co-host (every area, Edit)
   *  and for a supplier (their booking decides — not set here yet). */
  areas: AreaCell[] | null;
  /** A delegate's last day of access (`YYYY-MM-DD`), or null. */
  lastDay: string | null;
  /** The window has closed — they can open nothing now. */
  ended: boolean;
  /** This row is the person looking at the page. */
  isViewer: boolean;
  /** A booked planner nobody has invited to plan yet. */
  canInviteAsCoordinator: boolean;
  vendorId: string | null;
  /**
   * 🔑 The coordinator's level (owner 2026-10-29, "only TWO levels — Limited and Full"): the hosts' recorded answer,
   * or 'unanswered' for a coordinator seat not asked yet. Absent for everyone who is not (or was not) the coordinator.
   * Drives the Limited · Full access pick on the row — the place the Home card's answer stays changeable.
   */
  coordinatorLevel?: CoordinatorAccessLevel | 'unanswered';
};

export type EventWindowInput = {
  eventDate: string | null;
  eventEndDate: string | null;
  precision: string | null;
};

/** One delegate's cells, area by area, from their own grant. */
export function areaCells(permissions: ModeratorPermissions | null): AreaCell[] {
  return DELEGATE_AREAS.map((area) => {
    const choices = areaChoices(area);
    let choice: AreaChoice;
    if (choices === null) {
      choice = FIXED_AREA_LEVEL[area] ?? 'view';
    } else {
      choice = choiceOfLevel(resolveAreaLevel(permissions, area));
      // A stored level the host cannot pick (budget 'edit' — never written,
      // locked D1) is shown as the highest level the dropdown offers, which is
      // what the readers treat it as (`IN ('view','edit')`).
      if (!choices.includes(choice)) choice = choices.includes('view') ? 'view' : choices[0]!;
    }
    return { area, label: DELEGATE_AREA_LABEL[area], choice, choices };
  });
}

function seatName(seat: SeatInput, guest: SeatGuestInput | undefined, userNames: ReadonlyMap<string, string>): string {
  return (
    guest?.name ||
    (seat.userId ? userNames.get(seat.userId) : undefined) ||
    seat.displayLabel ||
    seat.invitationEmail ||
    'Someone'
  );
}

/**
 * Every person with access to the event, in the order the section draws them:
 * co-hosts · coordinators · helpers · booked suppliers.
 */
export function buildPeopleWithAccess(input: {
  hosts: readonly HostInput[];
  seats: readonly SeatInput[];
  seatGuests: ReadonlyMap<string, SeatGuestInput>;
  userNames: ReadonlyMap<string, string>;
  suppliers: readonly SupplierInput[];
  window: EventWindowInput;
  viewerUserId: string;
  now: Date;
}): PersonRow[] {
  const { hosts, seats, seatGuests, userNames, suppliers, window: w, viewerUserId, now } = input;
  const used = new Set<string>();
  const rows: PersonRow[] = [];
  const delegateWindow = { isCouple: false, eventDate: w.eventDate, eventEndDate: w.eventEndDate, precision: w.precision };
  const lastDay = delegateAccessLastDay(delegateWindow);
  const ended = delegateAccessHasExpired({ ...delegateWindow, now });

  // ── Co-hosts: every `couple` member, plus a co-host seat still waiting ────
  for (const h of hosts) {
    const seat = seats.find((s) => s.userId === h.userId && seatIsFullCohost(s.roleSubtype));
    if (seat) used.add(seat.moderatorId);
    const guest = seat?.guestId ? seatGuests.get(seat.guestId) : undefined;
    // 🔑 A coordinator the hosts gave FULL access sits on a co-host seat — still named their coordinator.
    const wasCoordinator = seat ? levelOf({ permissions_json: seat.permissions as LevelledPermissions | null }) : null;
    rows.push({
      key: `host:${h.userId}`,
      kind: 'co_host',
      name: h.name,
      // The creator is the Host; everyone else here is a Co-host (owner 2026-10-04).
      roleWord: h.isCreator ? CREATOR_WORD : 'Co-host',
      ...(wasCoordinator ? { coordinatorLevel: wasCoordinator, roleWord: 'Coordinator' } : null),
      moderatorId: seat?.moderatorId ?? null,
      guestId: guest?.guestId ?? null,
      access:
        h.isCreator
          ? { level: 'co_host', live: true, lock: 'creator' }
          : guest && seat
            ? guestAccessState({
                seat: { role_subtype: seat.roleSubtype, user_id: seat.userId, removed_at: null },
                guestRole: guest.role,
                isCreator: false,
              })
            : null,
      live: true,
      areas: null,
      lastDay: null,
      ended: false,
      isViewer: h.userId === viewerUserId,
      canInviteAsCoordinator: false,
      vendorId: null,
    });
  }

  const coordinators: PersonRow[] = [];
  const helpers: PersonRow[] = [];
  for (const seat of seats) {
    if (used.has(seat.moderatorId)) continue;
    const guest = seat.guestId ? seatGuests.get(seat.guestId) : undefined;
    const name = seatName(seat, guest, userNames);
    const live = Boolean(seat.userId);
    if (seatIsFullCohost(seat.roleSubtype)) {
      // A co-host chosen from the guest list who has not joined yet.
      rows.push({
        key: `seat:${seat.moderatorId}`,
        kind: 'co_host',
        name,
        roleWord: 'Co-host',
        moderatorId: seat.moderatorId,
        guestId: guest?.guestId ?? null,
        access: guest
          ? guestAccessState({
              seat: { role_subtype: seat.roleSubtype, user_id: seat.userId, removed_at: null },
              guestRole: guest.role,
              isCreator: false,
            })
          : null,
        live,
        areas: null,
        lastDay: null,
        ended: false,
        isViewer: seat.userId === viewerUserId,
        canInviteAsCoordinator: false,
        vendorId: null,
      });
      continue;
    }
    if (seat.roleSubtype === PLANNER_ROLE) {
      // A planner invite nobody accepted is shown only while its link works.
      if (!live) {
        const expired =
          !seat.invitationToken ||
          (seat.invitationExpiresAt != null && new Date(seat.invitationExpiresAt).getTime() <= now.getTime());
        if (expired) continue;
      }
      coordinators.push({
        key: `seat:${seat.moderatorId}`,
        kind: 'coordinator',
        name,
        roleWord: 'Coordinator',
        coordinatorLevel: levelOf({ permissions_json: seat.permissions as LevelledPermissions | null }) ?? 'unanswered',
        moderatorId: seat.moderatorId,
        guestId: null,
        access: null,
        live,
        areas: areaCells(seat.permissions),
        lastDay,
        ended,
        isViewer: seat.userId === viewerUserId,
        canInviteAsCoordinator: false,
        vendorId: null,
      });
      continue;
    }
    helpers.push({
      key: `seat:${seat.moderatorId}`,
      kind: 'helper',
      name,
      roleWord: ACCESS_LEVEL_LABEL.limited_helper,
      moderatorId: seat.moderatorId,
      guestId: guest?.guestId ?? null,
      access: guest
        ? guestAccessState({
            seat: { role_subtype: seat.roleSubtype, user_id: seat.userId, removed_at: null },
            guestRole: guest.role,
            isCreator: false,
          })
        : null,
      live,
      areas: areaCells(seat.permissions),
      lastDay,
      ended,
      isViewer: seat.userId === viewerUserId,
      canInviteAsCoordinator: false,
      vendorId: null,
    });
  }
  rows.push(...coordinators, ...helpers);

  const anyPlannerSeat = coordinators.length > 0;
  for (const s of suppliers) {
    rows.push({
      key: `supplier:${s.vendorId}`,
      kind: 'supplier',
      name: s.name,
      roleWord: s.categoryLabel,
      moderatorId: null,
      guestId: null,
      access: null,
      live: true,
      areas: null,
      lastDay: null,
      ended: false,
      isViewer: false,
      canInviteAsCoordinator: s.isPlanner && !anyPlannerSeat,
      vendorId: s.vendorId,
    });
  }
  return rows;
}

/**
 * 📁 EVENT ACCESS — THE GROUPS (owner 2026-10-07: *"Host: Helper: Vendors:"*,
 * then *"Coordinator Access? Booked Vendor Access?"*; the UI word is
 * "supplier"). A co-host is a Host; the hired coordinator is its own group; a
 * limited helper is a Helper; a booked supplier is a Booked supplier. Pure, so
 * the fold's summary and the section's headings can never count differently.
 */
export const ACCESS_GROUPS = [
  { key: 'hosts', title: 'Hosts', one: 'host', many: 'hosts', empty: 'No hosts yet.' },
  { key: 'coordinator', title: 'Coordinator', one: 'coordinator', many: 'coordinators', empty: 'No coordinator yet.' },
  { key: 'helpers', title: 'Helpers', one: 'helper', many: 'helpers', empty: 'No helpers yet.' },
  { key: 'suppliers', title: 'Booked suppliers', one: 'supplier', many: 'suppliers', empty: 'No booked suppliers yet.' },
] as const;
export type AccessGroupKey = (typeof ACCESS_GROUPS)[number]['key'];

export function accessGroupOf(kind: PersonKind): AccessGroupKey {
  return kind === 'co_host' ? 'hosts' : kind === 'coordinator' ? 'coordinator' : kind === 'supplier' ? 'suppliers' : 'helpers';
}

/**
 * The words `removeHost` can bring back to People with access — anything else in the address is not ours, so a
 * hand-edited link cannot print its own message on the section. ONE copy for both places the section is drawn (Event
 * Details and Home's ⚙ Event Settings sheet, owner 2026-10-30).
 */
const REMOVE_REFUSALS = new Set([
  'You cannot remove yourself.',
  'A celebrant stays a co-host. A celebrant can change their role first.',
  'Could not remove them. Try again.',
]);

/** The section's one flash line from the address it landed on — or null. */
export function accessFlashFrom(q: { host_removed?: unknown; invite_error?: unknown } | null | undefined): string | null {
  if (!q) return null;
  if (q.host_removed === '1') return 'Removed — their access ended immediately.';
  return typeof q.invite_error === 'string' && REMOVE_REFUSALS.has(q.invite_error) ? q.invite_error : null;
}

/** What the Event access fold says when its read FAILED — never a zero. */
export const ACCESS_SUMMARY_FAILED = 'Couldn’t load';

/**
 * The Event access fold's one line, from the real rows: "2 hosts · 1
 * coordinator · 1 helper · 12 suppliers". `null` = the read FAILED →
 * "Couldn’t load", never "0 hosts". A group with nobody in it is left out of
 * the line, not counted as 0.
 */
export function accessFoldSummary(rows: readonly PersonRow[] | null): string {
  if (rows === null) return ACCESS_SUMMARY_FAILED;
  const parts: string[] = [];
  for (const g of ACCESS_GROUPS) {
    const n = rows.filter((r) => accessGroupOf(r.kind) === g.key).length;
    if (n > 0) parts.push(`${n} ${n === 1 ? g.one : g.many}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Just you';
}

/**
 * 🏷 BOOKED SUPPLIERS — said once under the heading (owner 2026-10-07: *"Booked
 * Vendor Access? is defined depending on the category they provide for your
 * event"*). The category → access matrix lives in the corpus
 * (`03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md` § 7) and in
 * scattered SQL gates (`get_vendor_event_brief`'s food-relevant check, the
 * `*_booked_vendor_*` policies) — there is NO single map in code to render a
 * per-row list from, and suppliers hold no `moderator_area_level` row, so the
 * row shows its category only and nothing here is a switch.
 */
export const SUPPLIERS_BY_CATEGORY = 'What each booked supplier sees is set by their category. There is nothing to switch here.';

/**
 * Why Event Hub is a toggle you cannot move — the truth `areaChoices` already
 * holds (null = nothing asks the database for this area yet, so a live toggle
 * would be a switch wired to nothing). Mood Board left this list on 2026-10-30:
 * the hosts set it to Edit or View per person.
 */
export const FIXED_AREA_WHY = 'Every helper can view this for now. A per-person setting is not built yet, so it cannot be switched.';

/**
 * 🔀 THE COORDINATOR'S ONE SWITCH (owner 2026-10-07: *"Coordinator Access is
 * Same as User Host of the event. so toggle is just yes or no. Always auto
 * YES"* — *"On allows them to edit values inside and create schedules. Off only
 * provides them the initial information they received."*).
 *
 * Built on the SAME enforcement — the seat's per-area grant, written by
 * `setDelegateArea`, read by `moderator_area_level`. No new column:
 *   · ON  = every area the coordinator's default grant (`COORDINATOR_AREAS`)
 *     puts at Edit and a host can set — Guest list · Seat plan · The Day ·
 *     Suppliers — at Edit. That IS the default every coordinator seat is
 *     created with (`hosts/actions.ts`, `lib/coordinator-grant.ts`), so the
 *     switch is YES from the start with no write.
 *   · OFF = every area a host can set → Off. What they received as a booked
 *     supplier (their brief, their thread) is a different door and stays.
 * Budget stays View at most (locked D1) and Photos stays "only upon approval"
 * (owner 2026-08-06): ON never raises them.
 */
export const COORDINATOR_ON_AREAS: readonly DelegateArea[] = DELEGATE_AREAS.filter(
  (a) => COORDINATOR_AREAS[a] === 'edit' && (areaChoices(a)?.includes('edit') ?? false),
);

export const COORDINATOR_SWITCH_LABEL = 'Same access as you';
export const COORDINATOR_SWITCH_WHY = 'On — can change details and build the schedule. Off — sees only what you first shared.';

/** The switch's state, read from the grant the database enforces. */
export function coordinatorHasHostAccess(cells: readonly AreaCell[] | null): boolean {
  if (!cells) return false;
  return COORDINATOR_ON_AREAS.every((a) => cells.find((c) => c.area === a)?.choice === 'edit');
}

/** The per-area writes one flip makes — each through `setDelegateArea`. */
export function coordinatorSwitchWrites(cells: readonly AreaCell[], on: boolean): Array<{ area: DelegateArea; choice: AreaChoice }> {
  // OFF takes every settable area to its LOWEST level — Off where the area has one, else View (Mood Board has no Off:
  // every delegate reads the board). Writing 'off' to an area that cannot take it would be refused, and the refusal
  // would put the whole switch back.
  const lowest = (c: AreaCell): AreaChoice | null =>
    !c.choices ? null : c.choices.includes('off') ? 'off' : c.choices.includes('view') ? 'view' : null;
  const want = (c: AreaCell): AreaChoice | null =>
    on ? (COORDINATOR_ON_AREAS.includes(c.area) ? 'edit' : null) : lowest(c);
  return cells.flatMap((c) => {
    const next = want(c);
    return next && next !== c.choice ? [{ area: c.area, choice: next }] : [];
  });
}

/**
 * THE THREE POSITIONS of a helper's per-area toggle, in the owner's order
 * (2026-10-07: *"3 way toggle Edit - OFF - View"*) — Off in the middle.
 */
export const AREA_TOGGLE_ORDER: readonly AreaChoice[] = ['edit', 'off', 'view'];

/**
 * 🪪 YOUR ACCESS — what a HELPER sees of their own seat, first in Home's ⚙ Event Settings (owner 2026-10-31, DECISION_LOG
 * "A HELPER SEES THEIR OWN ACCESS AS THE FIRST ROW OF HOME ⚙ EVENT SETTINGS": *"Yes"* — their role and what they can
 * open, read-only). Built from the SAME parts the hosts' rows above are: the role is the word the hosts see on that
 * person's row (`Coordinator` for the hired planner's seat, else `seatAccessWord` — "Limited helper"), each area is
 * `areaCells` over the grant the database enforces (`moderator_area_level`), the last day is `delegateAccessLastDay`.
 * Nothing here is a second rule — it only arranges the helper's own row for the helper.
 */
export type OwnAccess = {
  /** The hosts' word for this seat — "Coordinator · Limited" · "Coordinator" · "Limited helper". */
  roleWord: string;
  /** One cell per area, as the hosts' row draws it — read-only here. */
  areas: AreaCell[];
  /** The last day the seat opens anything (`YYYY-MM-DD`), or null (no day-precise date yet). */
  lastDay: string | null;
};

/** A last day of access as the section says it — "Dec 25, 2026" (the hosts' rows and Your access alike). */
export function accessDayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** The words under "Your access" — the one visible line is the role (+ until when); the rest is the ⓘ. */
export const OWN_ACCESS_TIP =
  'The hosts decide what you can open: View lets you see a part, Edit lets you change it, Off keeps it closed. Only the hosts can change this.';

export function ownAccessOf(input: {
  roleSubtype: string | null;
  /** The seat's grant, already inside its window (`fetchEventViewer` → `delegatePermissions`). */
  permissions: ModeratorPermissions | null;
  window: EventWindowInput;
}): OwnAccess {
  const { roleSubtype, permissions, window: w } = input;
  const level = roleSubtype === PLANNER_ROLE ? levelOf({ permissions_json: permissions as LevelledPermissions | null }) : null;
  const roleWord =
    roleSubtype === PLANNER_ROLE
      ? level
        ? `Coordinator · ${LEVEL_WORD[level]}`
        : 'Coordinator'
      : roleSubtype && seatIsFullCohost(roleSubtype)
        ? 'Co-host'
        : ACCESS_LEVEL_LABEL.limited_helper;
  return {
    roleWord,
    areas: areaCells(permissions),
    lastDay: delegateAccessLastDay({ isCouple: false, eventDate: w.eventDate, eventEndDate: w.eventEndDate, precision: w.precision }),
  };
}

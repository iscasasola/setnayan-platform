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
    rows.push({
      key: `host:${h.userId}`,
      kind: 'co_host',
      name: h.name,
      // The creator is the Host; everyone else here is a Co-host (owner 2026-10-04).
      roleWord: h.isCreator ? CREATOR_WORD : 'Co-host',
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

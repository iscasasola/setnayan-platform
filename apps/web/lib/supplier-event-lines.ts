/**
 * supplier-event-lines.ts — WHAT A SUPPLIER READS WHEN AN EVENT ROW OPENS (supplier dashboard v13, APPROVED 2026-10-29).
 *
 * Owner, on the final check, verbatim:
 *   · *"for inquiries. we can say what service they are requesting for. and we can show what services they also have
 *     that are on the categories added by the event."* ⇒ the inquiry NAMES the service asked for; "You also offer" =
 *     this shop's OTHER services, only in categories the event already added — and only while the inquiry is open
 *     (controller call 3: never after Decline).
 *   · *"where is the expand look of these rows?"* ⇒ every Today row and every Customers › Events row opens to the same
 *     fixed lines: Event type · Celebrant · Hosted by (the one who asked marked "Asked you") · Location · Date ·
 *     Est. pax · Service requested · (You also offer) · For your service · Also booked.
 *
 * The SAME lines on Today's inquiry row, on the Events row and on the card at the top of the chat — one shape, drawn by
 * one component (`app/vendor-dashboard/_components/event-lines.tsx`), read by one batched read
 * (`supplier-event-lines.server.ts`). This file is the pure half: the decisions a unit test can run.
 *
 * 🔴 HONEST READS: a line whose read was refused says it could not load (`null`), never an empty list that reads as
 * "nobody hosts this" or "nothing was asked". An event with no venue says "Not set yet", which is true.
 */
import { familiesForServices, type DayOfFamily } from '@/lib/vendor-dayof-modules';
import { tilesForVendorCategories } from '@/lib/vendor-category-taxonomy';
import { guestRoleLabel, ROLE_LABELS, type GuestRole } from '@/lib/guests';
import { isHonoreeRole } from '@/lib/role-groups';
import type { RoleNames } from '@/lib/role-names';

/** Where the event stands with THIS shop (the roster's lanes, folded to the four words a row says). */
export type EventStage = 'asking' | 'talking' | 'booked' | 'done';

export type EventLineHost = {
  name: string;
  /** This host first messaged the shop — the main contact (prototype "Asked you"). */
  askedYou: boolean;
  /**
   * Who they are to the event — "Bride" · "Groom" · "Co-host" · "Host" · "Coordinator" (owner 2026-10-29: "Hosted by:
   * (all hosts + coordinator if there is booked already)", each "with their role"). Null = not known, and nothing is
   * drawn for it — never a guessed role. Absent when the caller read no roles.
   */
  role?: string | null;
};

/** A host seat's kind (`event_moderators.role_subtype`, the full co-host kinds) in the row's words. */
const SEAT_ROLE_WORD: Readonly<Record<string, string>> = {
  co_host: 'Co-host',
  host: 'Co-host',
  bride: 'Bride',
  groom: 'Groom',
  partner1: 'Partner',
  partner2: 'Partner',
  celebrant: 'Celebrant',
};

/**
 * One host's role word. Who they are celebrated as wins (their guest-list role when it is the honoree's — Bride, Groom,
 * Celebrant, in the couple's own word for it when they renamed it); then the seat they hold (Co-host); then "Host" for
 * the one who made the event. Otherwise null — said as nothing, never invented.
 */
export function hostRoleWord(input: {
  guestRole: string | null;
  seatKind: string | null;
  madeIt: boolean;
  /** The event's own role words (`events.role_names`), sanitised. */
  names?: RoleNames | null;
}): string | null {
  const g = input.guestRole as GuestRole | null;
  if (g && g in ROLE_LABELS && isHonoreeRole(g)) return guestRoleLabel(g, input.names ?? null);
  const seat = input.seatKind ? SEAT_ROLE_WORD[input.seatKind] : undefined;
  if (seat) return seat;
  return input.madeIt ? 'Host' : null;
}

export type EventLineService = { name: string };

export type EventLineOffer = {
  serviceId: string;
  name: string;
  /** "from ₱25,000" when the card states a price, else null — never a price the shop did not write. */
  from: string | null;
};

export type EventLineDoor = {
  key: string;
  label: string;
  /** What opening it gives — "view only", "opens once they book you". */
  line: string;
  href: string;
};

export type EventLines = {
  eventId: string;
  threadId: string | null;
  stage: EventStage;
  /** False when the event row itself could not be read — every fact line then says so. */
  read: boolean;
  /** "Debut" — null when the event has no type. */
  type: string | null;
  /** The event's own name ("Kat Arroyo", "Indalecio & Claire"). */
  celebrant: string | null;
  /** The venue, or null when they have not set one ("Not set yet"). */
  location: string | null;
  /** "February 14, 2027", or null when no date is set. */
  date: string | null;
  /** The count they asked with (or now plan for), else the event's estimate; null when neither is set. */
  pax: number | null;
  /** Everyone hosting it, the one who asked first. Null = the read was refused (said, never "nobody"). */
  hosts: EventLineHost[] | null;
  /** What they asked THIS shop for. Null = the read was refused. */
  requested: EventLineService[] | null;
  /** This shop's other services in categories the event already added — only while asking. */
  alsoOffer: EventLineOffer[];
  /** Other suppliers the event has booked — names and services, never prices. Null = refused. */
  alsoBooked: Array<{ name: string; service: string }> | null;
  /** The event's own pages for this shop's service (mood board, seat plan, production sheet, run of show). */
  forYou: EventLineDoor[];
  /** A returning customer's EARLIER event with this shop — "Their 2nd event · see their first". */
  firstEvent: { title: string; href: string } | null;
};

/**
 * The hosts in the order the row lists them: the one who asked first, then the rest as the event lists them. With
 * `roleOf` (user → role word, for THIS event) each carries its role.
 */
export function hostsInOrder(
  memberIds: readonly string[],
  askedBy: string | null,
  nameOf: ReadonlyMap<string, string>,
  roleOf?: ReadonlyMap<string, string | null>,
): EventLineHost[] {
  const ids = [...new Set(askedBy && !memberIds.includes(askedBy) ? [askedBy, ...memberIds] : memberIds)];
  const out: EventLineHost[] = [];
  for (const id of ids) {
    const name = nameOf.get(id)?.trim();
    if (!name) continue;
    out.push(roleOf ? { name, askedYou: id === askedBy, role: roleOf.get(id) ?? null } : { name, askedYou: id === askedBy });
  }
  return out.sort((a, b) => Number(b.askedYou) - Number(a.askedYou));
}

/**
 * "You also offer" — this shop's OTHER live services whose category the event has ALREADY added to its plan. Never the
 * whole list, never a service they already asked for, and nothing once the ask is answered (owner note 1; controller
 * call 3). Both vocabularies (legacy category / canonical tile) are folded through the ONE taxonomy table.
 */
export function alsoOfferFrom(input: {
  stage: EventStage;
  services: ReadonlyArray<{ id: string; name: string; category: string | null; fromPhp: number | null }>;
  requestedIds: ReadonlySet<string>;
  eventCategories: readonly string[];
}): EventLineOffer[] {
  if (input.stage !== 'asking') return [];
  const eventTiles = new Set(tilesForVendorCategories(input.eventCategories.filter(Boolean)) ?? []);
  if (eventTiles.size === 0) return [];
  const out: EventLineOffer[] = [];
  for (const s of input.services) {
    if (input.requestedIds.has(s.id) || !s.category) continue;
    const tiles = tilesForVendorCategories([s.category]) ?? [];
    if (!tiles.some((t) => eventTiles.has(t))) continue;
    out.push({
      serviceId: s.id,
      name: s.name,
      from: s.fromPhp && s.fromPhp > 0 ? `from ₱${Math.round(s.fromPhp).toLocaleString('en-PH')}` : null,
    });
  }
  return out;
}

/** Which of the event's pages serve a shop in each family (prototype `forYou`: a stylist the mood board, a caterer the
 *  production sheet, a coordinator the seat plan and the run of show). */
const FAMILY_PAGES: Record<DayOfFamily, ReadonlyArray<'mood' | 'seats' | 'sheet' | 'run'>> = {
  coordinate: ['seats', 'run'],
  setup: ['mood'],
  capture: ['mood', 'run'],
  serve: ['sheet'],
  perform: ['run'],
};

/**
 * "For your service" — the event's own pages for what this shop does there, each a door to the SHIPPED page
 * (`vendor-dashboard/clients/[eventId]/*`). View only: those pages are read-only for a supplier, and the seat plan and
 * the production sheet open only once the event has booked the shop (their own pages say the same). The event card
 * is always there.
 */
export function forYourServicePages(input: {
  eventId: string;
  stage: EventStage;
  /** The shop's own services (canonical tiles, `vendor_profiles.services`). */
  shopServices: readonly string[] | null;
  /** The tiles this event asked the shop for — narrows a many-service shop to what it does HERE. */
  eventTiles: readonly string[] | null;
}): EventLineDoor[] {
  const booked = input.stage === 'booked' || input.stage === 'done';
  const families = familiesForServices(input.shopServices, input.eventTiles);
  const want = new Set<string>();
  for (const f of families) for (const p of FAMILY_PAGES[f]) want.add(p);
  const id = input.eventId;
  const out: EventLineDoor[] = [];
  if (want.has('mood')) {
    const href = `/vendor-dashboard/clients/${id}/mood-board`;
    out.push({ key: 'mood', label: 'Mood board', line: 'Their palette and saved looks · view only', href });
  }
  if (want.has('seats')) {
    const href = `/vendor-dashboard/clients/${id}/seat-plan`;
    out.push({ key: 'seats', label: 'Seat plan', line: booked ? 'Their floor plan · view only' : 'Opens once they book you', href });
  }
  if (want.has('run')) {
    const href = `/vendor-dashboard/clients/${id}?tab=schedule`;
    out.push({ key: 'run', label: 'Run of show', line: 'Their day, hour by hour · view only', href });
  }
  if (want.has('sheet')) {
    const href = `/vendor-dashboard/clients/${id}/production-sheet`;
    out.push({ key: 'sheet', label: 'Production sheet', line: booked ? 'Meals and headcount per part · view only' : 'Opens once they book you', href });
  }
  const card = `/vendor-dashboard/clients/${id}?tab=details`;
  out.push({ key: 'card', label: 'Their event card', line: 'Notes, files, quote and payments', href: card });
  return out;
}

/** The four words a row says, from the roster's lanes. */
export function stageOfLane(lane: string): EventStage {
  if (lane === 'waiting') return 'asking';
  if (lane === 'booked') return 'booked';
  if (lane === 'finished') return 'done';
  return 'talking';
}

/**
 * "Sun, Feb 14, 2027" — the day a supplier plans around; "Feb 2027" / "2027" when the event has only a month or a year
 * (`event_date_precision` — a month-only date is stored on the 1st, and naming that day would be invented). Null when
 * none is set.
 */
export function eventDayWords(iso: string | null, precision: string | null = null): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  if (precision === 'year') return m[1]!;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (precision === 'month') return d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
  return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

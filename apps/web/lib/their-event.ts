/**
 * lib/their-event.ts — 🚪 "THEIR EVENT": what a booked supplier (not the coordinator) opens of the hosts' event, as a
 * short list of links to only their parts (owner 2026-11-21, DECISION_LOG "'THEIR EVENT' DOOR SHAPE + SCHEDULE RULE" —
 * verbatim *"Coordinators see the dashboard · Suppliers see lists of links for different parts of the dashboard."* —
 * "WHAT EACH BOOKED SUPPLIER OPENS BY DEFAULT", "THE EVENT'S MONOGRAM IS AN EASY DOWNLOAD", "'YES TO ALL'" (1) and (5);
 * drawing `prototypes/their_event_door_2026-11-21/their_event_door_fable.html`, "Default links per trade").
 *
 * PURE — the trade table, the cap, and the rows. It GRANTS NOTHING: each row opens a page whose own server gate decides
 * (the brief RPC, `get_vendor_seat_plan`'s floor list, `get_vendor_mood_board`, `supplier_booking_group`). A row this
 * file draws for a part the server would refuse is a bug — `their-event.test.ts` holds the table to the gates.
 *
 * 🏷 ONE SET OF NAMES (controller call (6), 21 Nov): the hosts' dashboard tab names — Guests · Seats · Schedule · Mood
 * Board · Logo · Hub · Numbers — never "Guest list", "Seat plan", "The Day".
 */
import { SEAT_PLAN_CATEGORIES } from './supplier-access-by-category';
import type { AreaLevel, DelegateArea } from './delegate-areas';

/** The parts a booked supplier can be given. Closed set. Never Budget, Payments or Memories (the cap). */
export type TheirEventPart = 'schedule' | 'logo' | 'numbers' | 'guests' | 'seats' | 'mood_board' | 'hub';

export const THEIR_EVENT_PART_NAME: Readonly<Record<TheirEventPart, string>> = {
  schedule: 'Schedule',
  logo: 'Logo',
  numbers: 'Numbers',
  guests: 'Guests',
  seats: 'Seats',
  mood_board: 'Mood Board',
  hub: 'Hub',
};

/** The order the list draws in — everybody's three first (drawing: "Same first three links as everybody"). */
export const THEIR_EVENT_ORDER: readonly TheirEventPart[] = ['schedule', 'logo', 'numbers', 'guests', 'seats', 'mood_board', 'hub'];

/** Everybody: the Schedule (view all, edit their own items), the Logo (plain download), Numbers (view). */
export const EVERYBODY_PARTS: readonly TheirEventPart[] = ['schedule', 'logo', 'numbers'];

export type Trade =
  | 'caterer'
  | 'venue'
  | 'stylist'
  | 'hair_makeup'
  | 'florist_decor_lights'
  | 'photo_video'
  | 'program'
  | 'invitations'
  | 'nothing_extra';

/** Each trade's own parts, on top of {@link EVERYBODY_PARTS} — the owner's table, with "YES TO ALL" (5) folded in. */
export const TRADE_PARTS: Readonly<Record<Trade, readonly TheirEventPart[]>> = {
  caterer: ['guests', 'seats'],
  venue: ['guests', 'seats', 'mood_board'],
  stylist: ['mood_board', 'guests', 'seats'],
  hair_makeup: ['guests'],
  florist_decor_lights: ['mood_board', 'seats'],
  photo_video: ['mood_board', 'guests'],
  // Emcee, band, DJ: the Schedule's script & songs — in the Schedule they already hold; nothing else.
  program: [],
  invitations: ['guests', 'hub'],
  nothing_extra: [],
};

/** The leaf service keys that make a decor shop a STYLIST (the trade the owner names apart from decor). */
const STYLIST_SERVICES: ReadonlySet<string> = new Set(['stylist_decorator', 'event_stylist', 'wedding_stylist']);

const TRADE_OF_CATEGORY: Readonly<Record<string, Trade>> = {
  catering: 'caterer',
  crew_meals: 'caterer',
  venue: 'venue',
  religious_venue: 'venue',
  makeup_artist: 'hair_makeup',
  hair_stylist: 'hair_makeup',
  florist: 'florist_decor_lights',
  reception_decor: 'florist_decor_lights',
  lights_and_sound: 'florist_decor_lights',
  photographer: 'photo_video',
  videographer: 'photo_video',
  host_emcee: 'program',
  band_dj: 'program',
  string_quartet: 'program',
  choir: 'program',
  invitations_stationery: 'invitations',
};

/** The supplier's trade, from the booked row's category (and the shop's leaf services, for the stylist). */
export function tradeOf(category: string | null | undefined, services?: readonly string[] | null): Trade {
  if ((services ?? []).some((s) => STYLIST_SERVICES.has(s))) return 'stylist';
  return TRADE_OF_CATEGORY[category ?? ''] ?? 'nothing_extra';
}

/** The trade's default parts, in the list's order. */
export function defaultParts(trade: Trade): TheirEventPart[] {
  const want = new Set<TheirEventPart>([...EVERYBODY_PARTS, ...TRADE_PARTS[trade]]);
  return THEIR_EVENT_ORDER.filter((p) => want.has(p));
}

/** The delegate areas a supplier seat may hold and the part each opens. */
const PART_OF_AREA: Readonly<Partial<Record<DelegateArea, TheirEventPart>>> = {
  guest_list: 'guests',
  seat_plan: 'seats',
  schedule: 'schedule',
  mood_board: 'mood_board',
  invitations: 'hub',
};

/**
 * 🔒 THE CAP (controller call (3), 21 Nov — *"a non-coordinator supplier can never be granted more than a
 * coordinator — no Payments, no Memories/Photos, Budget at most View"*). What a supplier's seat may hold on one area,
 * whatever was written on it. The SQL twin is the supplier branch of `moderator_area_level` (migration
 * 20271357500000-series `the_their_event_door`); where they differ the database wins.
 */
export function supplierAreaCap(area: DelegateArea, level: AreaLevel): AreaLevel {
  if (area === 'payments' || area === 'photos') return null;
  if (area === 'budget') return level === null ? null : 'view';
  return level;
}

export type TheirEventRow = {
  part: TheirEventPart;
  name: string;
  /** The grey line under the name ("See all · edit your items", "19 tables"). */
  line: string;
  /** The trailing word: "View" · "Yours: edit" · "Propose" · "Download". */
  trail: string;
  /** Where the tap goes — a part's own page, or the Logo's file. Null = said, not a link (e.g. no group yet). */
  href: string | null;
  /** The Logo is a file, not a page. */
  download?: boolean;
};

export type TheirEventInput = {
  eventId: string;
  category: string | null;
  services?: readonly string[] | null;
  /** The supplier seat's areas, as the hosts granted them (may add parts beyond the trade's defaults). */
  grants: Partial<Record<DelegateArea, AreaLevel>>;
  /** The Logo as a downloadable file (a data: URI of the event's monogram), or null when the event has none. */
  logoHref: string | null;
  /** `brief.seat_plan.table_count`. */
  tables: number | null;
  /** The booking group's label and live count, or null when this booking has none yet. */
  group: { label: string; count: number } | null;
  /** The group is not this person's to read (`supplier_booking_group` → `not_your_client`) — said, never "not filled". */
  groupNotYours?: boolean;
};

/**
 * 🔒 The booking's group has three readers (owner 2026-08-27; controller ruling 22 Nov 2026): the shop's owner, a Shop
 * Manager, and the person who handles this client. Anybody else on the team is told so — in the list and on the page.
 */
export const GROUP_NOT_YOURS_LINE = 'One group · open to whoever handles this client';
export const GROUP_NOT_YOURS = 'This group opens for the shop’s owner, a Shop Manager and the person who handles this client.';

/** The base of every part page — the supplier's customer page for this event. */
export const theirEventPartHref = (eventId: string, part: TheirEventPart): string => {
  const base = `/vendor-dashboard/clients/${eventId}`;
  switch (part) {
    case 'seats':
      return `${base}/seat-plan?door=their-event`;
    case 'mood_board':
      return `${base}/mood-board?door=their-event`;
    default:
      return `${base}/their-event/${part}`;
  }
};

/** Where "Ask for access to more" goes — the shipped Ask the host for access, on the customer page. */
export const askForMoreHref = (eventId: string): string => `/vendor-dashboard/clients/${eventId}#ask-access`;
export const ASK_FOR_MORE = 'Ask for access to more';

/**
 * The rows, in order: the trade's defaults plus any part the hosts added through the seat, each said truthfully. The
 * seat-plan floor list is the server's gate — a trade default the RPC refuses for this category is left out, never
 * drawn as a door that says no.
 */
export function theirEventRows(i: TheirEventInput): TheirEventRow[] {
  const parts = new Set<TheirEventPart>(defaultParts(tradeOf(i.category, i.services)));
  for (const [area, level] of Object.entries(i.grants) as Array<[DelegateArea, AreaLevel]>) {
    const part = PART_OF_AREA[area];
    if (part && supplierAreaCap(area, level ?? null) !== null) parts.add(part);
  }
  if (!(SEAT_PLAN_CATEGORIES as readonly string[]).includes(i.category ?? '')) parts.delete('seats');
  const proposes = (area: DelegateArea) => i.grants[area] === 'edit';
  const rows: TheirEventRow[] = [];
  for (const part of THEIR_EVENT_ORDER) {
    if (!parts.has(part)) continue;
    const name = THEIR_EVENT_PART_NAME[part];
    const href = theirEventPartHref(i.eventId, part);
    switch (part) {
      case 'schedule':
        rows.push({ part, name, line: 'See all · edit your items', trail: 'Yours: edit', href });
        break;
      case 'logo':
        if (i.logoHref) rows.push({ part, name, line: 'Download · always there', trail: 'Download', href: i.logoHref, download: true });
        else rows.push({ part, name, line: 'The hosts have not made one yet', trail: '', href: null });
        break;
      case 'numbers':
        rows.push({ part, name, line: 'Headcount and packs', trail: 'View', href });
        break;
      case 'guests':
        rows.push(
          i.group
            ? { part, name, line: `One group · ${i.group.label}`, trail: proposes('guest_list') ? 'Propose' : 'View', href }
            : { part, name, line: i.groupNotYours ? GROUP_NOT_YOURS_LINE : 'One group · the hosts have not filled it yet', trail: '', href: null },
        );
        break;
      case 'seats':
        rows.push({ part, name, line: i.tables ? `${i.tables} ${i.tables === 1 ? 'table' : 'tables'}` : 'The seat plan', trail: proposes('seat_plan') ? 'Propose' : 'View', href });
        break;
      case 'mood_board':
        rows.push({ part, name, line: 'The look of the day', trail: proposes('mood_board') ? 'Propose' : 'View', href });
        break;
      case 'hub':
        rows.push({ part, name, line: 'What the guests see', trail: 'View', href });
        break;
    }
  }
  return rows;
}

/** "Their event · Claire & Indalecio" — the one line on top of every part (drawing: "Their event · name · ✕ Close"). */
export function theirEventLine(eventName: string | null | undefined): string {
  const n = eventName?.trim();
  return n ? `Their event · ${n}` : 'Their event';
}

/**
 * 🧮 THE BOOKING GROUP'S DRIFT ("YES TO ALL" (1): *"a drift from the booked count is shown to both sides and never
 * changes the price by itself"*). Words only — the price is the quote's.
 */
export function groupDriftWords(live: number, booked: number | null): string | null {
  if (booked === null || !Number.isFinite(booked)) return null;
  const d = live - booked;
  if (d === 0) return `Matches the ${booked} booked.`;
  const n = Math.abs(d);
  return `${n} ${d > 0 ? 'more' : 'fewer'} than the ${booked} booked. The price changes only through the quote.`;
}

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
  /**
   * WHO THE EVENT IS FOR — never the event's name (Build 5 F3, owner screenshot 2026-11-10: the row read the event's
   * name "TEST SetnaProd walk" as its Celebrant). `eventCelebrantWords`: the guest-list honorees, else the celebrant the
   * onboarding asked for. Null = nobody is named ("Not named yet").
   */
  celebrant: string | null;
  /** The venue, or null when they have not set one ("Not set yet"). */
  location: string | null;
  /** "February 14, 2027", or null when no date is set. */
  date: string | null;
  /** The count they asked with (or now plan for), else the event's estimate; null when neither is set. */
  pax: number | null;
  /** 👥 RW-08: this shop's claimed per-guest booking, as the couple reads it — its total now (null when unreadable) and
   *  the guests it bills. Absent/null = not such a booking: the card says "Est. pax" as shipped. */
  perGuest?: { totalPhp: number | null; guests: number } | null;
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

/** What "Hosted by" calls a host whose account has no name yet — the word `hostFirstName` falls back to in the chat. */
export const UNNAMED_HOST = 'Host';

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
    /*
      👤 A HOST WITH NO NAME IS STILL A HOST (walk 13 Nov 2026: a brand-new couple account — no display or first name
      yet — asked a supplier, and "Hosted by" said "No host has joined on Setnayan yet."). They are listed as "Host",
      with their role and "Asked you"; the role is not said twice when it is that same word.
    */
    const name = nameOf.get(id)?.trim() || UNNAMED_HOST;
    const role = roleOf ? (roleOf.get(id) ?? null) : undefined;
    out.push(
      roleOf
        ? { name, askedYou: id === askedBy, role: name === UNNAMED_HOST && role === UNNAMED_HOST ? null : (role ?? null) }
        : { name, askedYou: id === askedBy },
    );
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

/** "Ana" · "Ana & Ben" · "Ana, Ben & Cara" — names in the order given, said the way a person reads them. */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/**
 * 🎂 THE CELEBRANT LINE (Build 5 F3 — owner screenshot 2026-11-10 + Lane W walk 2 item 2: the CELEBRANT row showed the
 * event's NAME, `celebrant: ev.display_name`). Who the day is FOR, in the product's one order:
 *
 *   1 · the guest-list honorees — rows whose MAIN role is celebrant · bride · groom (`lib/event-celebrants.server.ts`,
 *       "WHO IS A CELEBRANT — ONE RULE ACROSS THE PRODUCT"): a wedding's bride and groom, a birthday's celebrant row;
 *   2 · the celebrant the onboarding ASKED (`events.signature_details.celebrant_name`, or `celebrant_names` for an
 *       anniversary) — the walk's birthday had only this ("Ice Casasola", prefilled "for you");
 *   3 · the create step's honoree first name (`events.honoree_label`).
 *
 * None of them → null, drawn "Not named yet". 🔴 NEVER the event's display name — that is the TITLE ("the title keeps
 * the event name"), and a title is not a person.
 */
export function eventCelebrantWords(input: {
  honorees: ReadonlyArray<{ name: string | null }>;
  signatureDetails: unknown;
  honoreeLabel: string | null;
}): string | null {
  const fromList = [...new Set(input.honorees.map((h) => (h.name ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean))];
  if (fromList.length > 0) return joinNames(fromList);
  const sig = input.signatureDetails && typeof input.signatureDetails === 'object' ? (input.signatureDetails as Record<string, unknown>) : null;
  for (const key of ['celebrant_name', 'celebrant_names']) {
    const v = sig?.[key];
    if (typeof v === 'string' && v.trim()) return v.replace(/\s+/g, ' ').trim();
  }
  return (input.honoreeLabel ?? '').replace(/\s+/g, ' ').trim() || null;
}

/** One `thread_service_interests` row, as the requested line reads it. */
export type AskedInterest = {
  vendor_service_id: string | null;
  category_key: string | null;
  source: string;
  status: string | null;
};

/**
 * 📋 "SERVICE REQUESTED" — EVERY SERVICE THE COUPLE ASKED (Build 5 F3, owner screenshot 2026-11-10: an inquiry for
 * Mobile bar + Photo booth showed the supplier Mobile bar only). The plan row (`event_vendors`) carries the ask's
 * ANCHOR only; every other service the couple picked lives on the thread (`thread_service_interests`, written by
 * `startServiceInquiry` as `initial` + `couple_added`). So the line is the union, in the order they were asked:
 *
 *   · the plan row's cards (`service_id` · `requested_service_ids`);
 *   · each interest the COUPLE made (`initial`, `couple_added`; a `withdrawn` one is not asked any more) — a card by its
 *     name, a card-less service by its taxonomy name. A key a listed card already carries is that card, not a second
 *     line. `linked` (rides along inside a price) and `vendor_offered` (the shop's own offer) are not the couple's ask;
 *   · nothing from either → the plan row's categories, as before.
 *
 * `askedIds` also counts a live card whose kind was asked by key, so "You also offer" never offers back what they asked.
 */
export function requestedServices(input: {
  plan: ReadonlyArray<{ service_id: string | null; requested_service_ids: readonly string[] | null; category: string | null }>;
  interests: readonly AskedInterest[];
  services: ReadonlyArray<{ id: string; name: string; category: string | null }>;
  labelOf: (key: string) => string;
}): { requested: EventLineService[]; askedIds: Set<string> } {
  const byId = new Map(input.services.map((s) => [s.id, s]));
  const askedIds = new Set<string>();
  for (const r of input.plan) {
    if (r.service_id) askedIds.add(r.service_id);
    for (const s of r.requested_service_ids ?? []) askedIds.add(s);
  }
  const askedKeys: string[] = [];
  for (const i of input.interests) {
    if (i.source !== 'initial' && i.source !== 'couple_added') continue;
    if (i.status === 'withdrawn') continue;
    if (i.vendor_service_id) askedIds.add(i.vendor_service_id);
    else if (i.category_key?.trim()) askedKeys.push(i.category_key.trim());
  }
  const out: EventLineService[] = [];
  const said = new Set<string>();
  const say = (name: string) => {
    const k = name.trim().toLowerCase();
    if (!k || said.has(k)) return;
    said.add(k);
    out.push({ name: name.trim() });
  };
  const carried = new Set<string>();
  for (const id of askedIds) {
    const s = byId.get(id);
    if (s?.category) carried.add(s.category);
    say(s?.name ?? 'A service you no longer list');
  }
  for (const key of askedKeys) {
    if (carried.has(key)) continue;
    say(input.labelOf(key));
    for (const s of input.services) if (s.category === key) askedIds.add(s.id);
  }
  if (out.length === 0) {
    for (const c of input.plan.map((r) => r.category).filter((c): c is string => Boolean(c))) say(input.labelOf(c));
  }
  return { requested: out, askedIds };
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

/**
 * ⇅ THE CLIENTS LIST'S "SHOW & SORT" — what the sheet's rows mean (v113 Show & sort; spec §9 #7, owner 2026-11-08):
 * Show · Service ▾ · Status · Client · Handled by, then Group by (Day / Status / Handled by) and Sort.
 *
 * PURE. Two kinds of choice:
 *   · SHOW is a list the page already drew (a tile's, Done's, Overdue's, Unread's) — picking it shows that list IN
 *     PLACE, no request (`CustomersPin`).
 *   · Service · Status · Client · Handled by · Group by · Sort narrow and order the WHOLE roster before it is paged, so
 *     they ride the address (`?svc=&st=&client=&who=&group=&sort=`) — the one read the page already makes, applied to
 *     every event, never just to the page on screen.
 *
 * 👥 HANDLED BY is the shop's OWN assignment, never a guess: an event is handled by the seats assigned to the service it
 * booked (`event_vendors.service_id` → `vendor_service_agents`, the same pair `agent_customer_event_ids()` scopes an
 * agent's RLS by). An event with no booked service, or a service nobody is assigned to, is "Not given to a seat".
 * Owners and admins pick any seat; an agent sees only theirs (v113: "Your clients only").
 *
 * 🔒 customers/the-clients-list-is-v113.test.ts
 */
import { CUSTOMER_LANES, type CustomerLane, type PipelineCustomer } from '@/lib/vendor-customer-pipeline';

export const CLIENTS_SHOW = [
  { key: 'all', label: 'All' },
  { key: 'asking', label: 'Asked' },
  { key: 'booked', label: 'Booked' },
  { key: 'done', label: 'Done' },
  { key: 'schedules', label: 'Schedules' },
  { key: 'collect', label: 'To collect' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'unread', label: 'Unread' },
] as const;
export type ClientsShow = (typeof CLIENTS_SHOW)[number]['key'];

/** The lane words the rows wear (`LANE_BADGE`), so Status says what the badge says. */
export const CLIENTS_STATUS: readonly { key: CustomerLane; label: string }[] = [
  { key: 'waiting', label: 'Asking' },
  { key: 'holding', label: 'Holding' },
  { key: 'talking', label: 'Talking' },
  { key: 'booked', label: 'Booked' },
  { key: 'finished', label: 'Done' },
];

export const CLIENTS_GROUP = [
  { key: 'status', label: 'Status' },
  { key: 'day', label: 'Day' },
  { key: 'seat', label: 'Handled by' },
] as const;
export type ClientsGroup = (typeof CLIENTS_GROUP)[number]['key'];

export const CLIENTS_SORT = [
  { key: 'waiting', label: 'Waiting first' },
  { key: 'date', label: 'Event date' },
  { key: 'newest', label: 'Newest message' },
  { key: 'name', label: 'Name' },
] as const;
export type ClientsSort = (typeof CLIENTS_SORT)[number]['key'];

/** The pinned row hears a Show pick on this, and says what it shows on the other (`CustomersPin`). */
export const CLIENTS_SHOW_EVENT = 'customers:show';
export const CLIENTS_SHOWING_EVENT = 'customers:showing';

/** "Not given to a seat" — the Handled by value for an event no seat is assigned. */
export const NO_SEAT = 'none';

export type ClientsChoice = {
  svc: string | null;
  st: CustomerLane | null;
  client: string | null;
  /** 'me' · a seat's id · NO_SEAT · null = every seat. */
  who: string | null;
  group: ClientsGroup;
  sort: ClientsSort;
};

const one = (v: string | string[] | undefined): string => (typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? '') : '');

export function clientsChoiceOf(sp: Record<string, string | string[] | undefined>): ClientsChoice {
  const st = one(sp.st);
  const group = one(sp.group);
  const sort = one(sp.sort);
  return {
    svc: one(sp.svc) || null,
    st: (CUSTOMER_LANES as readonly string[]).includes(st) ? (st as CustomerLane) : null,
    client: one(sp.client) || null,
    who: one(sp.who) || null,
    group: CLIENTS_GROUP.some((g) => g.key === group) ? (group as ClientsGroup) : 'status',
    sort: CLIENTS_SORT.some((s) => s.key === sort) ? (sort as ClientsSort) : 'waiting',
  };
}

/** How many choices differ from the plain list ("· N applied"). An agent's own seat is not a choice they made. */
export function clientsChoiceApplied(c: ClientsChoice, agent: boolean): number {
  return [c.svc, c.st, c.client, agent ? null : c.who, c.group !== 'status' ? 1 : null, c.sort !== 'waiting' ? 1 : null].filter(
    (v) => v !== null,
  ).length;
}

/** The address's params for a choice — only what differs from the plain list. */
export function clientsChoiceParams(c: ClientsChoice): [string, string][] {
  const out: [string, string][] = [];
  if (c.svc) out.push(['svc', c.svc]);
  if (c.st) out.push(['st', c.st]);
  if (c.client) out.push(['client', c.client]);
  if (c.who) out.push(['who', c.who]);
  if (c.group !== 'status') out.push(['group', c.group]);
  if (c.sort !== 'waiting') out.push(['sort', c.sort]);
  return out;
}

export type ClientsContext = {
  /** The service an event booked (`event_vendors.service_id`), null when it booked none. */
  serviceOf: (eventId: string) => string | null;
  /** The seats assigned to that service. */
  seatsOf: (eventId: string) => readonly string[];
  /** The viewer's own seat (null = the shop's owner with no seat row). */
  meSeat: string | null;
  /** An agent sees only their own clients. */
  agent: boolean;
  /** The chat's last activity, for "Newest message". */
  lastActivity: (eventId: string) => string | null;
};

/** Whose seat a choice names — "me" resolved; an agent is always held to their own. */
function seatChosen(c: ClientsChoice, ctx: ClientsContext): string | null {
  if (ctx.agent) return ctx.meSeat ?? NO_SEAT;
  if (c.who === 'me') return ctx.meSeat ?? NO_SEAT;
  return c.who;
}

/** Narrow every event by Service · Status · Client · Handled by. */
export function narrowClients<R extends PipelineCustomer>(rows: readonly R[], c: ClientsChoice, ctx: ClientsContext): R[] {
  const seat = seatChosen(c, ctx);
  return rows.filter((r) => {
    if (c.svc && ctx.serviceOf(r.eventId) !== c.svc) return false;
    if (c.st && r.lane !== c.st) return false;
    if (c.client && r.eventId !== c.client) return false;
    if (seat) {
      const seats = ctx.seatsOf(r.eventId);
      if (seat === NO_SEAT ? seats.length > 0 : !seats.includes(seat)) return false;
    }
    return true;
  });
}

/** The heading a row sits under for a Group by (Status draws the shipped list — no headings of its own). */
export function groupKeyOf(
  group: ClientsGroup,
  ctx: Pick<ClientsContext, 'seatsOf'>,
  seatName: (id: string) => string,
): ((r: PipelineCustomer) => string) | null {
  if (group === 'day') return (r) => r.eventDate ?? 'No date yet';
  if (group === 'seat')
    return (r) => {
      const seats = ctx.seatsOf(r.eventId);
      return seats.length ? seats.map(seatName).join(' · ') : 'Not given to a seat';
    };
  return null;
}

/**
 * The order of one list: grouped rows sit together (a heading never repeats), then the Sort inside each heading.
 * "Waiting first" keeps the derivation's own order (the lanes, waiting first) — the shipped list, unchanged.
 */
export function orderClients<R extends PipelineCustomer>(rows: readonly R[], c: ClientsChoice, ctx: ClientsContext, groupKey: ((r: PipelineCustomer) => string) | null): R[] {
  const at = new Map(rows.map((r, i) => [r, i]));
  const within = (a: R, b: R): number => {
    if (c.sort === 'date') return (a.eventDate ?? '9999').localeCompare(b.eventDate ?? '9999') || at.get(a)! - at.get(b)!;
    if (c.sort === 'name') return a.title.localeCompare(b.title) || at.get(a)! - at.get(b)!;
    if (c.sort === 'newest') return (ctx.lastActivity(b.eventId) ?? '').localeCompare(ctx.lastActivity(a.eventId) ?? '') || at.get(a)! - at.get(b)!;
    return at.get(a)! - at.get(b)!;
  };
  if (!groupKey) return [...rows].sort(within);
  const key = (r: R) => groupKey(r);
  // Days in date order (no date last); other headings in name order.
  const headOrder = (a: string, b: string) =>
    c.group === 'day' ? (a === 'No date yet' ? 1 : b === 'No date yet' ? -1 : a.localeCompare(b)) : a === 'Not given to a seat' ? 1 : b === 'Not given to a seat' ? -1 : a.localeCompare(b);
  return [...rows].sort((a, b) => headOrder(key(a), key(b)) || within(a, b));
}

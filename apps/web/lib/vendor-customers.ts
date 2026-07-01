/**
 * vendor-customers.ts — pure assembly for the vendor "My Customers" surface
 * (/vendor-dashboard/customers). This is a READ / SHAPE-ONLY module: it takes
 * the rows the vendor-scoped queries + RPCs already resolved (schedule pools,
 * bookings, blocks, day states, waitlist, payday installments, chat threads)
 * and shapes them into the three things that page renders:
 *
 *   1. A month grid of 6-state day cells (Full · Booked · Locked · Whitelist ·
 *      Blocked · Waitlist) + per-day event labels — the same 6-state taxonomy
 *      the /vendor-dashboard/calendar page derives (buildDayStates), extended
 *      to also fold the couple-facing waitlist into a per-day chip.
 *   2. A this-month payments roll-up (collected vs expected) from the frozen
 *      installment plan the payday RPC returns.
 *   3. A per-customer list (one row per booked/inquiring event) with a status
 *      pill + a money note (balance owed / fully paid / date full / …).
 *
 * Pure + dependency-free (no Supabase, no `server-only`) so it's trivially
 * unit-testable and safe to import from a server component. All money is PHP
 * whole-peso (the sources already round to pesos). "Today" + the visible month
 * are passed in so the module stays a pure function of its inputs.
 */

import type {
  CalendarBlockEntry,
  PoolBookingEntry,
  SchedulePool,
  VendorCalendarDayState,
} from '@/lib/vendor-schedule';
import type { PaydayInstallmentRow } from '@/lib/vendor-cashflow';

/**
 * The six day states, precedence order (highest first). Mirrors the taxonomy
 * in migration 20270403356945_vendor_calendar_day_states_6_state_taxonomy.sql.
 * `open` is the absence of any of these (no chip rendered).
 */
export type CustomerDayStateKind =
  | 'blocked' // a manual / synced closure block covers the date
  | 'locked' // vendor-set hard hold (day_state = locked)
  | 'whitelist' // vendor-set approve-first day (day_state = whitelist)
  | 'full' // consuming reservations >= capacity on every visible pool
  | 'booked' // 0 < consuming reservations < capacity somewhere
  | 'waitlist'; // couples are waitlisted on a date (couple-facing queue)

export type CustomerCalendarDay = {
  /** 'YYYY-MM-DD' (PH civil day). */
  date: string;
  /** Day-of-month integer, 1..31. */
  day: number;
  /** True when the date is before `today` (rendered muted). */
  past: boolean;
  /** True when the date IS today (rendered emphasised). */
  isToday: boolean;
  /** The dominant state chip for this day, or null for an open day. */
  state: CustomerDayStateKind | null;
  /** Consuming reservations (booked + external) summed across visible pools. */
  consumed: number;
  /** Sum of daily capacity across visible pools (for the "n/cap" label). */
  capacity: number;
  /** How many couples are waitlisted on this date (0 = none). */
  waitlistCount: number;
  /** Short event labels for this day (e.g. booked event names). Deduped. */
  eventLabels: string[];
  /**
   * Distinct leaf service categories that have a booking on this day — the
   * filter index for "All services". Empty when nothing is booked/held here.
   */
  serviceCategories: string[];
  /**
   * Distinct team-member ids (vendor_team_member_id) whose assigned services
   * are booked on this day — the filter index for "All agents". Empty when the
   * day's bookings carry no agent-assigned service.
   */
  agentMemberIds: string[];
};

export type CustomerCalendarMonth = {
  /** 'YYYY-MM' key of the rendered month. */
  month: string;
  /** Weekday index (0=Sun) the 1st of the month falls on — for grid padding. */
  firstWeekday: number;
  days: CustomerCalendarDay[];
};

/** Per-pool per-day consuming/closure/state accumulation (internal). */
type DayAcc = {
  consumed: number;
  capacity: number;
  closed: boolean;
  locked: boolean;
  whitelist: boolean;
};

/**
 * Per-booking service/agent metadata, resolved server-side from
 * event_vendors.service_id → vendor_services.category and
 * vendor_service_agents. Keyed by pool_booking_id so a booking's day inherits
 * exactly its own leaf category + assigned agents (no cross-booking bleed).
 */
export type BookingMeta = {
  /** Leaf service category of the booked service (null when the booking has no
   *  resolved service_id — e.g. a legacy booking). */
  category: string | null;
  /** vendor_team_member_ids whose assignment covers this booking's service. */
  agentMemberIds: string[];
};

function daysInMonthOf(month: string): number {
  const [y = 2026, m = 1] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * Build the visible month's 6-state day grid. Precedence per day:
 *   blocked > locked > whitelist > full > booked > waitlist > open.
 * "full" requires every visible pool to be at/over capacity on that date;
 * otherwise a day with any consumption reads "booked" (matches the calendar
 * page's per-pool full rule aggregated to the day level).
 */
export function buildCustomerCalendarMonth(
  pools: SchedulePool[],
  bookings: PoolBookingEntry[],
  blocks: CalendarBlockEntry[],
  dayStates: VendorCalendarDayState[],
  waitlist: { requestedDate: string; pendingCount: number }[],
  month: string,
  todayIso: string,
  /** pool_booking_id → resolved service/agent metadata (optional; defaults to
   *  empty so the calendar still renders on a pre-enrichment call). */
  bookingMetaById: Map<string, BookingMeta> = new Map(),
): CustomerCalendarMonth {
  const daysInMonth = daysInMonthOf(month);
  const [y = 2026, m = 1] = month.split('-').map(Number);
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const dateOf = (d: number) => `${month}-${String(d).padStart(2, '0')}`;
  const poolIds = new Set(pools.map((p) => p.poolId));
  const capById = new Map(pools.map((p) => [p.poolId, p.capacity]));

  // Per (poolId, date) accumulator.
  const acc = new Map<string, Map<string, DayAcc>>();
  for (const p of pools) {
    const inner = new Map<string, DayAcc>();
    for (let d = 1; d <= daysInMonth; d++) {
      inner.set(dateOf(d), {
        consumed: 0,
        capacity: p.capacity,
        closed: false,
        locked: false,
        whitelist: false,
      });
    }
    acc.set(p.poolId, inner);
  }

  // Booked reservations consume capacity + contribute an event label + the
  // per-day service-category / agent filter index (from the resolved metadata).
  const labelsByDate = new Map<string, Set<string>>();
  const categoriesByDate = new Map<string, Set<string>>();
  const agentsByDate = new Map<string, Set<string>>();
  for (const b of bookings) {
    if (!poolIds.has(b.poolId)) continue;
    const st = acc.get(b.poolId)?.get(b.bookedDate);
    if (st) st.consumed += 1;
    const set = labelsByDate.get(b.bookedDate) ?? new Set<string>();
    set.add(b.eventName);
    labelsByDate.set(b.bookedDate, set);

    const meta = bookingMetaById.get(b.poolBookingId);
    if (meta?.category) {
      const cats = categoriesByDate.get(b.bookedDate) ?? new Set<string>();
      cats.add(meta.category);
      categoriesByDate.set(b.bookedDate, cats);
    }
    if (meta && meta.agentMemberIds.length > 0) {
      const agents = agentsByDate.get(b.bookedDate) ?? new Set<string>();
      for (const id of meta.agentMemberIds) agents.add(id);
      agentsByDate.set(b.bookedDate, agents);
    }
  }

  // Blocks: external clients consume capacity; manual/synced blocks close.
  for (const blk of blocks) {
    const targets = blk.poolId === null ? [...poolIds] : [blk.poolId];
    for (const poolId of targets) {
      const inner = acc.get(poolId);
      if (!inner) continue;
      for (let d = 1; d <= daysInMonth; d++) {
        const date = dateOf(d);
        if (date < blk.startDate || date > blk.endDate) continue;
        const st = inner.get(date);
        if (!st) continue;
        if (blk.source === 'external_client') {
          if (blk.poolId === poolId) st.consumed += 1;
        } else {
          st.closed = true;
        }
      }
    }
  }

  // Explicit vendor-set day states (locked / whitelist). NULL pool = org-wide.
  for (const ds of dayStates) {
    const targets = ds.poolId === null ? [...poolIds] : [ds.poolId];
    for (const poolId of targets) {
      const st = acc.get(poolId)?.get(ds.stateDate);
      if (!st) continue;
      if (ds.dayState === 'locked') st.locked = true;
      else if (ds.dayState === 'whitelist') st.whitelist = true;
    }
  }

  const waitlistByDate = new Map(
    waitlist.map((w) => [w.requestedDate, w.pendingCount]),
  );

  const days: CustomerCalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = dateOf(d);
    let consumed = 0;
    let capacity = 0;
    let anyClosed = false;
    let allClosed = pools.length > 0;
    let anyLocked = false;
    let anyWhitelist = false;
    let anyFull = false;
    let everyFull = pools.length > 0;
    for (const p of pools) {
      const st = acc.get(p.poolId)?.get(date);
      if (!st) {
        allClosed = false;
        everyFull = false;
        continue;
      }
      consumed += st.consumed;
      capacity += capById.get(p.poolId) ?? st.capacity;
      if (st.closed) anyClosed = true;
      else allClosed = false;
      if (st.locked) anyLocked = true;
      if (st.whitelist) anyWhitelist = true;
      const poolFull = st.consumed >= (capById.get(p.poolId) ?? st.capacity);
      if (poolFull && !st.closed) anyFull = true;
      if (!poolFull) everyFull = false;
    }
    const waitlistCount = waitlistByDate.get(date) ?? 0;

    // Precedence: blocked > locked > whitelist > full > booked > waitlist.
    let state: CustomerDayStateKind | null = null;
    if (anyClosed && allClosed) state = 'blocked';
    else if (anyLocked) state = 'locked';
    else if (anyWhitelist) state = 'whitelist';
    else if (everyFull && capacity > 0) state = 'full';
    else if (consumed > 0 || anyFull) state = 'booked';
    else if (waitlistCount > 0) state = 'waitlist';
    // A block on SOME (not all) pools still surfaces as booked/open on the rest;
    // if nothing else fired but a partial block exists, mark it blocked so the
    // vendor sees the closure.
    if (state === null && anyClosed) state = 'blocked';

    days.push({
      date,
      day: d,
      past: date < todayIso,
      isToday: date === todayIso,
      state,
      consumed,
      capacity,
      waitlistCount,
      eventLabels: [...(labelsByDate.get(date) ?? [])],
      serviceCategories: [...(categoriesByDate.get(date) ?? [])],
      agentMemberIds: [...(agentsByDate.get(date) ?? [])],
    });
  }

  return { month, firstWeekday, days };
}

/** This-month payment roll-up from the frozen installment plan. */
export type MonthlyPaymentsSummary = {
  /** Sum of resolvable installment amounts due in the visible month. */
  expectedPhp: number;
  /** Sum of confirmed (received) installment amounts due in the visible month. */
  collectedPhp: number;
  /** Count of installments due this month whose amount couldn't resolve. */
  unresolvedCount: number;
  /** True when there is nothing scheduled this month (empty state). */
  isEmpty: boolean;
};

/**
 * Roll up the installments whose due_date falls in `month` ('YYYY-MM').
 * Installments with a null/unresolvable amount are counted (unresolvedCount)
 * but never invented into the totals — a genuinely-unknown amount stays out of
 * the "of expected" figure rather than being guessed at.
 */
export function summarizeMonthlyPayments(
  rows: PaydayInstallmentRow[],
  month: string,
): MonthlyPaymentsSummary {
  let expectedPhp = 0;
  let collectedPhp = 0;
  let unresolvedCount = 0;
  let count = 0;
  for (const r of rows) {
    if (!r.due_date || r.due_date.slice(0, 7) !== month) continue;
    count += 1;
    if (r.amount_php === null) {
      unresolvedCount += 1;
      continue;
    }
    expectedPhp += r.amount_php;
    if (r.confirmed) collectedPhp += r.amount_php;
  }
  return {
    expectedPhp,
    collectedPhp,
    unresolvedCount,
    isEmpty: count === 0,
  };
}

/**
 * Per-event money position from the FULL installment plan (all months), used
 * for the customer-row note (balance owed / fully paid). Keyed by event_id.
 */
export type EventMoneyPosition = {
  expectedPhp: number;
  collectedPhp: number;
  /** expectedPhp − collectedPhp, floored at 0. */
  balancePhp: number;
  /** True when the plan resolved to a positive total and it's fully received. */
  fullyPaid: boolean;
  /** True when every installment amount for this event was null/unresolvable. */
  allUnresolved: boolean;
  installmentCount: number;
};

export function computeEventMoneyPositions(
  rows: PaydayInstallmentRow[],
): Map<string, EventMoneyPosition> {
  const byEvent = new Map<
    string,
    { expected: number; collected: number; resolved: number; count: number }
  >();
  for (const r of rows) {
    const cur = byEvent.get(r.event_id) ?? {
      expected: 0,
      collected: 0,
      resolved: 0,
      count: 0,
    };
    cur.count += 1;
    if (r.amount_php !== null) {
      cur.resolved += 1;
      cur.expected += r.amount_php;
      if (r.confirmed) cur.collected += r.amount_php;
    }
    byEvent.set(r.event_id, cur);
  }
  const out = new Map<string, EventMoneyPosition>();
  for (const [eventId, v] of byEvent) {
    const balancePhp = Math.max(0, v.expected - v.collected);
    out.set(eventId, {
      expectedPhp: v.expected,
      collectedPhp: v.collected,
      balancePhp,
      fullyPaid: v.expected > 0 && v.collected >= v.expected,
      allUnresolved: v.resolved === 0,
      installmentCount: v.count,
    });
  }
  return out;
}

/** A customer row's status pill. */
export type CustomerStatus =
  | 'booked'
  | 'locked'
  | 'whitelist'
  | 'waitlist'
  | 'in_conversation';

export type CustomerRow = {
  /** event_id — the stable key. */
  eventId: string;
  /** Event display name (couples show as their event until they reveal names). */
  eventName: string;
  /** 'YYYY-MM-DD' or null. */
  eventDate: string | null;
  /** Venue name (place), or null when the couple hasn't set one. */
  place: string | null;
  status: CustomerStatus;
  /** Chat thread id for a deep-link, when one exists. */
  threadId: string | null;
  /** The money position, when the event has a booked installment plan. */
  money: EventMoneyPosition | null;
  /** Leaf service categories tied to this customer's booking(s) — "All
   *  services" filter index. Empty for an in-conversation row (no service_id). */
  serviceCategories: string[];
  /** vendor_team_member_ids assigned to this customer's booked service(s) —
   *  "All agents" filter index. Empty when no agent covers the service. */
  agentMemberIds: string[];
};

// ── Demand heatmap (from Demand Radar) ────────────────────────────────────

/**
 * Per-event-type demand intensity for a single calendar month, folded from the
 * Demand Radar's month buckets. The radar rolls up demand by (month, event
 * type) — it has NO per-date resolution — so the heat is a month-level signal
 * every date in that month shares. `byEventType` lets the calendar re-key the
 * intensity to whichever event type the vendor has selected; `total` is the
 * all-types sum used when no type is selected.
 */
export type MonthDemandHeat = {
  /** event_type slug → demand signal (inquiries+unlocks+bookings) for `month`. */
  byEventType: Record<string, number>;
  /** Sum across every event type — the all-types intensity. */
  total: number;
  /**
   * Normalization ceiling: the single busiest (month, event-type) demand signal
   * across the WHOLE radar. Intensity for a date = thisMonthSignal / scaleMax,
   * so navigating months shows real differences and the busiest month reads
   * "hottest". >0 only when the radar surfaced any demand.
   */
  scaleMax: number;
};

/** A demand-radar bucket, narrowed to what the heatmap needs (month + type). */
type RadarHeatBucket = {
  month_bucket: string;
  event_type: string;
  inquiry_count: number;
  unlock_count: number;
  booking_count: number;
};

/**
 * Fold the demand-radar buckets into this-month intensity, keyed by event type.
 * Buckets whose first-of-month `month_bucket` doesn't match `month` ('YYYY-MM')
 * are ignored. Pure; safe with [] (yields an all-zero heat → no overlay).
 */
export function buildMonthDemandHeat(
  buckets: RadarHeatBucket[],
  month: string,
): MonthDemandHeat {
  const byEventType: Record<string, number> = {};
  let total = 0;
  // Normalization ceiling: busiest (month, event-type) cell across the radar.
  const perMonthType = new Map<string, number>();
  for (const b of buckets) {
    const signal =
      (b.inquiry_count || 0) + (b.unlock_count || 0) + (b.booking_count || 0);
    if (signal <= 0 || typeof b.month_bucket !== 'string') continue;
    const cellKey = `${b.month_bucket.slice(0, 7)}:${b.event_type}`;
    perMonthType.set(cellKey, (perMonthType.get(cellKey) ?? 0) + signal);
    if (b.month_bucket.slice(0, 7) === month) {
      byEventType[b.event_type] = (byEventType[b.event_type] ?? 0) + signal;
      total += signal;
    }
  }
  let scaleMax = 0;
  for (const v of perMonthType.values()) if (v > scaleMax) scaleMax = v;
  return { byEventType, total, scaleMax };
}

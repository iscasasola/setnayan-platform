/**
 * setnayan-ai-triggers.ts — the Setnayan AI trigger engine (pure + deterministic).
 *
 * This is the "brain" that decides WHICH templates fire. It is intentionally
 * pure: it takes a typed snapshot of an event's planning state + a `now`, and
 * returns the interventions that should surface — no I/O, no model, no clock of
 * its own. The thin adapter that builds a PlanningSnapshot from the DB and
 * surfaces the result is a separate concern (a later PR); keeping the logic pure
 * here makes every trigger, the restraint engine, and the weekly digest fully
 * unit-testable and free (deterministic → no per-use cost).
 *
 * Pipeline:  snapshot --runTriggers--> raw Interventions
 *                     --applyRestraint--> what actually surfaces (dedup, priority,
 *                                          cooldown, cap)
 *                     --assembleWeeklyDigest--> the SEC-01 receipt copy
 *
 * Copy + ids come from the deterministic library (setnayan-ai-templates.ts);
 * this file only decides WHEN each fires and with WHAT data. INERT until the
 * per-user flag is on and the snapshot adapter is wired.
 */
import {
  renderTemplate,
  WEDDING_TERMINOLOGY,
  type TemplateCategory,
} from './setnayan-ai-templates';

type Terminology = Parameters<typeof renderTemplate>[2];

/** A fired suggestion: which template, the data to fill it, and how it ranks. */
export type Intervention = {
  templateId: string;
  category: TemplateCategory;
  slots: Record<string, string | number>;
  /** Higher = more urgent. Drives ordering + which one interrupts. */
  priority: number;
  /** Stable key so the same situation never double-fires / can be cooled down. */
  dedupeKey: string;
  variant?: string;
};

// ---- Snapshot input (what the adapter will assemble from real data) ---------

export type SnapshotPayment = {
  vendor: string;
  amountPhp: number;
  dueDate: string; // ISO date
  paid: boolean;
};
export type SnapshotStatutory = { document: string; deadline: string };
export type SnapshotShortlistCategory = {
  category: string;
  openWeeks: number;
  viewedCount: number;
  inquiredCount: number;
  bookedCount: number;
  top2?: string; // for the decision-stuck nudge
  differentiator?: string;
  newCount?: number; // for the discovery-stuck nudge
  relaxedFilter?: string;
};
export type SnapshotPriceChange = {
  vendor: string;
  category: string;
  oldPricePhp: number;
  newPricePhp: number;
};
export type SnapshotContract = {
  vendor: string;
  windowType: string;
  deadline: string;
  daysLeft: number;
};
export type SnapshotInquiry = {
  vendor: string;
  service: string;
  sentDaysAgo: number;
  replied: boolean;
};
/**
 * The money half of the snapshot — GRD-05's whole input.
 *
 * ⚠ EVERY FIELD IS A FIELD OF `EventMoney`, AND NOTHING ELSE MAY JOIN THEM
 * (BA8). This type used to be assembled from raw rows by the guard's own
 * formula, which is why the paid guard could not see a locked package's agreed
 * total, a catalogue line item, a manual line on an off-platform supplier, a
 * credit, crew meals, transport, or a supplier-less `event_costs` row — every
 * one of which `/budget` has counted since BUD-2. Build it ONLY through
 * `budgetFromEventMoney` (lib/setnayan-ai-snapshot.ts), which reads
 * `resolveEventMoney` and nothing else.
 *
 * 🔑 THERE IS NO `pendingPhp`. It carried `submitted` Setnayan orders — money
 * the couple has APPLIED for and an admin has not approved — and the resolver
 * files those under `estimated`, never `committed` (see
 * `ORDER_ESTIMATE_STATUSES`). §18.5 rule 4 gives "over budget" exactly one
 * meaning: what the couple has AGREED exceeds their target. A field that only
 * this guard counts is the two-books defect with a smaller blast radius, not a
 * feature.
 */
export type SnapshotBudget = {
  /** `EventMoney.targetPhp` — the couple's own target, in PHP. */
  totalPhp: number;
  /** `EventMoney.committed` — what they have AGREED to pay. */
  committedPhp: number;
  /**
   * The biggest committed bucket's LABEL, from `EventMoney.byBucket` — the
   * same words `/budget` prints for that category ("Catering", not
   * "catering"). Absent when nothing is committed anywhere.
   */
  topDriverCategory?: string;
};
export type SnapshotDateCluster = {
  date: string;
  count: number;
  categoryList?: string;
};
/** Two run-of-show blocks whose times overlap (GRD-06). */
export type SnapshotScheduleClash = {
  itemA: string;
  itemB: string;
  /** Human time label of the collision (e.g. "Sat, May 9, 3:00 PM"). */
  slot: string;
};
/** A shortlisted/booked vendor whose availability for the event date changed (GRD-09). */
export type SnapshotAvailabilityChange = {
  vendor: string;
  /** Human date label the change affects (the couple's event date). */
  date: string;
  /** What changed, e.g. "newly booked" / "no longer free". */
  status: string;
};

export type PlanningSnapshot = {
  eventType: string;
  payments: SnapshotPayment[];
  statutory: SnapshotStatutory[];
  shortlist: SnapshotShortlistCategory[];
  priceChanges: SnapshotPriceChange[];
  contracts: SnapshotContract[];
  inquiries: SnapshotInquiry[];
  budget: SnapshotBudget | null;
  dateClusters: SnapshotDateCluster[];
  scheduleClash: SnapshotScheduleClash[];
  availability: SnapshotAvailabilityChange[];
};

// ---- Tunable thresholds (the restraint dials; kept in one place) ------------

export const TRIGGER_THRESHOLDS = {
  /**
   * "Due soon" — the urgent window GRD-01 fires in, counted FORWARD from today.
   *
   * ⚠ This number is also the money resolver's. `lib/budget-truth.ts` imports
   * it (and `paymentHorizonDays`) rather than declaring its own, so the page
   * and the email cannot disagree about what "due soon" means. If you change
   * it, you change both surfaces — which is the point.
   */
  paymentDueWindowDays: 7,
  /**
   * The roll-up horizon — how far ahead a milestone still counts as something
   * the couple is looking at (the 30 days `lib/budget.ts` has always used for
   * `upcomingDueAmount`). Beyond it a payment is `later`, not `upcoming`.
   */
  paymentHorizonDays: 30,
  contractWindowDays: 7,
  vendorQuietDays: 4,
  stuckWeeks: 4,
  dateConvergeMin: 3,
} as const;

/**
 * Where one dated milestone sits relative to today. ONE definition, shared by
 * the guard (which alerts) and the money resolver (which counts) — see the
 * threshold docs above.
 *
 * The boundaries, spelled out because a wrong one emails a real couple about a
 * payment they do not owe:
 *
 * | days until due | state      |
 * |----------------|------------|
 * | -1 and below   | `overdue`  |  the date has passed
 * | 0              | `due_soon` |  DUE TODAY IS NOT LATE
 * | 1 … 7          | `due_soon` |  ≤ paymentDueWindowDays
 * | 8 … 30         | `upcoming` |  ≤ paymentHorizonDays
 * | 31 and above   | `later`    |
 *
 * `overdue` and `due_soon` are what GRD-01 alerts on. `upcoming` and `later`
 * are counted, never interrupted for.
 */
export type PaymentDueState = 'overdue' | 'due_soon' | 'upcoming' | 'later';

export function paymentDueState(days: number): PaymentDueState {
  if (days < 0) return 'overdue';
  if (days <= TRIGGER_THRESHOLDS.paymentDueWindowDays) return 'due_soon';
  if (days <= TRIGGER_THRESHOLDS.paymentHorizonDays) return 'upcoming';
  return 'later';
}

// ---- helpers ----------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The platform's calendar. Every `due_date` / `deadline` is a bare PH date, and
 * `planPaymentDueReminder` already schedules its sends at 09:00 +08:00.
 */
const PH_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Which Manila calendar day an instant falls on, as a whole-day index. */
function phDayIndex(t: number): number {
  return Math.floor((t + PH_UTC_OFFSET_MS) / MS_PER_DAY);
}

/**
 * Whole days from today to `dateStr` — negative once the date has passed.
 * `+Infinity` for an unparseable date, so a bad row is never called overdue.
 *
 * ⚠ CALENDAR DAYS, NOT ELAPSED HOURS. This used to be
 * `floor((due − now) / MS_PER_DAY)` against the raw instants, which drifts
 * with the time of day: a milestone due TODAY returned −1 from 00:00 UTC
 * onward. That was harmless only because the old filter threw every negative
 * away. Once the window opens backwards it stops being harmless — it would
 * email a couple that a payment due this afternoon was already "1 day" late.
 * Both endpoints are now floored to their Manila day first, so the answer is
 * the same at 09:00 and at 23:00.
 */
export function daysUntilDue(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  return phDayIndex(d.getTime()) - phDayIndex(now.getTime());
}

/** Group a PHP integer with thousands separators (deterministic, no locale). */
function php(n: number): string {
  const sign = n < 0 ? '-' : '';
  const digits = Math.round(Math.abs(n)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ---- the triggers (each pure: snapshot + now -> Interventions) --------------

/** "1 day" / "12 days" — pre-worded, because renderTemplate is pure substitution. */
function dayCount(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

/**
 * How far above the due-soon band an overdue alert may climb. Bounded on
 * purpose: `100 − d` is unbounded for a date years in the past, and one
 * forgotten milestone from 2024 would otherwise outrank every other guard
 * forever and eat the whole per-sweep cap (GUARD_NOTIFY_MAX_PER_SWEEP = 3).
 */
const OVERDUE_PRIORITY_CEILING = 10;

/**
 * GRD-01 — a vendor payment milestone needs attention.
 *
 * ⚠ THE DEFECT THIS FILTER USED TO HAVE. It read
 * `d >= 0 && d <= paymentDueWindowDays`, and that `d >= 0` dropped every
 * payment the couple had ALREADY MISSED. A missed payment therefore produced
 * no alert, no email, and no tray badge — it did not render as a warning, it
 * rendered as NOTHING, which is indistinguishable from having no payments due
 * at all. The window now opens backwards: overdue fires, and it fires LOUDER
 * than a heads-up, under its own copy variant and its own dedupe key so the
 * earlier "due in 3 days" note cannot cool it down.
 *
 * `paymentDueState` is imported by `lib/budget-truth.ts` too — the number the
 * page counts and the number the email names are the same number.
 */
export function paymentDueTrigger(snap: PlanningSnapshot, now: Date): Intervention[] {
  return snap.payments
    .filter((p) => !p.paid)
    .map((p) => {
      const d = daysUntilDue(p.dueDate, now);
      return { p, d, state: paymentDueState(d) };
    })
    .filter(({ state }) => state === 'overdue' || state === 'due_soon')
    .map(({ p, d, state }) => {
      const overdue = state === 'overdue';
      // The two variants take DIFFERENT slots — `overdue_for` reads backwards,
      // `days_left` forwards — so neither copy can print the other's number.
      const slots: Record<string, string | number> = {
        vendor: p.vendor,
        amount: php(p.amountPhp),
        due_date: p.dueDate,
      };
      if (overdue) slots.overdue_for = dayCount(-d);
      else slots.days_left = d;
      return {
        templateId: 'GRD-01',
        category: 'guard' as const,
        variant: overdue ? 'overdue' : 'default',
        slots,
        // Sooner = higher; already-missed outranks not-yet-missed, bounded.
        priority: overdue
          ? 100 + Math.min(-d, OVERDUE_PRIORITY_CEILING)
          : 100 - d,
        // A DISTINCT key: the heads-up that fired while this was still upcoming
        // is inside the 7-day guard cooldown, and reusing its key would swallow
        // the first alert that the money is actually late.
        dedupeKey: overdue
          ? `GRD-01:overdue:${p.vendor}:${p.dueDate}`
          : `GRD-01:${p.vendor}:${p.dueDate}`,
      };
    });
}

export function statutoryDeadlineTrigger(snap: PlanningSnapshot, now: Date): Intervention[] {
  if (snap.eventType !== 'wedding') return []; // GRD-02 is wedding-only
  return snap.statutory
    .map((s) => ({ s, d: daysUntilDue(s.deadline, now) }))
    .filter(({ d }) => d >= 0 && d <= 60)
    .map(({ s, d }) => ({
      templateId: 'GRD-02',
      category: 'guard' as const,
      slots: { document: s.document, deadline: s.deadline, days_left: d },
      priority: 95 - d,
      dedupeKey: `GRD-02:${s.document}`,
    }));
}

export function priceRiseTrigger(snap: PlanningSnapshot): Intervention[] {
  return snap.priceChanges
    .filter((c) => c.newPricePhp > c.oldPricePhp)
    .map((c) => ({
      templateId: 'GRD-03',
      category: 'guard' as const,
      slots: {
        vendor: c.vendor,
        category: c.category,
        old_price: php(c.oldPricePhp),
        new_price: php(c.newPricePhp),
      },
      priority: 70,
      dedupeKey: `GRD-03:${c.vendor}:${c.category}`,
    }));
}

/**
 * GRD-05 — "Warns you before you go over budget", the sentence the
 * `SETNAYAN_AI` buy page sells.
 *
 * `committedPhp − totalPhp` is `EventMoney.overBudgetByPhp` computed the same
 * way the resolver computes it (`committed − targetPhp`, budget-truth.ts), so
 * the amount this guard prints is the amount `/budget` prints. That equality
 * is asserted, not assumed: `lib/one-set-of-books.test.ts`.
 */
export function overBudgetTrigger(snap: PlanningSnapshot): Intervention[] {
  const b = snap.budget;
  if (!b) return [];
  const over = b.committedPhp - b.totalPhp;
  if (over <= 0) return [];
  return [
    {
      templateId: 'GRD-05',
      category: 'guard',
      slots: { over_amount: php(over), top_driver_category: b.topDriverCategory ?? 'a few categories' },
      priority: 80,
      dedupeKey: 'GRD-05:budget',
    },
  ];
}

export function contractWindowTrigger(snap: PlanningSnapshot): Intervention[] {
  return snap.contracts
    .filter((c) => c.daysLeft >= 0 && c.daysLeft <= TRIGGER_THRESHOLDS.contractWindowDays)
    .map((c) => ({
      templateId: 'GRD-07',
      category: 'guard' as const,
      slots: { vendor: c.vendor, window_type: c.windowType, deadline: c.deadline },
      priority: 85 - c.daysLeft,
      dedupeKey: `GRD-07:${c.vendor}:${c.windowType}`,
    }));
}

export function vendorQuietTrigger(snap: PlanningSnapshot): Intervention[] {
  return snap.inquiries
    .filter((q) => !q.replied && q.sentDaysAgo >= TRIGGER_THRESHOLDS.vendorQuietDays)
    .map((q) => ({
      templateId: 'SEC-04',
      category: 'secretary' as const,
      slots: { vendor: q.vendor, days: q.sentDaysAgo },
      priority: 50,
      dedupeKey: `SEC-04:${q.vendor}`,
    }));
}

export function stuckCategoryTrigger(snap: PlanningSnapshot): Intervention[] {
  const out: Intervention[] = [];
  for (const c of snap.shortlist) {
    if (c.bookedCount > 0 || c.openWeeks <= TRIGGER_THRESHOLDS.stuckWeeks) continue;
    if (c.inquiredCount >= 1) {
      // decision-stuck → narrow (SEC-02)
      out.push({
        templateId: 'SEC-02',
        category: 'secretary',
        slots: {
          category: c.category,
          weeks: c.openWeeks,
          top2: c.top2 ?? 'your two front-runners',
          differentiator: c.differentiator ?? 'price vs. style',
        },
        priority: 55,
        dedupeKey: `SEC-02:${c.category}`,
      });
    } else if (c.viewedCount > 0) {
      // discovery-stuck → offer more (SEC-03)
      out.push({
        templateId: 'SEC-03',
        category: 'secretary',
        slots: {
          category: c.category,
          new_count: c.newCount ?? 'a few',
          relaxed_filter: c.relaxedFilter ?? 'your filters',
        },
        priority: 45,
        dedupeKey: `SEC-03:${c.category}`,
      });
    }
  }
  return out;
}

export function dateConvergenceTrigger(snap: PlanningSnapshot): Intervention[] {
  const top = [...snap.dateClusters]
    .filter((c) => c.count >= TRIGGER_THRESHOLDS.dateConvergeMin)
    .sort((a, b) => b.count - a.count)[0];
  if (!top) return [];
  return [
    {
      templateId: 'SEC-07',
      category: 'secretary',
      slots: { date: top.date, count: top.count, category_list: top.categoryList ?? '' },
      priority: 40,
      dedupeKey: `SEC-07:${top.date}`,
    },
  ];
}

/**
 * Schedule-clash guard (GRD-06). Fires one intervention per pair of run-of-show
 * blocks whose times overlap. The overlap detection lives in the snapshot
 * adapter (a pure, tested helper); this trigger just renders each collision.
 */
export function scheduleClashTrigger(snap: PlanningSnapshot): Intervention[] {
  return snap.scheduleClash.map((c) => ({
    templateId: 'GRD-06',
    category: 'guard' as const,
    slots: { item_a: c.itemA, item_b: c.itemB, slot: c.slot },
    // Between price (70) and over-budget (80): a clash is a real problem but
    // rarely as time-critical as money already over the line.
    priority: 75,
    dedupeKey: `GRD-06:${c.itemA}:${c.itemB}:${c.slot}`,
  }));
}

/**
 * Availability-change guard (GRD-09). Fires when a vendor the couple has
 * shortlisted or booked just became busy on their event date — the snapshot
 * adapter detects the change from the global vendor calendar; this renders it.
 */
export function availabilityChangeTrigger(snap: PlanningSnapshot): Intervention[] {
  return snap.availability.map((a) => ({
    templateId: 'GRD-09',
    category: 'guard' as const,
    slots: { vendor: a.vendor, date: a.date, status: a.status },
    // Availability slipping on a top pick is time-critical — as high as an
    // over-budget flag; you may need to lock or replace them fast.
    priority: 80,
    dedupeKey: `GRD-09:${a.vendor}:${a.date}`,
  }));
}

/** Run every trigger and collect the raw (pre-restraint) interventions. */
export function runTriggers(snap: PlanningSnapshot, now: Date): Intervention[] {
  return [
    ...paymentDueTrigger(snap, now),
    ...statutoryDeadlineTrigger(snap, now),
    ...priceRiseTrigger(snap),
    ...overBudgetTrigger(snap),
    ...contractWindowTrigger(snap),
    ...scheduleClashTrigger(snap),
    ...availabilityChangeTrigger(snap),
    ...vendorQuietTrigger(snap),
    ...stuckCategoryTrigger(snap),
    ...dateConvergenceTrigger(snap),
  ];
}

// ---- the restraint engine ---------------------------------------------------

/**
 * Reduce raw interventions to what should actually surface:
 *   • dedup by dedupeKey (highest priority wins),
 *   • drop anything currently on cooldown (already shown recently),
 *   • sort by priority desc,
 *   • optionally cap to `maxProactive` (for interrupts; the digest passes no cap
 *     so it can list everything).
 * This is the "earn the interruption" discipline in code.
 */
export function applyRestraint(
  interventions: Intervention[],
  opts: { maxProactive?: number; cooldown?: ReadonlySet<string> } = {},
): Intervention[] {
  const cooldown = opts.cooldown ?? new Set<string>();
  const byKey = new Map<string, Intervention>();
  for (const iv of interventions) {
    if (cooldown.has(iv.dedupeKey)) continue;
    const existing = byKey.get(iv.dedupeKey);
    if (!existing || iv.priority > existing.priority) byKey.set(iv.dedupeKey, iv);
  }
  const ranked = [...byKey.values()].sort((a, b) => b.priority - a.priority);
  return typeof opts.maxProactive === 'number' ? ranked.slice(0, opts.maxProactive) : ranked;
}

// ---- the weekly digest (SEC-01 assembly) ------------------------------------

/** A short imperative for the "Next up:" line, by the top intervention's kind. */
function nextTaskLabel(iv: Intervention | undefined): string {
  if (!iv) return 'nothing urgent — you’re in good shape';
  switch (iv.templateId) {
    case 'GRD-01':
      return iv.variant === 'overdue'
        ? `settle the overdue ${iv.slots.vendor} payment`
        : `settle the ${iv.slots.vendor} payment`;
    case 'GRD-02':
      return `sort out your ${iv.slots.document}`;
    case 'GRD-05':
      return 'trim the budget or raise the total';
    case 'GRD-03':
      return `lock in ${iv.slots.vendor} before the price climbs further`;
    case 'GRD-06':
      return `resolve the clash at ${iv.slots.slot}`;
    case 'GRD-07':
      return `decide on ${iv.slots.vendor} before the window closes`;
    case 'GRD-09':
      return `lock or replace ${iv.slots.vendor} — their date just moved`;
    case 'SEC-04':
      return `nudge ${iv.slots.vendor}`;
    case 'SEC-02':
    case 'SEC-03':
      return `pick your ${iv.slots.category}`;
    case 'SEC-07':
      return `confirm your date`;
    default:
      return 'review your plan';
  }
}

/** Soonest upcoming item, for the quiet-week digest's "on the horizon" line. */
function soonestHorizonItem(snap: PlanningSnapshot, now: Date): string {
  const candidates: { label: string; d: number }[] = [];
  for (const p of snap.payments) {
    if (!p.paid) candidates.push({ label: `your ${p.vendor} payment on ${p.dueDate}`, d: daysUntilDue(p.dueDate, now) });
  }
  for (const s of snap.statutory) {
    if (snap.eventType === 'wedding') candidates.push({ label: `your ${s.document} (${s.deadline})`, d: daysUntilDue(s.deadline, now) });
  }
  for (const c of snap.contracts) {
    candidates.push({ label: `the ${c.windowType} window with ${c.vendor}`, d: c.daysLeft });
  }
  const soonest = candidates.filter((c) => c.d >= 0).sort((a, b) => a.d - b.d)[0];
  return soonest?.label ?? 'nothing pressing';
}

/**
 * Build the weekly receipt (SEC-01). Empty interventions → the honest "quiet
 * week" variant; otherwise the "busy" variant with a bulleted what-I-watched
 * list + a next step. All copy via renderTemplate (deterministic, free).
 */
export function assembleWeeklyDigest(
  interventions: Intervention[],
  snap: PlanningSnapshot,
  now: Date,
  terminology: Terminology = WEDDING_TERMINOLOGY,
): string {
  if (interventions.length === 0) {
    return renderTemplate(
      'SEC-01',
      { horizon_item: soonestHorizonItem(snap, now) },
      terminology,
      'quiet',
    );
  }
  const ranked = [...interventions].sort((a, b) => b.priority - a.priority);
  const flags = ranked
    .map((iv) => `• ${renderTemplate(iv.templateId, iv.slots, terminology, iv.variant ?? 'default')}`)
    .join('\n');
  const checkedCount =
    snap.payments.length +
    snap.contracts.length +
    snap.shortlist.length +
    snap.scheduleClash.length +
    snap.priceChanges.length +
    snap.availability.length;
  const onTrack = Math.max(0, checkedCount - ranked.length);
  return renderTemplate(
    'SEC-01',
    {
      checked_count: checkedCount,
      on_track_count: onTrack,
      flags,
      next_task: nextTaskLabel(ranked[0]),
    },
    terminology,
    'busy',
  );
}

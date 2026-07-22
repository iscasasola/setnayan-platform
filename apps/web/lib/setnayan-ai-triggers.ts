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
export type SnapshotBudget = {
  totalPhp: number;
  committedPhp: number;
  pendingPhp: number;
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
  paymentDueWindowDays: 7,
  contractWindowDays: 7,
  vendorQuietDays: 4,
  stuckWeeks: 4,
  dateConvergeMin: 3,
} as const;

// ---- helpers ----------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysUntil(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((d.getTime() - now.getTime()) / MS_PER_DAY);
}

/** Group a PHP integer with thousands separators (deterministic, no locale). */
function php(n: number): string {
  const sign = n < 0 ? '-' : '';
  const digits = Math.round(Math.abs(n)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ---- the triggers (each pure: snapshot + now -> Interventions) --------------

export function paymentDueTrigger(snap: PlanningSnapshot, now: Date): Intervention[] {
  return snap.payments
    .filter((p) => !p.paid)
    .map((p) => ({ p, d: daysUntil(p.dueDate, now) }))
    .filter(({ d }) => d >= 0 && d <= TRIGGER_THRESHOLDS.paymentDueWindowDays)
    .map(({ p, d }) => ({
      templateId: 'GRD-01',
      category: 'guard' as const,
      slots: { vendor: p.vendor, amount: php(p.amountPhp), due_date: p.dueDate, days_left: d },
      priority: 100 - d, // sooner = higher
      dedupeKey: `GRD-01:${p.vendor}:${p.dueDate}`,
    }));
}

export function statutoryDeadlineTrigger(snap: PlanningSnapshot, now: Date): Intervention[] {
  if (snap.eventType !== 'wedding') return []; // GRD-02 is wedding-only
  return snap.statutory
    .map((s) => ({ s, d: daysUntil(s.deadline, now) }))
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

export function overBudgetTrigger(snap: PlanningSnapshot): Intervention[] {
  const b = snap.budget;
  if (!b) return [];
  const over = b.committedPhp + b.pendingPhp - b.totalPhp;
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
      return `settle the ${iv.slots.vendor} payment`;
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
    if (!p.paid) candidates.push({ label: `your ${p.vendor} payment on ${p.dueDate}`, d: daysUntil(p.dueDate, now) });
  }
  for (const s of snap.statutory) {
    if (snap.eventType === 'wedding') candidates.push({ label: `your ${s.document} (${s.deadline})`, d: daysUntil(s.deadline, now) });
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

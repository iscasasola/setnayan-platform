/**
 * 🧩 TOOLKIT TEMPLATES — ready-made payment plans and availability set-ups, installed from the Toolkit and opened
 * filled in, in the maker the shop already uses (owner 23 Nov 2026).
 *
 * ⚖ DECISION_LOG 2026-11-23 "Toolkit templates for every maker…", "Toolkit templates drawing APPROVED" (specs
 *   24dcf90c) and "Seven open calls settled" item 1. Drawing: specs `prototypes/toolkit_templates_2026-11-23/`
 *   (frames 1 · 1b · 2 · 3 and the Notes view's template table — every name, part and "For first" tag below is that
 *   table's).
 *
 *   · PAYMENT PLANS (8): percents and days ONLY — never a peso amount (the ruling: "Payment-plan percentages are
 *     editable templates, never invented peso amounts"). Install copies one into the shop's saved plans
 *     (`vendor_pay_plans`); from then on it is the shop's own plan ("· yours" on every card). Nothing is applied to a
 *     card until the supplier picks it there (the card-maker rule "no payment split is a default" stays).
 *   · AVAILABILITY (6): named set-ups on the four styles a card can pick today (`isCardPickableStyle`). A template
 *     never fills the count a shop can handle, except "One event a day", whose name is the count. Install adds it to
 *     the card maker's Availability row ("From a template").
 *   · ROOM LAYOUTS (6, paid): listed only once Spaces is live (drawing, Notes "Space / room"). Not built here.
 *   · Every template is FREE ("Included"): the only priced ones are the room layouts.
 *
 * Installed state lives in `vendor_profiles.store_layout.templates` (the Toolkit's one layout column; no new schema):
 * `pay` maps a template key to the saved plan it made (installed = that plan is still live), `av` lists the
 * availability templates installed.
 *
 * PURE — no I/O. 🔒 lib/toolkit-templates.test.ts
 */
import { formatCount } from './format-number';
import { MAX_SCHEDULE_ITEMS, pctToBps, type DueAnchor } from './vendor-service-payment-schedules';
import { availabilityLabel, availabilityName, isCardPickableStyle, type AvailabilityStyle } from './availability-styles';
import type { PayPlanItem } from './vendor-pay-plans';

// ── PAYMENT PLANS ───────────────────────────────────────────────────────────

export type PlanPart = { label: string; pct: number; anchor: DueAnchor; days: number };

export type PayPlanTemplate = {
  key: string;
  name: string;
  /** The shelf row's line (drawing frame 1, shelf page). */
  line: string;
  parts: readonly PlanPart[];
  /** "For first" — HUB_TOOLS_SEED category names. Tags only order; they never lock. */
  forCategories: readonly string[];
};

const p = (label: string, pct: number, anchor: DueAnchor, days = 0): PlanPart => ({ label, pct, anchor, days });

export const PAY_PLAN_TEMPLATES: readonly PayPlanTemplate[] = [
  {
    key: 'reserve_20',
    name: 'Reserve with 20%',
    line: '20% to book · rest 7 days before',
    parts: [p('Reservation', 20, 'on_lock'), p('Final balance', 80, 'before_event', 7)],
    forCategories: ['Reception', 'Ceremony', 'Outdoor'],
  },
  {
    key: 'deposit_monthly',
    name: 'First payment, then monthly',
    line: 'A first payment, then one part each month',
    parts: [p('First payment', 25, 'on_lock'), p('Second payment', 25, 'before_event', 90), p('Third payment', 25, 'before_event', 60), p('Final balance', 25, 'before_event', 30)],
    forCategories: ['Reception', 'Ceremony', 'Accommodation'],
  },
  {
    key: 'full_upfront',
    name: 'Full upfront',
    line: 'Full when they book',
    parts: [p('Full payment', 100, 'on_lock')],
    forCategories: ['Cake', 'Photo Booth', 'Digital Services'],
  },
  {
    key: 'half_half',
    name: 'Half now, half before',
    line: 'Half to book · half 7 days before',
    parts: [p('Reservation', 50, 'on_lock'), p('Final balance', 50, 'before_event', 7)],
    forCategories: ['Stylist / Decorator', 'Lights & Sounds', 'Chairs & tents'],
  },
  {
    key: 'p20_three',
    name: '20% to book, two more parts',
    line: 'A month after booking, then the balance',
    parts: [p('Reservation', 20, 'on_lock'), p('Second payment', 40, 'on_lock', 30), p('Final balance', 40, 'before_event', 14)],
    forCategories: ['Stylist / Decorator', 'Coordinator / Planner', 'Catering'],
  },
  {
    key: 'p30_three',
    name: '30% to book, two more parts',
    line: 'A month after booking, then the balance',
    parts: [p('Reservation', 30, 'on_lock'), p('Second payment', 35, 'on_lock', 30), p('Final balance', 35, 'before_event', 14)],
    forCategories: ['Photo & Video', 'Host / MC', 'Live Band'],
  },
  {
    key: 'final_count',
    name: 'Balance after the final count',
    line: 'The last part follows the final headcount',
    parts: [p('Reservation', 50, 'on_lock'), p('Second payment', 40, 'before_event', 21), p('Final balance', 10, 'before_event', 3)],
    forCategories: ['Catering', 'Stations', 'Restaurant (Reservation)'],
  },
  {
    key: 'on_the_day',
    name: 'Balance on the day',
    line: 'A first payment, the rest on the day',
    parts: [p('Reservation', 30, 'on_lock'), p('Final balance', 70, 'before_event', 0)],
    forCategories: ['Photo & Video', 'Performers', 'Host / MC'],
  },
];

/** The plan's stored rows (`vendor_pay_plans.items`), in pay order. Percent only: never a peso amount. */
export function templatePlanItems(t: PayPlanTemplate): PayPlanItem[] {
  return t.parts.map((x) => ({
    label: x.label,
    amount_kind: 'percent' as const,
    percent_bps: pctToBps(x.pct),
    amount_centavos: null,
    due_anchor: x.anchor,
    due_offset_days: x.days,
    cancellation_terms: null,
    downpayment_non_refundable: false,
    refund_window_days: null,
    no_show_forfeit: false,
  }));
}

/** "When booked" · "30 days after booking" · "7 days before" · "The Day" — the drawing's Due words. */
export function partDueWords(x: Pick<PlanPart, 'anchor' | 'days'>): string {
  if (x.anchor === 'on_lock') return x.days > 0 ? `${formatCount(x.days)} ${x.days === 1 ? 'day' : 'days'} after booking` : 'When booked';
  return x.days > 0 ? `${formatCount(x.days)} ${x.days === 1 ? 'day' : 'days'} before` : 'The Day';
}

/** "2 parts · 20 · 80" — the tile's line after the kind word. */
export function partsLine(t: PayPlanTemplate): string {
  const n = t.parts.length;
  return `${formatCount(n)} ${n === 1 ? 'part' : 'parts'} · ${t.parts.map((x) => formatCount(x.pct)).join(' · ')}`;
}

/** The parts add up to 100%. Held for every template by the test; the editor says the same of a changed plan. */
export function partsTotal(parts: readonly Pick<PlanPart, 'pct'>[]): number {
  return parts.reduce((s, x) => s + x.pct, 0);
}

/** At most this many parts in one plan — the card's own limit (`MAX_SCHEDULE_ITEMS`). */
export const MAX_PLAN_PARTS = MAX_SCHEDULE_ITEMS;

/**
 * The plan editor's rows as posted (repeated `part_label` · `part_pct` · `part_anchor` · `part_days`, in pay order) →
 * the parts, or the words that say what is wrong. Whole percents 1–100 that add up to exactly 100; days 0–730.
 */
export function readPlanParts(fd: { getAll: (k: string) => unknown[] }): PlanPart[] | string {
  const labels = fd.getAll('part_label');
  const pcts = fd.getAll('part_pct');
  const anchors = fd.getAll('part_anchor');
  const days = fd.getAll('part_days');
  if (labels.length === 0) return 'Add at least one payment.';
  if (labels.length > MAX_PLAN_PARTS) return `A plan holds at most ${MAX_PLAN_PARTS} payments.`;
  if (pcts.length !== labels.length || anchors.length !== labels.length || days.length !== labels.length) return 'Couldn’t read the payments. Try again.';
  const out: PlanPart[] = [];
  for (let i = 0; i < labels.length; i += 1) {
    const label = String(labels[i] ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const pct = Number(pcts[i]);
    const anchor = anchors[i];
    const d = Number(days[i]);
    if (!label) return `Name payment ${i + 1}.`;
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) return `Payment ${i + 1} needs a percent from 1 to 100.`;
    if (anchor !== 'on_lock' && anchor !== 'before_event') return `Pick when payment ${i + 1} is due.`;
    if (!Number.isInteger(d) || d < 0 || d > 730) return `Payment ${i + 1} needs a number of days from 0 to 730.`;
    out.push({ label, pct, anchor, days: d });
  }
  const total = partsTotal(out);
  if (total !== 100) return `The payments add up to ${total}%. They must add up to 100%.`;
  return out;
}

// ── AVAILABILITY ────────────────────────────────────────────────────────────

export type AvTemplate = {
  key: string;
  name: string;
  style: AvailabilityStyle;
  /** "Order at least N days" (`order_lead_days`) for a made-to-order template; null = not set by the template. */
  leadDays: number | null;
  /** The day count — set ONLY where the name is the count ("One event a day"); null = the shop types its own. */
  perDay: number | null;
  forCategories: readonly string[];
};

export const AV_TEMPLATES: readonly AvTemplate[] = [
  { key: 'one_a_day', name: 'One event a day', style: 'day', leadDays: null, perDay: 1, forCategories: ['Photo & Video', 'Coordinator / Planner', 'Host / MC'] },
  { key: 'more_a_day', name: 'More than one event a day', style: 'day', leadDays: null, perDay: null, forCategories: ['Reception', 'Catering', 'Stylist / Decorator'] },
  { key: 'order_14', name: 'Made to order, two weeks ahead', style: 'order', leadDays: 14, perDay: null, forCategories: ['Cake', 'Dessert', 'Engraving / Embroidery'] },
  { key: 'order_30', name: 'Made to order, a month ahead', style: 'order', leadDays: 30, perDay: null, forCategories: ['Caricature / Calligraphy / Painting', 'Perfume Bar'] },
  { key: 'by_piece', name: 'Rented by the piece', style: 'piece', leadDays: null, perDay: null, forCategories: ['Chairs & tents', 'Lights & Sounds', 'Dance Floor'] },
  { key: 'always', name: 'Always available', style: 'none', leadDays: null, perDay: null, forCategories: ['Digital Services'] },
];

/** "One booking a day · AV-DAY" — the tile's line after the kind word. */
export function avStyleLine(t: AvTemplate): string {
  return `${availabilityName(t.style)} · ${availabilityLabel(t.style)}`;
}

/** What is inside an availability template, as the item page lists it (drawing frame 3). */
export function avInside(t: AvTemplate): { name: string; value: string; line?: string }[] {
  const rows: { name: string; value: string; line?: string }[] = [{ name: 'How you book', value: availabilityName(t.style) }];
  if (t.style !== 'none') {
    const count = t.style === 'order' ? 'Orders for one day' : t.style === 'piece' ? 'Pieces you have' : 'Events for one day';
    rows.push(t.perDay != null ? { name: count, value: formatCount(t.perDay) } : { name: count, value: 'You set it', line: 'Only you know how many you can do' });
  }
  if (t.leadDays != null) rows.push({ name: 'Couples order', value: `${formatCount(t.leadDays)} days before` });
  return rows;
}

/** "Setnayan reads this as: …" — one sentence for the card maker's From a template row. */
export function avReads(t: AvTemplate): string {
  if (t.style === 'none') return 'Setnayan reads this as: always available, never counted.';
  if (t.style === 'order')
    return `Setnayan reads this as: you take orders for any date${t.leadDays ? `, and couples must order ${formatCount(t.leadDays)} days before` : ''}.`;
  if (t.style === 'piece') return 'Setnayan reads this as: you rent out pieces, counted against how many you have.';
  return t.perDay === 1 ? 'Setnayan reads this as: one event on any one date.' : 'Setnayan reads this as: as many events on one date as you can handle.';
}

// ── THE KINDS, THEIR WORDS ──────────────────────────────────────────────────

export type TemplateKind = 'pay' | 'av';
export type TemplateRef = { kind: 'pay'; t: PayPlanTemplate } | { kind: 'av'; t: AvTemplate };

/** The coloured kind word each line starts with (drawing, "Colour by kind"; owner 23 Nov). */
export const KIND_WORD: Readonly<Record<TemplateKind, string>> = { pay: 'Payment plan', av: 'Availability' };

export function payTemplateOf(key: string): PayPlanTemplate | null {
  return PAY_PLAN_TEMPLATES.find((t) => t.key === key) ?? null;
}
export function avTemplateOf(key: string): AvTemplate | null {
  return AV_TEMPLATES.find((t) => t.key === key) ?? null;
}

/** The installed toast (drawing frame 2): "… is installed · Use it as is, or change any part." */
export const installedToast = (name: string) => `${name} is installed · Use it as is, or change any part.`;

/** The Remove toast (drawing frame 2 "After Remove"). */
export function removedToast(name: string, cardCount: number): string {
  if (cardCount <= 0) return `${name} is removed`;
  return `${name} is removed · ${formatCount(cardCount)} ${cardCount === 1 ? 'card keeps its' : 'cards keep their'} payments as they are.`;
}

// ── INSTALLED STATE (store_layout.templates) ────────────────────────────────

export type TemplatesLayout = { pay: Readonly<Record<string, string>>; av: readonly string[] };
export const NO_TEMPLATES: TemplatesLayout = { pay: {}, av: [] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The column's `templates` as the app reads it — unknown keys and malformed ids are dropped, never guessed. */
export function readTemplatesLayout(raw: unknown): TemplatesLayout {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const payRaw = o.pay && typeof o.pay === 'object' && !Array.isArray(o.pay) ? (o.pay as Record<string, unknown>) : {};
  const pay: Record<string, string> = {};
  for (const [k, v] of Object.entries(payRaw)) if (payTemplateOf(k) && typeof v === 'string' && UUID.test(v)) pay[k] = v;
  const av = Array.isArray(o.av) ? [...new Set(o.av.filter((k): k is string => typeof k === 'string' && avTemplateOf(k) !== null))] : [];
  return { pay, av };
}

/** A pay template is installed while the plan it made is still one of the shop's live plans. */
export function payInstalled(key: string, l: TemplatesLayout, livePlanIds: ReadonlySet<string> | null): boolean | null {
  const id = l.pay[key];
  if (!id) return false;
  if (livePlanIds === null) return null;
  return livePlanIds.has(id);
}

export function avInstalled(key: string, l: TemplatesLayout): boolean {
  return l.av.includes(key);
}

/** The availability templates the card maker offers ("From a template"), in the shelf's order; only pickable styles. */
export function installedAvTemplates(l: TemplatesLayout): AvTemplate[] {
  return AV_TEMPLATES.filter((t) => l.av.includes(t.key) && isCardPickableStyle(t.style));
}

export function withPayInstalled(l: TemplatesLayout, key: string, planId: string | null): TemplatesLayout {
  const pay = { ...l.pay };
  if (planId) pay[key] = planId;
  else delete pay[key];
  return { ...l, pay };
}

export function withAvInstalled(l: TemplatesLayout, key: string, on: boolean): TemplatesLayout {
  const av = l.av.filter((k) => k !== key);
  return { ...l, av: on ? [...av, key] : av };
}

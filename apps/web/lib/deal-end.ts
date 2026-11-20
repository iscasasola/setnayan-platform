/**
 * 🏁 THE DEAL'S END, IN PURE RULES (Unichat part H2, 20 Nov 2026 — drawing `build-sessions/UNICHAT-LIVE-2026-11-19.html`,
 * plan row H of `UNICHAT-BUILD-PLAN-2026-11-20.md`). 🔒 lib/deal-end.test.ts
 *
 * Four cards close a deal in the chat, and every one of them reads rows that ALREADY ship — nothing here stores, and
 * nothing here knows a price:
 *   · terms at Accept  — the supplier's own reservation terms (`vendor_service_payment_schedules`, seq 0), frozen
 *                        onto the quote when it is sent (`vendor_proposals.rendered_terms`). The accept already
 *                        records who and when (`resolved_by_user_id`, `resolved_at`), so an accepted quote that
 *                        carries terms IS the record of what was agreed.
 *   · the receipt      — a confirmed `event_vendor_payments` row: its amount, what for, paid on, what is left.
 *   · crew for the day — the supplier's crews on the schedule (`event_schedule_tasks`: crew · what · call time).
 *   · handover, review — `booking_handovers` and `vendor_reviews`.
 * A refused read is never drawn as an empty one: each loader returns `{ ok: false }` and the card says so.
 */
import { termsLine, type ServiceCardScheduleRow } from './quote-from-service-card';

// ── Terms ───────────────────────────────────────────────────────────────────

/** The terms a quote carries may be long; the database column has no cap, the screen-safe one is this. */
export const QUOTE_TERMS_MAX = 4000;

/**
 * The terms of the cards a quote was built from → the words frozen on the quote. One card: its own line. Several
 * cards that say the same thing: said once. Several that differ: each under its card's name, so nobody has to guess
 * which service a rule belongs to. No card states anything → '' (a quote with no terms shows no terms line at all).
 */
export function quoteTermsFromCards(
  cards: ReadonlyArray<{ title: string | null; rows: readonly Pick<ServiceCardScheduleRow, 'seq' | 'label' | 'cancellation_terms' | 'downpayment_non_refundable' | 'refund_window_days' | 'no_show_forfeit'>[] }>,
): string {
  const said: { title: string; line: string }[] = [];
  for (const c of cards) {
    const line = termsLine(c.rows as readonly ServiceCardScheduleRow[]);
    if (line) said.push({ title: (c.title ?? '').trim(), line });
  }
  if (said.length === 0) return '';
  const distinct = [...new Set(said.map((s) => s.line))];
  const text = distinct.length === 1 ? distinct[0]! : said.map((s) => (s.title ? `${s.title}: ${s.line}` : s.line)).join('\n');
  return text.slice(0, QUOTE_TERMS_MAX);
}

/** What the reader is told beside Accept. Null = the quote states no terms, so nothing is drawn. */
export function termsAtAccept(input: { terms: string | null | undefined; supplierName: string; status: string }): { words: string; agreed: boolean } | null {
  if (!(input.terms ?? '').trim()) return null;
  const agreed = input.status === 'accepted';
  return { agreed, words: agreed ? `You agreed to ${input.supplierName}’s terms` : `Accepting means you agree to ${input.supplierName}’s terms` };
}

// ── The receipt ─────────────────────────────────────────────────────────────

/** One `event_vendor_payments` row, as the hosts read it. */
export type PaymentRow = {
  payment_id: string;
  amount_php: number | string;
  paid_at: string | null;
  method: string | null;
  reference: string | null;
  is_deposit_record: boolean | null;
  vendor_confirmed_at: string | null;
  payment_refused_at: string | null;
};

export type Receipt = {
  paymentId: string;
  amountCentavos: number;
  /** "First payment" or "Payment" — the ledger's own two words (`tg_vendor_payments_chat_record`). */
  whatFor: 'First payment' | 'Payment';
  method: string | null;
  reference: string | null;
  /** The day the hosts paid (`paid_at`, a date). */
  paidOn: string | null;
  confirmedAt: string;
  /** Confirmed so far on this booking, this payment included. */
  paidCentavos: number;
  /** The accepted quote's total, or null when no accepted quote states one — then "what is left" is not said. */
  agreedCentavos: number | null;
  leftCentavos: number | null;
};

const centavos = (php: number | string | null | undefined) => Math.round((Number(php) || 0) * 100);

/**
 * The payment a receipt line is about. The line and the confirmation are written in ONE transaction, so the row whose
 * `vendor_confirmed_at` sits nearest the line's own time (within a minute) and whose amount is the amount the line
 * printed is that payment. Nothing matches → null, and the card says it could not find the payment; it never draws
 * another payment's figures.
 */
export function receiptFor(input: {
  payments: readonly PaymentRow[];
  lineAt: string;
  /** The line's ₱ text as printed ("₱9,000" · "₱9,000.50"). */
  amountWords: string;
  first: boolean;
  /** The accepted quote's total in centavos; null = none stated. */
  agreedCentavos: number | null;
}): Receipt | null {
  const at = Date.parse(input.lineAt);
  const want = Math.round(Number(input.amountWords.replace(/[₱,]/g, '')) * 100);
  if (!Number.isFinite(at) || !Number.isFinite(want)) return null;
  const confirmed = input.payments.filter((p) => p.vendor_confirmed_at && !p.payment_refused_at);
  let best: PaymentRow | null = null;
  let bestGap = Infinity;
  for (const p of confirmed) {
    if (centavos(p.amount_php) !== want) continue;
    if (Boolean(p.is_deposit_record) !== input.first) continue;
    const gap = Math.abs(Date.parse(p.vendor_confirmed_at!) - at);
    if (gap <= 60_000 && gap < bestGap) {
      best = p;
      bestGap = gap;
    }
  }
  if (!best) return null;
  const upTo = Date.parse(best.vendor_confirmed_at!);
  // "What is left" as it stood WHEN this payment was confirmed — an older receipt does not change when a later one lands.
  const paid = confirmed.filter((p) => Date.parse(p.vendor_confirmed_at!) <= upTo).reduce((n, p) => n + centavos(p.amount_php), 0);
  const agreed = input.agreedCentavos != null && input.agreedCentavos > 0 ? Math.round(input.agreedCentavos) : null;
  return {
    paymentId: best.payment_id,
    amountCentavos: centavos(best.amount_php),
    whatFor: best.is_deposit_record ? 'First payment' : 'Payment',
    method: best.method?.trim() || null,
    reference: best.reference?.trim() || null,
    paidOn: best.paid_at,
    confirmedAt: best.vendor_confirmed_at!,
    paidCentavos: paid,
    agreedCentavos: agreed,
    leftCentavos: agreed == null ? null : Math.max(0, agreed - paid),
  };
}

// ── Crew for the day ────────────────────────────────────────────────────────

/** One `event_schedule_tasks` row of this supplier that names a crew. */
export type CrewTaskRow = { crew: string | null; what: string; call_at: string | null; moment_start: string | null; sort_order?: number | null };

export type DayCrewMember = {
  name: string;
  /** What they do — every task they hold, in the day's order, said once each. */
  roles: string[];
  /** Their first call of the day (a stored wall clock), or null when no task of theirs has a time yet. */
  arriveAt: string | null;
};

/**
 * The supplier's crew for the day, from the schedule's own tasks: one row per crew name (case-insensitive), their
 * roles as written, and their arrival = the earliest of their own call times (a task with no call time arrives with
 * its moment). Ordered by arrival, then by name. A task with no crew name is the supplier itself and is not a member.
 */
export function dayCrew(tasks: readonly CrewTaskRow[]): { members: DayCrewMember[]; firstArrival: string | null } {
  const by = new Map<string, DayCrewMember>();
  const ordered = [...tasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  for (const t of ordered) {
    const name = (t.crew ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const m = by.get(key) ?? { name, roles: [], arriveAt: null };
    const role = t.what.trim();
    if (role && !m.roles.some((r) => r.toLowerCase() === role.toLowerCase())) m.roles.push(role);
    const at = t.call_at ?? t.moment_start;
    if (at && (!m.arriveAt || Date.parse(at) < Date.parse(m.arriveAt))) m.arriveAt = at;
    by.set(key, m);
  }
  const members = [...by.values()].sort((a, b) => {
    const x = a.arriveAt ? Date.parse(a.arriveAt) : Infinity;
    const y = b.arriveAt ? Date.parse(b.arriveAt) : Infinity;
    return x - y || a.name.localeCompare(b.name);
  });
  return { members, firstArrival: members.find((m) => m.arriveAt)?.arriveAt ?? null };
}

// ── Handover, then the review ───────────────────────────────────────────────

export type HandoverRow = {
  handover_id: string;
  event_vendor_id: string;
  kind: 'gallery_link' | 'file' | 'note' | 'signoff';
  label: string | null;
  payload: string | null;
  status: 'delivered' | 'acknowledged' | 'disputed';
  created_at: string;
  couple_acknowledged_at: string | null;
};

/** The handover a "Handover · <kind>" line is about: same kind, written within a minute of the line. */
export function handoverFor(rows: readonly HandoverRow[], kind: HandoverRow['kind'], lineAt: string): HandoverRow | null {
  const at = Date.parse(lineAt);
  if (!Number.isFinite(at)) return null;
  let best: HandoverRow | null = null;
  let bestGap = Infinity;
  for (const r of rows) {
    if (r.kind !== kind) continue;
    const gap = Math.abs(Date.parse(r.created_at) - at);
    if (gap <= 60_000 && gap < bestGap) {
      best = r;
      bestGap = gap;
    }
  }
  return best;
}

/** A link the card may open: only http(s). A note's words, or anything else, is never made a link. */
export function handoverLink(row: Pick<HandoverRow, 'kind' | 'payload'>): string | null {
  if (row.kind !== 'gallery_link' && row.kind !== 'file') return null;
  const p = (row.payload ?? '').trim();
  return /^https?:\/\/\S+$/i.test(p) ? p : null;
}

/** "★★★★☆" for a 1–5 rating — the filled part and the rest, so the card can colour them apart. */
export function starWords(rating: number): { on: string; off: string; label: string } {
  const n = Math.min(5, Math.max(0, Math.round(rating)));
  return { on: '★'.repeat(n), off: '★'.repeat(5 - n), label: `${n} of 5 stars` };
}

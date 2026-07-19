/**
 * Proposal PAYMENT SCHEDULE — pure self-balancing resolver.
 *
 * Vendor Proposal Maker · deferred half (see Vendor_Proposal_Maker_2026-07-10.md
 * § 8 "Payment schedule — self-balancing, pays to ₱0"). The shipped in-thread
 * editor composes LINE ITEMS; this module composes the SCHEDULE those line items
 * get paid on:
 *
 *   • seq-0 = the downpayment = the guest-side LOCK amount (the gold "locks"
 *     tag). Always present.
 *   • an auto "Final balance" row that ALWAYS makes the RAW plan pay to ₱0
 *     against `base_centavos` (the proposal total = line items + crew/transport −
 *     discount, BEFORE the crew-meal credit). autoBalance = base − Σ(manual);
 *     appended only when positive.
 *   • the crew-meal "offset — couple provides" CREDIT is deducted from the FINAL
 *     installment first and cascades UPWARD, never touching the downpayment
 *     (reuses applyCreditToFinalInstallment from ./package-line-pricing). If the
 *     credit exceeds everything-but-the-downpayment, the downpayment stays whole
 *     and the schedule flags `credit_over_centavos > 0` ("over — trim a
 *     payment") rather than silently eating the lock.
 *
 * PAY-TO-ZERO GUARANTEE. All math is in whole CENTAVOS (integer). When
 * `balances` is true (no over-cover, credit fits): Σ(raw) = base_centavos
 * EXACTLY (autoBalance is the exact integer remainder), and after the credit
 * Σ(amount_centavos) = base − credit = the net the couple actually pays. There
 * is never a non-zero residual and no amount is ever negative.
 *
 * PURE + TOTAL — no I/O; never throws on missing / malformed input (a quote
 * preview or a send must not crash on a half-filled draft). The server
 * re-resolves from the drafts (sanitizeAndResolveSchedule) so the persisted
 * numbers are authoritative, never the client's arithmetic.
 */
import { applyCreditToFinalInstallment } from '@/lib/package-line-pricing';

export type InstallmentKind = 'fixed' | 'percent';
/** When an installment is due. Mirrors vendor_service_payment_schedules.due_anchor,
 *  plus 'on_event' (the prototype's "Event day"). */
export type InstallmentDue = 'on_lock' | 'before_event' | 'on_event';

/** One manual installment as the editor / wire payload carries it (human units:
 *  whole pesos for fixed, whole percent 0–100 for percent). */
export type InstallmentDraft = {
  label: string;
  kind: InstallmentKind;
  /** Whole pesos when kind = 'fixed', else ignored. */
  amountPhp: number | null;
  /** Whole percent 0–100 when kind = 'percent', else ignored. */
  percent: number | null;
  due: InstallmentDue;
  /** Days before the event when due = 'before_event'; ignored otherwise. */
  offsetDays: number;
};

/** Config for the single auto "Final balance" row (its label + due timing). */
export type AutoBalanceMeta = {
  label: string;
  due: InstallmentDue;
  offsetDays: number;
};

/** One resolved installment (centavos), post-credit — the persisted/display shape. */
export type ResolvedInstallment = {
  seq: number;
  label: string;
  /** 'auto' for the generated Final balance row; else the draft's kind. */
  kind: InstallmentKind | 'auto';
  /** Post-credit amount (what the couple sees / owes for this installment). */
  amount_centavos: number;
  /** Pre-credit resolved amount (before the crew credit reduced it). */
  raw_centavos: number;
  /** Basis points 0–10000 for percent installments, else null. */
  percent_bps: number | null;
  due: InstallmentDue;
  offset_days: number;
  is_downpayment: boolean;
  is_auto_balance: boolean;
  /** How much crew-meal credit was subtracted from this row (centavos). */
  credit_applied_centavos: number;
};

/** The frozen-on-send schedule snapshot stored in vendor_proposals.payment_schedule. */
export type ResolvedSchedule = {
  version: 1;
  /** The proposal total the RAW plan balances to (line items + crew/transport − discount). */
  base_centavos: number;
  /** Crew-meal "offset" credit deducted from the final installment first. */
  credit_centavos: number;
  /** Σ of every installment's post-credit amount (= base − credit when it balances). */
  total_centavos: number;
  /** True when the raw plan pays to ₱0 against base AND the credit fits below the downpayment. */
  balances: boolean;
  /** Manual installments over-cover the base by this much (centavos); 0 when fine. */
  over_by_centavos: number;
  /** Credit that couldn't be applied without touching the downpayment (centavos); 0 when fine. */
  credit_over_centavos: number;
  installments: ResolvedInstallment[];
};

/** Hard ceiling on manual installments — keeps the editor + card tidy. */
export const MAX_INSTALLMENTS = 12;

const DUES: readonly InstallmentDue[] = ['on_lock', 'before_event', 'on_event'];

/** Coerce to a finite integer (0 fallback). Keeps the resolver total. */
function int(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
}
/** Whole pesos → centavos (non-negative). */
function phpToCentavos(php: unknown): number {
  return Math.max(0, Math.round((Number(php) || 0) * 100));
}
/** Clamp a percent to 0–100. */
function clampPct(p: unknown): number {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}
function normDue(d: unknown): InstallmentDue {
  return DUES.includes(d as InstallmentDue) ? (d as InstallmentDue) : 'on_lock';
}

/** Resolve one manual draft's RAW (pre-credit) amount in centavos. */
function resolveRaw(d: InstallmentDraft, baseCentavos: number): number {
  if (d?.kind === 'percent') {
    return Math.max(0, Math.round((baseCentavos * clampPct(d.percent)) / 100));
  }
  return phpToCentavos(d?.amountPhp);
}

/**
 * Resolve the manual installments + auto Final balance into a self-balancing,
 * credit-adjusted schedule. See the module header for the pay-to-zero guarantee.
 */
export function resolveSchedule(input: {
  manual: InstallmentDraft[];
  autoBalance: AutoBalanceMeta;
  baseCentavos: number;
  creditCentavos: number;
}): ResolvedSchedule {
  const base = Math.max(0, int(input?.baseCentavos));
  const credit = Math.max(0, int(input?.creditCentavos));
  const drafts = (Array.isArray(input?.manual) ? input.manual : []).slice(0, MAX_INSTALLMENTS);

  // 1 · Resolve each manual installment to raw centavos (seq in array order).
  const rawRows: ResolvedInstallment[] = drafts.map((d, i) => {
    const raw = resolveRaw(d, base);
    return {
      seq: i,
      label: String(d?.label ?? '').trim().slice(0, 120) || `Payment ${i + 1}`,
      kind: d?.kind === 'percent' ? 'percent' : 'fixed',
      amount_centavos: raw,
      raw_centavos: raw,
      percent_bps: d?.kind === 'percent' ? Math.round(clampPct(d.percent) * 100) : null,
      due: normDue(d?.due),
      offset_days: Math.max(0, int(d?.offsetDays)),
      is_downpayment: i === 0,
      is_auto_balance: false,
      credit_applied_centavos: 0,
    };
  });

  const sumManual = rawRows.reduce((s, r) => s + r.raw_centavos, 0);
  const autoBalanceRaw = base - sumManual;
  const overBy = Math.max(0, sumManual - base);

  // 2 · Append the auto "Final balance" row when the plan is short of base. Its
  // amount is the EXACT integer remainder, so Σ(raw) = base exactly.
  const rows = rawRows.slice();
  if (autoBalanceRaw > 0) {
    rows.push({
      seq: rows.length,
      label: String(input?.autoBalance?.label ?? '').trim().slice(0, 120) || 'Final balance',
      kind: 'auto',
      amount_centavos: autoBalanceRaw,
      raw_centavos: autoBalanceRaw,
      percent_bps: null,
      due: normDue(input?.autoBalance?.due),
      offset_days: Math.max(0, int(input?.autoBalance?.offsetDays)),
      is_downpayment: false,
      is_auto_balance: true,
      credit_applied_centavos: 0,
    });
  }

  // 3 · Apply the crew-meal credit to the TAIL only (everything after the
  // downpayment = seq 0), final-first, never negative — the downpayment/lock is
  // protected. Reuses the shared applyCreditToFinalInstallment (generic integer
  // math; fed centavos via amount_php).
  const head = rows.slice(0, 1); // the downpayment (or empty for a degenerate no-installment draft)
  const tail = rows.slice(1);
  const coverable = tail.reduce((s, r) => s + r.raw_centavos, 0);
  const creditOver = Math.max(0, credit - coverable);

  // Reduce the tail final-first via the shared helper (integer, never negative);
  // it only touches amount_php, so map back onto the clean ResolvedInstallment.
  const reduced = applyCreditToFinalInstallment(
    tail.map((r) => ({ amount_php: r.raw_centavos })),
    credit,
  );
  const creditedTail: ResolvedInstallment[] = tail.map((r, i) => {
    const post = Math.max(0, int(reduced[i]?.amount_php));
    return { ...r, amount_centavos: post, credit_applied_centavos: Math.max(0, r.raw_centavos - post) };
  });

  const installments = [...head, ...creditedTail];
  const total = installments.reduce((s, r) => s + r.amount_centavos, 0);

  return {
    version: 1,
    base_centavos: base,
    credit_centavos: credit,
    total_centavos: total,
    balances: overBy === 0 && creditOver === 0,
    over_by_centavos: overBy,
    credit_over_centavos: creditOver,
    installments,
  };
}

/**
 * Server-side sanitize + resolve. Takes the raw wire payload the editor posts
 * (untrusted shapes), coerces it, and re-resolves through resolveSchedule so the
 * PERSISTED numbers come from the pure resolver, never the client's arithmetic.
 * Returns null when there are no manual installments (→ store {} = no schedule).
 */
export function sanitizeAndResolveSchedule(raw: unknown): ResolvedSchedule | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as {
    manual?: unknown;
    autoBalance?: unknown;
    baseCentavos?: unknown;
    creditCentavos?: unknown;
  };
  const manualRaw = Array.isArray(obj.manual) ? obj.manual : [];
  if (manualRaw.length === 0) return null;

  const manual: InstallmentDraft[] = manualRaw.slice(0, MAX_INSTALLMENTS).map((m) => {
    const d = (m ?? {}) as Partial<InstallmentDraft>;
    return {
      label: String(d.label ?? '').slice(0, 120),
      kind: d.kind === 'percent' ? 'percent' : 'fixed',
      amountPhp: d.amountPhp == null ? null : int(d.amountPhp),
      percent: d.percent == null ? null : clampPct(d.percent),
      due: normDue(d.due),
      offsetDays: Math.max(0, int(d.offsetDays)),
    };
  });

  const abRaw = (obj.autoBalance ?? {}) as Partial<AutoBalanceMeta>;
  const autoBalance: AutoBalanceMeta = {
    label: String(abRaw.label ?? '').slice(0, 120) || 'Final balance',
    due: normDue(abRaw.due),
    offsetDays: Math.max(0, int(abRaw.offsetDays)),
  };

  return resolveSchedule({
    manual,
    autoBalance,
    baseCentavos: Math.max(0, int(obj.baseCentavos)),
    creditCentavos: Math.max(0, int(obj.creditCentavos)),
  });
}

/** Human-readable due timing for a couple/vendor-facing installment row. */
export function dueLabel(due: InstallmentDue, offsetDays: number): string {
  if (due === 'before_event') {
    const d = Math.max(0, int(offsetDays));
    return `${d} day${d === 1 ? '' : 's'} before the event`;
  }
  if (due === 'on_event') return 'On the event day';
  return 'On booking (locks)';
}

/** Type guard for a stored ResolvedSchedule (non-empty, has installments). */
export function isResolvedSchedule(v: unknown): v is ResolvedSchedule {
  return (
    !!v &&
    typeof v === 'object' &&
    Array.isArray((v as ResolvedSchedule).installments) &&
    (v as ResolvedSchedule).installments.length > 0
  );
}

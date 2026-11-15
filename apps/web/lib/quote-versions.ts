/**
 * EVERY VERSION OF ONE QUOTE, AND WHAT CHANGED BETWEEN THEM.
 *
 * ── THE RULING (owner, 4 Nov 2026 · DECISION_LOG "WHO A SUPPLIER COUNTS · QUOTE
 * "WHAT CHANGED"…") ─────────────────────────────────────────────────────────────
 * "when we send a new quotation, it replaces the old quotation? and do we see the
 * changes made in each quotation? for both sides?" → approved prototype, "Yes,
 * build both". Earlier (2026-09-18): a supplier may update a quote; the update
 * supersedes the old one and must be accepted again.
 *
 * ── NO NEW COLUMN — THE VERSION IS ALREADY IN THE ROWS ─────────────────────────
 * A new quote has always been a NEW `vendor_proposals` row for the same
 * (event_id, vendor_profile_id), and `supersede_prior_vendor_proposals` retires
 * the one before it. So "version N" is the row's place among that pair's SENT
 * rows (every status but 'draft'), ordered by when it was sent; its predecessor
 * is the row before it. A `supersedes_proposal_id` column would be a second
 * source of truth for an order the rows already state.
 *
 * ── ONE DIFF, EVERY SURFACE ─────────────────────────────────────────────────
 * `quoteChanges` is the only place a difference between two quotes is decided.
 * The couple's card, the supplier's card, the "Every version" sheet and Admin ›
 * Disputes all draw `<QuoteWhatChanged>` from it — never a second comparison.
 * Held by `quote-versions.test.ts`.
 *
 * Pure. Nothing here reads or writes.
 */
import { dueLabel, isResolvedSchedule, type ResolvedSchedule } from '@/lib/proposal-payment-schedule';
import { formatCount } from '@/lib/format-number';

/** One stored line, as `vendor_proposals.line_items` holds it. */
export type QuoteVersionLine = {
  label: string | null;
  detail?: string | null;
  amount_centavos: number | null;
  /** A service/card id, when a line carries one — the stable identity to match on. */
  service_card_id?: string | null;
  card_id?: string | null;
  /** The Offer Maker offer this line IS (`vendor_offers.public_id`) — "applied" is derived from it (lib/offer-drop.ts). */
  offer_id?: string | null;
};

/** The columns a version needs — `QUOTE_VERSION_SELECT`. */
export type QuoteVersionRow = {
  proposal_id: string;
  public_id: string;
  event_id: string;
  vendor_profile_id: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  total_centavos: number;
  line_items: QuoteVersionLine[] | null;
  payment_schedule: unknown;
};

export const QUOTE_VERSION_SELECT =
  'proposal_id, public_id, event_id, vendor_profile_id, status, sent_at, created_at, total_centavos, line_items, payment_schedule' as const;

export type QuoteVersion = {
  proposalId: string;
  publicId: string;
  /** 1-based, within (event, supplier), in the order they were sent. */
  version: number;
  status: string;
  /** When it was sent (falls back to when it was made). ISO. */
  at: string;
  totalCentavos: number;
  lines: QuoteVersionLine[];
  /** One line naming the payment plan, or null when the quote carries none. */
  plan: string | null;
  /** The version this one replaced; null for version 1. */
  previous: QuoteVersion | null;
  /** `event_id|vendor_profile_id` — which quote this is a version of. */
  pair: string;
};

function lineLabel(li: QuoteVersionLine): string {
  return String(li?.label ?? '').trim();
}

function shownLines(raw: unknown): QuoteVersionLine[] {
  return (Array.isArray(raw) ? (raw as QuoteVersionLine[]) : []).filter((li) => lineLabel(li).length > 0);
}

function pct(bps: number | null): string | null {
  if (bps == null || !Number.isFinite(bps)) return null;
  const p = bps / 100;
  return `${Number.isInteger(p) ? p : p.toFixed(1)}%`;
}

function peso(centavos: number): string {
  const whole = centavos % 100 === 0;
  return `₱${(centavos / 100).toLocaleString('en-PH', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * The payment plan in one line — "30% to book · balance 30 days before the
 * event". Read from the frozen `payment_schedule`; null when there is none, so
 * a quote sent before schedules existed shows no plan line rather than a guess.
 */
export function quotePlanText(schedule: unknown): string | null {
  if (!isResolvedSchedule(schedule)) return null;
  const s = schedule as ResolvedSchedule;
  const parts = [...s.installments]
    .sort((a, b) => a.seq - b.seq)
    .map((inst) => {
      const amount = pct(inst.percent_bps) ?? peso(inst.amount_centavos);
      const when = dueLabel(inst.due, inst.offset_days).toLowerCase();
      if (inst.is_downpayment) return inst.due === 'on_lock' ? `${amount} to book` : `${amount} to book, ${when}`;
      if (inst.is_auto_balance) return `balance ${when}`;
      return `${amount} ${when}`;
    });
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Number the versions of every (event, supplier) pair in `rows`, newest last.
 * Drafts are not versions — they were never sent. Ties on the timestamp break
 * on `proposal_id` so the order is the same on every screen.
 */
export function orderQuoteVersions(rows: readonly QuoteVersionRow[]): QuoteVersion[] {
  const byPair = new Map<string, QuoteVersionRow[]>();
  for (const r of rows) {
    if (!r || r.status === 'draft') continue;
    const key = `${r.event_id}|${r.vendor_profile_id}`;
    const list = byPair.get(key) ?? [];
    if (!list.some((x) => x.proposal_id === r.proposal_id)) list.push(r);
    byPair.set(key, list);
  }
  const out: QuoteVersion[] = [];
  for (const list of byPair.values()) {
    const sorted = [...list].sort((a, b) => {
      const ta = Date.parse(a.sent_at ?? a.created_at) || 0;
      const tb = Date.parse(b.sent_at ?? b.created_at) || 0;
      return ta !== tb ? ta - tb : a.proposal_id < b.proposal_id ? -1 : 1;
    });
    let previous: QuoteVersion | null = null;
    sorted.forEach((r, i) => {
      const v: QuoteVersion = {
        proposalId: r.proposal_id,
        publicId: r.public_id,
        version: i + 1,
        status: r.status,
        at: r.sent_at ?? r.created_at,
        totalCentavos: Number(r.total_centavos) || 0,
        lines: shownLines(r.line_items),
        plan: quotePlanText(r.payment_schedule),
        previous,
        pair: `${r.event_id}|${r.vendor_profile_id}`,
      };
      out.push(v);
      previous = v;
    });
  }
  return out;
}

/** The versions of ONE pair (the pair `proposalId` belongs to), newest first — the "Every version" list. */
export function versionsNewestFirst(versions: readonly QuoteVersion[], proposalId: string): QuoteVersion[] {
  const self = versions.find((v) => v.proposalId === proposalId);
  if (!self) return [];
  return versions.filter((v) => v.pair === self.pair).sort((a, b) => b.version - a.version);
}

// ── WHAT CHANGED ──────────────────────────────────────────────────────────────

export type QuoteLineChange =
  | { kind: 'added'; label: string; to: number | null }
  | { kind: 'removed'; label: string; from: number | null }
  | { kind: 'changed'; label: string; from: number | null; to: number | null };

export type QuoteChanges = {
  /** Lines in their display order: changed and added (in the new order), then removed. */
  lines: QuoteLineChange[];
  /** The payment plan, when its wording differs. */
  plan: { from: string | null; to: string | null } | null;
  total: { from: number; to: number };
  /** How many things changed (lines + the plan) — "2 changes". The total is not counted. */
  count: number;
};

export type QuoteSide = {
  lines: readonly QuoteVersionLine[];
  plan: string | null;
  totalCentavos: number;
};

/**
 * A line's identity: its service/card id when it has one, else its name
 * (case- and space-insensitive). A name that repeats is matched by occurrence,
 * so two "Extra hour" lines are two lines, not one.
 */
function identities(lines: readonly QuoteVersionLine[]): Array<{ key: string; line: QuoteVersionLine }> {
  const seen = new Map<string, number>();
  return lines
    .filter((li) => lineLabel(li).length > 0)
    .map((line) => {
      const id = String(line.service_card_id ?? line.card_id ?? '').trim();
      const base = id ? `id:${id}` : `name:${lineLabel(line).toLowerCase().replace(/\s+/g, ' ')}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return { key: `${base}#${n}`, line };
    });
}

function amountOf(li: QuoteVersionLine): number | null {
  return typeof li.amount_centavos === 'number' && Number.isFinite(li.amount_centavos) ? li.amount_centavos : null;
}

/**
 * The two sides' lines, paired by identity, in display order: the newer side's order first, then what the older side
 * had and the newer one dropped. The ONE pairing — `quoteChanges` and `versionsSideBySide` both read it, so the list
 * of changes and the side-by-side sheet can never disagree about which line is which.
 */
function pairLines(
  prev: readonly QuoteVersionLine[],
  next: readonly QuoteVersionLine[],
): Array<{ key: string; before: QuoteVersionLine | null; after: QuoteVersionLine | null }> {
  const before = identities(prev);
  const after = identities(next);
  const beforeByKey = new Map(before.map((b) => [b.key, b.line]));
  const afterKeys = new Set(after.map((a) => a.key));
  return [
    ...after.map(({ key, line }) => ({ key, before: beforeByKey.get(key) ?? null, after: line })),
    ...before.filter(({ key }) => !afterKeys.has(key)).map(({ key, line }) => ({ key, before: line, after: null })),
  ];
}

export function quoteChanges(prev: QuoteSide, next: QuoteSide): QuoteChanges {
  const lines: QuoteLineChange[] = [];
  for (const { before: old, after: line } of pairLines(prev.lines, next.lines)) {
    if (line && !old) {
      lines.push({ kind: 'added', label: lineLabel(line), to: amountOf(line) });
    } else if (line && old && amountOf(old) !== amountOf(line)) {
      lines.push({ kind: 'changed', label: lineLabel(line), from: amountOf(old), to: amountOf(line) });
    } else if (old && !line) {
      lines.push({ kind: 'removed', label: lineLabel(old), from: amountOf(old) });
    }
  }
  const plan = (prev.plan ?? null) !== (next.plan ?? null) ? { from: prev.plan ?? null, to: next.plan ?? null } : null;
  return {
    lines,
    plan,
    total: { from: prev.totalCentavos, to: next.totalCentavos },
    count: lines.length + (plan ? 1 : 0),
  };
}

// ── SEE EVERY VERSION · SIDE BY SIDE ───────────────────────────────────────────

/** One row of the two-picker comparison: a line on either side (absent = `undefined`), or the plan, or the total. */
export type SideBySideRow = {
  key: string;
  label: string;
  kind: 'line' | 'plan' | 'total';
  /** Line: centavos, null = complimentary, undefined = not on that version. Plan: its words. Total: centavos. */
  a: number | string | null | undefined;
  b: number | string | null | undefined;
  /** Marked as changed — exactly the lines `quoteChanges` lists, the plan when it differs, the total when it moved. */
  changed: boolean;
};

/**
 * "See every version · side by side" (approved design 12 Nov — two pickers, one table, changed rows marked). Every
 * line of either version once, in the newer version's order, then the plan and the total. Built on `pairLines` +
 * `quoteChanges`, never a second comparison (🔒 quote-versions.test.ts: the marked rows ARE `quoteChanges`).
 */
export function versionsSideBySide(a: QuoteVersion, b: QuoteVersion): SideBySideRow[] {
  const changes = quoteChanges(
    { lines: a.lines, plan: a.plan, totalCentavos: a.totalCentavos },
    { lines: b.lines, plan: b.plan, totalCentavos: b.totalCentavos },
  );
  const rows: SideBySideRow[] = pairLines(a.lines, b.lines).map(({ key, before, after }) => ({
    key,
    label: lineLabel((after ?? before)!),
    kind: 'line',
    a: before ? amountOf(before) : undefined,
    b: after ? amountOf(after) : undefined,
    changed: !before || !after || amountOf(before) !== amountOf(after),
  }));
  rows.push({ key: 'plan', label: 'Payment plan', kind: 'plan', a: a.plan, b: b.plan, changed: changes.plan !== null });
  rows.push({ key: 'total', label: 'Total', kind: 'total', a: a.totalCentavos, b: b.totalCentavos, changed: changes.total.from !== changes.total.to });
  return rows;
}

/** The pair's versions oldest → newest, for the two pickers; empty when `proposalId` is not among them. */
export function versionsOldestFirst(versions: readonly QuoteVersion[], proposalId: string): QuoteVersion[] {
  return versionsNewestFirst(versions, proposalId).reverse();
}

/** The diff between a version and the one it replaced; null for version 1. */
export function changesSincePrevious(v: QuoteVersion): QuoteChanges | null {
  if (!v.previous) return null;
  return quoteChanges(
    { lines: v.previous.lines, plan: v.previous.plan, totalCentavos: v.previous.totalCentavos },
    { lines: v.lines, plan: v.plan, totalCentavos: v.totalCentavos },
  );
}

/** "Nov 2" — the day a version was sent, in Manila. */
export function versionDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

/** "Nov 2, 2026, 3:04:12 PM" Manila — Admin's exact timestamp. */
export function versionExactTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Manila',
  })} PHT`;
}

/** "Nov 2 · 3 lines · 2 changes" / "Oct 20 · 2 lines · first quote". */
export function versionSummary(v: QuoteVersion): string {
  const n = v.lines.length;
  const changes = changesSincePrevious(v);
  const tail = changes ? `${formatCount(changes.count)} change${changes.count === 1 ? '' : 's'}` : 'first quote';
  return `${versionDay(v.at)} · ${formatCount(n)} line${n === 1 ? '' : 's'} · ${tail}`;
}

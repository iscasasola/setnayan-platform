/**
 * saved-quote.ts — A SAVED QUOTE, AS THE ONE-SCREEN QUOTE KEEPS IT (simpler supplier dashboard step 4, 2026-10-14).
 *
 * Owner, completeness pass: *"Start from a saved quote" stays (`vendor_proposal_templates`; hidden when the supplier
 * has none)* — and the quote screen gains "Save this quote · reuse it next time". A template row has always held a
 * name, a body, terms and a package (`20261208006000_vendor_proposals.sql`); it never held the quote's LINES, so a
 * quote saved from the builder could only come back as its note. Migration `…_saved_quote_draft` adds ONE nullable
 * column, `quote_draft jsonb`, and this file is its whole shape: what is written, and how a read is trusted.
 *
 * 🔑 A SAVED QUOTE IS PRICES AND TERMS, NEVER A COUPLE. It holds the lines, crew meal, transport, discount and its
 * reason, how they pay and for how long it is good — nothing about the couple it was first written for, so starting
 * the next couple's quote from it can never carry the last couple's name, count or date. The guest count is the next
 * thread's own (`livePax`), never the saved one.
 *
 * ⚠ READ BACK AS UNTRUSTED. jsonb is whatever was written by whichever client wrote it; `parseSavedQuoteDraft` keeps
 * only the fields below, each clamped to its own range, and answers null for anything it cannot read — the builder then
 * keeps what it had (the same rule as a card or package seed that fails).
 */
import type { QuoteSeedLine } from './quote-from-service-card';
import { MAX_INSTALLMENTS, type AutoBalanceMeta, type InstallmentDraft } from './proposal-payment-schedule';

export const SAVED_QUOTE_VERSION = 1;
/** A saved quote holds at most this many lines (the builder has no hard cap; a template is not a catalogue). */
export const SAVED_QUOTE_MAX_LINES = 60;

export type SavedQuoteDraft = {
  v: typeof SAVED_QUOTE_VERSION;
  lines: QuoteSeedLine[];
  crew: { mode: 'included' | 'charge' | 'offset'; size: number; perHeadPhp: number };
  transport: { mode: 'included' | 'flat' | 'distance'; flatPhp: number };
  discountPhp: number;
  discountReason: string | null;
  schedule: { manual: InstallmentDraft[]; autoBalance: AutoBalanceMeta };
  /** "Good for" in days from the day it is sent; null = no end date. */
  validDays: number | null;
  note: string;
};

const num = (v: unknown, lo: number, hi: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
};
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const DUES = ['on_lock', 'before_event', 'on_event'] as const;

function parseLine(raw: unknown): QuoteSeedLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const label = str(r.label, 200).trim();
  if (!label) return null;
  return {
    label,
    basis: oneOf(r.basis, ['flat', 'per_pax', 'per_hour'] as const, 'flat'),
    free: r.free === true,
    flatPhp: num(r.flatPhp, 0, 100_000_000),
    ratePhp: num(r.ratePhp, 0, 10_000_000),
    minPax: Math.round(num(r.minPax, 0, 100_000)),
    basePhp: num(r.basePhp, 0, 100_000_000),
    inclHours: Math.round(num(r.inclHours, 0, 1_000)),
    extraPhp: num(r.extraPhp, 0, 10_000_000),
  };
}

function parseInstallment(raw: unknown): InstallmentDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const kind = oneOf(r.kind, ['fixed', 'percent'] as const, 'percent');
  return {
    label: str(r.label, 80) || 'Payment',
    kind,
    amountPhp: kind === 'fixed' ? num(r.amountPhp, 0, 100_000_000) : null,
    percent: kind === 'percent' ? Math.round(num(r.percent, 0, 100)) : null,
    due: oneOf(r.due, DUES, 'on_lock'),
    offsetDays: Math.round(num(r.offsetDays, 0, 3_650)),
  };
}

/** A jsonb value → a draft the builder can load, or null. Never throws. */
export function parseSavedQuoteDraft(raw: unknown): SavedQuoteDraft | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== SAVED_QUOTE_VERSION) return null;
  const lines = (Array.isArray(r.lines) ? r.lines : []).slice(0, SAVED_QUOTE_MAX_LINES).map(parseLine).filter((l): l is QuoteSeedLine => l !== null);
  if (lines.length === 0) return null;
  const crewRaw = (r.crew && typeof r.crew === 'object' ? r.crew : {}) as Record<string, unknown>;
  const transportRaw = (r.transport && typeof r.transport === 'object' ? r.transport : {}) as Record<string, unknown>;
  const scheduleRaw = (r.schedule && typeof r.schedule === 'object' ? r.schedule : {}) as Record<string, unknown>;
  const autoRaw = (scheduleRaw.autoBalance && typeof scheduleRaw.autoBalance === 'object' ? scheduleRaw.autoBalance : {}) as Record<string, unknown>;
  const manual = (Array.isArray(scheduleRaw.manual) ? scheduleRaw.manual : [])
    .slice(0, MAX_INSTALLMENTS)
    .map(parseInstallment)
    .filter((i): i is InstallmentDraft => i !== null);
  const reason = str(r.discountReason, 160).trim();
  const validDays = r.validDays == null ? null : Math.round(num(r.validDays, 1, 365));
  return {
    v: SAVED_QUOTE_VERSION,
    lines,
    crew: {
      mode: oneOf(crewRaw.mode, ['included', 'charge', 'offset'] as const, 'included'),
      size: Math.round(num(crewRaw.size, 0, 500)),
      perHeadPhp: num(crewRaw.perHeadPhp, 0, 100_000),
    },
    transport: {
      mode: oneOf(transportRaw.mode, ['included', 'flat', 'distance'] as const, 'included'),
      flatPhp: num(transportRaw.flatPhp, 0, 10_000_000),
    },
    discountPhp: num(r.discountPhp, 0, 100_000_000),
    discountReason: reason || null,
    schedule: {
      manual: manual.length > 0 ? manual : [{ label: 'First payment', kind: 'percent', amountPhp: null, percent: 20, due: 'on_lock', offsetDays: 0 }],
      autoBalance: {
        label: str(autoRaw.label, 80) || 'Final balance',
        due: oneOf(autoRaw.due, DUES, 'before_event'),
        offsetDays: Math.round(num(autoRaw.offsetDays, 0, 3_650)),
      },
    },
    validDays,
    note: str(r.note, 2000),
  };
}

/** "Good for" → the quote's `valid_until` (a PH civil day), counted from `todayIso`. Null = no end date. */
export function validUntilFor(todayIso: string, days: number | null): string {
  if (!days || !/^\d{4}-\d{2}-\d{2}$/.test(todayIso)) return '';
  const [y, m, d] = todayIso.split('-').map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d + days));
  return at.toISOString().slice(0, 10);
}

/** The reverse, for a quote opened with a date already set: whole days from today, or null when it is none of ours. */
export function validDaysOf(todayIso: string, validUntil: string): number | null {
  if (!validUntil || !/^\d{4}-\d{2}-\d{2}$/.test(validUntil) || !/^\d{4}-\d{2}-\d{2}$/.test(todayIso)) return null;
  const ms = Date.parse(`${validUntil}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`);
  const days = Math.round(ms / 86_400_000);
  return days > 0 ? days : null;
}

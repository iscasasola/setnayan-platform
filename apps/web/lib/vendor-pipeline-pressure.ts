import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * vendor-pipeline-pressure.ts — how full is a shop's pipeline for ONE date, and
 * the sentence that says so.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * The per-tier ceilings shipped on 2026-08-09 (migration 20271121655918) and
 * were shipped WITHOUT A NUMBER ANYWHERE ON SCREEN. `vendorWhitelistPerDate()`
 * in lib/vendor-tier-caps.ts had, until this file, ZERO callers in the whole
 * application — so the only way a supplier could learn how many customers they
 * may chase for one date was to be refused by it. The owner's own instruction
 * for this work: *"Being told 'you can't take another client' reads as broken
 * unless it is designed to read as a ladder."*
 *
 * ── THE COUNT IS NOT COMPUTED HERE, ON PURPOSE ──────────────────────────────
 * The obvious build is a Supabase query in TypeScript that counts accepted
 * threads on the date. That would be a SECOND copy of the predicate the
 * database trigger refuses on, and every second copy of a rule in this schema
 * has eventually drifted from the first. The count lives in ONE SQL function
 * (`vendor_whitelist_used_for_date`) called by BOTH the trigger and the reader
 * RPC this module wraps, so the sentence on the screen and the sentence in the
 * refusal cannot disagree.
 *
 * ── FAIL TOWARD SILENCE, NEVER TOWARD A WALL ────────────────────────────────
 * Every failure mode here renders NOTHING: caps switched off, unreadable, no
 * date chosen yet, an RPC error, a caller who does not own the thread. A
 * missing line costs a supplier a warning; an invented one tells them they are
 * full when they are not, on the screen where they decide whether to pursue a
 * real customer.
 *
 * PURE + I/O split, mirroring vendor-photo-challenge.ts: the decision and the
 * copy are pure functions with no clock and no env, and the reader takes its
 * Supabase client as an argument, so this module has no `server-only` import
 * and stays testable under `tsx --test`.
 */

/** How close to the ceiling a shop is for one date. */
export type PipelinePressureState =
  /** Room to spare. */
  | 'room'
  /** Exactly one slot left — the next accept is the last one. */
  | 'last'
  /** At (or somehow past) the ceiling: the next accept is refused. */
  | 'full';

export type PipelinePressure = {
  /** Customers already being chased for this date, EXCLUDING the one on screen. */
  used: number;
  /** This plan's ceiling for one date. */
  cap: number;
  state: PipelinePressureState;
  /** The event's calendar day, ISO `YYYY-MM-DD`. */
  dateIso: string;
};

/** Pure. `used` excludes the inquiry being looked at, so `used === cap` is full. */
export function pipelinePressureState(used: number, cap: number): PipelinePressureState {
  if (cap <= 0) return 'full';
  if (used >= cap) return 'full';
  if (used === cap - 1) return 'last';
  return 'room';
}

/**
 * "14 Feb" from an ISO calendar day. PURE.
 *
 * ⚠ Deliberately parsed from the STRING, never `new Date(iso)`. `event_date` is
 * a DATE column, so `new Date('2027-02-14')` is midnight UTC, and the local
 * getters then report the 13th to every reader west of Greenwich — the exact
 * bug that printed the wrong day on 41 screens (2026-08-04). Invalid input
 * returns null and the caller draws nothing.
 */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

export function pipelineDayLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-');
  const month = Number(m);
  const day = Number(d);
  if (!Number(y) || !month || !day || month < 1 || month > 12) return null;
  return `${day} ${MONTHS[month - 1]}`;
}

/**
 * The one sentence. PURE. Returns null when the date cannot be named, because a
 * ceiling sentence with no date in it is not actionable — a supplier holds
 * different pipelines on different days and "you are full" without a day reads
 * as the whole shop being shut.
 */
export function pipelinePressureLine(p: PipelinePressure): string | null {
  const day = pipelineDayLabel(p.dateIso);
  if (!day) return null;
  if (p.state === 'full') {
    return `You're chasing ${p.used} of ${p.cap} for ${day} — your plan's limit.`;
  }
  if (p.state === 'last') {
    return `Your last slot for ${day} — you're chasing ${p.used} of ${p.cap}.`;
  }
  return `You're chasing ${p.used} of ${p.cap} customers for ${day}.`;
}

/**
 * Read the pressure for the inquiry on screen, or null to draw nothing.
 *
 * Call with the supplier's OWN session client: the RPC is caller-scoped through
 * `current_vendor_profile_ids()` and returns no rows for a thread the caller's
 * shops do not own. Do NOT hand it a service-role client "for authority" — that
 * would answer for a thread the caller has no business reading.
 *
 * Returns null when the ceilings are switched off. The screen must not announce
 * a limit that would not actually refuse anything: a supplier told "2 of 3"
 * while nothing is enforced has been told something untrue about their own
 * account.
 */
export async function fetchPipelinePressure(
  supabase: SupabaseClient,
  threadId: string,
): Promise<PipelinePressure | null> {
  try {
    const { data, error } = await supabase.rpc('vendor_whitelist_pressure', {
      p_thread_id: threadId,
    });
    if (error || !data) return null;
    const row = (Array.isArray(data) ? data[0] : data) as
      | { used?: number; cap?: number; event_date?: string; enforced?: boolean }
      | undefined;
    if (!row || row.enforced !== true) return null;
    const used = Number(row.used);
    const cap = Number(row.cap);
    const dateIso = typeof row.event_date === 'string' ? row.event_date : '';
    if (!Number.isFinite(used) || !Number.isFinite(cap) || cap <= 0 || !dateIso) {
      return null;
    }
    return { used, cap, dateIso, state: pipelinePressureState(used, cap) };
  } catch {
    return null;
  }
}

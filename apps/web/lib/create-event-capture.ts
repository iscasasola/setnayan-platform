/**
 * create-event-capture.ts — resolve the optional date / guest-count / budget-band
 * a couple can now enter when creating a NON-WEDDING event.
 *
 * Owner decision (2026-07-12): relax the locked "single-field, name-only"
 * creation (iteration 0000 §2.5) for the non-wedding inline create form. The
 * couple can optionally seed their timing + guest count + budget so the Event
 * Brief and (once anchored) the planning checklist have real signal.
 *
 * DATE MODEL — matches the wedding wizard, NOT a single locked date (owner
 * 2026-07-12: "we used to give them up to 4 dates or a range"):
 *   - 'specific' → up to 4 candidate dates  → events.date_candidates
 *   - 'window'   → a start..end range        → events.date_window_start/end
 * `events.event_date` stays NULL — the LOCKED single date is chosen later
 * (date-as-output; the date-selection lock ceremony), exactly like weddings.
 *
 * Pure + admit-unknown: every field OPTIONAL, invalid input degrades to
 * null/[]/none (never throws), and the budget amount only resolves when BOTH a
 * real band and a guest count are present. Trivially unit-testable.
 */

import type { BudgetBand } from './budget-bands-shared';

export type CreateCaptureInput = {
  dateModeRaw?: FormDataEntryValue | null;
  /** All submitted candidate-date fields (FormData.getAll('date_candidate')). */
  dateCandidatesRaw?: (FormDataEntryValue | null)[];
  windowStartRaw?: FormDataEntryValue | null;
  windowEndRaw?: FormDataEntryValue | null;
  paxRaw?: FormDataEntryValue | null;
  budgetBandRaw?: FormDataEntryValue | null;
};

export type CreateCaptureFields = {
  /** 'specific' | 'window' | null (no usable date given). */
  dateMode: 'specific' | 'window' | null;
  /** Valid, de-duped, ordered candidate dates (max 4). Empty unless mode='specific'. */
  dateCandidates: string[];
  dateWindowStart: string | null;
  dateWindowEnd: string | null;
  estimatedPax: number | null;
  /** Canonical budget_band value (or null). */
  budgetBand: string | null;
  /** med (per-head pesos) × pax × 100. Null unless a real band + pax are both set. */
  estimatedBudgetCentavos: number | null;
};

const MAX_CANDIDATES = 4;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// Upper bound MATCHES the DB CHECK on events.estimated_pax (> 0 AND < 10000,
// migration 20260713010000). An out-of-range headcount must degrade to null
// here, never pass through to a Postgres CHECK failure that hard-fails creation.
const MAX_PAX = 9_999;

function str(v: FormDataEntryValue | null | undefined): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** A YYYY-MM-DD string that is also a REAL calendar date (rejects 2027-02-30),
 *  and — when `minDate` is given — is not in the past (no planning dates behind
 *  today, which would otherwise anchor a fresh event into recap/day-of mode). */
function validDate(raw: string, minDate: string | null): string | null {
  if (!ISO_DATE.test(raw)) return null;
  const t = Date.parse(`${raw}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  if (new Date(t).toISOString().slice(0, 10) !== raw) return null;
  if (minDate && raw < minDate) return null; // YYYY-MM-DD compares chronologically
  return raw;
}

function validPax(raw: string): number | null {
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= MAX_PAX ? n : null;
}

export function resolveCreateCapture(
  input: CreateCaptureInput,
  bands: readonly BudgetBand[],
  opts?: { today?: string },
): CreateCaptureFields {
  const minDate = opts?.today ?? null;
  const estimatedPax = validPax(str(input.paxRaw));

  // Budget — normalize legacy 'nolimit' → 'no_limit' (matches the onboarding commit).
  const rawBand = str(input.budgetBandRaw);
  const bandValue = rawBand === 'nolimit' ? 'no_limit' : rawBand;
  const band = bandValue ? bands.find((b) => b.value === bandValue) ?? null : null;
  const estimatedBudgetCentavos =
    band && band.med > 0 && estimatedPax != null
      ? Math.round(band.med * estimatedPax * 100)
      : null;

  // Dates — window when explicitly chosen AND a valid start/end pair, else the
  // candidate list (up to 4, de-duped, chronological). No usable date → null mode.
  const windowStart = validDate(str(input.windowStartRaw), minDate);
  const windowEnd = validDate(str(input.windowEndRaw), minDate);
  const wantsWindow = str(input.dateModeRaw) === 'window';

  let dateMode: 'specific' | 'window' | null = null;
  let dateCandidates: string[] = [];
  let dateWindowStart: string | null = null;
  let dateWindowEnd: string | null = null;

  if (wantsWindow && windowStart && windowEnd) {
    // Keep chronological (swap a backwards range rather than reject it).
    const [lo, hiRaw] = windowStart <= windowEnd ? [windowStart, windowEnd] : [windowEnd, windowStart];
    // Platform convention (date_window comment on migration 20260719000000): a
    // window spans at most 30 days inclusive (start + 29). Clamp rather than
    // reject so an over-long range still yields a usable window.
    const maxHi = new Date(Date.parse(`${lo}T00:00:00Z`) + 29 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    dateMode = 'window';
    dateWindowStart = lo;
    dateWindowEnd = hiRaw > maxHi ? maxHi : hiRaw;
  } else {
    const seen = new Set<string>();
    for (const raw of input.dateCandidatesRaw ?? []) {
      const d = validDate(str(raw), minDate);
      if (d && !seen.has(d)) {
        seen.add(d);
        dateCandidates.push(d);
        if (dateCandidates.length >= MAX_CANDIDATES) break;
      }
    }
    dateCandidates.sort();
    if (dateCandidates.length > 0) dateMode = 'specific';
  }

  return {
    dateMode,
    dateCandidates,
    dateWindowStart,
    dateWindowEnd,
    estimatedPax,
    budgetBand: band ? band.value : null,
    estimatedBudgetCentavos,
  };
}

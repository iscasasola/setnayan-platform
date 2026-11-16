/**
 * paper-intake-shared.ts — what the supplier's screen and the server intake share, kept free of `node:crypto` so a
 * client component can import it: the tries number, and THE ONE ANSWER TO "WHERE DOES THIS PAPER STAND?".
 */
import type { IntakeOutcome, IntakeReport } from '@/lib/paper-intake';

/** Tries per paper (owner 2026-11-14: "3 tries per paper"). */
export const MAX_TRIES = 3;

/**
 * 🧾 ONE PAPER, ONE STATE (walk W1-B12, 16 Nov 2026). The upload place drew a paper twice from two sources: the list
 * of what the last upload did (`IntakeReport`s) and the paper's row (`doc_uploads[slot]`) — so one paper could read
 * "We couldn't open that file" in the list and "Not clear enough · Try 2 of 3" or "Waiting for a photo" on its row.
 * Every word about a paper is now derived HERE, once, from the stored slot plus the last upload's report ON THAT
 * paper; the row and the count both draw this. A report that names no paper (a file we could not open or place) is
 * never a paper's state — the list says it belongs to no paper.
 *
 *   in       a clean read is filed                                    — "Recognised"
 *   person   filed, and a person at Setnayan checks it: the third unclear try (owner ruling 17 — it goes to the
 *            admin verification queue instead of locking the supplier out), or a file with no read of its own
 *   reading  an upload is being checked right now (nothing filed for this paper yet)
 *   refused  nothing kept yet, and the latest word on it was a refusal — its reason and its try count
 *   waiting  nothing sent for it yet
 *
 * `in` and `person` are the paper being IN — the same rule `isSlotComplete` counts (a stored `r2_key`), so the
 * "N of 3" beside the rows, Today's "Send your documents" and the Profile strip can never disagree with a row.
 * 🔒 lib/one-paper-one-state.test.ts
 */
export type PaperStateKind = 'in' | 'person' | 'reading' | 'refused' | 'waiting';

export type PaperStateView = {
  kind: PaperStateKind;
  /** The row's one status line. */
  text: string;
  /** Why the latest copy was refused (a refusal only), in the server's own words. */
  reason: string | null;
  /** Tries used on this paper. */
  attempts: number;
  /** The paper is in (filed) — counted in "N of 3". */
  isIn: boolean;
  /** What the last upload said about a paper that STAYS in ("This replaced…", "Only one of DTI or SEC is needed…",
   *  "…we kept the one you sent before") — said under its row, never as a second status. */
  note?: string | null;
};

/** The person-check line (owner ruling 17) — once the papers are sent, and before (honest: a draft is not yet in the
 *  admin queue; it reaches it on Send for review, as every paper does). */
export const PERSON_CHECKS_PAPER = 'A person at Setnayan is checking this paper';
export const PERSON_WILL_CHECK_PAPER = 'A person at Setnayan checks this paper once you send your papers';

/** Outcomes that leave a paper refused — the copy was not kept. */
const REFUSALS: ReadonlySet<IntakeOutcome> = new Set<IntakeOutcome>([
  'unreadable',
  'expired',
  'different_name',
  'tries_used',
  'only_one_needed',
  'unknown',
  'other',
  'file_refused',
  'reader_unavailable',
]);

type StoredSlot = { r2_key?: unknown; manual?: unknown; attempts?: unknown; evidence?: { model?: unknown } | null } | null;

function stored(raw: unknown): StoredSlot {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as StoredSlot) : null;
}

/**
 * Where ONE paper stands: its stored slot (`doc_uploads[slot]`) and, when the last upload filed a word about THIS
 * paper, that report (the latest one for the paper). `reading` = an upload is being checked right now; `sent` = the papers
 * are with Setnayan (in review), so a person-checked paper is being checked now rather than once sent.
 */
export function paperState(
  raw: unknown,
  report: Pick<IntakeReport, 'outcome' | 'message' | 'attempts'> | null,
  opts: { reading?: boolean; sent?: boolean; sentBackReason?: string | null } = {},
): PaperStateView {
  const { reading = false, sent = false, sentBackReason = null } = opts;
  const s = stored(raw);
  const attempts = Math.max(
    typeof s?.attempts === 'number' && s.attempts > 0 ? Math.floor(s.attempts) : 0,
    typeof report?.attempts === 'number' ? report.attempts : 0,
  );
  // The SAME rule `isSlotComplete` counts by (`lib/vendor-verification.ts`: a stored `r2_key` string) — never a second one.
  const filed = typeof s?.r2_key === 'string';
  const note = report && report.outcome !== 'read_ok' ? report.message : null;
  if (filed && s?.manual !== true && s?.evidence?.model) {
    return { kind: 'in', text: 'Recognised', reason: null, attempts, isIn: true, note };
  }
  if (filed) {
    // The third unclear try (`manual`), or a file filed with no read of its own: either way a person checks it.
    return { kind: 'person', text: sent ? PERSON_CHECKS_PAPER : PERSON_WILL_CHECK_PAPER, reason: null, attempts, isIn: true, note };
  }
  // 📨 Setnayan sent THIS paper back (owner 2026-11-14, "Only the named one") and no new copy is filed yet.
  if (sentBackReason) {
    return { kind: 'refused', text: `Needs a new copy · ${sentBackReason}`, reason: sentBackReason, attempts, isIn: false };
  }
  if (reading) return { kind: 'reading', text: 'Reading…', reason: null, attempts, isIn: false };
  const refusedNow = report && REFUSALS.has(report.outcome) ? report.message : null;
  if (refusedNow || attempts > 0) {
    const counted = !report || report.outcome === 'unreadable';
    const tries =
      attempts > 0 && counted
        ? ` · Try ${Math.min(attempts + 1, MAX_TRIES)} of ${MAX_TRIES}${attempts + 1 >= MAX_TRIES ? ' · last one' : ''}`
        : report && !counted
          ? ' · Not counted as a try'
          : '';
    const reason = refusedNow ?? 'Not clear enough — not kept';
    return { kind: 'refused', text: `${reason}${tries}`, reason, attempts, isIn: false };
  }
  return { kind: 'waiting', text: 'Waiting for a photo', reason: null, attempts, isIn: false };
}

/** The latest report the last upload made about each paper (a later page of the same upload wins). */
export function latestReportBySlot<R extends Pick<IntakeReport, 'slot'>>(reports: readonly R[]): Partial<Record<string, R>> {
  const out: Partial<Record<string, R>> = {};
  for (const r of reports) if (r.slot) out[r.slot] = r;
  return out;
}

/** The reports that name NO paper — the only ones the list draws on its own (they are nobody's state). */
export function unplacedReports<R extends Pick<IntakeReport, 'slot'>>(reports: readonly R[]): R[] {
  return reports.filter((r) => !r.slot);
}

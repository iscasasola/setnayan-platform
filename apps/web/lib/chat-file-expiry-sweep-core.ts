/**
 * THE CHAT FILE EXPIRY SWEEP — the decision and the order of operations, pure.
 * The I/O is injected (`lib/chat-file-expiry-sweep.ts` binds the real database
 * and R2), so `chat-file-expiry-sweep.test.ts` RUNS this against fakes: what is
 * selected, what is never selected, what a dry run touches, and what counts as
 * "deleted".
 *
 * Owner, 2026-10-28 (DECISION_LOG "CHAT FILES"): every chat file that is not a
 * contract, a payment proof or pinned to Decisions is deleted from R2 90 days
 * after the event; the message stays, showing "File expired" with its name.
 * *"the R2 delete is MEASURED, never claimed."*
 *
 * ── THE ORDER, AND WHY ──────────────────────────────────────────────────────
 *   1. delete the object;
 *   2. HEAD it — only an explicit 404 counts as deleted (`deleted`);
 *      anything else is `unconfirmed` and the pointer is KEPT, so the next run
 *      tries again (a DELETE of an already-gone key is harmless — idempotent);
 *   3. only then clear `attachment_r2_key` (compare-and-swap on the same ref),
 *      keeping `attachment_name`. Clearing first would orphan an object no run
 *      could ever find again.
 *
 * ⚠ IRREVERSIBLE — the bucket is not versioned. That is why the job ships OFF
 * (`CHAT_FILE_EXPIRY_ENABLED`, server-side, opt-in `=== 'true'`): switched off it
 * runs as a DRY RUN that deletes nothing and reports what it would have done.
 */

import {
  CHAT_KEPT_FOREVER_COLUMNS,
  expiryDateFor,
  isKeptForever,
  isPastExpiry,
  type ChatFileMessage,
} from '@/lib/chat-file-rules';

export const CHAT_FILE_EXPIRY_BATCH = 200;

export type ChatFileCandidate = ChatFileMessage & {
  message_id: string;
  thread_id: string;
  attachment_r2_key: string | null;
  events: {
    event_date: string | null;
    event_end_date: string | null;
    event_date_precision: string | null;
  } | null;
};

export type ChatFileExpiryIO = {
  /** Messages whose event date is on or before `cutoff` and that still hold a file. */
  listCandidates(cutoff: string, limit: number): Promise<ChatFileCandidate[]>;
  /** The refs among these that a proof / contract column ALSO names. Throw on a failed read. */
  refsKeptElsewhere(refs: string[]): Promise<Set<string>>;
  deleteObject(ref: string, threadId: string): Promise<'deleted' | 'refused'>;
  /** 'absent' ONLY on an explicit 404. */
  headObject(ref: string): Promise<'absent' | 'present' | 'unknown'>;
  /** Clear the ref (keep the name) iff it still equals `ref`. TRUE when one row changed. */
  markExpired(messageId: string, ref: string): Promise<boolean>;
};

export type ChatFileExpirySummary = {
  dryRun: boolean;
  scanned: number;
  /** Past 90 days and not kept forever. */
  due: number;
  /** Selected by the read but kept: pinned to Decisions, or a proof/contract also names it. */
  keptForever: number;
  /** Would have been deleted (dry run only). */
  wouldDelete: number;
  /** MEASURED: deleted AND a HEAD then said 404. */
  deleted: number;
  /** Deleted, but the HEAD did not say 404 — pointer kept, retried next run. */
  unconfirmed: number;
  /** The ref was not this thread's own file — left alone. */
  refused: number;
  /** Messages now showing "File expired". */
  marked: number;
  failed: number;
};

/** The latest event day whose files are due today: today − 90 days (Manila). */
export function expiryCutoff(now: Date): string {
  // expiryDateFor(d) = d + 90; due when today ≥ d + 90 ⇔ d ≤ today − 90.
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 90)).toISOString().slice(0, 10);
}

/** Is THIS row due? The one predicate — the read only narrows, this decides. */
export function isDueForExpiry(row: ChatFileCandidate, now: Date): boolean {
  if (!row.attachment_r2_key) return false;
  if (isKeptForever(row)) return false;
  const ev = row.events;
  if (!ev) return false;
  const expiry = expiryDateFor(ev.event_date, {
    endDate: ev.event_end_date,
    precision: ev.event_date_precision,
  });
  return isPastExpiry(now, expiry);
}

export async function runChatFileExpirySweepWith(
  io: ChatFileExpiryIO,
  opts: { now?: Date; dryRun: boolean; limit?: number },
): Promise<ChatFileExpirySummary> {
  const now = opts.now ?? new Date();
  const limit = Math.max(1, Math.min(opts.limit ?? CHAT_FILE_EXPIRY_BATCH, 1000));
  const s: ChatFileExpirySummary = {
    dryRun: opts.dryRun,
    scanned: 0,
    due: 0,
    keptForever: 0,
    wouldDelete: 0,
    deleted: 0,
    unconfirmed: 0,
    refused: 0,
    marked: 0,
    failed: 0,
  };

  const rows = await io.listCandidates(expiryCutoff(now), limit);
  s.scanned = rows.length;

  const due: ChatFileCandidate[] = [];
  for (const r of rows) {
    if (r.attachment_r2_key && isKeptForever(r)) {
      s.keptForever += 1;
      continue;
    }
    if (isDueForExpiry(r, now)) due.push(r);
  }
  if (due.length === 0) return s;

  // A proof or contract that names the same object keeps it. Fail CLOSED: a
  // failed read here deletes nothing this run.
  let elsewhere: Set<string>;
  try {
    elsewhere = await io.refsKeptElsewhere(due.map((r) => r.attachment_r2_key as string));
  } catch {
    s.failed += due.length;
    return s;
  }

  for (const r of due) {
    const ref = r.attachment_r2_key as string;
    if (elsewhere.has(ref)) {
      s.keptForever += 1;
      continue;
    }
    s.due += 1;
    if (opts.dryRun) {
      s.wouldDelete += 1;
      continue;
    }
    try {
      const outcome = await io.deleteObject(ref, r.thread_id);
      if (outcome === 'refused') {
        s.refused += 1;
        continue;
      }
      const head = await io.headObject(ref);
      if (head !== 'absent') {
        s.unconfirmed += 1;
        continue;
      }
      s.deleted += 1;
      if (await io.markExpired(r.message_id, ref)) s.marked += 1;
      else s.failed += 1;
    } catch {
      s.failed += 1;
    }
  }
  return s;
}

/** The kept-forever columns the read must filter `IS NULL` on — re-exported for the binder. */
export const KEPT_FOREVER_FILTER_COLUMNS = CHAT_KEPT_FOREVER_COLUMNS;

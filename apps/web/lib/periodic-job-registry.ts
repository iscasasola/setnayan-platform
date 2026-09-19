/**
 * THE CRON-FREE JOB CATALOG, AND HOW TO READ A RUN — pure, no server-only.
 *
 * This repo has no scheduler. Every periodic job rides on request traffic
 * through Next `after()` and a DB compare-and-swap (`claim_periodic_job`) picks
 * one winner per window. That design is DELIBERATE and is not what this module
 * changes (see app/admin/admin-carries-the-cron-free-jobs.test.ts).
 *
 * What it changes is what the record SAYS. Until 2026-09-15 `cron_job_runs` held
 * two columns — job_key and last_run_at — and last_run_at was stamped at the
 * instant of the CLAIM, before the body ran, inside a catch that swallowed every
 * failure. 🔑 A retention sweep that threw left a FRESH timestamp and did not
 * retry for a full week; a silently failing deletion job and a working one were
 * byte-identical from every record we keep. `/privacy` promises deletions with
 * dates on them under RA 10173, and the only evidence any of them had happened
 * was a timestamp meaning "somebody was about to try".
 *
 * ⚠ THIS FILE IS PURE ON PURPOSE. `lib/periodic-jobs.ts` imports 'server-only',
 * so a `tsx --test` file cannot import it — and a guard that can only grep is a
 * guard that cannot execute the decision. Everything here that can be got wrong
 * (which key belongs to which promise, what counts as "never closed", what
 * counts as overdue) lives here, where a test RUNS it.
 */

/** ~once per day (the first eligible request after this gap wins the day). */
export const DAILY_GAP_MS = 20 * 60 * 60 * 1000;

/** ~once per week (slightly under 7d so it reliably fires each week). */
export const WEEKLY_GAP_MS = 6 * 24 * 60 * 60 * 1000;

/**
 * How long after a claim a run may still legitimately be in flight.
 *
 * A job body runs inside a Vercel `after()` budget, measured in seconds to a
 * couple of minutes. Fifteen minutes is generous by an order of magnitude and
 * still far below the SHORTEST configured gap (10 minutes for the delivery
 * drain — so a drain that is genuinely stuck is caught on the following claim).
 * Past this, an open row is not "still working", it is dead.
 */
export const RUN_STALL_GRACE_MS = 15 * 60 * 1000;

/*
 * ⛔ THERE IS DELIBERATELY NO FRESHNESS RULE HERE, AND NONE MAY BE ADDED.
 *
 * "Every job has run within its configured gap" is the check this file exists
 * to NOT have. Several of these jobs are CORRECTLY idle for long stretches
 * because their trigger is a page nobody has opened — that is the cron-free
 * design working, not a defect.
 *
 * 🔑 THE WORKED EXAMPLE, MEASURED 2026-09-15. `samahan-story-sweep` is an
 * HOURLY job that had been silent for ten days and twenty-one hours. That reads
 * as a five-alarm fire. It was perfectly healthy: its only caller is a single
 * Samahan community page, nobody had opened one in eleven days, and the table
 * held zero rows and zero expired rows. A correct job, on an unvisited page,
 * with nothing to do.
 *
 * 🔑 AND THAT IS PRECISELY WHY OUTCOMES ARE WORTH RECORDING: a job that HAS NOT
 * RUN and a job with NOTHING TO DO produce the same silence. What separates
 * them is `rows_affected`, not the clock. Answering "is this job broken?" took
 * six queries; with an outcome on the row it takes one.
 *
 * The property this module classifies is CLAIMED ⇒ CLOSED. Never claimed-on-time.
 * A check that cries wolf on correct behaviour teaches everyone to ignore it,
 * which is worse than having no check.
 */

export type JobKind =
  /** Deletes or degrades personal data on a clock `/privacy` prints. */
  | 'retention'
  /** Everything else — sends, probes, heals, drains. */
  | 'operational';

export type PeriodicJob = {
  key: string;
  kind: JobKind;
  gapMs: number;
  /** Plain English, for the owner. He does not read code. */
  what: string;
  /**
   * TRUE when the body returns a number the run must record. Every retention
   * job does: "deleted 0" is the answer a filing asks for, and it has to be
   * distinguishable from "we never found out".
   */
  reportsCount: boolean;
};

/**
 * Every key passed to claimPeriodicJob anywhere in the tree.
 *
 * ➕ ADDING A JOB? Add it here in the same commit. `runClaimedJob` is the only
 * way to claim one, and `lib/jobs-close-what-they-claim.test.ts` counts the call
 * sites against this list — a job added without a row here fails that guard,
 * in front of a reviewer, rather than becoming a twenty-third thing whose
 * outcome nobody records.
 */
export const PERIODIC_JOBS: readonly PeriodicJob[] = [
  // ── Retention: the promises on /privacy with dates attached ──────────────
  {
    key: 'retention-sweep',
    kind: 'retention',
    gapMs: WEEKLY_GAP_MS,
    what: 'Chat threads deleted 5 years after the event (orders held 10 years for BIR)',
    reportsCount: true,
  },
  {
    key: 'face-data-retention',
    kind: 'retention',
    gapMs: WEEKLY_GAP_MS,
    what: 'Face-recognition data deleted 3 months after the event ends',
    reportsCount: true,
  },
  {
    key: 'vendor-identity-retention',
    kind: 'retention',
    gapMs: WEEKLY_GAP_MS,
    what: "A supplier's raw identity uploads deleted 90 days after the decision",
    reportsCount: true,
  },
  {
    key: 'vendor-dossier-retention',
    kind: 'retention',
    gapMs: WEEKLY_GAP_MS,
    what: 'Deep Search supplier dossiers deleted after 180 days',
    reportsCount: true,
  },
  {
    key: 'papic-fullres-drop',
    kind: 'retention',
    gapMs: WEEKLY_GAP_MS,
    what: 'Full-resolution originals replaced by the compressed copy at 6 months',
    reportsCount: true,
  },
  {
    key: 'connection-request-expiry',
    kind: 'retention',
    gapMs: DAILY_GAP_MS,
    what: 'Unanswered and declined connection requests deleted',
    reportsCount: true,
  },
  {
    key: 'anon-draft-sweep',
    kind: 'retention',
    gapMs: DAILY_GAP_MS,
    what: 'Abandoned anonymous drafts cleaned up',
    reportsCount: true,
  },
  {
    key: 'samahan-story-sweep',
    kind: 'retention',
    gapMs: 60 * 60 * 1000,
    what: 'Expired Samahan stories and their files reclaimed',
    reportsCount: true,
  },
  // ── Operational ──────────────────────────────────────────────────────────
  {
    key: 'anniversary-digest',
    kind: 'operational',
    gapMs: DAILY_GAP_MS,
    what: 'The anniversary digest email',
    reportsCount: true,
  },
  {
    key: 'anniversary-headsup',
    kind: 'operational',
    gapMs: DAILY_GAP_MS,
    what: 'The anniversary heads-up email',
    reportsCount: true,
  },
  {
    key: 'godchild-birthday-reminder',
    kind: 'operational',
    gapMs: DAILY_GAP_MS,
    what: 'Godchild birthday reminders',
    reportsCount: true,
  },
  {
    key: 'renewal-reminders',
    kind: 'operational',
    gapMs: DAILY_GAP_MS,
    what: 'Subscription renewal reminders',
    reportsCount: true,
  },
  {
    key: 'papic-fullres-drop-warning',
    kind: 'operational',
    gapMs: DAILY_GAP_MS,
    what: 'The two-week warning before full-resolution originals are compressed',
    reportsCount: true,
  },
  {
    key: 'supplier-night-before-email',
    kind: 'operational',
    gapMs: DAILY_GAP_MS,
    what: "The supplier's night-before reminder (ships off until flipped on)",
    reportsCount: true,
  },
  {
    key: 'verified-badge-deadlines',
    kind: 'operational',
    gapMs: DAILY_GAP_MS,
    what: 'Verified-badge 60-day reminder and expiry note',
    reportsCount: true,
  },
  {
    key: 'lock-request-expiry',
    kind: 'operational',
    gapMs: DAILY_GAP_MS,
    what: 'The lock-request nudge at day 5 and expiry at day 7',
    reportsCount: true,
  },
  {
    // S40 — the deletion-handshake quartet's own comment described this
    // notice ("informational... audit trail") for a month before anything
    // emitted it. No expiry: unlike the lock handshake, a deletion ask stays
    // pending until answered or cancelled, so this is a reminder only.
    key: 'deletion-request-nudge',
    kind: 'operational',
    gapMs: DAILY_GAP_MS,
    what: 'The day-3 reminder to a supplier sitting on a deletion request',
    reportsCount: true,
  },
  {
    key: 'seo-health',
    kind: 'operational',
    gapMs: DAILY_GAP_MS,
    what: 'The SEO health audit',
    reportsCount: false,
  },
  {
    key: 'seo-gsc',
    kind: 'operational',
    gapMs: DAILY_GAP_MS,
    what: 'The Search Console metrics pull',
    reportsCount: false,
  },
  {
    key: 'papic-drive-copy-retry',
    kind: 'operational',
    gapMs: DAILY_GAP_MS,
    what: 'Retry of stuck Google Drive copies',
    reportsCount: true,
  },
  {
    key: 'interconnection-probes',
    kind: 'operational',
    gapMs: 6 * 60 * 60 * 1000,
    what: 'The integration health probes',
    reportsCount: true,
  },
  {
    key: 'papic-nsfw-rescreen',
    kind: 'operational',
    gapMs: 20 * 60 * 1000,
    what: 'Re-screen of captures whose NSFW screen was dropped',
    reportsCount: true,
  },
  {
    // 🔴 ADDED 2026-09-18. The worker has existed since iteration 0011 as a
    // cron route with `TODO(0011): wire the actual cron schedule` on it — a
    // schedule that was never coming, because this repo has no scheduler by
    // design. Measured that day: five live Google grants (a couple's YouTube
    // and Drive, all three Live Studio pool channels) with every access token
    // expired, two of them since July, and every refresh token still plaintext
    // because this sweep is the only writer that seals one.
    key: 'oauth-refresh',
    kind: 'operational',
    gapMs: 60 * 60 * 1000,
    what: 'Renewal of the Google connections (YouTube, Drive, Live Studio)',
    reportsCount: true,
  },
  {
    key: 'photo-delivery-drain',
    kind: 'operational',
    gapMs: 10 * 60 * 1000,
    what: 'The stalled "Release to Drive" drainer',
    reportsCount: true,
  },
  {
    key: 'email-delivery-check',
    kind: 'operational',
    gapMs: 10 * 60 * 1000,
    what: 'Asking Resend whether each email we sent was delivered or bounced',
    reportsCount: true,
  },
] as const;

export const PERIODIC_JOB_KEYS: readonly string[] = PERIODIC_JOBS.map((j) => j.key);

export const RETENTION_JOB_KEYS: readonly string[] = PERIODIC_JOBS.filter(
  (j) => j.kind === 'retention',
).map((j) => j.key);

/**
 * Turn whatever a job body returned into the `rows_affected` that gets written.
 *
 * 🔑 0 AND NULL ARE DIFFERENT ANSWERS AND THIS IS WHERE THAT IS DECIDED.
 *   · 0    — "it ran and nothing was due". A complete, healthy, successful run,
 *            and for a retention promise it is the usual answer for months.
 *   · null — "this job reports no count at all". Absence of information.
 * Collapsing 0 into null would make a working deletion job indistinguishable
 * from one nobody measured, which is the whole defect being removed here.
 *
 * Lives in this pure module, and not inline in the server-only runner, so a
 * test can EXECUTE the decision rather than grep for it.
 */
export function normalizeRowsAffected(result: unknown): number | null {
  return typeof result === 'number' && Number.isFinite(result) ? Math.trunc(result) : null;
}

export function findPeriodicJob(key: string): PeriodicJob | undefined {
  return PERIODIC_JOBS.find((j) => j.key === key);
}

// ── Reading one row ─────────────────────────────────────────────────────────

/** One `cron_job_runs` row, as the columns actually are. */
export type JobRunRow = {
  job_key: string;
  last_run_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  ok: boolean | null;
  rows_affected: number | null;
  error: string | null;
};

export type JobState =
  /** No row at all — this job has never won a window. */
  | 'never-claimed'
  /**
   * The row predates outcome recording (migration 20271229157398). We know when
   * it was claimed and NOTHING about what it did. Not a failure. Not a success.
   */
  | 'no-outcome-recorded'
  /** Claimed, still inside the stall grace — plausibly in flight right now. */
  | 'running'
  /**
   * 🔑 THE ONE THIS WHOLE CHANGE EXISTS FOR. Claimed, never closed, past the
   * grace: the process died, the after() budget ran out, or the body hung —
   * and under the old two-column table this was INDISTINGUISHABLE from success.
   */
  | 'never-finished'
  /** Closed with ok = false. The catch that used to swallow it now writes it. */
  | 'failed'
  /**
   * Closed with ok = true. INCLUDING a run that touched nothing: `rows_affected`
   * 0 is a first-class healthy outcome — "it ran, nothing was due" — and is
   * reported as a result, never as a miss. There is no 'stale' or 'overdue'
   * state and there must not be one; see the note above the constants.
   */
  | 'ok';

export type JobVerdict = {
  key: string;
  state: JobState;
  /** TRUE when a person should look at this row. */
  needsAttention: boolean;
  /** One sentence, written for the owner, never naming a symbol. */
  summary: string;
};

function msSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? nowMs - t : null;
}

function humanGap(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 90) return `${min} minute${min === 1 ? '' : 's'}`;
  const hrs = Math.round(ms / 3600000);
  if (hrs < 48) return `${hrs} hours`;
  return `${Math.round(ms / 86400000)} days`;
}

/**
 * Classify one job's last run.
 *
 * `row` is undefined when the key has no row at all.
 *
 * ⚠ THE CADENCE IS NOT A PARAMETER HERE, ON PURPOSE. The catalog carries each
 * job's gap because it documents intent, but this function must never see it —
 * a gap in scope is an invitation to compare it against the clock, which is the
 * one rule this file refuses to have.
 */
export function classifyJobRun(
  key: string,
  row: JobRunRow | undefined,
  nowMs: number,
): JobVerdict {
  if (!row) {
    return {
      key,
      state: 'never-claimed',
      // NOT an alarm. A job whose trigger page nobody has opened yet has never
      // claimed, and that is the cron-free design behaving correctly.
      needsAttention: false,
      summary:
        'No run recorded yet. Nothing has triggered this job — which is normal until someone opens the page it rides on.',
    };
  }

  const sinceClaim = msSince(row.last_run_at, nowMs);
  const claimedAgo = sinceClaim == null ? 'an unknown time ago' : `${humanGap(sinceClaim)} ago`;

  // Legacy row: claimed before this table recorded outcomes. Say exactly that.
  if (!row.started_at && !row.finished_at && row.ok == null) {
    return {
      key,
      state: 'no-outcome-recorded',
      needsAttention: false,
      summary: `Last started ${claimedAgo}. This run predates outcome recording, so what it did was never written down — unknown, not failed. The next run will say.`,
    };
  }

  if (!row.finished_at) {
    const sinceStart = msSince(row.started_at, nowMs);
    if (sinceStart != null && sinceStart <= RUN_STALL_GRACE_MS) {
      return {
        key,
        state: 'running',
        needsAttention: false,
        summary: `Started ${humanGap(sinceStart)} ago and has not reported back yet. Still within the normal window.`,
      };
    }
    return {
      key,
      state: 'never-finished',
      needsAttention: true,
      summary: `Started ${claimedAgo} and NEVER FINISHED. It claimed the window — so nothing else ran it — and then stopped without saying whether it did anything.`,
    };
  }

  if (row.ok === false) {
    return {
      key,
      state: 'failed',
      needsAttention: true,
      summary: `Last run FAILED (${claimedAgo}): ${row.error ?? 'no message was recorded'}`,
    };
  }

  // 🔑 ZERO IS AN ANSWER. It is what "checked, nothing had come due" looks like,
  // and it must never read as a shrug or a failure — that is the defect this
  // whole change removes, reproduced one level up.
  const count =
    row.rows_affected == null
      ? 'This job does not report a count.'
      : row.rows_affected === 0
        ? 'It checked and nothing was due, so it changed nothing. That is a complete, successful run.'
        : `It handled ${row.rows_affected} record${row.rows_affected === 1 ? '' : 's'}.`;

  return {
    key,
    state: 'ok',
    needsAttention: false,
    summary: `Ran and finished ${claimedAgo}. ${count}`,
  };
}

/** Classify the whole catalog against whatever rows came back. */
export function classifyAllJobs(rows: readonly JobRunRow[], nowMs: number): JobVerdict[] {
  const byKey = new Map(rows.map((r) => [r.job_key, r]));
  return PERIODIC_JOBS.map((j) => classifyJobRun(j.key, byKey.get(j.key), nowMs));
}

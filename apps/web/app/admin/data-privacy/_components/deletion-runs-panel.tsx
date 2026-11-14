import { AlertTriangle } from 'lucide-react';
import { Badge, One, Row, Rows, Sec } from '@/app/admin/app-performance/_components/insights-parts';
import type { JobLedger } from '@/lib/periodic-job-health';
import { jobsInRenderOrder } from '@/lib/periodic-job-health';
import type { JobState, JobVerdict } from '@/lib/periodic-job-registry';

/**
 * "Deletions" — did the jobs behind our RA 10173 promises actually run?
 *
 * 🔑 WHY THIS TAB EXISTS. `cron_job_runs` recorded only WHEN a job was CLAIMED —
 * a timestamp written the instant before the body ran, inside a catch that
 * swallowed every failure — and NOTHING in the app read the table at all. So a
 * silently failing deletion job and a working one were byte-identical from every
 * record we kept, and there was nowhere to look even if they hadn't been.
 *
 * ⛔ THIS BOARD DOES NOT JUDGE FRESHNESS, AND MUST NOT START. A job here is
 * triggered by someone opening a page, not by a scheduler; several are
 * CORRECTLY quiet for long stretches. "Hourly job, silent for eleven days" was a
 * real and completely false alarm on 2026-09-15 — the job was fine, the page was
 * simply unvisited and the table was empty. The only thing red here means is
 * CLAIMED AND NEVER CLOSED, or FAILED.
 *
 * 🔑 AND "handled 0 records" IS A GOOD RESULT — it is what "checked, nothing was
 * due" looks like. It is printed as a completed run, never as a shrug.
 *
 * Drawn to the Insights drawing (admin_pub/insights.html › Privacy & NPC › Deletions): the verdict as the opening line
 * with the explanation in its ⓘ, then hairline rows each carrying its state as a badge — no tiles.
 */

const STATE_META: Record<JobState, { label: string; tone: 'ok' | 'danger' | 'info' | undefined; bad: boolean }> = {
  ok: { label: 'Ran and finished', tone: 'ok', bad: false },
  running: { label: 'Running now', tone: 'info', bad: false },
  'never-claimed': { label: 'No run yet', tone: undefined, bad: false },
  'no-outcome-recorded': { label: 'Outcome unknown', tone: undefined, bad: false },
  'never-finished': { label: 'Started, never finished', tone: 'danger', bad: true },
  failed: { label: 'Failed', tone: 'danger', bad: true },
};

function JobRow({ verdict, what }: { verdict: JobVerdict; what: string }) {
  const meta = STATE_META[verdict.state];
  return (
    <Row
      data="deletion-run"
      title={<span className="whitespace-normal">{what}</span>}
      sub={<span className="whitespace-normal">{verdict.summary}</span>}
      tone={meta.bad ? 'danger' : undefined}
      trail={<Badge tone={meta.tone}>{meta.label}</Badge>}
    />
  );
}

export function DeletionRunsPanel({ ledger }: { ledger: JobLedger }) {
  if (!ledger.ok) {
    // A failed read must never render as a clean board. An empty list and a
    // refused query look identical, and the second one is the dangerous one.
    return (
      <section>
        <p role="alert" className="mt-2 flex items-start gap-2 text-sm text-[var(--sn-danger)]">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <span>
            We could not read the job ledger, so this page cannot tell you whether the deletions ran. This is{' '}
            <strong>not</strong> the same as everything being fine. ({ledger.reason})
          </span>
        </p>
      </section>
    );
  }

  const byKey = new Map(ledger.verdicts.map((v) => [v.key, v]));
  const jobs = jobsInRenderOrder();
  const retention = jobs.filter((j) => j.kind === 'retention');
  const operational = jobs.filter((j) => j.kind !== 'retention');
  const attention = ledger.verdicts.filter((v) => v.needsAttention);

  return (
    <section data-deletion-runs="">
      <One
        label={
          attention.length === 0
            ? 'Nothing needs your attention: every job that started has also reported back.'
            : `${attention.length} job${attention.length === 1 ? '' : 's'} need${attention.length === 1 ? 's' : ''} a look — listed below.`
        }
      >
        Our privacy notice promises deletions with dates on them. Each job below records what it did the last time it
        ran, so a job that stops working looks different from one that is simply quiet. Handling 0 records is a good
        result — it means the job checked and nothing had come due yet. These run when someone uses the site, not on a
        timer, so a long gap between runs is normal and is not flagged here. What is flagged is a job that started and
        never said how it finished, or one that failed.
      </One>

      <Sec title="The promises on our privacy notice" count={retention.length} />
      <Rows label="The promises on our privacy notice">
        {retention.map((j) => {
          const v = byKey.get(j.key);
          return v ? <JobRow key={j.key} verdict={v} what={j.what} /> : null;
        })}
      </Rows>

      <Sec title="Everything else that runs on its own" count={operational.length} />
      <Rows label="Everything else that runs on its own">
        {operational.map((j) => {
          const v = byKey.get(j.key);
          return v ? <JobRow key={j.key} verdict={v} what={j.what} /> : null;
        })}
      </Rows>
    </section>
  );
}

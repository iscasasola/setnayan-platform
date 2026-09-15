import { CheckCircle2, CircleAlert, CircleDashed, Loader2, XCircle, HelpCircle } from 'lucide-react';
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
 */

const STATE_META: Record<
  JobState,
  { label: string; icon: typeof CheckCircle2; color: string; bad: boolean }
> = {
  ok: { label: 'Ran and finished', icon: CheckCircle2, color: 'var(--sn-success, #157347)', bad: false },
  running: { label: 'Running now', icon: Loader2, color: 'var(--m-slate-3)', bad: false },
  'never-claimed': { label: 'No run yet', icon: CircleDashed, color: 'var(--m-slate-3)', bad: false },
  'no-outcome-recorded': { label: 'Outcome unknown', icon: HelpCircle, color: 'var(--m-slate-3)', bad: false },
  'never-finished': { label: 'Started, never finished', icon: CircleAlert, color: 'var(--sn-danger, #b42318)', bad: true },
  failed: { label: 'Failed', icon: XCircle, color: 'var(--sn-danger, #b42318)', bad: true },
};

function Row({ verdict, what }: { verdict: JobVerdict; what: string }) {
  const meta = STATE_META[verdict.state];
  const Icon = meta.icon;
  return (
    <li className="sn-tile flex items-start gap-3 py-3">
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" style={{ color: meta.color }} strokeWidth={1.75} />
      <span className="min-w-0">
        <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
          {what}
        </span>
        <span className="mt-0.5 block text-sm" style={{ color: meta.bad ? 'var(--m-ink)' : 'var(--m-slate-2)' }}>
          <strong>{meta.label}.</strong> {verdict.summary}
        </span>
      </span>
    </li>
  );
}

export function DeletionRunsPanel({ ledger }: { ledger: JobLedger }) {
  if (!ledger.ok) {
    // A failed read must never render as a clean board. An empty list and a
    // refused query look identical, and the second one is the dangerous one.
    return (
      <section>
        <h2 className="sn-sec">Deletions</h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--sn-danger, #b42318)' }}>
          We could not read the job ledger, so this page cannot tell you whether the deletions
          ran. This is <strong>not</strong> the same as everything being fine. ({ledger.reason})
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
    <section>
      <h2 className="sn-sec">Deletions — did they actually run?</h2>
      <p className="mt-1 max-w-2xl text-sm" style={{ color: 'var(--m-slate-2)' }}>
        Our privacy notice promises deletions with dates on them. Each job below records what it
        did the last time it ran, so a job that stops working looks different from one that is
        simply quiet. <strong>Handling 0 records is a good result</strong> — it means the job
        checked and nothing had come due yet.
      </p>
      <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--m-slate-3)' }}>
        These run when someone uses the site, not on a timer, so a long gap between runs is normal
        and is not flagged here. What is flagged is a job that started and never said how it
        finished, or one that failed.
      </p>

      {attention.length === 0 ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--sn-success, #157347)' }}>
          Nothing needs your attention: every job that started has also reported back.
        </p>
      ) : (
        <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
          {attention.length} job{attention.length === 1 ? '' : 's'} need{attention.length === 1 ? 's' : ''} a
          look — listed below.
        </p>
      )}

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--m-slate-3)' }}>
        The promises on our privacy notice
      </p>
      <ul className="mt-2 space-y-1.5">
        {retention.map((j) => {
          const v = byKey.get(j.key);
          return v ? <Row key={j.key} verdict={v} what={j.what} /> : null;
        })}
      </ul>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--m-slate-3)' }}>
        Everything else that runs on its own
      </p>
      <ul className="mt-2 space-y-1.5">
        {operational.map((j) => {
          const v = byKey.get(j.key);
          return v ? <Row key={j.key} verdict={v} what={j.what} /> : null;
        })}
      </ul>
    </section>
  );
}

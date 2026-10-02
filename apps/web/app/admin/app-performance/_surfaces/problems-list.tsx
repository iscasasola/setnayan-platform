/**
 * PROBLEMS — the grouped list (owner 2026-10-02: "if not [successful], then it
 * should be flagged and traced and we get a list of this issue").
 *
 * One plain line per issue — what was pressed, where, what went wrong, how
 * often today, how often it fails out of every try — with the trace folded
 * under it. Open issues first, most-hit then newest. Issues close themselves
 * once a newer build is live and they stop recurring for 48 h, and reopen if
 * they come back. Then "where people stop" for the guided flows.
 *
 * Server component, no client JS and no server action: the read is
 * `readFaultIssues()` (lib/telemetry/fault-issues.server.ts), the same one the
 * controller uses to feed the change tracker. Rendered inside the existing
 * Connection Logs surface — no new page, no new route.
 */

import { formatCount } from '@/lib/format-number';
import { readFaultIssues, type FaultIssue } from '@/lib/telemetry/fault-issues.server';

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function IssueRow({ issue }: { issue: FaultIssue }) {
  return (
    <li className="m-card px-4 py-3">
      <details>
        <summary className="cursor-pointer list-none text-sm leading-snug text-[#1B1A17]">
          <span className="font-medium">{issue.line}</span>
          {issue.reopened_count > 0 ? (
            <span className="ml-2 rounded-full bg-danger-100 px-2 py-0.5 text-[11px] text-danger-800">
              came back ×{formatCount(issue.reopened_count)}
            </span>
          ) : null}
        </summary>
        <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs text-ink/75">
          <dt className="text-ink/50">Kind</dt>
          <dd>{issue.kind}</dd>
          <dt className="text-ink/50">What</dt>
          <dd className="break-all font-mono">{issue.action}</dd>
          {issue.page ? (
            <>
              <dt className="text-ink/50">Page</dt>
              <dd className="break-all font-mono">{issue.page}</dd>
            </>
          ) : null}
          {issue.message ? (
            <>
              <dt className="text-ink/50">Error</dt>
              <dd className="break-words font-mono">{issue.message}</dd>
            </>
          ) : null}
          <dt className="text-ink/50">Seen</dt>
          <dd>
            {formatCount(issue.hit_count)} times · first {ago(issue.first_seen)} · last {ago(issue.last_seen)}
          </dd>
          <dt className="text-ink/50">Build</dt>
          <dd className="font-mono">
            {issue.last_build_sha ? issue.last_build_sha.slice(0, 7) : 'unknown'}
            {issue.first_build_sha && issue.first_build_sha !== issue.last_build_sha
              ? ` (first on ${issue.first_build_sha.slice(0, 7)})`
              : ''}
          </dd>
          <dt className="text-ink/50">Trace</dt>
          <dd>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-[#1B1A17]/5 p-2 font-mono text-[11px]">
              {JSON.stringify(issue.last_trace, null, 2)}
            </pre>
          </dd>
        </dl>
      </details>
    </li>
  );
}

export async function ProblemsList() {
  const read = await readFaultIssues();
  if (!read.ok) {
    return (
      <div role="alert" className="rounded-card bg-[var(--sn-warning-soft)] p-6 text-center text-sm text-ink">
        Couldn&rsquo;t load the Problems list — refresh to try again. This is not an all-clear.
      </div>
    );
  }
  return (
    <section aria-label="Problems" className="space-y-4">
      <p className="max-w-2xl text-sm leading-relaxed text-ink/70">
        Every failed action, tap that did nothing, and dead end — grouped, most-hit first. An issue
        closes itself once a newer build is live and it has not come back for 48 hours.
      </p>

      {read.open.length === 0 ? (
        <p className="m-card px-4 py-3 text-sm text-ink/70">
          Nothing open. Every recorded problem has stopped happening.
        </p>
      ) : (
        <ul className="space-y-2">
          {read.open.map((i) => (
            <IssueRow key={i.id} issue={i} />
          ))}
        </ul>
      )}

      {read.dropOffs.length > 0 ? (
        <div className="space-y-2">
          <h2 className="m-label-mono text-[11px] uppercase tracking-[0.18em] text-[#8A6B39]">
            Where people stop
          </h2>
          <ul className="space-y-2">
            {read.dropOffs.map((d) => (
              <li key={d.flow} className="m-card px-4 py-3">
                <details>
                  <summary className="cursor-pointer list-none text-sm font-medium text-[#1B1A17]">{d.line}</summary>
                  <ol className="mt-2 space-y-0.5 text-xs text-ink/75">
                    {d.steps
                      .filter((s) => s.reached > 0)
                      .map((s) => (
                        <li key={s.step} className={d.worst?.step === s.step ? 'font-semibold text-danger-800' : ''}>
                          {s.step.replace(/_/g, ' ')} — {formatCount(s.reached)} reached
                          {s.stoppedHere > 0 ? ` · ${formatCount(s.stoppedHere)} stopped here` : ''}
                        </li>
                      ))}
                  </ol>
                </details>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {read.closed.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink/60">Recently closed ({read.closed.length})</summary>
          <ul className="mt-2 space-y-2 opacity-70">
            {read.closed.map((i) => (
              <IssueRow key={i.id} issue={i} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

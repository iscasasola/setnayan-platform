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
 * Server component, no server action: the read is `readFaultIssues()`
 * (lib/telemetry/fault-issues.server.ts), the same one the controller uses to
 * feed the change tracker. Rendered inside the existing Connection Logs
 * surface — no new page, no new route.
 *
 * Drawn to the approved drawing (admin_pub/insights.html › Problems, 14 Nov
 * 2026): the explanation lives in the opening ⓘ, each issue is a hairline row
 * that opens in place (the house `Fold`) onto its facts and its folded trace,
 * "Where people stop" and "Recently closed" are folds too — no cards (T18).
 */

import type { ReactNode } from 'react';

import { Fold } from '@/app/_components/fold';
import { formatCount } from '@/lib/format-number';
import { readFaultIssues, type FaultIssue } from '@/lib/telemetry/fault-issues.server';

import { Badge, Facts, One, Sec } from '../_components/insights-parts';

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function IssueRow({ issue }: { issue: FaultIssue }) {
  const seen = `${formatCount(issue.hit_count)} times · first ${ago(issue.first_seen)} · last ${ago(issue.last_seen)}`;
  const facts: [string, ReactNode][] = [
    ['Kind', issue.kind],
    ['What', <span className="break-all font-mono text-[13px]">{issue.action}</span>],
  ];
  if (issue.page) facts.push(['Page', <span className="break-all font-mono text-[13px]">{issue.page}</span>]);
  if (issue.message) facts.push(['Error', <span className="break-words font-mono text-[13px]">{issue.message}</span>]);
  facts.push(['Seen', seen]);
  facts.push([
    'Build',
    <span className="font-mono text-[13px]">
      {issue.last_build_sha ? issue.last_build_sha.slice(0, 7) : 'unknown'}
      {issue.first_build_sha && issue.first_build_sha !== issue.last_build_sha
        ? ` (first on ${issue.first_build_sha.slice(0, 7)})`
        : ''}
    </span>,
  ]);
  return (
    <Fold
      data="problem-issue"
      className="border-t border-ink/10"
      title={issue.line}
      line={seen}
      wrap
      aside={
        issue.reopened_count > 0 ? (
          <Badge tone="danger">came back ×{formatCount(issue.reopened_count)}</Badge>
        ) : undefined
      }
    >
      <div className="pb-3">
        <Facts rows={facts} />
        <Fold title="Trace" summary="JSON" className="border-t border-ink/10">
          <pre className="mb-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-ink/5 p-2 font-mono text-[11px] text-ink/80">
            {JSON.stringify(issue.last_trace, null, 2)}
          </pre>
        </Fold>
      </div>
    </Fold>
  );
}

export async function ProblemsList() {
  const read = await readFaultIssues();
  if (!read.ok) {
    return (
      <div role="alert" className="rounded-lg bg-[var(--sn-warning-soft)] px-3 py-2 text-sm text-ink">
        Couldn&rsquo;t load the Problems list — refresh to try again. This is not an all-clear.
      </div>
    );
  }
  return (
    <section aria-label="Problems">
      <One label="Most-hit first · closes itself">
        Every failed action, tap that did nothing, and dead end — grouped, most-hit first. An issue closes itself once a
        newer build is live and it has not come back for 48 hours.
      </One>

      <Sec title="Open" count={read.open.length} />
      {read.open.length === 0 ? (
        <div className="border-t border-ink/10 py-3">
          <p className="text-[15px] font-semibold text-ink">Nothing open.</p>
          <p className="text-[13px] text-ink/65">Every recorded problem has stopped happening.</p>
        </div>
      ) : (
        <div data-insights-rows="problems-open">
          {read.open.map((i) => (
            <IssueRow key={i.id} issue={i} />
          ))}
        </div>
      )}

      {read.dropOffs.length > 0 ? (
        <>
          <Sec
            title="Where people stop"
            about="Each flow’s steps: how many reached each step and how many stopped there. The worst step is marked."
          />
          <div data-insights-rows="problems-drop-offs">
            {read.dropOffs.map((d) => (
              <Fold key={d.flow} data="problem-flow" className="border-t border-ink/10" title={d.line} wrap>
                <ol className="pb-3">
                  {d.steps
                    .filter((s) => s.reached > 0)
                    .map((s) => (
                      <li
                        key={s.step}
                        className={`border-t border-ink/10 py-2 text-[13px] ${
                          d.worst?.step === s.step ? 'font-semibold text-[var(--sn-danger)]' : 'text-ink/75'
                        }`}
                      >
                        {s.step.replace(/_/g, ' ')} — {formatCount(s.reached)} reached
                        {s.stoppedHere > 0 ? ` · ${formatCount(s.stoppedHere)} stopped here` : ''}
                      </li>
                    ))}
                </ol>
              </Fold>
            ))}
          </div>
        </>
      ) : null}

      {read.closed.length > 0 ? (
        <Fold
          data="problems-closed"
          className="mt-3 border-y border-ink/10"
          title={`Recently closed (${read.closed.length})`}
          summary="stopped happening for 48 h on a newer build"
        >
          <div className="opacity-70">
            {read.closed.map((i) => (
              <IssueRow key={i.id} issue={i} />
            ))}
          </div>
        </Fold>
      ) : null}
    </section>
  );
}

/**
 * Insights Studio surface — "Browser blocks": what the browser-protection
 * policy WOULD have blocked, if it were switched from watching to blocking.
 *
 * WHY THIS EXISTS · Measured from the live site's own headers on 2026-08-17,
 * the ENFORCED Content-Security-Policy covers frames only; the wide policy is
 * sent report-only. That is correct and was always meant to be temporary — the
 * enforcement step was deferred until "the reports are boring".
 *
 * Nobody could tell whether they were boring. `/api/csp-report` ended at a
 * single `console.warn`, under a comment claiming a Sentry call that did not
 * exist, and function logs roll off. So the deferral had no exit: the evidence
 * needed to make the decision was never kept. This surface is that evidence.
 *
 * 🔴 READ-ONLY, AND DELIBERATELY HAS NO BUTTON. Tightening the policy is not a
 * click — it is a code change to `next.config.ts`, reviewed by the owner, made
 * once the origins below are understood. Our own frame policy blocked our own
 * map for weeks; a one-click "enforce" here would invite exactly that at
 * speed, on every page at once.
 *
 * WHAT A ZERO ACCOUNT SEES · An empty table is the expected state and must not
 * read as breakage: the policy is report-only, so no violations means nothing
 * on the site is currently outside the allowlist. The empty state says so.
 *
 * PRIVACY · Nothing personal reaches this table. `lib/csp-report.ts` reduces
 * the blocked URI to scheme+host and the document URI to a route SHAPE
 * (`/dashboard/:id`) before the write. No ids, tokens, query strings or slugs.
 */

import { ShieldAlert } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';

const ROW_LIMIT = 200;

type Row = {
  directive: string;
  blocked_origin: string;
  route_shape: string;
  day: string;
  hits: number;
  last_seen_at: string;
};

export async function BrowserBlocksSurface() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('csp_violation_reports')
    .select('directive,blocked_origin,route_shape,day,hits,last_seen_at')
    .order('hits', { ascending: false })
    .order('last_seen_at', { ascending: false })
    .limit(ROW_LIMIT);

  // ⚠ A FAILED READ IS NOT AN EMPTY LIST. Supabase resolves with `{ error }`
  // rather than throwing, so treating null as "no violations" would print a
  // reassuring "nothing was blocked" over a broken query — the same false calm
  // that let the report endpoint look healthy while it recorded nothing.
  if (error) {
    return (
      <section className="sn-col">
        <h2 className="text-lg font-medium text-ink">Browser blocks</h2>
        <p className="mt-3 rounded-lg border border-ink/15 bg-ink/[0.03] p-4 text-sm text-ink/80">
          Could not read the violation log, so this is <strong>not</strong> a
          statement that nothing was blocked — it is a statement that we do not
          know. ({error.message})
        </p>
      </section>
    );
  }

  const rows = (data ?? []) as Row[];
  const total = rows.reduce((n, r) => n + Number(r.hits ?? 0), 0);
  const origins = new Set(rows.map((r) => r.blocked_origin)).size;

  return (
    <section className="sn-col">
      <header className="flex items-start gap-3">
        <ShieldAlert aria-hidden className="mt-1 h-5 w-5 text-ink/60" />
        <div>
          <h2 className="text-lg font-medium text-ink">Browser blocks</h2>
          <p className="mt-1 text-sm text-ink/70">
            What the wide browser-protection policy <em>would</em> have stopped.
            It is currently watching, not blocking — so nothing here was
            actually blocked from a visitor. This is the evidence for deciding
            whether it is safe to switch it on.
          </p>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="mt-5 rounded-lg border border-ink/15 bg-ink/[0.03] p-4 text-sm text-ink/80">
          Nothing recorded yet. With the policy in watching mode, an empty list
          means no page has loaded anything outside the allowlist — which is the
          good outcome, not a broken screen. Reports began being kept on
          17 August 2026; anything before that was never written down.
        </p>
      ) : (
        <>
          <p className="mt-5 text-sm text-ink/70">
            <strong>{total.toLocaleString()}</strong>{' '}
            {total === 1 ? 'report' : 'reports'} across{' '}
            <strong>{origins}</strong> {origins === 1 ? 'source' : 'sources'}.
            A source that appears here repeatedly and is one of ours belongs in
            the allowlist before the policy is tightened.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink/15 text-left text-ink/60">
                  <th scope="col" className="py-2 pr-4 font-medium">Rule</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Source it wanted</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Page</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Day</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Times</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={`${r.directive}|${r.blocked_origin}|${r.route_shape}|${r.day}`}
                    className="border-b border-ink/10"
                  >
                    <td className="py-2 pr-4 font-mono text-xs text-ink">{r.directive}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-ink">{r.blocked_origin}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-ink/70">{r.route_shape}</td>
                    <td className="py-2 pr-4 text-ink/70">{r.day}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink">
                      {Number(r.hits).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length >= ROW_LIMIT ? (
            <p className="mt-3 text-xs text-ink/60">
              Showing the {ROW_LIMIT} busiest combinations. There are more.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

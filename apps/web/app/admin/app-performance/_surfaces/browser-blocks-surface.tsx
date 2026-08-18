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
 * (Measured in production 2026-08-17: this table holds zero rows.)
 *
 * PRIVACY · Nothing personal reaches this table. `lib/csp-report.ts` reduces
 * the blocked URI to scheme+host and the document URI to a route SHAPE
 * (`/dashboard/:id`) before the write. No ids, tokens, query strings or slugs.
 *
 * ── Converted to <ConsoleTable> 2026-08-17, and this one was already RIGHT ──
 * This file is where the archetype's rule came from: its own comment read
 * "A FAILED READ IS NOT AN EMPTY LIST" and it returned on the error before it
 * could render a list. Nothing about its behaviour changes here — the hand-
 * rolled markup is dropped, and the three sentences it had written by hand
 * (the refused-read report, the empty-is-the-good-outcome blurb, the row-cap
 * disclosure) are now the component's, so the next surface gets them for free
 * instead of having to remember them.
 */

import { ShieldAlert } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/require-admin';
import { ConsoleTable } from '@/app/admin/_components/console-table';

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

  // NULL survives to the render. Supabase resolves with `{ error }` rather than
  // throwing, so coercing here would be the one place the distinction is lost —
  // the same false calm that let the report endpoint look healthy while it
  // recorded nothing.
  const rows = data as Row[] | null;
  const listed = rows ?? [];
  const total = listed.reduce((n, r) => n + Number(r.hits ?? 0), 0);
  const origins = new Set(listed.map((r) => r.blocked_origin)).size;

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

      <div className="mt-5">
        <ConsoleTable
          rows={rows}
          readPermitted
          readError={error}
          reads="the violation log"
          cap={ROW_LIMIT}
          label="Browser blocks"
          minWidth="46rem"
          rowKey={(r) => `${r.directive}|${r.blocked_origin}|${r.route_shape}|${r.day}`}
          note={
            <>
              <strong>{total.toLocaleString()}</strong>{' '}
              {total === 1 ? 'report' : 'reports'} across{' '}
              <strong>{origins}</strong> {origins === 1 ? 'source' : 'sources'},
              busiest first. A source that appears here repeatedly and is one of
              ours belongs in the allowlist before the policy is tightened.
            </>
          }
          empty={{
            Icon: ShieldAlert,
            title: 'Nothing recorded yet',
            blurb:
              'With the policy in watching mode, an empty list means no page has loaded anything outside the allowlist — which is the good outcome, not a broken screen. Reports began being kept on 17 August 2026; anything before that was never written down.',
          }}
          columns={[
            {
              header: 'Rule',
              mono: true,
              cell: (r) => <span className="text-ink">{r.directive}</span>,
            },
            {
              header: 'Source it wanted',
              mono: true,
              cell: (r) => <span className="text-ink">{r.blocked_origin}</span>,
            },
            {
              header: 'Page',
              mono: true,
              hideBelow: 'md',
              cell: (r) => <span className="text-ink/70">{r.route_shape}</span>,
            },
            {
              header: 'Day',
              hideBelow: 'lg',
              cell: (r) => <span className="text-ink/70">{r.day}</span>,
            },
            {
              header: 'Times',
              align: 'right',
              mono: true,
              cell: (r) => (
                <span className="text-ink">{Number(r.hits).toLocaleString()}</span>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}

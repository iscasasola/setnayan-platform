import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { PROBES } from '@/lib/interconnect/probes';

/** One number: the query reads it and the disclosure below names it. */
const ROW_LIMIT = 400;
import { UGAT_JOINTS } from '@/lib/ugat/graph';
import { VERDICT_COPY, isFault, type ProbeVerdict } from '@/lib/interconnect/verdict';

/**
 * Interconnections — the runtime health of the joints BETWEEN subsystems.
 *
 * Every other tab in this studio reports on a part. This one reports on the
 * seams, because that is where the defects that survive a green CI live: the
 * song desk shipped as 8 individually-verified PRs and was unreachable in prod
 * the whole time, since `services` speaks tiles and `booked_categories` speaks
 * categories and the surface intersected them raw.
 *
 * ── WHAT THE COLOURS MEAN ──────────────────────────────────────────────────
 * The important cell is `lying`: service_role can see rows that the surface's
 * own reader cannot. That is not "no data" — it is data being hidden from the
 * person entitled to it, and it renders in the product as a perfectly calm
 * empty state.
 *
 * `empty` is grey, not green, and that is deliberate. This database is
 * pre-launch-empty; if "nothing to show" rendered as success the page would be
 * a wall of green that means nothing at all.
 *
 * ── THE STALENESS LINE IS PART OF THE READING ──────────────────────────────
 * Probes run cron-free, off `after()` on public traffic. No visitors, no ticks.
 * So "last run" is printed at the same weight as the verdict: a two-week-old
 * `ok` is not a claim about today, and a page that hid the timestamp would let
 * a stopped probe read as a healthy joint.
 */

type LedgerRow = {
  probe_key: string;
  joint_id: string | null;
  verdict: ProbeVerdict;
  subject_count: number;
  truth_count: number;
  detail: string | null;
  ran_at: string;
};

const VERDICT_STYLE: Record<ProbeVerdict, string> = {
  ok: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  empty: 'bg-ink/5 text-ink/60 ring-ink/15',
  lying: 'bg-red-50 text-red-800 ring-red-600/25',
  denied: 'bg-amber-50 text-amber-900 ring-amber-600/25',
  error: 'bg-amber-50 text-amber-900 ring-amber-600/25',
};

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export async function InterconnectionsSurface() {
  // Small table, few probes — pull a window and reduce in memory rather than
  // reaching for a DISTINCT ON. 400 rows is ~50 days at the current tick rate.
  const { data, error } = await createAdminClient()
    .from('interconnection_probe_runs')
    .select('probe_key, joint_id, verdict, subject_count, truth_count, detail, ran_at')
    .order('ran_at', { ascending: false })
    .limit(ROW_LIMIT);
  if (error) {
    logQueryError('InterconnectionsSurface', error, {}, 'graceful_degrade');
  }

  // ⚠ THE ERROR WAS DESTRUCTURED AWAY ENTIRELY, AND ON THIS SURFACE THAT IS THE
  // WORST POSSIBLE PLACE FOR IT. Supabase resolves with `{ error }`, so a refused
  // read arrived as null, `?? []` made the ledger empty, and because the list is
  // driven by the PROBE REGISTRY every card fell to `run: null` — rendering
  // "Never run" on EVERY probe, plus a banner announcing that all of them had
  // never run, plus a plausible reason ("a quiet site means a quiet ledger").
  // A health monitor stating at full confidence that nothing has ever been
  // checked, and explaining its own wrong answer convincingly.
  //
  // 🔑 A REGISTRY-DRIVEN LIST MAKES A REFUSED READ LOUDER, NOT QUIETER. Every other
  // instance of this defect renders an absence that looks like NOTHING; this one
  // renders an absence that looks like a CATASTROPHE. Both are lies, and this one
  // either sends somebody chasing an outage that does not exist or gets dismissed
  // as obviously broken — either way the real signal is gone.
  // ⚖ The registry-driven design is CORRECT and is NOT changed: its own docblock
  // explains that a probe which has genuinely never run must say so. What changes
  // is that "never run" is now only claimable when the ledger was actually read.
  const measured = Array.isArray(data);
  const rows = (data ?? []) as LedgerRow[];
  const latest = new Map<string, LedgerRow>();
  for (const r of rows) if (!latest.has(r.probe_key)) latest.set(r.probe_key, r);

  // Drive the list from the REGISTRY, not from the ledger. A probe that has
  // never run must appear as "never run" — if the page listed only what the
  // ledger contains, adding a probe and forgetting to deploy it would leave the
  // page looking complete.
  const cards = PROBES.map((p) => ({ probe: p, run: latest.get(p.key) ?? null }));
  const faults = cards.filter((c) => c.run && isFault(c.run.verdict));
  // Only a MEASURED ledger can tell you a probe never ran.
  const neverRan = measured ? cards.filter((c) => !c.run) : [];

  return (
    <section>
      {/* The tab strip already says "Interconnections". The name stays in the
          document at zero pixels.
          ⚖ The sentence survives: it is what a probe verdict MEANS — that a
          disagreement between the surface's own reader and service_role is a
          surface hiding rows from somebody entitled to them. Nobody can read
          the cards below without it, so it stays in the page, above them. */}
      <PageMasthead title="Interconnections" />
      <p className="mb-6 max-w-3xl text-sm text-ink/70">
        Whether the joints between subsystems still carry traffic. Each probe runs the
        surface&apos;s own reader and compares it with what service_role can see — where they
        disagree, the surface is hiding rows from someone entitled to them.
      </p>

      {faults.length > 0 ? (
        <p className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-inset ring-red-600/20">
          {faults.length} joint{faults.length === 1 ? '' : 's'} need attention.
        </p>
      ) : null}

      {!measured ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70"
        >
          <p>
            <strong className="text-ink">The probe ledger could not be read.</strong> Every
            probe below shows <em>Unknown</em>, not <em>Never run</em> — those are different
            answers and only one of them is a finding.
          </p>
          <p className="mt-2">
            Nothing here says the probes stopped, and nothing here says they are fine.
            Reload; if it repeats, treat the platform&rsquo;s health as unknown and hand
            this to an engineer{error?.message ? `: ${error.message}` : '.'}
          </p>
        </div>
      ) : neverRan.length > 0 ? (
        <p className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20">
          {neverRan.length} probe{neverRan.length === 1 ? ' has' : 's have'} never run. Probes fire
          from public-site traffic, so a quiet site means a quiet ledger — this is not a pass.
        </p>
      ) : null}

      <ul className="space-y-3">
        {cards.map(({ probe, run }) => (
          <li
            key={probe.key}
            className="rounded-xl border border-ink/10 p-4 sm:flex sm:items-start sm:justify-between sm:gap-6"
          >
            <div className="min-w-0">
              <p className="font-medium text-ink">{probe.title}</p>
              <p className="mt-0.5 font-mono text-xs text-ink/45">
                {probe.key}
                {probe.jointId ? ` · Ugat ${probe.jointId}` : ''}
              </p>
              <p className="mt-2 text-sm text-ink/70">
                {run?.detail ?? (measured ? 'No result recorded yet.' : 'Not read.')}
              </p>
            </div>

            <div className="mt-3 shrink-0 text-right sm:mt-0">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                  run ? VERDICT_STYLE[run.verdict] : 'bg-ink/5 text-ink/60 ring-ink/15'
                }`}
              >
                {run ? VERDICT_COPY[run.verdict] : measured ? 'Never run' : 'Unknown'}
              </span>
              {run ? (
                <p className="mt-1.5 text-xs text-ink/50">
                  {run.subject_count}/{run.truth_count} served · {ago(run.ran_at)}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {/* Two derived numbers and no hand-typed third. The backlog figure used to
          sit here as a literal; it was wrong from the day it shipped (47 for a
          file holding 44) and would have gone stale again every time a concept
          is mapped. The baseline file is the reading. */}
      <p className="mt-6 max-w-3xl text-xs text-ink/50">
        Coverage: {PROBES.length} probe{PROBES.length === 1 ? '' : 's'} against{' '}
        {UGAT_JOINTS.length} mapped Ugat joints, and the map itself reaches roughly a third of the
        app. The rest is the <code className="font-mono">map-backlog</code> list in{' '}
        <code className="font-mono">ugat-concept.baseline.txt</code> — that gap is the backlog,
        stated rather than implied.
      </p>
    </section>
  );
}

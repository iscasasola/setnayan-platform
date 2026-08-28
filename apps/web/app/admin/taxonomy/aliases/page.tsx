import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveCoverageLabels } from '@/lib/vendor-coverages';
import { PageMasthead } from '@/app/_components/page-masthead';
import { KpiStatCard } from '../../_components/kpi-stat-card';
import { approveTradeAlias, rejectTradeAlias, unteachTradeAlias } from './actions';

export const metadata = { title: 'Trade aliases · Admin' };
export const dynamic = 'force-dynamic';

/**
 * /admin/taxonomy/aliases — ONE TRADE, MANY NAMES, the review queue (C2,
 * 2026-08-28).
 *
 * 🔒 WHY THIS PAGE EXISTS AT ALL: an alias with `reviewed_at IS NULL`
 * answers nobody — see actions.ts. `scripts/seed-trade-aliases.ts` MINES
 * words straight out of our own `canonical_service_schemas` attribute
 * options (no model, no network — see lib/trade-alias-miner.ts) and writes
 * them here unreviewed; this is the only door that turns one into
 * something the maker's search can actually use. Ship a table with a review
 * screen that nobody ever opens and the whole feature stays permanently
 * switched off — the "gate with no handle" shape this repo keeps paying
 * for, avoided here by shipping BOTH in the same PR. A MINED word still
 * needs a person's yes — surviving the miner's distinctiveness filters
 * does not make an option value a good search word (see that file's own
 * docblock for a real example), so review stays mandatory.
 */
export default async function TradeAliasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = (first(sp.q) ?? '').trim().toLowerCase().slice(0, 80);
  const tab = first(sp.tab) === 'reviewed' ? 'reviewed' : 'pending';
  const ok = first(sp.ok);
  const error = first(sp.error);

  const admin = createAdminClient();
  const [pendingRes, reviewedCountRes, labels] = await Promise.all([
    admin
      .from('canonical_service_aliases')
      .select('id,phrase,canonical_service,source,created_at')
      .is('reviewed_at', null)
      .order('canonical_service', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(500),
    admin.from('canonical_service_aliases').select('id', { count: 'exact', head: true }).not('reviewed_at', 'is', null),
    resolveCoverageLabels().catch(
      () =>
        ({
          leafLabel: (cs: string) => cs,
          pathLabel: (cs: string) => cs,
          allowedEventTypes: () => null,
        }) as Awaited<ReturnType<typeof resolveCoverageLabels>>,
    ),
  ]);

  type Row = { id: number; phrase: string; canonical_service: string; source: string; created_at: string };
  const pending = (pendingRes.data ?? []) as Row[];
  const reviewedCount = reviewedCountRes.count ?? 0;

  let reviewed: Row[] = [];
  if (tab === 'reviewed') {
    const { data } = await admin
      .from('canonical_service_aliases')
      .select('id,phrase,canonical_service,source,created_at')
      .not('reviewed_at', 'is', null)
      .order('canonical_service', { ascending: true })
      .limit(500);
    reviewed = (data ?? []) as Row[];
  }

  const rows = tab === 'reviewed' ? reviewed : pending;
  const filtered = q
    ? rows.filter(
        (r) =>
          r.phrase.toLowerCase().includes(q) ||
          labels.leafLabel(r.canonical_service).toLowerCase().includes(q) ||
          r.canonical_service.toLowerCase().includes(q),
      )
    : rows;

  const grouped = new Map<string, Row[]>();
  for (const r of filtered) {
    const arr = grouped.get(r.canonical_service) ?? [];
    arr.push(r);
    grouped.set(r.canonical_service, arr);
  }
  const groups = [...grouped.entries()].sort((a, b) =>
    labels.leafLabel(a[0]).localeCompare(labels.leafLabel(b[0])),
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <PageMasthead
        title="Trade aliases"
        actions={
          <Link
            href="/admin/taxonomy"
            className="text-sm font-medium text-ink/60 hover:text-ink"
          >
            ← Taxonomy Studio
          </Link>
        }
      />

      <p className="mb-4 text-sm text-ink/60">
        Other words a supplier might type for a trade — &ldquo;sorbetero&rdquo; for Sorbetes
        Cart. An unreviewed row here cannot answer anybody: it is invisible to the card maker
        until you approve it.
      </p>

      {ok ? (
        <div className="mb-4 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">
          {ok}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
          {error}
        </div>
      ) : null}

      <section className="mb-4 grid grid-cols-2 gap-3">
        <KpiStatCard label="Waiting for review" value={pending.length} />
        <KpiStatCard label="Live (reviewed)" value={reviewedCount} />
      </section>

      <div className="mb-4 flex items-center gap-2 border-b border-ink/10 pb-2 text-sm">
        <Link
          href={`/admin/taxonomy/aliases${q ? `?q=${encodeURIComponent(q)}` : ''}`}
          className={`rounded-full px-3 py-1 ${tab === 'pending' ? 'bg-ink text-white' : 'text-ink/60 hover:text-ink'}`}
        >
          Waiting for review
        </Link>
        <Link
          href={`/admin/taxonomy/aliases?tab=reviewed${q ? `&q=${encodeURIComponent(q)}` : ''}`}
          className={`rounded-full px-3 py-1 ${tab === 'reviewed' ? 'bg-ink text-white' : 'text-ink/60 hover:text-ink'}`}
        >
          Live
        </Link>
      </div>

      <form method="get" className="mb-6">
        {tab === 'reviewed' ? <input type="hidden" name="tab" value="reviewed" /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Filter by trade or phrase…"
          className="input-field w-full"
          aria-label="Filter aliases"
        />
      </form>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink/15 px-4 py-8 text-center text-sm text-ink/50">
          {tab === 'reviewed'
            ? 'No reviewed aliases yet.'
            : q
              ? 'Nothing waiting for review matches that filter.'
              : 'Nothing waiting for review. From the code repo, run \'pnpm -F @setnayan/web exec tsx scripts/seed-trade-aliases.ts\' to mine more words from what we already know about each trade.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {groups.map(([canonical, aliasRows]) => (
            <li key={canonical} className="rounded-xl border border-ink/10 p-4">
              <div className="mb-2">
                <p className="text-sm font-semibold text-ink">{labels.leafLabel(canonical)}</p>
                <p className="text-xs text-ink/50">{labels.pathLabel(canonical)}</p>
              </div>
              <ul className="space-y-2">
                {aliasRows.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink/[0.03] px-3 py-2"
                  >
                    <span className="text-sm text-ink">
                      &ldquo;{r.phrase}&rdquo;{' '}
                      <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">
                        {r.source}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      {tab === 'pending' ? (
                        <>
                          <form action={approveTradeAlias}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="_q" value={q} />
                            <button
                              type="submit"
                              className="rounded-md border border-ink/15 bg-white px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-terracotta/50 hover:text-mulberry"
                            >
                              Approve
                            </button>
                          </form>
                          <form action={rejectTradeAlias}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="_q" value={q} />
                            <button
                              type="submit"
                              className="rounded-md border border-danger-200 bg-white px-2.5 py-1 text-xs font-medium text-danger-700 transition-colors hover:border-danger-400"
                            >
                              Reject
                            </button>
                          </form>
                        </>
                      ) : (
                        <form action={unteachTradeAlias}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="_q" value={q} />
                          <button
                            type="submit"
                            className="rounded-md border border-danger-200 bg-white px-2.5 py-1 text-xs font-medium text-danger-700 transition-colors hover:border-danger-400"
                          >
                            Remove
                          </button>
                        </form>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

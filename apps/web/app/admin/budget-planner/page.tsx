import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPhp } from '@/lib/budget';
import {
  fetchAllocationAggregates,
  type BenchmarkRow,
} from '@/lib/budget-allocation-data';
import { updateLeafBenchmark, updateAllocationConfig } from './actions';

export const metadata = { title: 'Budget Planner' };

/**
 * /admin/budget-planner — admin-facing control surface for the Budget Planner
 * allocation engine (Budget_Planner_Allocation_Engine_2026-06-05.md).
 *
 * Three sections:
 *   1. Benchmark seeding — the fallback ₱ per service the planner shows couples
 *      before there are enough real vendor prices. Per-row inline form →
 *      updateLeafBenchmark. Blank input = NULL (never invent a price).
 *   2. Engine settings — the singleton config knobs (sample thresholds,
 *      confidence band, surplus mode) → updateAllocationConfig.
 *   3. Couple insights (de-identified) — k-anonymity-gated aggregate of saved
 *      plans. Reads via the SERVICE-ROLE client because couples-own RLS blocks
 *      the authed admin from raw decision rows by design; only aggregates are
 *      ever shown, never individual couples.
 *
 * Gating: relies on the /admin layout gate; the server actions also call
 * requireAdmin. Rendered defensively regardless.
 */

// Engine-config row shape (singleton, config_key='default').
type ConfigRow = {
  min_sample_n: number;
  high_confidence_n: number;
  med_confidence_n: number;
  band_pct: number;
  surplus_mode: string;
};

// Engine defaults — used when the config row is absent (table not yet seeded).
const CONFIG_FALLBACK = {
  min_sample_n: 3,
  high_confidence_n: 8,
  med_confidence_n: 3,
  band_pct: 0.15,
  surplus_mode: 'park' as const,
};

export default async function AdminBudgetPlannerPage() {
  const supabase = await createClient();

  // Benchmarks + config read via the authed admin client (both tables carry an
  // is_admin() RLS write/read policy). Aggregates MUST use the service-role
  // client — the couples-own RLS on budget_allocation_decisions blocks the
  // authed admin from raw rows by design.
  const admin = createAdminClient();
  const [benchmarkRes, configRes, agg] = await Promise.all([
    supabase
      .from('budget_leaf_benchmarks')
      .select(
        'plan_group_id,label,benchmark_php,floor_php,p25_php,p75_php,is_active,sort_order',
      )
      .order('sort_order', { ascending: true }),
    supabase
      .from('budget_allocation_config')
      .select('min_sample_n,high_confidence_n,med_confidence_n,band_pct,surplus_mode')
      .eq('config_key', 'default')
      .maybeSingle(),
    fetchAllocationAggregates(admin),
  ]);

  const benchmarks = (benchmarkRes.data ?? []) as BenchmarkRow[];
  const configRow = (configRes.data as ConfigRow | null) ?? null;
  const config = {
    min_sample_n: configRow?.min_sample_n ?? CONFIG_FALLBACK.min_sample_n,
    high_confidence_n: configRow?.high_confidence_n ?? CONFIG_FALLBACK.high_confidence_n,
    med_confidence_n: configRow?.med_confidence_n ?? CONFIG_FALLBACK.med_confidence_n,
    band_pct:
      configRow?.band_pct != null ? Number(configRow.band_pct) : CONFIG_FALLBACK.band_pct,
    surplus_mode:
      configRow?.surplus_mode === 'distribute' ? 'distribute' : 'park',
  };

  // Resolve each aggregate leaf to its benchmark label (fallback to the id).
  const labelByLeaf = new Map<string, string>();
  for (const b of benchmarks) labelByLeaf.set(b.plan_group_id, b.label);

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Budget Planner</h1>
        <p className="text-sm text-ink/60">
          Seed the fallback benchmark prices, tune the allocation engine, and
          review de-identified couple insights. Prices are admin-set and never
          invented — leave a field blank to clear it.
        </p>
      </header>

      {/* ── 1. Benchmark seeding ─────────────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="mb-1 text-base font-semibold tracking-tight">
          Benchmark seeding ({benchmarks.length})
        </h2>
        <p className="mb-3 text-sm text-ink/60">
          Set the typical ₱ per service. These are the fallback the planner shows
          couples when there aren&apos;t enough real vendor prices yet. Leave
          blank to clear.
        </p>
        <div className="overflow-hidden rounded-2xl border border-ink/10">
          {benchmarks.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-ink/60">
                No benchmark leaves in budget_leaf_benchmarks yet.
              </p>
            </div>
          ) : (
            <>
              {/* Column header strip — desktop only. */}
              <div className="hidden border-b border-ink/10 bg-cream px-4 py-2 sm:grid sm:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto_auto] sm:items-center sm:gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  Service
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  Benchmark
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  Floor
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  p25
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  p75
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  Active
                </span>
                <span className="sr-only">Save</span>
              </div>
              {benchmarks.map((row) => (
                <BenchmarkRowForm key={row.plan_group_id} row={row} />
              ))}
            </>
          )}
        </div>
      </section>

      {/* ── 2. Engine settings ───────────────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="mb-1 text-base font-semibold tracking-tight">
          Engine settings
        </h2>
        <p className="mb-3 text-sm text-ink/60">
          The allocation engine knobs. Sample thresholds decide when real vendor
          medians are trusted over the seeded benchmark; the band is the ±
          tolerance around a target; surplus mode decides what happens to money
          left over after every service is funded.
        </p>
        <form
          action={async (fd: FormData) => {
            'use server';
            await updateAllocationConfig(fd);
          }}
          className="rounded-2xl border border-ink/10 bg-paper p-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Min sample N
              </span>
              <input
                name="min_sample_n"
                type="number"
                min="1"
                step="1"
                defaultValue={config.min_sample_n}
                required
                className="input-field mt-1 w-full"
              />
              <span className="mt-1 block text-[11px] text-ink/45">
                Fewest vendor prices before a market median is used at all.
              </span>
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                High-confidence N
              </span>
              <input
                name="high_confidence_n"
                type="number"
                min="1"
                step="1"
                defaultValue={config.high_confidence_n}
                required
                className="input-field mt-1 w-full"
              />
              <span className="mt-1 block text-[11px] text-ink/45">
                Sample size at which the median fully overrides the benchmark.
              </span>
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Med-confidence N
              </span>
              <input
                name="med_confidence_n"
                type="number"
                min="1"
                step="1"
                defaultValue={config.med_confidence_n}
                required
                className="input-field mt-1 w-full"
              />
              <span className="mt-1 block text-[11px] text-ink/45">
                Sample size where median + benchmark are blended.
              </span>
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Band (0–1)
              </span>
              <input
                name="band_pct"
                type="number"
                min="0"
                max="1"
                step="0.01"
                defaultValue={config.band_pct}
                required
                className="input-field mt-1 w-full"
              />
              <span className="mt-1 block text-[11px] text-ink/45">
                ± tolerance around a target, e.g. 0.15 = ±15%.
              </span>
            </label>
            <label className="block sm:col-span-2 lg:col-span-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                Surplus mode
              </span>
              <select
                name="surplus_mode"
                defaultValue={config.surplus_mode}
                className="input-field mt-1 w-full"
              >
                <option value="park">Park surplus as cushion (recommended)</option>
                <option value="distribute">
                  Distribute surplus across services
                </option>
              </select>
              <span className="mt-1 block text-[11px] text-ink/45">
                What to do with money left after every service is funded.
              </span>
            </label>
          </div>
          <div className="mt-5">
            <button
              type="submit"
              className="rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta/90"
            >
              Save settings
            </button>
          </div>
        </form>
      </section>

      {/* ── 3. Couple insights (de-identified) ───────────────────────────── */}
      <section className="mb-4">
        <h2 className="mb-1 text-base font-semibold tracking-tight">
          Couple insights (de-identified)
        </h2>
        <p className="mb-3 text-sm text-ink/60">
          Aggregate only — never individual couples. Hidden until at least N
          couples have saved a plan (k-anonymity).
        </p>
        <div className="overflow-hidden rounded-2xl border border-ink/10">
          {agg.aggregates.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-ink/60">
                Not enough data yet. Insights appear here once enough couples
                have saved budget plans.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 bg-cream text-left">
                  <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Service
                  </th>
                  <th className="px-4 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Avg share
                  </th>
                  <th className="px-4 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Avg ₱
                  </th>
                  <th className="px-4 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    Couples
                  </th>
                  <th className="px-4 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    First-priority %
                  </th>
                </tr>
              </thead>
              <tbody>
                {agg.aggregates.map((a) => (
                  <tr
                    key={a.planGroupId}
                    className="border-b border-ink/5 last:border-b-0"
                  >
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {labelByLeaf.get(a.planGroupId) ?? a.planGroupId}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink">
                      {(a.avgShareBp / 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink">
                      {formatPhp(a.avgFinalPhp)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink/70">
                      {a.coupleCount}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink/70">
                      {Math.round(a.firstPinRate * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {agg.suppressedBelowMinN && (
          <p className="mt-2 text-[11px] text-ink/45">
            Some leaves are hidden until more couples contribute.
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * One benchmark leaf as an inline edit form. Each row posts independently to
 * updateLeafBenchmark with a hidden plan_group_id. NULL prices render as empty
 * inputs (the admin fills them — never a made-up number). is_active is a
 * checkbox; absent on submit = false (the action coerces presence → true).
 */
function BenchmarkRowForm({ row }: { row: BenchmarkRow }) {
  return (
    <form
      action={async (fd: FormData) => {
        'use server';
        await updateLeafBenchmark(fd);
      }}
      className="grid grid-cols-1 gap-3 border-b border-ink/5 p-4 last:border-b-0 sm:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto_auto] sm:items-center"
    >
      <input type="hidden" name="plan_group_id" value={row.plan_group_id} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{row.label}</p>
        <code className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          {row.plan_group_id}
        </code>
      </div>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55 sm:hidden">
          Benchmark
        </span>
        <input
          name="benchmark_php"
          type="text"
          inputMode="numeric"
          defaultValue={row.benchmark_php ?? ''}
          placeholder="—"
          className="input-field mt-1 w-full sm:mt-0"
        />
      </label>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55 sm:hidden">
          Floor
        </span>
        <input
          name="floor_php"
          type="text"
          inputMode="numeric"
          defaultValue={row.floor_php ?? ''}
          placeholder="—"
          className="input-field mt-1 w-full sm:mt-0"
        />
      </label>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55 sm:hidden">
          p25
        </span>
        <input
          name="p25_php"
          type="text"
          inputMode="numeric"
          defaultValue={row.p25_php ?? ''}
          placeholder="—"
          className="input-field mt-1 w-full sm:mt-0"
        />
      </label>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55 sm:hidden">
          p75
        </span>
        <input
          name="p75_php"
          type="text"
          inputMode="numeric"
          defaultValue={row.p75_php ?? ''}
          placeholder="—"
          className="input-field mt-1 w-full sm:mt-0"
        />
      </label>
      <label className="flex items-center gap-2 sm:justify-center">
        <input
          name="is_active"
          type="checkbox"
          defaultChecked={row.is_active}
          className="h-4 w-4 rounded border-ink/30"
        />
        <span className="text-sm text-ink/70 sm:hidden">Active</span>
      </label>
      <button
        type="submit"
        className="rounded-md bg-terracotta px-3 py-1.5 text-xs font-medium text-cream hover:bg-terracotta/90 sm:px-4 sm:py-2 sm:text-sm"
      >
        Save
      </button>
    </form>
  );
}

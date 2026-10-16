/**
 * SLOW LOADS — the load-time log's tab in the App Performance studio (owner
 * 2026-10-16: "can we make a page on admin that will log the loading time of
 * each load done? or when a loading takes more that 1.5 seconds … or when it
 * load longer than its target loading time?").
 *
 * Two answers, top to bottom:
 *   1. the newest loads that went over their page's target — page, how long,
 *      where the time went (server · download · drawing), device, build, when;
 *   2. every page: its target, p50 / p95, how often it is over, and how the
 *      newest build compares with the one before.
 *
 * Reads `fetchLoadTimeStats()` through the service role, so it gates itself
 * with requireAdmin() like every other surface here. A refused read says so —
 * it never renders as "nothing is slow". Percentiles below the cockpit's MIN_N
 * floor read "—", never a number from three loads.
 *
 * 📱 The phone answers, it does not edit (owner ruling 2026-08-26): the target
 * editor stands down below `lg`, and a line says where it went.
 * Frames only on what you press: rows are divided, not boxed.
 */
import { Laptop } from 'lucide-react';

import { requireAdmin } from '@/lib/admin/require-admin';
import { MIN_N } from '@/lib/admin/app-performance-stats';
import { formatCount } from '@/lib/format-number';
import { fetchLoadTimeStats } from '@/lib/telemetry/load-timing.server';
import {
  ALWAYS_SEND_MS,
  DEFAULT_TARGET_MS,
  RETENTION_DAYS,
  SAMPLE_WEIGHT,
  TARGET_MAX_MS,
  TARGET_MIN_MS,
  formatMs,
  type LoadRow,
} from '@/lib/telemetry/load-timing';
import { saveLoadTarget } from '@/app/admin/app-performance/actions';

const SERVER = 'var(--sn-ink-700)';
const DOWNLOAD = 'var(--sn-gold-500)';
const RENDER = 'var(--sn-ink-300)';

const TARGET_NOTICE: Record<string, { text: string; bad: boolean }> = {
  saved: { text: 'Target saved.', bad: false },
  invalid: { text: `A target is between ${TARGET_MIN_MS / 1000} and ${TARGET_MAX_MS / 1000} seconds.`, bad: true },
  unknown: { text: 'That page is not one the app has — nothing was saved.', bad: true },
  unread: { text: 'The targets could not be read — nothing was saved. Try again.', bad: true },
  refused: { text: 'The save was refused — nothing changed. Try again.', bad: true },
};

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`;
}

const KIND_WORD: Record<string, string> = { page: 'opened', nav: 'tap' };

/** Where the time went, as one thin bar + the three numbers. */
function Breakdown({ row }: { row: LoadRow }) {
  const parts = [
    { label: 'server', v: row.server_ms, color: SERVER },
    { label: 'download', v: row.download_ms, color: DOWNLOAD },
    { label: 'drawing', v: row.render_ms, color: RENDER },
  ];
  const known = parts.filter((p) => p.v !== null) as Array<{ label: string; v: number; color: string }>;
  const sum = known.reduce((s, p) => s + p.v, 0);
  if (known.length === 0 || sum <= 0) return <span className="text-ink/45">not measured</span>;
  return (
    <span className="block min-w-[10rem]">
      <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-ink/5" aria-hidden>
        {known.map((p) => (
          <span key={p.label} style={{ width: `${(p.v / sum) * 100}%`, background: p.color }} />
        ))}
      </span>
      <span className="mt-1 block text-[11px] tabular-nums text-ink/60">
        {known.map((p) => `${p.label} ${formatMs(p.v)}`).join(' · ')}
      </span>
    </span>
  );
}

function outcomeWord(row: LoadRow): string | null {
  if (row.outcome === 'left') return 'left before it showed';
  if (row.outcome === 'cap') return 'still not there';
  return null;
}

export async function SlowLoadsSurface({ targetNotice }: { targetNotice?: string }) {
  await requireAdmin();
  const data = await fetchLoadTimeStats(MIN_N);
  const now = Date.now();
  const notice = targetNotice ? TARGET_NOTICE[targetNotice] : undefined;
  const rowsUnread = data.errors.includes('load times unread');

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-xl font-semibold text-ink">Slow loads</h1>
        <p className="mt-1 max-w-prose text-sm text-ink/65">
          How long real people wait for a page — over its target is slow. Every page&apos;s target is{' '}
          {formatMs(DEFAULT_TARGET_MS)} unless it has its own.
        </p>
      </header>

      {notice ? (
        <p role="status" className={`text-sm ${notice.bad ? 'text-danger-700' : 'text-[var(--sn-success)]'}`}>
          {notice.text}
        </p>
      ) : null}

      {data.errors.length > 0 ? (
        <p role="alert" className="text-sm text-danger-700">
          Couldn&rsquo;t load all of this: {data.errors.join(' · ')}. This is not an all-clear.
        </p>
      ) : null}

      {/* ── 1 · the newest slow loads ─────────────────────────────────── */}
      <section aria-labelledby="slow-list">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="slow-list" className="text-base font-semibold text-ink">
            Over target, newest first
          </h2>
          <p className="flex flex-wrap items-center gap-3 text-[11px] text-ink/55">
            <Legend color={SERVER} label="server" />
            <Legend color={DOWNLOAD} label="download" />
            <Legend color={RENDER} label="drawing" />
          </p>
        </div>
        {rowsUnread ? null : data.slow.length === 0 ? (
          <p className="text-sm text-ink/60">
            No load went over its target in the last {RETENTION_DAYS} days
            {data.overall.n === 0 ? ' — and none has been measured yet' : ''}.
          </p>
        ) : (
          <ul className="divide-y divide-ink/10 border-y border-ink/10" data-testid="slow-loads">
            {data.slow.map((r, i) => (
              <li
                key={`${r.created_at}-${i}`}
                className="grid gap-x-6 gap-y-2 py-3 text-sm lg:grid-cols-[minmax(14rem,2fr)_7rem_minmax(12rem,2fr)_8rem_5rem_5rem] lg:items-center"
              >
                <span className="min-w-0">
                  <span className="block break-all font-mono text-[13px] text-ink">{r.route}</span>
                  <span className="text-[11px] text-ink/50">
                    {KIND_WORD[r.kind] ?? r.kind}
                    {r.signed_in ? ' · signed in' : ' · guest'}
                  </span>
                </span>
                <span>
                  <span className="font-semibold tabular-nums text-danger-700">{formatMs(r.total_ms)}</span>
                  <span className="block text-[11px] text-ink/50">
                    {outcomeWord(r) ?? `target ${formatMs(r.target)}`}
                  </span>
                </span>
                <Breakdown row={r} />
                <span className="text-[12px] text-ink/70">
                  {r.device}
                  {r.connection ? ` · ${r.connection}` : ''}
                </span>
                <span className="font-mono text-[12px] text-ink/60">{r.build_sha ? r.build_sha.slice(0, 7) : '—'}</span>
                <span className="text-[12px] text-ink/60">{ago(r.created_at, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 2 · every page ────────────────────────────────────────────── */}
      <section aria-labelledby="per-page">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="per-page" className="text-base font-semibold text-ink">
            Every page
          </h2>
          <p className="text-[11px] text-ink/55">
            {data.currentBuild
              ? `Trend: build ${data.currentBuild.slice(0, 7)} vs ${data.previousBuild ? data.previousBuild.slice(0, 7) : 'no earlier build yet'}`
              : 'Trend appears once two builds have loads'}
          </p>
        </div>

        <p className="mb-3 flex items-center gap-2 text-sm text-ink/60 lg:hidden">
          <Laptop aria-hidden strokeWidth={1.7} className="h-4 w-4 shrink-0 text-ink/45" />
          Targets are set on the computer.
        </p>

        {rowsUnread ? null : data.pages.length === 0 ? (
          <p className="text-sm text-ink/60">No loads measured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm" data-testid="per-page">
              <thead>
                <tr className="border-b border-ink/15 text-left text-[11px] uppercase tracking-[0.1em] text-ink/50">
                  <th className="py-2 pr-4 font-medium">Page</th>
                  <th className="py-2 pr-4 font-medium">Target</th>
                  <th className="py-2 pr-4 text-right font-medium">Loads</th>
                  <th className="py-2 pr-4 text-right font-medium">p50</th>
                  <th className="py-2 pr-4 text-right font-medium">p95</th>
                  <th className="py-2 pr-4 text-right font-medium">Over target</th>
                  <th className="py-2 text-right font-medium">Since last build</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {data.pages.map((p) => (
                  <tr key={p.route} className="align-top">
                    <td className="py-2.5 pr-4 font-mono text-[13px] text-ink">
                      <span className="break-all">{p.route}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="tabular-nums lg:hidden">
                        {formatMs(p.target)}
                        {p.targetSet ? '' : ' (default)'}
                      </span>
                      <form action={saveLoadTarget} className="hidden items-center gap-1.5 lg:flex">
                        <input type="hidden" name="route" value={p.route} />
                        <label className="sr-only" htmlFor={`t-${p.route}`}>
                          Target for {p.route}, in seconds
                        </label>
                        <input
                          id={`t-${p.route}`}
                          name="target_s"
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min={TARGET_MIN_MS / 1000}
                          max={TARGET_MAX_MS / 1000}
                          defaultValue={p.targetSet ? (p.target / 1000).toString() : ''}
                          placeholder={(DEFAULT_TARGET_MS / 1000).toFixed(1)}
                          className="input-field h-8 w-20 py-0 text-sm tabular-nums"
                        />
                        <span className="text-[11px] text-ink/50">s</span>
                        <button type="submit" className="button-secondary h-8 px-2.5 text-xs">
                          Save
                        </button>
                        {p.targetSet ? (
                          <button type="submit" name="clear" value="1" className="h-8 px-1.5 text-xs text-ink/55 underline-offset-2 hover:underline">
                            Use {(DEFAULT_TARGET_MS / 1000).toFixed(1)} s
                          </button>
                        ) : null}
                      </form>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-ink/75">
                      {formatCount(p.loads)}
                      {p.n < MIN_N && p.n > 0 ? (
                        <span className="block text-[11px] text-ink/45">
                          {p.n} of {MIN_N} measured
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{formatMs(p.p50)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{formatMs(p.p95)}</td>
                    <td
                      className={`py-2.5 pr-4 text-right tabular-nums ${p.overPct !== null && p.overPct > 0.1 ? 'font-semibold text-danger-700' : ''}`}
                    >
                      {pct(p.overPct)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {p.trend ? (
                        <span className={p.trend.pct > 0.05 ? 'text-danger-700' : p.trend.pct < -0.05 ? 'text-[var(--sn-success)]' : 'text-ink/60'}>
                          {p.trend.pct > 0 ? '▲' : p.trend.pct < 0 ? '▼' : '='} {Math.abs(Math.round(p.trend.pct * 100))}%
                          <span className="block text-[11px] text-ink/45">
                            {formatMs(p.trend.previous)} → {formatMs(p.trend.current)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-ink/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="border-t border-ink/10 pt-4 text-xs text-ink/55">
        Measured in each person&apos;s browser: a full page load to its largest content painted, an in-app tap to the new
        page&apos;s content painted. Every load over {formatMs(ALWAYS_SEND_MS)} is kept; about 1 in {SAMPLE_WEIGHT}{' '}
        faster ones is kept and counted ×{SAMPLE_WEIGHT}, so p50/p95 are the real traffic&apos;s. Pages are stored as
        their route, never an address; nothing personal is kept. Last {RETENTION_DAYS} days · {formatCount(data.overall.n)}{' '}
        measured
        {data.capped ? ' · the read hit its cap, so these are the newest loads only' : ''}.
      </footer>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

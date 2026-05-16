'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PlayCircle, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Manual trigger UI for the /api/admin/cron/generate-2307 endpoint.
 *
 * Used by admin to backfill prior quarters or re-run the cron against
 * the most recently ended quarter. The endpoint accepts ?year= +
 * ?quarter= query params; we POST with no body and let the route
 * compute the period from the query string.
 */

type Props = {
  defaultYear: number;
  defaultQuarter: number;
};

type ApiSummary = {
  ok: boolean;
  triggered_by?: string;
  year?: number;
  quarter?: number;
  vendor_count?: number;
  generated?: number;
  skipped_no_ewt?: number;
  errors?: Array<{ vendor_profile_id: string; message: string }>;
  error?: string;
};

export function Manual2307Trigger({ defaultYear, defaultQuarter }: Props) {
  const router = useRouter();
  const [year, setYear] = useState<number>(defaultYear);
  const [quarter, setQuarter] = useState<number>(defaultQuarter);
  const [result, setResult] = useState<ApiSummary | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const yearOptions: number[] = [];
  for (let y = defaultYear; y >= defaultYear - 4; y--) yearOptions.push(y);

  function run() {
    setErrorText(null);
    setResult(null);
    startTransition(async () => {
      try {
        const url = `/api/admin/cron/generate-2307?year=${year}&quarter=${quarter}`;
        const res = await fetch(url, { method: 'POST' });
        const data = (await res.json()) as ApiSummary;
        if (!res.ok || !data.ok) {
          setErrorText(data.error ?? `HTTP ${res.status}`);
          return;
        }
        setResult(data);
        router.refresh();
      } catch (err) {
        setErrorText(err instanceof Error ? err.message : 'Unknown error');
      }
    });
  }

  return (
    <section className="mb-6 rounded-xl border border-ink/10 bg-cream p-4">
      <h2 className="mb-3 text-base font-semibold text-ink">
        Manual trigger
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Year
          </span>
          <select
            value={year}
            onChange={(e) => setYear(Number.parseInt(e.target.value, 10))}
            className="input-field"
            disabled={pending}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Quarter
          </span>
          <select
            value={quarter}
            onChange={(e) => setQuarter(Number.parseInt(e.target.value, 10))}
            className="input-field"
            disabled={pending}
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                Q{q}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="button-primary inline-flex h-10 items-center gap-2 px-4 text-sm"
        >
          {pending ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle aria-hidden className="h-4 w-4" />
          )}
          {pending ? 'Generating…' : 'Generate 2307s for this quarter'}
        </button>
      </div>

      {errorText ? (
        <div className="mt-3 flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorText}</span>
        </div>
      ) : null}

      {result ? (
        <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <div className="flex items-start gap-2">
            <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p>
                <strong>{result.year} Q{result.quarter}</strong> · scanned{' '}
                {result.vendor_count} vendor{result.vendor_count === 1 ? '' : 's'} ·
                generated {result.generated} · skipped (no EWT){' '}
                {result.skipped_no_ewt}
                {result.errors && result.errors.length > 0 ? (
                  <> · errors {result.errors.length}</>
                ) : null}
                .
              </p>
              {result.errors && result.errors.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {result.errors.map((e) => (
                    <li key={e.vendor_profile_id} className="font-mono">
                      {e.vendor_profile_id}: {e.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

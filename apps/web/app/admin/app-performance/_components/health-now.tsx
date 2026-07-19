'use client';

import { useEffect, useState } from 'react';

/**
 * HealthNow — live point-in-time platform health, fetched from the browser
 * against /api/health/deep (iteration 0035). Client-side because the deep
 * probe is same-origin from the admin's browser; a server-side self-fetch
 * would need an absolute deployment URL and stalls the RSC stream behind a
 * 3s-timeout probe.
 *
 * HONESTY: this is a POINT-IN-TIME reading. A 24h/window uptime HISTORY needs
 * probe persistence (Better Stack export or a samples table) — that gap is
 * labeled on the card, not papered over (plan § 3 Stability · S1).
 */

type CheckResult = { ok: boolean; duration_ms: number; error_class?: string };
type DeepHealth = {
  ok: boolean;
  failing?: string[];
  checks?: Record<string, CheckResult>;
};

export function HealthNow() {
  const [state, setState] = useState<
    | { phase: 'loading' }
    | { phase: 'done'; health: DeepHealth }
    | { phase: 'unreachable' }
  >({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health/deep', { cache: 'no-store' })
      // 503 still carries the per-check JSON body — parse either way.
      .then((res) => res.json() as Promise<DeepHealth>)
      .then((health) => {
        if (!cancelled) setState({ phase: 'done', health });
      })
      .catch(() => {
        if (!cancelled) setState({ phase: 'unreachable' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.phase === 'loading') {
    return (
      <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
        Probing…
      </p>
    );
  }
  if (state.phase === 'unreachable') {
    return (
      <p className="text-sm font-medium" style={{ color: 'var(--m-blush-deep)' }}>
        Probe unreachable — the platform may be down, or this session is offline.
      </p>
    );
  }

  const { health } = state;
  const checks = Object.entries(health.checks ?? {});
  return (
    <div>
      <p
        className="mb-3 text-2xl font-semibold tabular-nums"
        style={{ color: health.ok ? 'var(--m-sage-deep)' : 'var(--m-blush-deep)' }}
      >
        {health.ok ? 'All systems up' : `Failing: ${(health.failing ?? []).join(', ')}`}
      </p>
      <ul className="space-y-1.5">
        {checks.map(([name, check]) => (
          <li key={name} className="flex items-center justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-2" style={{ color: 'var(--m-ink)' }}>
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  background: check.ok ? 'var(--m-sage-deep)' : 'var(--m-blush-deep)',
                }}
              />
              {name}
            </span>
            <span className="tabular-nums" style={{ color: 'var(--m-slate)' }}>
              {check.ok ? `${Math.round(check.duration_ms)} ms` : (check.error_class ?? 'failed')}
            </span>
          </li>
        ))}
        {checks.length === 0 ? (
          <li className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
            No per-check detail returned.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

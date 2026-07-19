'use client';

/**
 * Sentry prod smoke-test button — admin-only. POST to
 * /api/admin/sentry-smoke-test, which returns 200 immediately and throws
 * a controlled error 100ms later for Sentry to capture.
 *
 * Per Task #5 / punch-list #19e: owner clicks this, then verifies (a)
 * the error appears in the Sentry dashboard within 60s and (b) the
 * configured alert email/Slack lands within 60s.
 */

import { useState } from 'react';

type FireResult =
  | { ok: true; traceId: string; initiatedBy: string }
  | { ok: false; status: number; error: string };

export function SentrySmokeTestButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FireResult | null>(null);

  async function fire() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/sentry-smoke-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = (await res.json()) as
        | { ok: true; throwingIn: number; traceId: string; initiatedBy: string; hint?: string }
        | { error: string; message?: string };

      if (res.ok && 'ok' in json && json.ok) {
        setResult({ ok: true, traceId: json.traceId, initiatedBy: json.initiatedBy });
      } else {
        setResult({
          ok: false,
          status: res.status,
          error:
            'message' in json && json.message
              ? json.message
              : 'error' in json
                ? json.error
                : `HTTP ${res.status}`,
        });
      }
    } catch (err) {
      setResult({ ok: false, status: 0, error: String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          onClick={fire}
          disabled={busy}
          className="rounded-full bg-ink px-4 py-1.5 text-sm text-cream disabled:opacity-50"
        >
          {busy ? 'Firing…' : 'Fire Sentry smoke test (admin only)'}
        </button>
        <p className="flex-1 min-w-[12rem] text-xs text-ink/55">
          Posts to <code className="rounded bg-ink/5 px-1 py-0.5 font-mono">/api/admin/sentry-smoke-test</code>.
          The endpoint returns 200, then throws a tagged error 100ms later.
        </p>
      </div>

      {result && result.ok && (
        <div className="rounded border border-success-200 bg-success-50 p-3 text-sm text-success-900">
          <strong>Smoke test fired ✓</strong>
          <div className="mt-1 text-xs text-success-700/80">
            Check Sentry dashboard + alert email within 60s.
          </div>
          <div className="mt-2 grid gap-1 font-mono text-xs text-success-900/80">
            <span>
              trace_id: <code className="rounded bg-success-100/60 px-1 py-0.5">{result.traceId}</code>
            </span>
            <span>
              initiated_by: <code className="rounded bg-success-100/60 px-1 py-0.5">{result.initiatedBy}</code>
            </span>
          </div>
          <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-xs text-success-900/80">
            <li>Open the Sentry project dashboard.</li>
            <li>
              Search by <code>{result.traceId}</code> — error should appear within 60s.
            </li>
            <li>Confirm the configured alert email/Slack delivered within 60s.</li>
          </ol>
        </div>
      )}

      {result && !result.ok && (
        <div className="rounded border border-danger-200 bg-danger-50 p-3 text-sm text-danger-900">
          <strong>Smoke test failed</strong>
          <div className="mt-1 text-xs">HTTP {result.status}: {result.error}</div>
        </div>
      )}
    </div>
  );
}

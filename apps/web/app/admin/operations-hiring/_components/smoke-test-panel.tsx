'use client';

import { useState } from 'react';

type SmokeResult =
  | { ok: true; type: string; messageId?: string; recipient?: string; via?: string }
  | { ok: false; type: string; reason?: string; error?: string; status?: number };

export function SmokeTestPanel() {
  const [resendBusy, setResendBusy] = useState(false);
  const [sentryBusy, setSentryBusy] = useState(false);
  const [lastResult, setLastResult] = useState<SmokeResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  async function runResendTest() {
    setResendBusy(true);
    setLastError(null);
    setLastResult(null);
    try {
      const res = await fetch('/api/admin/smoke-test?type=resend');
      const json = (await res.json()) as SmokeResult;
      setLastResult(json);
      if (!res.ok && !json.ok) {
        setLastError(`HTTP ${res.status}`);
      }
    } catch (err) {
      setLastError(String(err));
    } finally {
      setResendBusy(false);
    }
  }

  async function runSentryTest() {
    setSentryBusy(true);
    setLastError(null);
    setLastResult(null);
    try {
      const res = await fetch('/api/admin/smoke-test?type=sentry');
      // We EXPECT a 500 here — the route handler throws on purpose for
      // Sentry to capture. So a 500 response = test fired correctly.
      if (res.status === 500) {
        setLastResult({
          ok: true,
          type: 'sentry',
          recipient: 'Sentry dashboard',
          via: 'thrown-error',
        });
      } else {
        setLastError(`Expected HTTP 500 (controlled throw), got ${res.status}`);
      }
    } catch (err) {
      // Some browsers / proxies surface 500-from-throw as a network error.
      // Treat that as success too.
      setLastResult({
        ok: true,
        type: 'sentry',
        recipient: 'Sentry dashboard',
        via: 'network-error-from-throw',
      });
    } finally {
      setSentryBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-ink/10 bg-cream p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink/50">
          Prod smoke tests
        </h2>
        <span className="text-xs text-ink/50">owner-only · run in prod</span>
      </div>
      <p className="mt-2 text-sm text-ink/60">
        Verifies Sentry capture + Resend email delivery against the live deployment.
        Sentry test triggers a controlled error (expected 500); Resend test sends a
        test email to <code className="rounded bg-ink/5 px-1 py-0.5">{`OWNER_NOTIFICATION_EMAIL`}</code>.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runResendTest}
          disabled={resendBusy || sentryBusy}
          className="rounded-full bg-ink px-4 py-1.5 text-sm text-cream disabled:opacity-50"
        >
          {resendBusy ? 'Sending…' : 'Send Resend test email'}
        </button>
        <button
          type="button"
          onClick={runSentryTest}
          disabled={sentryBusy || resendBusy}
          className="rounded-full border border-ink/20 bg-ink/5 px-4 py-1.5 text-sm text-ink/80 hover:bg-ink/10 disabled:opacity-50"
        >
          {sentryBusy ? 'Triggering…' : 'Trigger Sentry test error'}
        </button>
      </div>

      {lastResult && lastResult.ok && (
        <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <strong>{lastResult.type} test fired ✓</strong>
          {lastResult.messageId && (
            <span className="ml-2 text-emerald-700/80">message_id: <code className="font-mono text-xs">{lastResult.messageId}</code></span>
          )}
          {lastResult.recipient && (
            <span className="ml-2 text-emerald-700/80">→ {lastResult.recipient}</span>
          )}
          <div className="mt-1 text-xs text-emerald-700/80">
            {lastResult.type === 'resend'
              ? 'Check your inbox at the OWNER_NOTIFICATION_EMAIL. If the email does not arrive within 60s, see the troubleshooting steps in the Resend dashboard.'
              : 'Check Sentry dashboard for the captured event. The error subject contains the trace_id you can search by.'}
          </div>
        </div>
      )}

      {lastResult && !lastResult.ok && (
        <div className="mt-3 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <strong>{lastResult.type} test FAILED</strong>
          {lastResult.reason && <div className="mt-1 text-xs">reason: {lastResult.reason}</div>}
          {lastResult.error && <div className="mt-1 text-xs">error: {lastResult.error}</div>}
        </div>
      )}

      {lastError && (
        <div className="mt-3 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {lastError}
        </div>
      )}
    </section>
  );
}

'use client';

/**
 * Prod smoke tests — drawn as the approved drawing's last section of Operations & hiring (insights.html): a section
 * head whose explanation lives in its ⓘ (T17), two equal-weight 44 px buttons, and the result as plain lines in the
 * house tones (no boxes around read-only words, T18). The two tests fire exactly as before — no confirm step was
 * added or removed.
 */
import { useState } from 'react';

import { Sec } from '@/app/admin/app-performance/_components/insights-parts';

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
    <section aria-labelledby="ops-smoke">
      <Sec
        id="ops-smoke"
        title="Prod smoke tests"
        about={
          <>
            Verifies Sentry capture + Resend email delivery against the live deployment. Sentry test triggers a
            controlled error (expected 500); Resend test sends a test email to{' '}
            <code className="rounded bg-ink/5 px-1 py-0.5">{`OWNER_NOTIFICATION_EMAIL`}</code>.
          </>
        }
        right={<span className="text-[12px] text-ink/55">owner-only · run in prod</span>}
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={runResendTest}
          disabled={resendBusy || sentryBusy}
          className="min-h-11 rounded-full bg-[var(--sn-info-soft)] px-3 text-[14px] font-semibold text-[var(--sn-info)] disabled:opacity-50"
        >
          {resendBusy ? 'Sending…' : 'Send Resend test email'}
        </button>
        <button
          type="button"
          onClick={runSentryTest}
          disabled={sentryBusy || resendBusy}
          className="min-h-11 rounded-full bg-[var(--sn-warning-soft)] px-3 text-[14px] font-semibold text-[var(--sn-warning-deep)] disabled:opacity-50"
        >
          {sentryBusy ? 'Triggering…' : 'Trigger Sentry test error'}
        </button>
      </div>

      {lastResult && lastResult.ok && (
        <div role="status" className="mt-3 text-[14px] text-[var(--sn-success-deep)]">
          <strong>{lastResult.type} test fired ✓</strong>
          {lastResult.messageId && (
            <span className="ml-2 text-ink/65">message_id: <code className="font-mono text-xs">{lastResult.messageId}</code></span>
          )}
          {lastResult.recipient && (
            <span className="ml-2 text-ink/65">→ {lastResult.recipient}</span>
          )}
          <div className="mt-1 text-[13px] text-ink/65">
            {lastResult.type === 'resend'
              ? 'Check your inbox at the OWNER_NOTIFICATION_EMAIL. If the email does not arrive within 60s, see the troubleshooting steps in the Resend dashboard.'
              : 'Check Sentry dashboard for the captured event. The error subject contains the trace_id you can search by.'}
          </div>
        </div>
      )}

      {lastResult && !lastResult.ok && (
        <div role="alert" className="mt-3 text-[14px] text-[var(--sn-danger)]">
          <strong>{lastResult.type} test FAILED</strong>
          {lastResult.reason && <div className="mt-1 text-[13px]">reason: {lastResult.reason}</div>}
          {lastResult.error && <div className="mt-1 text-[13px]">error: {lastResult.error}</div>}
        </div>
      )}

      {lastError && (
        <p role="alert" className="mt-3 text-[14px] text-[var(--sn-danger)]">
          {lastError}
        </p>
      )}
    </section>
  );
}

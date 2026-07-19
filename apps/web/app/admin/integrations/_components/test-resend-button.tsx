'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Send, XCircle } from 'lucide-react';

// Integration Activation Console — PR1. Fires the existing admin smoke-test
// (/api/admin/smoke-test?type=resend), which sends a real test email via the
// now-DB-first sendEmail() and reports back. Green/red inline.

export function TestResendButton() {
  const [state, setState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setState('testing');
    setMsg(null);
    try {
      const res = await fetch('/api/admin/smoke-test?type=resend', { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        error?: string;
        message?: string;
      };
      if (res.ok && body.ok !== false) {
        setState('ok');
        setMsg(body.id ? `Sent — message id ${body.id}` : 'Sent.');
      } else {
        setState('fail');
        setMsg(body.error || body.message || `Failed (${res.status})`);
      }
    } catch (e) {
      setState('fail');
      setMsg(e instanceof Error ? e.message : 'Request failed');
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={state === 'testing'}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:border-terracotta/40 hover:text-terracotta-700 disabled:opacity-60"
      >
        {state === 'testing' ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
        ) : (
          <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        )}
        Send a test email
      </button>
      {state === 'ok' && (
        <p className="inline-flex items-start gap-1.5 text-xs text-emerald-800">
          <CheckCircle2 aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          {msg} (delivered to the platform contact address)
        </p>
      )}
      {state === 'fail' && (
        <p className="inline-flex items-start gap-1.5 text-xs text-rose-700">
          <XCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          {msg}
        </p>
      )}
    </div>
  );
}

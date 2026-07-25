'use client';

import { useState, useTransition } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { runReencryptSweep } from '../actions';
import type { ReencryptCounts } from '@/lib/secrets/reencrypt';

// Step 4 of the ENCRYPTION_KEY dual-key runbook: re-seal every stored ciphertext
// under the current key. The action returns three integers and nothing else —
// no value, no ciphertext, no row identifier.
//
// A button rather than a form because the result renders in place (the operator
// runs it repeatedly until failed = 0) instead of redirecting.

export function ReencryptPanel() {
  const [pending, startTransition] = useTransition();
  const [counts, setCounts] = useState<ReencryptCounts | null>(null);
  const [failedToRun, setFailedToRun] = useState(false);

  return (
    <div className="space-y-3 border-t border-ink/10 pt-4">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setFailedToRun(false);
          startTransition(async () => {
            try {
              setCounts(await runReencryptSweep());
            } catch {
              setCounts(null);
              setFailedToRun(true);
            }
          });
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600 ${
          pending ? 'cursor-wait opacity-80' : ''
        }`}
      >
        {pending ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2.25} />
        ) : (
          <RefreshCw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        )}
        {pending ? 'Sweeping…' : 'Run re-encrypt sweep'}
      </button>

      {counts ? (
        <div role="status" className="space-y-1.5">
          <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[180px_1fr]">
            <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              Re-encrypted
            </dt>
            <dd className="text-ink/80">{counts.reencrypted}</dd>
            <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              Already current
            </dt>
            <dd className="text-ink/80">{counts.alreadyCurrent}</dd>
            <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              Failed
            </dt>
            <dd className={counts.failed > 0 ? 'font-medium text-rose-700' : 'text-ink/80'}>
              {counts.failed}
            </dd>
          </dl>
          <p className="text-xs text-ink/60">
            {counts.failed > 0
              ? 'Some values decrypt under NEITHER key — they were left untouched. Keep ENCRYPTION_KEY_PREVIOUS set, confirm it holds the real old key, and run again.'
              : counts.reencrypted > 0
                ? 'Run it once more. When it reports 0 re-encrypted and 0 failed, nothing depends on the previous key any more.'
                : 'Nothing depends on ENCRYPTION_KEY_PREVIOUS any more — it is safe to delete it in Vercel and redeploy.'}
          </p>
        </div>
      ) : null}

      {failedToRun ? (
        <p role="alert" className="text-xs text-rose-700">
          The sweep could not run. Check that ENCRYPTION_KEY is set and try again.
        </p>
      ) : null}
    </div>
  );
}

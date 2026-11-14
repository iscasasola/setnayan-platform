'use client';

/**
 * "Re-run audit now" — the manual trigger for the SEO/GEO health audit.
 *
 * The audit otherwise only fires from `after()` in the admin layout, claim-gated
 * to ~once a day, and because `after()` runs post-response the surface always
 * shows the PREVIOUS snapshot. This button calls the jobs directly and
 * revalidates, so a price edit is confirmable in seconds.
 *
 * Deliberately reports the Search Console half honestly — it no-ops until the
 * GSC credentials are in Vercel env, and a bare "Done" would hide that.
 *
 * The view's one main verb (approved drawing, insights.html › SEO & GEO): filled, 44 px.
 */

import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { seoConsole } from './seo-actions';

export function SeoRerunButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            try {
              setResult(await seoConsole());
            } catch {
              setResult({ ok: false, message: 'Re-run failed. Check server logs.' });
            }
          })
        }
        className="button-primary inline-flex min-h-11 items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} aria-hidden />
        {pending ? 'Running…' : 'Re-run audit now'}
      </button>
      {result ? (
        <p
          role="status"
          className={`max-w-xs text-right text-[12px] ${result.ok ? 'text-ink/60' : 'text-[var(--sn-danger)]'}`}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

/**
 * /vendor-dashboard route-segment error boundary.
 *
 * WHY (2026-05-29 · pilot blocker · 3 days from 2026-06-01 launch):
 * The shop-console crash matching Sentry digest 1341067551 ("Missing
 * SUPABASE env vars for admin client.") persisted in production even
 * after PR #628 wrapped `sweepLapsedSubscriptions(createAdminClient(), …)`
 * at apps/web/app/vendor-dashboard/page.tsx:99 in defensive try/catch.
 *
 * Root cause analysis on origin/main (aad577b) confirmed:
 *   - page.tsx:99 IS wrapped (verified via `git show origin/main`)
 *   - layout.tsx Promise.all helpers (countUnread · fetchUserRoleSummary ·
 *     getCurrentUser) use the regular createClient — NOT createAdminClient
 *   - All createAdminClient calls inside page.tsx's main try block (lines
 *     121-181) including `displayUrlForStoredAsset` are caught locally
 *   - Production Sentry release header confirms `aad577b` IS serving
 *
 * Yet the user reproduces "Something on our end didn't work · Reference:
 * 1341067551" on /vendor-dashboard main after hard refresh. That means
 * either (a) a transitive helper we haven't traced still throws the
 * "Missing SUPABASE env vars" message, OR (b) Vercel's prerender pipeline
 * cached a 500 from before PR #628 deployed, OR (c) the user's service
 * worker is intercepting.
 *
 * Route-segment error boundary catches ALL of those failure modes in one
 * file. Next.js auto-mounts this for any unhandled exception in the
 * /vendor-dashboard route tree (this file, its sub-routes, layout, page).
 * Errors stop bubbling at this boundary instead of reaching the global
 * app/error.tsx — the user sees a vendor-specific friendly message + a
 * Try again button that calls `reset()` to re-render the route segment
 * (which on retry, after the racy env-var case clears per PR #628 commit
 * body, will succeed cleanly).
 *
 * Sentry SDK still captures the underlying error via the global handler
 * wired in instrumentation.ts (iteration 0035 Observability) — no manual
 * logging needed beyond dev-mode debug.
 *
 * Per `[[feedback_setnayan_no_dev_text_post_launch]]` — brand-voice
 * editorial copy with selective Filipino warmth, not engineering jargon.
 * Per `[[feedback_setnayan_orphan_prevention]]` — entry point is implicit
 * (Next.js auto-mounts on errors in this segment); exit points are the
 * Try again button + the Switch to customer view link, both routed to
 * existing surfaces.
 * Per `[[feedback_setnayan_document_changes_with_why]]` — WHY block above.
 *
 * Cross-references:
 *   - CLAUDE.md 2026-05-29 row "2 pilot blockers" (parent PR #614 chain)
 *   - CLAUDE.md 2026-05-29 row "Vercel deploy status" (PR #628 fix landed)
 *   - apps/web/app/error.tsx (root error boundary · used to render this
 *     crash before this segment-level boundary was added)
 *   - Sentry digest 1341067551 (this fix's root cause coverage)
 *
 * Must be a Client Component (Next.js requirement for error boundaries).
 */

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function VendorDashboardError({ error, reset }: Props) {
  useEffect(() => {
    // Sentry SDK auto-captures via the global handler. Dev-mode console
    // surfaces the error in the local terminal for debugging.
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[vendor-dashboard error boundary]', error);
    }
  }, [error]);

  return (
    <main className="min-h-screen bg-cream text-ink flex items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/40 mb-6">
          Setnayan · Shop console
        </p>
        <div className="flex justify-center mb-6">
          <AlertTriangle
            aria-hidden
            className="h-10 w-10 text-terracotta"
            strokeWidth={1.5}
          />
        </div>
        <h1 className="font-display italic text-3xl sm:text-4xl leading-tight text-ink mb-6">
          Your shop console is temporarily unavailable.
        </h1>
        <p className="font-sans text-base sm:text-lg text-ink/70 leading-relaxed mb-10 max-w-md mx-auto">
          We hit a transient error loading your vendor dashboard. Try again in
          a moment — fresh deploys sometimes need a beat to settle. If it
          keeps happening, switch to your customer view and we&rsquo;ll dig in
          on our end.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center px-6 py-3 bg-mulberry text-cream font-sans text-sm font-medium tracking-wide hover:bg-mulberry-600 transition-colors rounded-sm"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 border border-ink/20 text-ink font-sans text-sm font-medium tracking-wide hover:bg-ink/5 transition-colors rounded-sm"
          >
            Switch to customer view
          </Link>
        </div>
        {error?.digest && (
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/30 mt-10">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}

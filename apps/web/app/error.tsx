'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// Root error boundary — brand-voice per feedback_setnayan_no_dev_text_post_launch
// lock. Next.js auto-mounts this for any unhandled exception in a route segment.
// Must be a Client Component (Next.js requirement for error boundaries).
// Sentry SDK already captures the error via the global handler wired in
// instrumentation.ts (iteration 0035 Observability) — no manual logging needed.

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ error, reset }: Props) {
  useEffect(() => {
    // Sentry SDK auto-captures via the global handler. The `digest` is the
    // server-side error ID Next.js emits — surfaces in Sentry breadcrumb if
    // a customer mentions it in support.
    if (process.env.NODE_ENV === 'development') {
      console.error('[root error boundary]', error);
    }
  }, [error]);

  return (
    <main className="min-h-screen bg-cream text-ink flex items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/40 mb-6">
          Setnayan
        </p>
        <h1 className="font-display italic text-4xl sm:text-5xl leading-tight text-ink mb-6">
          Something on our end didn&rsquo;t work.
        </h1>
        <p className="font-sans text-base sm:text-lg text-ink/70 leading-relaxed mb-10 max-w-md mx-auto">
          We&rsquo;ve logged the issue and our team will look at it. Please try
          again in a moment.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center px-6 py-3 bg-terracotta text-cream font-sans text-sm font-medium tracking-wide hover:bg-terracotta-600 transition-colors rounded-sm"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-ink/20 text-ink font-sans text-sm font-medium tracking-wide hover:bg-ink/5 transition-colors rounded-sm"
          >
            Take me home
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

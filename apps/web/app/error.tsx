'use client';

import Link from 'next/link';
import { useEffect } from 'react';

// Global error boundary. Catches runtime errors from any route under the
// root layout. Keep copy editorial-brand-voice per
// `feedback_setnayan_no_dev_text_post_launch` — no stack-trace exposure,
// no "something went wrong" generic, just polite + actionable.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Forward to Sentry via the existing provider chain. Avoid logging the
    // full error object to console — keep production logs clean.
    if (typeof window !== 'undefined' && 'Sentry' in window) {
      const sentry = (window as unknown as { Sentry?: { captureException: (e: unknown) => void } })
        .Sentry;
      sentry?.captureException(error);
    }
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-ink/55">
        Something interrupted us
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        We couldn&rsquo;t load this page.
      </h1>
      <p className="mt-4 max-w-prose text-base text-ink/65">
        It&rsquo;s on us — our team has been notified. Try again, or take a moment
        and come back to it.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
          Reference: {error.digest}
        </p>
      ) : null}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center justify-center rounded-md bg-terracotta px-5 text-sm font-medium text-cream hover:bg-terracotta-600"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-md border border-ink/15 bg-cream px-5 text-sm font-medium text-ink hover:bg-ink/5"
        >
          Take me home
        </Link>
      </div>
    </main>
  );
}

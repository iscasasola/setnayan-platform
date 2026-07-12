'use client';

/**
 * /admin error boundary — self-diagnosing (2026-07-12).
 *
 * WHY: admin crashes used to bubble to the root app/error.tsx, which shows
 * the guest-friendly "Something on our end didn't work" page with only a
 * digest — right for couples, useless for the operator (the owner reported
 * an /admin/money error today that was undiagnosable from the generic page).
 * Admins are internal: show them the actual error message, digest, and route
 * so any future admin crash names itself. No stack traces of third parties —
 * `error.message` + digest only, still safe.
 */

import { useEffect } from 'react';
import Link from 'next/link';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Mirror to the console for DevTools copy/paste.
    // eslint-disable-next-line no-console
    console.error('[admin-error]', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/50">
        Setnayan HQ · admin error
      </p>
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        This surface crashed — here&rsquo;s exactly why.
      </h1>
      <div className="w-full overflow-x-auto rounded-xl border border-danger-200 bg-danger-50/60 p-4 text-left">
        <p className="font-mono text-[13px] leading-relaxed text-danger-800 break-words">
          {error.message || 'No message on the error object.'}
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/45">
            digest: {error.digest} · route: {typeof window !== 'undefined' ? window.location.pathname : ''}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-terracotta px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="rounded-md border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink hover:bg-ink/5"
        >
          Back to Overview
        </Link>
      </div>
      <p className="max-w-md text-xs leading-relaxed text-ink/50">
        Internal surface — this detail view never renders for couples, vendors,
        or guests (their crashes keep the calm branded page).
      </p>
    </main>
  );
}

'use client';

import { useEffect } from 'react';

// Guest-site error boundary (2026-08-05).
//
// WHY THIS EXISTS. The loaders behind an invitation used to discard their read
// errors, so a failed query returned the same empty value as a genuine miss and
// the page told the guest their LINK WAS WRONG — someone standing at a venue
// holding a printed QR, being told their invitation is not real, because a
// query timed out. The loaders now throw on a failed read, and this is what the
// guest sees instead.
//
// It is deliberately NOT the root boundary. That one is written for a customer
// on the marketing site: it says "our team will look at it" and offers "Take me
// home", which for a wedding guest means leaving the invitation they were sent
// and landing on a page about buying a product. Here, home IS this page, so the
// only thing offered is trying again.
//
// Sentry captures via the global handler (instrumentation.ts) — no manual log.

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function InvitationError({ error, reset }: Props) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[invitation error boundary]', error);
    }
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6 py-16 text-ink">
      <div className="w-full max-w-md text-center">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.2em] text-ink/40">
          Setnayan
        </p>
        <h1 className="mb-5 font-display text-3xl italic leading-tight text-ink sm:text-4xl">
          This invitation didn&rsquo;t load.
        </h1>
        {/* The one thing worth saying: it is not their link. That is precisely
            what the page used to tell them by mistake. */}
        <p className="mx-auto mb-9 max-w-sm font-sans text-base leading-relaxed text-ink/70">
          Your link is fine — something on our end is having trouble. Give it a
          moment and try again.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center justify-center rounded-sm bg-mulberry px-6 py-3 font-sans text-sm font-medium tracking-wide text-cream transition-colors hover:bg-mulberry-600"
        >
          Try again
        </button>
        {error?.digest && (
          // 12px, not the root boundary's 10px: this screen is read by a guest,
          // often an older one at a venue, and the reference is the thing they
          // would be asked to read out to whoever they call for help.
          <p className="mt-10 font-mono text-xs uppercase tracking-[0.15em] text-ink/40">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}

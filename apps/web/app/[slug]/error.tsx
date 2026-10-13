'use client';

import { startTransition, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AUTO_RETRY_DELAY_MS, claimAutoRetry } from '@/lib/invitation-retry';

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
// 🔁 TRYING AGAIN RE-ASKS THE SERVER (2026-10-13, guest-load fix). The failure
// that brings a guest here is almost always the free database stalling for a
// few seconds mid-render (`lib/read-limit.ts` gives up at its deadline). In
// Next 15 `reset()` alone re-renders the page the browser ALREADY HOLDS — the
// failed one — so "Try again" did nothing. Both the button and the one
// automatic retry now run `router.refresh()` (a fresh server render) and
// `reset()` together in one transition: the boundary stays on screen until the
// new render arrives, then gives way to it. The automatic retry fires once per
// page per minute (`lib/invitation-retry.ts`), AUTO_RETRY_DELAY_MS after this
// screen appears — a stall is usually over by then — and while either is under
// way the screen says "Still opening your invitation…" (owner rule: a press
// says what is happening; never a dead end).
//
// Sentry captures via the browser SDK, lazy-loaded post-hydration by
// app/_components/deferred-observability.tsx — no manual log. This boundary is
// a Client Component, so instrumentation.ts (server-only) does not see it.

/** Longer than the page's own read budget (lib/read-limit.ts, 10 s + a 4 s pause) plus the wait. */
const OPENING_GIVES_UP_MS = 20_000;

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export default function InvitationError({ error, reset }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [opening, setOpening] = useState(false);
  // Read through a ref so the timer below always reaches the current router/reset.
  const latest = useRef({ router, reset });
  latest.current = { router, reset };

  function openAgain() {
    setOpening(true);
    startTransition(() => {
      latest.current.router.refresh();
      latest.current.reset();
    });
  }

  // If the fresh render failed too and React handed THIS boundary the new error,
  // say so again and offer the button — never a spinner that waits forever.
  // (A render that hangs past the page's own read deadline also ends here.)
  const firstError = useRef(error);
  useEffect(() => {
    if (error !== firstError.current) setOpening(false);
  }, [error]);
  useEffect(() => {
    if (!opening) return;
    const giveUp = window.setTimeout(() => setOpening(false), OPENING_GIVES_UP_MS);
    return () => window.clearTimeout(giveUp);
  }, [opening]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[invitation error boundary]', error);
    }
    // 📋 Problems list — a browser-born crash is recorded (a server-born one,
    // with a digest, was already recorded by onRequestError). Lazy: this
    // boundary pays nothing for it until it renders.
    void import('@/lib/telemetry/report-crash')
      .then((m) => m.reportCrash(error, 'event page'))
      .catch(() => {});
  }, [error]);

  // The one automatic retry — decided once per mount, at most once per page per minute.
  const autoDecided = useRef(false);
  useEffect(() => {
    if (autoDecided.current) return;
    autoDecided.current = true;
    if (!claimAutoRetry(sessionStore(), pathname || window.location.pathname, Date.now())) return;
    setOpening(true);
    const timer = window.setTimeout(() => {
      startTransition(() => {
        latest.current.router.refresh();
        latest.current.reset();
      });
    }, AUTO_RETRY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6 py-16 text-ink">
      <div className="w-full max-w-md text-center">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.2em] text-ink/70">
          Setnayan
        </p>
        {/* No alarm while it is still trying: a stall is usually over in seconds. */}
        <h1 className="mb-5 font-display text-3xl italic leading-tight text-ink sm:text-4xl">
          {opening ? <>Still opening your invitation&hellip;</> : <>This invitation didn&rsquo;t load.</>}
        </h1>
        {/* The one thing worth saying when it failed: it is not their link. That
            is precisely what the page used to tell them by mistake. */}
        <p
          role="status"
          aria-live="polite"
          className="mx-auto mb-9 max-w-sm font-sans text-base leading-relaxed text-ink/70"
        >
          {opening
            ? 'This is taking a little longer than usual. One moment.'
            : 'Your link is fine — something on our end is having trouble. Give it a moment and try again.'}
        </p>
        <button
          type="button"
          onClick={openAgain}
          disabled={opening}
          aria-busy={opening}
          className="inline-flex items-center justify-center rounded-sm bg-mulberry px-6 py-3 font-sans text-sm font-medium tracking-wide text-cream transition-colors hover:bg-mulberry-600 disabled:opacity-70"
        >
          {opening ? 'Opening…' : 'Try again'}
        </button>
        {error?.digest && (
          // 12px, not the root boundary's 10px: this screen is read by a guest,
          // often an older one at a venue, and the reference is the thing they
          // would be asked to read out to whoever they call for help.
          <p className="mt-10 font-mono text-xs uppercase tracking-[0.15em] text-ink/70">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}

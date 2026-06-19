'use client';

import { useEffect } from 'react';

// Global error boundary — Next.js mounts this when the root layout itself
// throws (the only error class root error.tsx can't catch, because it lives
// INSIDE the layout). Must include its own <html> + <body> because the
// layout has crashed by the time this renders.
//
// Per feedback_setnayan_no_dev_text_post_launch: even the worst-case crash
// surface reads brand-voice not engineering jargon. Inline styles only —
// Tailwind classes are not guaranteed to be available when the layout
// dies before its global.css <link> resolves.

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[global error boundary]', error);
    }
    // Report the root-layout crash to Sentry. This boundary is the ONLY place
    // these errors surface on the client — Sentry's SDK does NOT auto-capture
    // errors caught by a React error boundary — so without this the "We've
    // logged the issue" copy below would not be true.
    //
    // Dynamic import keeps @sentry/nextjs out of the shared client chunk (same
    // reasoning as _components/deferred-observability.tsx); a root-layout crash
    // is rare enough that loading the SDK on demand here is fine. No-ops safely
    // when the DSN is unset or the SDK never initialised.
    void import('@sentry/nextjs')
      .then((Sentry) => {
        Sentry.captureException(error, {
          tags: { boundary: 'global-error' },
          extra: error?.digest ? { digest: error.digest } : {},
        });
      })
      .catch(() => {
        /* observability is best-effort — never let it crash the crash page */
      });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          // Clean Editorial palette — Warm Alabaster surface + Deep Obsidian
          // text (per CLAUDE.md palette lock). global-error.tsx renders OUTSIDE
          // Tailwind's pipeline (Next.js root error boundary) so colors must be
          // inline hex literals matching the --m-* tokens in globals.css.
          backgroundColor: '#FBFBFA',
          color: '#1E2229',
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 1.5rem',
        }}
      >
        <div style={{ maxWidth: '36rem', width: '100%', textAlign: 'center' }}>
          <p
            style={{
              fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: 'rgba(30, 34, 41, 0.4)',
              marginBottom: '1.5rem',
            }}
          >
            Setnayan
          </p>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontStyle: 'italic',
              fontSize: '2.5rem',
              lineHeight: 1.15,
              fontWeight: 500,
              marginTop: 0,
              marginBottom: '1.5rem',
            }}
          >
            Something on our end didn&rsquo;t work.
          </h1>
          <p
            style={{
              fontSize: '1.0625rem',
              color: 'rgba(30, 34, 41, 0.7)',
              lineHeight: 1.65,
              maxWidth: '28rem',
              margin: '0 auto 2.5rem',
            }}
          >
            We&rsquo;ve logged the issue and our team will look at it. Please
            try again in a moment.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '0.75rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: '0.75rem 1.5rem',
                // 2026-05-30 Clean Editorial unification: Rich Mulberry CTA
                // (per CLAUDE.md 2026-05-29 palette lock). Supersedes the
                // 2026-05-22 Facebook blue. global-error.tsx renders OUTSIDE
                // Tailwind's processing pipeline (Next.js error boundary
                // root) so colors must be inline hex literals, not utility
                // classes. The Mulberry value matches the --color-mulberry
                // token in apps/web/app/globals.css.
                backgroundColor: '#5C2542',
                color: '#FFFFFF',
                fontSize: '0.875rem',
                fontWeight: 500,
                letterSpacing: '0.025em',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
                global-error mounts when the root layout itself has crashed.
                The Next.js router context may not be available, so a raw <a>
                with full-page navigation is the safe fallback. <Link> would
                depend on the same machinery that just died. */}
            <a
              href="/"
              style={{
                padding: '0.75rem 1.5rem',
                color: '#1E2229',
                fontSize: '0.875rem',
                fontWeight: 500,
                letterSpacing: '0.025em',
                border: '1px solid rgba(30, 34, 41, 0.2)',
                borderRadius: '2px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Take me home
            </a>
          </div>
          {error?.digest && (
            <p
              style={{
                fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                fontSize: '0.625rem',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'rgba(30, 34, 41, 0.3)',
                marginTop: '2.5rem',
              }}
            >
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}

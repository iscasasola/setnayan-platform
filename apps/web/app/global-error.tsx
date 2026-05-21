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
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          backgroundColor: '#FAF6F0',
          color: '#1A1A1A',
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
              color: 'rgba(26, 26, 26, 0.4)',
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
              color: 'rgba(26, 26, 26, 0.7)',
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
                backgroundColor: '#7A1F2B',
                color: '#FAF6F0',
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
                color: '#1A1A1A',
                fontSize: '0.875rem',
                fontWeight: 500,
                letterSpacing: '0.025em',
                border: '1px solid rgba(26, 26, 26, 0.2)',
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
                color: 'rgba(26, 26, 26, 0.3)',
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

import Link from 'next/link';

/**
 * WhatYouGet — the post-hero homepage narrative ("A Place for Each").
 *
 * Owner 2026-06-14: after the hero's "Set na 'yan" end-card, answer the one
 * question the hero raises — "okay… so how does this actually help me?" — in
 * depth. Show we are NOT just a place to inquire: you create and run the whole
 * wedding free, and add paid services only if you want more. Omit what the hero
 * already said (the overwhelm + the brand payoff); lead with the rooms you move
 * into. Price-free BY DESIGN — no SKU amounts on the homepage (prices live on
 * the dedicated surfaces; the homepage sells the free-first promise).
 *
 * Dependency-light (no framer-motion) so it renders through the client
 * PostHeroReveal gate as server-rendered children.
 */

const ROOMS: Array<{ name: string; line: string }> = [
  { name: 'Guest List', line: 'Everyone you love, organized — with RSVPs and day-of check-in.' },
  { name: 'Seat Plan', line: 'Drag every table into place. Free, forever.' },
  { name: 'Budget', line: 'Every peso tracked, every deadline in your calendar.' },
  { name: 'Timeline', line: 'A countdown and a run-of-show that keeps the day on time.' },
  { name: 'Mood Board', line: 'Your palette and your look, in one beautiful board.' },
  { name: 'Website', line: 'A real wedding site with branded QR invitations.' },
];

export function WhatYouGet() {
  return (
    <section className="bg-[var(--m-paper)] text-[var(--m-ink)]">
      {/* Beat 1 — the reframe */}
      <div className="mx-auto max-w-[1100px] px-5 pt-20 pb-10 text-center sm:px-8 sm:pt-28 lg:px-14">
        <div
          className="m-mono"
          style={{
            fontSize: 11,
            letterSpacing: '.24em',
            textTransform: 'uppercase',
            color: 'var(--m-slate-2)',
          }}
        >
          How Setnayan helps you
        </div>
        <h2
          className="m-serif italic mx-auto mt-5"
          style={{ fontSize: 'clamp(2.1rem, 6vw, 3.6rem)', lineHeight: 1.08, maxWidth: 820 }}
        >
          Not just a place to inquire.{' '}
          <span style={{ color: 'var(--m-mulberry)' }}>A home you move into — free.</span>
        </h2>
        <p
          className="mx-auto mt-6 text-[var(--m-slate)]"
          style={{ fontSize: 'clamp(1rem, 2.6vw, 1.2rem)', lineHeight: 1.6, maxWidth: 600 }}
        >
          Most apps hand you a list of vendors and leave. Setnayan is where you actually build and
          run the whole wedding — every part of it, free from the first day.
        </p>
      </div>

      {/* Beat 2 — a place for each */}
      <div className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8 lg:px-14">
        <div
          className="m-mono text-center"
          style={{
            fontSize: 11,
            letterSpacing: '.24em',
            textTransform: 'uppercase',
            color: 'var(--m-orange-2)',
            marginBottom: 28,
          }}
        >
          A place for each
        </div>
        <div
          className="grid gap-3 sm:gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
        >
          {ROOMS.map((r) => (
            <div
              key={r.name}
              className="rounded-[14px] border border-[var(--m-line)] bg-[var(--m-paper-2)] p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-[var(--m-ink)]" style={{ fontSize: 16 }}>
                  {r.name}
                </span>
                <span
                  className="m-mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: '.14em',
                    textTransform: 'uppercase',
                    color: 'var(--m-ink)',
                    background: 'var(--m-orange-3)',
                    borderRadius: 999,
                    padding: '3px 8px',
                  }}
                >
                  Free
                </span>
              </div>
              <p className="mt-2 text-[var(--m-slate)]" style={{ fontSize: 14, lineHeight: 1.5 }}>
                {r.line}
              </p>
            </div>
          ))}
        </div>
        <p
          className="m-serif italic mx-auto mt-7 text-center text-[var(--m-slate)]"
          style={{ fontSize: 'clamp(1.05rem, 2.8vw, 1.35rem)', maxWidth: 560 }}
        >
          Every part of your wedding has a place. You don&rsquo;t pay to start — you just move in.
        </p>
      </div>

      {/* Beat 3 — find your people (free marketplace) */}
      <div className="mx-auto max-w-[820px] px-5 py-12 text-center sm:px-8 lg:px-14">
        <h3
          className="m-serif italic"
          style={{ fontSize: 'clamp(1.7rem, 4.5vw, 2.6rem)', lineHeight: 1.12 }}
        >
          Find your people
        </h3>
        <p
          className="mt-4 text-[var(--m-slate)]"
          style={{ fontSize: 'clamp(1rem, 2.6vw, 1.15rem)', lineHeight: 1.6 }}
        >
          When you&rsquo;re ready to hire, find vendors who fit your date, your location, and your
          budget — and book at{' '}
          <span className="font-medium text-[var(--m-ink)]">0% commission. Always.</span>
        </p>
      </div>

      {/* Beat 4 — soft upgrade (no prices) */}
      <div className="mx-auto max-w-[820px] border-t border-[var(--m-line-soft)] px-5 py-12 text-center sm:px-8 lg:px-14">
        <h3
          className="m-serif italic"
          style={{ fontSize: 'clamp(1.7rem, 4.5vw, 2.6rem)', lineHeight: 1.12 }}
        >
          Want it sharper? Want it remembered?
        </h3>
        <p
          className="mt-4 text-[var(--m-slate)]"
          style={{ fontSize: 'clamp(1rem, 2.6vw, 1.15rem)', lineHeight: 1.6 }}
        >
          Setnayan AI ranks the vendors who fit you best. Papic turns your guests&rsquo; phones into
          a photo-and-video crew. A custom song. A same-day film. Add only what you want — the
          planning always stays free.
        </p>
      </div>

      {/* Beat 5 — close + CTA */}
      <div className="px-5 pt-16 pb-24 text-center sm:px-8 lg:px-14">
        <div
          className="m-mono"
          style={{
            fontSize: 11,
            letterSpacing: '.24em',
            textTransform: 'uppercase',
            color: 'var(--m-mulberry)',
            marginBottom: 14,
          }}
        >
          Set na &rsquo;yan
        </div>
        <div
          className="m-serif italic mx-auto"
          style={{ fontSize: 'clamp(2rem, 5.5vw, 3.4rem)', lineHeight: 1.06, maxWidth: 720 }}
        >
          Start your wedding — <span style={{ color: 'var(--m-mulberry)' }}>free.</span>
        </div>
        <div className="mt-8">
          <Link href="/onboarding/wedding" className="m-btn m-btn-primary m-btn-lg">
            Start planning <span style={{ color: 'var(--m-orange-3)' }}>· free</span>
          </Link>
        </div>
        <div
          className="m-mono"
          style={{
            fontSize: 11,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--m-slate-2)',
            marginTop: 18,
          }}
        >
          0% commission · always
        </div>
      </div>
    </section>
  );
}

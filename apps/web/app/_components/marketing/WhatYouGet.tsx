import Link from 'next/link';
import { Reveal, Blob } from './_motion';

/**
 * WhatYouGet — the post-hero homepage narrative ("A Place for Each").
 *
 * Owner 2026-06-14 (redesign): the hero is a cinematic dark scroll-scrub that
 * ends on a premium end-card. The old reveal cut straight from that to a flat,
 * bright page of six one-line bordered boxes — it "felt empty" and never let
 * the visitor FEEL the benefit. This rebuild makes the reveal CONTINUE the hero:
 *
 *   Beat 0 — DARK BRIDGE (#0e0f12, same canvas as the hero end-card → no jar):
 *            the feel-the-difference centerpiece. "Without Setnayan" (dim,
 *            tilted chaos chips) → one arrow → "With Setnayan" (one bright,
 *            glowing dashboard card). The canvas then fades dark → light.
 *   Beat 1 — the reframe ("A home you move into — free"). Owner's line, elevated.
 *   Beat 2 — "A place for each": six free tools, each with a small product MOCK
 *            (RSVP avatars · table plan · budget bar · timeline · palette ·
 *            site+QR) and a concrete "what it replaces" line — real product you
 *            can feel, not labelled boxes.
 *   Beat 3 — find your people (free 0%-commission marketplace).
 *   Beat 4 — want it sharper (premium add-ons, as tangible chips).
 *   Beat 5 — close + CTA, styled to echo the hero end-card.
 *
 * Still PRICE-FREE by design — no SKU amounts on the homepage (prices live on
 * the dedicated surfaces; the homepage sells the free-first promise). Reuses the
 * repo's zero-dependency Reveal/Blob primitives + the --m-* Clean Editorial
 * tokens, so it renders through the client PostHeroReveal gate cleanly.
 */

// ─────────────────────────────────────────────────────────────────────
// The six free rooms — each carries a concrete outcome + the mess it ends.
// `mock` keys into RoomMock() below for a small, theme-tokened product visual.
// ─────────────────────────────────────────────────────────────────────
const ROOMS: Array<{ mock: RoomMockKind; name: string; line: string; ends: string }> = [
  {
    mock: 'guests',
    name: 'Guest List',
    line: 'Everyone you love, organized — with RSVPs and day-of check-in.',
    ends: 'Ends the “sino ba talaga ang pupunta?” group chat.',
  },
  {
    mock: 'seats',
    name: 'Seat Plan',
    line: 'Drag every table into place, and watch it just fit.',
    ends: 'Ends the printed chart you re-draw at midnight.',
  },
  {
    mock: 'budget',
    name: 'Budget',
    line: 'Every peso tracked, every deadline in your calendar.',
    ends: 'Ends Budget.xlsx — v8, mostly guessed.',
  },
  {
    mock: 'timeline',
    name: 'Timeline',
    line: 'A countdown and a run-of-show that keeps the day on time.',
    ends: 'Ends the where-is-everyone panic at 3pm.',
  },
  {
    mock: 'mood',
    name: 'Mood Board',
    line: 'Your palette and your whole look, in one beautiful board.',
    ends: 'Ends three Pinterest boards that disagree.',
  },
  {
    mock: 'website',
    name: 'Website',
    line: 'A real wedding site with branded QR invitations.',
    ends: 'Ends the “can you resend the details?” texts.',
  },
];

export function WhatYouGet() {
  return (
    <section className="text-[var(--m-ink)]">
      {/* ───────────────────────────────────────────────────────────────
          BEAT 0 — DARK BRIDGE. Continues the hero's #0e0f12 canvas so the
          "tap to learn more" reveal feels like the same film, then resolves
          the chaos→order story into a single bright card before fading to light.
          ─────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: '#0e0f12' }}>
        <Blob top={-60} left={-40} size={520} color="var(--m-orange)" opacity={0.1} />
        <Blob bottom={-120} right={-80} size={560} color="var(--m-mulberry)" opacity={0.16} />

        <div className="relative mx-auto max-w-[1100px] px-5 pt-20 pb-16 sm:px-8 sm:pt-24 lg:px-14">
          <Reveal>
            <div
              className="m-mono text-center"
              style={{
                fontSize: 11,
                letterSpacing: '.24em',
                textTransform: 'uppercase',
                color: 'var(--m-orange-3)',
              }}
            >
              Set na ’yan
            </div>
            <h2
              className="m-serif italic mx-auto mt-5 text-center"
              style={{
                color: '#FBFBFA',
                fontSize: 'clamp(2rem, 5.6vw, 3.4rem)',
                lineHeight: 1.1,
                maxWidth: 760,
              }}
            >
              So how does this actually{' '}
              <span style={{ color: 'var(--m-orange-3)' }}>change your wedding?</span>
            </h2>
            <p
              className="mx-auto mt-5 text-center"
              style={{
                color: 'rgba(251,251,250,.62)',
                fontSize: 'clamp(1rem, 2.5vw, 1.15rem)',
                lineHeight: 1.6,
                maxWidth: 560,
              }}
            >
              It moves the whole thing out of a dozen apps and into one calm home —
              free from the first day.
            </p>
          </Reveal>

          {/* The before → after. Left: the mess you live in now. Right: one home. */}
          <div className="mt-14 grid items-center gap-8 lg:grid-cols-[1fr_auto_1.05fr]">
            {/* Without Setnayan — dim, tilted chaos */}
            <Reveal>
              <div>
                <div
                  className="m-mono mb-4"
                  style={{
                    fontSize: 10,
                    letterSpacing: '.18em',
                    textTransform: 'uppercase',
                    color: 'rgba(251,251,250,.4)',
                  }}
                >
                  Without Setnayan
                </div>
                <div className="flex flex-col gap-2">
                  {CHAOS.map((c, i) => (
                    <div
                      key={c.tag}
                      style={{
                        transform: `rotate(${CHAOS_TILT[i]}deg)`,
                        background: 'rgba(255,255,255,.03)',
                        border: '1px solid rgba(255,255,255,.08)',
                        borderRadius: 'var(--m-r-md)',
                        padding: '10px 14px',
                        display: 'grid',
                        gridTemplateColumns: '128px 1fr',
                        gap: 12,
                        alignItems: 'center',
                      }}
                    >
                      <span
                        className="m-mono"
                        style={{
                          fontSize: 10,
                          letterSpacing: '.06em',
                          textTransform: 'uppercase',
                          color: 'rgba(251,251,250,.4)',
                        }}
                      >
                        {c.tag}
                      </span>
                      <span style={{ fontSize: 13, color: 'rgba(251,251,250,.72)' }}>{c.body}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* The turn — arrow + "one home" */}
            <Reveal delay={120}>
              <div className="flex flex-col items-center gap-3 py-2 lg:py-0">
                <svg
                  width="120"
                  height="24"
                  viewBox="0 0 120 24"
                  style={{ overflow: 'visible' }}
                  className="rotate-90 lg:rotate-0"
                  aria-hidden
                >
                  <path
                    d="M 0 12 L 108 12"
                    stroke="var(--m-orange-3)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                  <path
                    d="M 100 4 L 116 12 L 100 20"
                    fill="none"
                    stroke="var(--m-orange-3)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  className="m-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '.18em',
                    textTransform: 'uppercase',
                    color: 'var(--m-orange-3)',
                  }}
                >
                  One home
                </span>
              </div>
            </Reveal>

            {/* With Setnayan — one bright, glowing dashboard card */}
            <Reveal delay={200}>
              <div
                style={{
                  background: 'var(--m-paper)',
                  borderRadius: 'var(--m-r-lg)',
                  padding: 22,
                  boxShadow:
                    '0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.06), 0 0 60px rgba(197,160,89,.18)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="m-mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: '.18em',
                      textTransform: 'uppercase',
                      color: 'var(--m-orange-2)',
                    }}
                  >
                    With Setnayan
                  </span>
                  <span
                    className="m-mono"
                    style={{
                      fontSize: 9,
                      letterSpacing: '.12em',
                      textTransform: 'uppercase',
                      color: 'var(--m-sage-deep)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 'var(--m-r-full)',
                        background: 'var(--m-sage-deep)',
                        display: 'inline-block',
                      }}
                    />
                    On track
                  </span>
                </div>
                <div
                  className="m-serif italic"
                  style={{ fontSize: 26, lineHeight: 1.1, marginTop: 10, color: 'var(--m-ink)' }}
                >
                  Your wedding, all in one place.
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  {DASH_STATS.map((s) => (
                    <div
                      key={s.k}
                      style={{
                        background: 'var(--m-paper-2)',
                        border: '1px solid var(--m-line)',
                        borderRadius: 'var(--m-r-md)',
                        padding: '11px 10px',
                      }}
                    >
                      <div
                        className="m-display"
                        style={{
                          fontSize: 22,
                          color: 'var(--m-ink)',
                          fontVariantNumeric: 'tabular-nums',
                          paddingBottom: 0,
                        }}
                      >
                        {s.v}
                      </div>
                      <div
                        className="m-mono"
                        style={{
                          fontSize: 9,
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          color: 'var(--m-slate-2)',
                          marginTop: 2,
                        }}
                      >
                        {s.k}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Budget progress — a small "it's handled" proof */}
                <div className="mt-3">
                  <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                    <span
                      className="m-mono"
                      style={{
                        fontSize: 9,
                        letterSpacing: '.1em',
                        textTransform: 'uppercase',
                        color: 'var(--m-slate-2)',
                      }}
                    >
                      Budget
                    </span>
                    <span
                      className="m-mono"
                      style={{ fontSize: 9, color: 'var(--m-slate-2)' }}
                    >
                      62% planned
                    </span>
                  </div>
                  <div
                    style={{
                      height: 7,
                      borderRadius: 'var(--m-r-full)',
                      background: 'var(--m-ivory)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: '62%',
                        height: '100%',
                        borderRadius: 'var(--m-r-full)',
                        background: 'var(--m-orange)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* ── NEW BEAT: Papic — guests become the crew ──────────────────────
            Sits in the dark section so the contrast reads: chaos → still dark
            but now purposeful → light (planning). Sets up the UPS before the
            "free planning tools" section that follows. */}
        <div className="relative mx-auto max-w-[1100px] px-5 pt-2 pb-16 sm:px-8 lg:px-14">
          <Reveal>
            <div
              className="m-mono text-center"
              style={{ fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--m-orange-3)' }}
            >
              Papic
            </div>
            <h2
              className="m-serif italic mx-auto mt-5 text-center"
              style={{ color: '#FBFBFA', fontSize: 'clamp(1.9rem, 5.2vw, 3.2rem)', lineHeight: 1.1, maxWidth: 780 }}
            >
              Your guests don&rsquo;t hire a photographer.{' '}
              <span style={{ color: 'var(--m-orange-3)' }}>They become one.</span>
            </h2>
            <p
              className="mx-auto mt-5 text-center"
              style={{ color: 'rgba(251,251,250,.62)', fontSize: 'clamp(1rem, 2.5vw, 1.15rem)', lineHeight: 1.6, maxWidth: 600 }}
            >
              Papic turns your most enthusiastic cousins, friends, and ninongs into your photo crew.
              They shoot freely from designated seats — every guest&rsquo;s photo auto-tagged via QR scan.
              Everyone leaves with their own gallery and a personalised souvenir reel.
              No production hire. No waiting weeks for a USB drive.
            </p>
          </Reveal>
        </div>

        {/* Dark → light transition: the relief, made literal. */}
        <div
          aria-hidden
          style={{
            height: 120,
            background: 'linear-gradient(to bottom, #0e0f12 0%, var(--m-paper) 100%)',
          }}
        />
      </div>

      {/* ───────────────────────────────────────────────────────────────
          BEAT 1 — the reframe (light)
          ─────────────────────────────────────────────────────────────── */}
      <div className="bg-[var(--m-paper)]">
        <div className="mx-auto max-w-[1100px] px-5 pt-6 pb-10 text-center sm:px-8 lg:px-14">
          <Reveal>
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
              Most apps hand you a list of vendors and leave. Setnayan is where you actually build
              and run the whole wedding — every part of it, free from the first day.
            </p>
          </Reveal>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            BEAT 2 — a place for each (rich, mocked cards)
            ───────────────────────────────────────────────────────────── */}
        <div className="mx-auto max-w-[1100px] px-5 pb-12 sm:px-8 lg:px-14">
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
            className="grid gap-3.5 sm:gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
          >
            {ROOMS.map((r, i) => (
              <Reveal key={r.name} delay={i * 60}>
                <div
                  className="m-card m-card-lift h-full overflow-hidden"
                  style={{ display: 'flex', flexDirection: 'column' }}
                >
                  {/* product mock — the "feel the tool" visual */}
                  <div
                    style={{
                      background: 'var(--m-paper-2)',
                      borderBottom: '1px solid var(--m-line)',
                      padding: '16px 18px',
                    }}
                  >
                    <RoomMock kind={r.mock} />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="font-medium text-[var(--m-ink)]"
                        style={{ fontSize: 16 }}
                      >
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
                          borderRadius: 'var(--m-r-full)',
                          padding: '3px 8px',
                        }}
                      >
                        Free
                      </span>
                    </div>
                    <p
                      className="mt-2 text-[var(--m-slate)]"
                      style={{ fontSize: 14, lineHeight: 1.5 }}
                    >
                      {r.line}
                    </p>
                    <p
                      className="m-mono mt-3 pt-3"
                      style={{
                        fontSize: 11,
                        lineHeight: 1.5,
                        letterSpacing: '.02em',
                        color: 'var(--m-orange-2)',
                        borderTop: '1px solid var(--m-line-soft)',
                      }}
                    >
                      {r.ends}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <p
            className="m-serif italic mx-auto mt-8 text-center text-[var(--m-slate)]"
            style={{ fontSize: 'clamp(1.05rem, 2.8vw, 1.35rem)', maxWidth: 560 }}
          >
            Every part of your wedding has a place. You don&rsquo;t pay to start — you just move in.
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            BEAT 3 — find your people (free marketplace)
            ───────────────────────────────────────────────────────────── */}
        <div className="mx-auto max-w-[820px] px-5 py-12 text-center sm:px-8 lg:px-14">
          <Reveal>
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
          </Reveal>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            BEAT 4 — close + CTA (echoes the hero end-card)
            ───────────────────────────────────────────────────────────── */}
        <div className="px-5 pt-12 pb-24 text-center sm:px-8 lg:px-14">
          <Reveal>
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
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Beat 0 data — the chaos you live in now vs the calm dashboard.
// ─────────────────────────────────────────────────────────────────────
const CHAOS: Array<{ tag: string; body: string }> = [
  { tag: 'Viber · 11pm', body: '“sino mag-pa-print ng QR?”' },
  { tag: 'Budget.xlsx — v8', body: '₱2M, mostly guessed' },
  { tag: 'Drive · vendor PDFs', body: '14 PDFs, 6 versions' },
  { tag: 'GCash · receipts', body: 'screenshots, somewhere' },
  { tag: 'Pinterest · mood', body: '3 boards, conflicting' },
];
const CHAOS_TILT = [-1.6, 1.2, -0.8, 1.8, -1.2];
const DASH_STATS: Array<{ v: string; k: string }> = [
  { v: '166', k: 'RSVPs' },
  { v: '9', k: 'Vendors' },
  { v: '12', k: 'Tables' },
];


// ─────────────────────────────────────────────────────────────────────
// RoomMock — tiny, theme-tokened product visuals so each free tool reads
// as a real surface, not a labelled box. Pure inline SVG/CSS, no deps.
// ─────────────────────────────────────────────────────────────────────
type RoomMockKind = 'guests' | 'seats' | 'budget' | 'timeline' | 'mood' | 'website';

function RoomMock({ kind }: { kind: RoomMockKind }) {
  const H = 60;
  if (kind === 'guests') {
    // A row of RSVP avatars, the lead one with a confirmed check.
    return (
      <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
        {[16, 46, 76, 106, 136].map((cx, i) => (
          <circle
            key={cx}
            cx={cx}
            cy={26}
            r={13}
            fill={i < 3 ? 'var(--m-orange-4)' : 'var(--m-paper)'}
            stroke={i < 3 ? 'var(--m-orange)' : 'var(--m-line)'}
            strokeWidth={1.5}
          />
        ))}
        <circle cx={26} cy={36} r={8} fill="var(--m-sage-deep)" />
        <path
          d="M22 36 l3 3 l6 -6"
          fill="none"
          stroke="#fff"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x={160} y={18} width={48} height={7} rx={3.5} fill="var(--m-line)" />
        <rect x={160} y={31} width={32} height={7} rx={3.5} fill="var(--m-orange-3)" />
      </svg>
    );
  }
  if (kind === 'seats') {
    // A loose floor plan: round tables + a sweetheart table.
    return (
      <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
        <rect x={88} y={6} width={44} height={12} rx={6} fill="var(--m-mulberry-4)" stroke="var(--m-mulberry-3)" strokeWidth={1} />
        {[
          [34, 40],
          [80, 44],
          [128, 42],
          [176, 40],
          [186, 16],
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={11}
            fill="var(--m-paper)"
            stroke="var(--m-orange)"
            strokeWidth={1.5}
          />
        ))}
        <circle cx={34} cy={40} r={4} fill="var(--m-orange)" />
      </svg>
    );
  }
  if (kind === 'budget') {
    // Three category bars filling up — "it's handled".
    return (
      <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
        {[
          [10, 150, 'var(--m-orange)'],
          [26, 110, 'var(--m-mulberry)'],
          [42, 180, 'var(--m-sage-deep)'],
        ].map(([y, w, c], i) => (
          <g key={i}>
            <rect x={8} y={y as number} width={196} height={8} rx={4} fill="var(--m-ivory)" />
            <rect x={8} y={y as number} width={w as number} height={8} rx={4} fill={c as string} />
          </g>
        ))}
      </svg>
    );
  }
  if (kind === 'timeline') {
    // A run-of-show line with milestone dots, "today" lit gold.
    return (
      <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
        <line x1={14} y1={30} x2={206} y2={30} stroke="var(--m-line)" strokeWidth={2} />
        {[14, 62, 110, 158, 206].map((cx, i) => (
          <circle
            key={cx}
            cx={cx}
            cy={30}
            r={i === 2 ? 8 : 5}
            fill={i <= 2 ? 'var(--m-orange)' : 'var(--m-paper)'}
            stroke={i <= 2 ? 'var(--m-orange)' : 'var(--m-line)'}
            strokeWidth={1.5}
          />
        ))}
        <rect x={92} y={44} width={36} height={6} rx={3} fill="var(--m-orange-3)" />
      </svg>
    );
  }
  if (kind === 'mood') {
    // The palette — five swatches.
    return (
      <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
        {[
          'var(--m-mulberry)',
          'var(--m-orange)',
          'var(--m-sage)',
          'var(--m-ink)',
          'var(--m-orange-4)',
        ].map((c, i) => (
          <rect
            key={i}
            x={10 + i * 41}
            y={12}
            width={36}
            height={36}
            rx={8}
            fill={c}
            stroke="var(--m-line)"
            strokeWidth={i === 4 ? 1 : 0}
          />
        ))}
      </svg>
    );
  }
  // website — a tiny browser frame with a QR invite.
  return (
    <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
      <rect x={8} y={6} width={150} height={48} rx={7} fill="var(--m-paper)" stroke="var(--m-line)" strokeWidth={1.5} />
      <line x1={8} y1={19} x2={158} y2={19} stroke="var(--m-line)" strokeWidth={1} />
      {[15, 23, 31].map((cx) => (
        <circle key={cx} cx={cx} cy={12.5} r={2} fill="var(--m-line)" />
      ))}
      <rect x={18} y={28} width={70} height={7} rx={3.5} fill="var(--m-orange-3)" />
      <rect x={18} y={40} width={48} height={6} rx={3} fill="var(--m-line)" />
      {/* QR */}
      <rect x={170} y={14} width={40} height={40} rx={6} fill="var(--m-ink)" />
      {[
        [176, 20],
        [196, 20],
        [176, 40],
        [190, 34],
        [200, 44],
        [196, 28],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={6} height={6} rx={1} fill="var(--m-orange-3)" />
      ))}
    </svg>
  );
}

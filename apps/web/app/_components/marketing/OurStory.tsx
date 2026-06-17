import Link from 'next/link';
import { Reveal, Blob } from './_motion';
import { AlaalaOrbGL } from './AlaalaOrbGL';

/**
 * OurStory — the "Living Memories" brand manifesto.
 *
 * Owner 2026-06-14 ("I want to share this idea with the world … embrace this
 * new concept of memories"). The umbrella idea over Papic / Panood / Kwento /
 * Editorial: memory-keeping evolved — paper albums → digital albums → LIVING
 * memories. A wedding was never meant to be frozen; technology can finally hold
 * what it actually was, so Setnayan keeps it alive.
 *
 * Two exports:
 *   - OurStoryManifesto()  — the full /our-story page body (cinematic: dark
 *     evolution open → the manifesto → the four features as proof (capture→keep)
 *     → keepsake close + CTA).
 *   - OurStoryTeaser()     — a compact dark band for the homepage that routes
 *     into the full story.
 *
 * Sells FEELING, not implementation — moments / people / stories / forever
 * ([[feedback_setnayan_public_surface_hygiene]]). Reuses the repo's zero-dep
 * Reveal/Blob primitives + the --m-* Clean Editorial tokens; the dark canvas is
 * the same #0e0f12 as the homepage hero, so the brand reads as one film.
 */

// The evolution — three eras, the present lit gold.
const ERAS: Array<{ tag: string; name: string; line: string; now?: boolean }> = [
  { tag: 'Then', name: 'Paper albums', line: 'Pages on a shelf, slowly turning yellow.' },
  { tag: 'Lately', name: 'Digital albums', line: 'The same still frames — just glowing now.' },
  {
    tag: 'Now',
    name: 'Living memories',
    line: 'The day kept the way it actually happened — alive.',
    now: true,
  },
];

// Capture → keep. The four features, each as a FEELING (the name is the quiet
// subtitle, not the headline).
const KEPT: Array<{ mock: FeatureMockKind; eyebrow: string; title: string; line: string; via: string }> = [
  {
    mock: 'moments',
    eyebrow: 'The moments',
    title: 'What you were too busy to see.',
    line: 'The reactions, the laughter, the small candids — caught by the people right beside you, not just the one camera up front.',
    via: 'Papic',
  },
  {
    mock: 'people',
    eyebrow: 'The people',
    title: 'Everyone you wished could be there.',
    line: 'The lola who couldn’t travel. The cousin overseas. Brought into the room — to see your day as if they were standing in it.',
    via: 'Panood',
  },
  {
    mock: 'stories',
    eyebrow: 'The stories',
    title: 'The night, told back to you.',
    line: 'The little moments you never saw — your guests leave them for you, in their own words, beside the photo it happened in.',
    via: 'Kwento',
  },
  {
    mock: 'keepsake',
    eyebrow: 'Kept forever',
    title: 'One living page. Your front-page story.',
    line: 'All of it gathered into a page that moves and grows — yours to keep. And when you want to hold it, we print it, with a code that brings you back to the living version.',
    via: 'Editorial',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FULL PAGE BODY
// ─────────────────────────────────────────────────────────────────────────────
export function OurStoryManifesto() {
  return (
    <section className="text-[var(--m-ink)]">
      {/* ───────────────────────────────────────────────────────────────
          ACT 1 — DARK OPEN. The evolution: paper → digital → living.
          ─────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ background: '#0e0f12' }}>
        <Blob top={-80} left={-60} size={560} color="var(--m-orange)" opacity={0.12} />
        <Blob bottom={-140} right={-90} size={600} color="var(--m-mulberry)" opacity={0.18} />

        <div className="relative mx-auto max-w-[1100px] px-5 pt-16 pb-12 sm:px-8 sm:pt-20 lg:px-14">
          {/* ── ACT 1 HERO: Orb + Alaala proposition ── */}
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16 lg:pb-4">
            {/* Orb — responsive size; cold-start renders CSS gradient skin */}
            <div className="flex flex-shrink-0 justify-center">
              <AlaalaOrbGL className="h-[260px] w-[260px] sm:h-[310px] sm:w-[310px] lg:h-[370px] lg:w-[370px]" />
            </div>

            {/* Text — "Alaala / living memory / proposition" */}
            <Reveal>
              <div
                className="m-mono text-center lg:text-left"
                style={{ fontSize: 11, letterSpacing: '.26em', textTransform: 'uppercase', color: 'var(--m-orange-3)' }}
              >
                Our story
              </div>
              <h1
                className="m-serif italic mt-3 text-center lg:text-left"
                style={{ color: '#FBFBFA', fontSize: 'clamp(3rem, 8vw, 5.5rem)', lineHeight: 1.0, letterSpacing: '-0.01em' }}
              >
                Alaala.
              </h1>
              <p
                className="m-mono mt-1 text-center lg:text-left"
                style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(251,251,250,0.36)' }}
              >
                living memory
              </p>
              <p
                className="m-serif italic mt-6 text-center lg:text-left"
                style={{ color: '#FBFBFA', fontSize: 'clamp(1.15rem, 3vw, 1.6rem)', lineHeight: 1.24 }}
              >
                Everyone gives you a record.
                <br />
                We give you an{' '}
                <span style={{ color: 'var(--m-orange-3)' }}>Alaala.</span>
              </p>
              <p
                className="mt-4 text-center lg:text-left"
                style={{ color: 'rgba(251,251,250,.5)', fontSize: 'clamp(0.9rem, 2.1vw, 1rem)', lineHeight: 1.68, maxWidth: 440 }}
              >
                Every guest goes home with a personal highlight reel — the moments, the
                people, the stories. Yours to keep, forever.
              </p>
            </Reveal>
          </div>

          {/* ── Bridge: "never still" → three-era evolution ── */}
          <Reveal>
            <div className="mt-16 text-center">
              <h2
                className="m-serif italic mx-auto"
                style={{ color: '#FBFBFA', fontSize: 'clamp(1.65rem, 4.4vw, 2.7rem)', lineHeight: 1.1 }}
              >
                Your wedding was{' '}
                <span style={{ color: 'var(--m-orange-3)' }}>never still.</span>
              </h2>
              <p
                className="mx-auto mt-4"
                style={{ color: 'rgba(251,251,250,.6)', fontSize: 'clamp(0.9rem, 2.2vw, 1.05rem)', lineHeight: 1.65, maxWidth: 540 }}
              >
                We have always kept the people we love in albums. First on paper. Then on screens —
                the same still frames, just glowing now.
              </p>
            </div>
          </Reveal>

          {/* The three eras */}
          <div className="mt-10 grid gap-4 sm:gap-5 lg:grid-cols-3">
            {ERAS.map((e, i) => (
              <Reveal key={e.name} delay={i * 110}>
                <div
                  className="h-full"
                  style={{
                    background: e.now ? 'rgba(197,160,89,.08)' : 'rgba(255,255,255,.03)',
                    border: e.now ? '1px solid rgba(197,160,89,.45)' : '1px solid rgba(255,255,255,.08)',
                    borderRadius: 16,
                    padding: '22px 22px 24px',
                    boxShadow: e.now ? '0 0 60px rgba(197,160,89,.16)' : 'none',
                  }}
                >
                  <div
                    className="m-mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: '.18em',
                      textTransform: 'uppercase',
                      color: e.now ? 'var(--m-orange-3)' : 'rgba(251,251,250,.4)',
                    }}
                  >
                    {e.tag}
                  </div>
                  <div
                    className="m-serif italic"
                    style={{ fontSize: 26, lineHeight: 1.1, marginTop: 10, color: e.now ? '#FBFBFA' : 'rgba(251,251,250,.82)' }}
                  >
                    {e.name}
                  </div>
                  <p
                    style={{
                      fontSize: 14,
                      lineHeight: 1.55,
                      marginTop: 8,
                      color: e.now ? 'rgba(251,251,250,.72)' : 'rgba(251,251,250,.5)',
                    }}
                  >
                    {e.line}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Dark → light: the still photo comes alive. */}
        <div
          aria-hidden
          style={{ height: 120, background: 'linear-gradient(to bottom, #0e0f12 0%, var(--m-paper) 100%)' }}
        />
      </div>

      {/* ───────────────────────────────────────────────────────────────
          ACT 2 — THE MANIFESTO (light). The emotional core.
          ─────────────────────────────────────────────────────────────── */}
      <div className="bg-[var(--m-paper)]">
        <div className="mx-auto max-w-[760px] px-5 pt-4 pb-16 text-center sm:px-8">
          <Reveal>
            <p
              className="m-serif italic"
              style={{ fontSize: 'clamp(1.5rem, 4.2vw, 2.4rem)', lineHeight: 1.3, color: 'var(--m-ink)' }}
            >
              But a wedding was never a still photo.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <p className="mt-8 text-[var(--m-slate)]" style={{ fontSize: 'clamp(1.05rem, 2.6vw, 1.2rem)', lineHeight: 1.7 }}>
              It was your lola laughing in the third row. The friend who cried during your vows. The
              cousin overseas who stayed up until 3&nbsp;a.m. just to watch you say{' '}
              <span className="m-serif italic text-[var(--m-ink)]">“I do.”</span> The joke you missed —
              because you were busy getting married. The story your guests are{' '}
              <span className="m-serif italic text-[var(--m-ink)]">still</span> telling each other, one
              you’ve never even heard.
            </p>
          </Reveal>

          <Reveal delay={140}>
            <p
              className="m-serif italic mx-auto mt-10"
              style={{ fontSize: 'clamp(1.4rem, 3.6vw, 2rem)', lineHeight: 1.3, maxWidth: 560 }}
            >
              A photograph can’t hold that. An album can’t move.{' '}
              <span style={{ color: 'var(--m-mulberry)' }}>Until now.</span>
            </p>
          </Reveal>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            ACT 3 — HOW WE KEEP IT ALIVE (capture → keep). The four.
            ───────────────────────────────────────────────────────────── */}
        <div className="mx-auto max-w-[1100px] px-5 pb-8 sm:px-8 lg:px-14">
          <Reveal>
            <div className="text-center">
              <div
                className="m-mono"
                style={{ fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--m-orange-2)' }}
              >
                How we keep it alive
              </div>
              <h2
                className="m-serif italic mx-auto mt-5"
                style={{ fontSize: 'clamp(2rem, 5.4vw, 3.2rem)', lineHeight: 1.1, maxWidth: 760 }}
              >
                We catch what the day would have lost — and keep it.
              </h2>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:gap-5 lg:grid-cols-2">
            {KEPT.map((k, i) => (
              <Reveal key={k.via} delay={i * 70}>
                <div className="m-card h-full overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ background: 'var(--m-paper-2)', borderBottom: '1px solid var(--m-line)', padding: '18px 20px' }}>
                    <FeatureMock kind={k.mock} />
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div
                      className="m-mono"
                      style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--m-orange-2)' }}
                    >
                      {k.eyebrow}
                    </div>
                    <div className="m-serif italic" style={{ fontSize: 24, lineHeight: 1.16, marginTop: 8, color: 'var(--m-ink)' }}>
                      {k.title}
                    </div>
                    <p className="mt-3 text-[var(--m-slate)]" style={{ fontSize: 14.5, lineHeight: 1.6 }}>
                      {k.line}
                    </p>
                    <div
                      className="m-mono mt-4 pt-3"
                      style={{
                        fontSize: 10,
                        letterSpacing: '.14em',
                        textTransform: 'uppercase',
                        color: 'var(--m-slate-2)',
                        borderTop: '1px solid var(--m-line-soft)',
                      }}
                    >
                      We call it {k.via}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            ACT 4 — CLOSE (dark echo) + CTA.
            ───────────────────────────────────────────────────────────── */}
        <div className="relative mt-12 overflow-hidden" style={{ background: '#0e0f12' }}>
          <div aria-hidden style={{ height: 80, background: 'linear-gradient(to bottom, var(--m-paper) 0%, #0e0f12 100%)' }} />
          <Blob bottom={-160} left={-80} size={620} color="var(--m-mulberry)" opacity={0.2} />
          <Blob top={-60} right={-70} size={520} color="var(--m-orange)" opacity={0.12} />
          <div className="relative mx-auto max-w-[820px] px-5 pb-24 pt-6 text-center sm:px-8">
            <Reveal>
              <div
                className="m-mono"
                style={{ fontSize: 11, letterSpacing: '.26em', textTransform: 'uppercase', color: 'var(--m-orange-3)', marginBottom: 18 }}
              >
                Set na ’yan
              </div>
              <h2
                className="m-serif italic mx-auto"
                style={{ color: '#FBFBFA', fontSize: 'clamp(2.1rem, 5.8vw, 3.6rem)', lineHeight: 1.06, maxWidth: 680 }}
              >
                This isn’t a better album. It’s{' '}
                <span style={{ color: 'var(--m-orange-3)' }}>a new kind of memory.</span>
              </h2>
              <p
                className="mx-auto mt-6"
                style={{ color: 'rgba(251,251,250,.62)', fontSize: 'clamp(1rem, 2.5vw, 1.15rem)', lineHeight: 1.6, maxWidth: 520 }}
              >
                The way we remember has been waiting for the technology to catch up. It just did.
              </p>
              <p
                className="m-serif italic mx-auto mt-6"
                style={{ color: 'var(--m-orange-3)', fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', lineHeight: 1.3, maxWidth: 540 }}
              >
                We call it Alaala — the memory you keep.
              </p>
              <div className="mt-9">
                <Link href="/onboarding/wedding" className="m-btn m-btn-primary m-btn-lg">
                  Start your wedding <span style={{ color: 'var(--m-orange-3)' }}>· free</span>
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOMEPAGE TEASER — a compact dark band that routes into the full story.
// ─────────────────────────────────────────────────────────────────────────────
export function OurStoryTeaser() {
  return (
    <section className="relative overflow-hidden" style={{ background: '#0e0f12' }}>
      <Blob top={-70} left={-50} size={520} color="var(--m-orange)" opacity={0.1} />
      <Blob bottom={-130} right={-70} size={540} color="var(--m-mulberry)" opacity={0.16} />

      <div className="relative mx-auto max-w-[820px] px-5 pt-20 pb-16 text-center sm:px-8">
        <Reveal>
          <div
            className="m-mono"
            style={{ fontSize: 11, letterSpacing: '.26em', textTransform: 'uppercase', color: 'var(--m-orange-3)' }}
          >
            A new way to remember
          </div>
          <h2
            className="m-serif italic mx-auto mt-5"
            style={{ color: '#FBFBFA', fontSize: 'clamp(2rem, 5.6vw, 3.4rem)', lineHeight: 1.08, maxWidth: 680 }}
          >
            Your wedding was <span style={{ color: 'var(--m-orange-3)' }}>never still.</span>
          </h2>
          <p
            className="mx-auto mt-5"
            style={{ color: 'rgba(251,251,250,.64)', fontSize: 'clamp(1rem, 2.5vw, 1.15rem)', lineHeight: 1.6, maxWidth: 520 }}
          >
            We used to keep weddings in albums. Setnayan keeps them alive — the moments you missed, the
            people who couldn’t come, the stories your guests tell.
          </p>

          {/* paper → digital → living */}
          <div
            className="m-mono mt-7 inline-flex flex-wrap items-center justify-center gap-2.5"
            style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase' }}
          >
            <span style={{ color: 'rgba(251,251,250,.42)' }}>Paper</span>
            <span style={{ color: 'rgba(251,251,250,.28)' }}>→</span>
            <span style={{ color: 'rgba(251,251,250,.42)' }}>Digital</span>
            <span style={{ color: 'rgba(251,251,250,.28)' }}>→</span>
            <span style={{ color: 'var(--m-orange-3)' }}>Living</span>
          </div>

          <div className="mt-8">
            <Link
              href="/our-story"
              className="m-mono inline-flex items-center gap-2"
              style={{
                fontSize: 12,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: '#FBFBFA',
                borderBottom: '1px solid var(--m-orange-3)',
                paddingBottom: 4,
              }}
            >
              Read our story <span style={{ color: 'var(--m-orange-3)' }}>→</span>
            </Link>
          </div>
        </Reveal>
      </div>

      {/* melt into the light footer below */}
      <div aria-hidden style={{ height: 110, background: 'linear-gradient(to bottom, #0e0f12 0%, var(--m-paper) 100%)' }} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FeatureMock — tiny, theme-tokened visuals so each idea reads as something
// real, not a labelled box. Pure inline SVG, no deps. Mirrors WhatYouGet's
// RoomMock conventions (220×60 viewBox on --m-paper-2).
// ─────────────────────────────────────────────────────────────────────────────
type FeatureMockKind = 'moments' | 'people' | 'stories' | 'keepsake';

function FeatureMock({ kind }: { kind: FeatureMockKind }) {
  const H = 60;
  if (kind === 'moments') {
    // A film frame coming alive — play triangle + a live dot + motion ticks.
    return (
      <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
        <rect x={8} y={10} width={120} height={40} rx={8} fill="var(--m-paper)" stroke="var(--m-orange)" strokeWidth={1.5} />
        <path d="M56 22 L74 30 L56 38 Z" fill="var(--m-orange)" />
        <circle cx={20} cy={20} r={3} fill="var(--m-mulberry)" />
        {[150, 168, 186, 204].map((x, i) => (
          <rect key={x} x={x} y={30 - (i % 2 === 0 ? 12 : 7)} width={9} height={i % 2 === 0 ? 24 : 14} rx={3} fill={i < 2 ? 'var(--m-orange-3)' : 'var(--m-line)'} />
        ))}
      </svg>
    );
  }
  if (kind === 'people') {
    // A phone bringing a far-away face into the room — signal arcs.
    return (
      <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
        <rect x={90} y={6} width={40} height={48} rx={7} fill="var(--m-paper)" stroke="var(--m-mulberry-3)" strokeWidth={1.5} />
        <circle cx={110} cy={26} r={9} fill="var(--m-orange-4)" stroke="var(--m-orange)" strokeWidth={1.2} />
        <rect x={100} y={40} width={20} height={6} rx={3} fill="var(--m-orange-3)" />
        {[18, 30, 42].map((r, i) => (
          <path key={`l${r}`} d={`M ${74 - i * 10} ${30 - r / 2} A ${r} ${r} 0 0 0 ${74 - i * 10} ${30 + r / 2}`} fill="none" stroke="var(--m-orange)" strokeWidth={1.5} opacity={0.8 - i * 0.2} />
        ))}
        {[18, 30, 42].map((r, i) => (
          <path key={`r${r}`} d={`M ${146 + i * 10} ${30 - r / 2} A ${r} ${r} 0 0 1 ${146 + i * 10} ${30 + r / 2}`} fill="none" stroke="var(--m-orange)" strokeWidth={1.5} opacity={0.8 - i * 0.2} />
        ))}
      </svg>
    );
  }
  if (kind === 'stories') {
    // A guest's words — a speech bubble with lines + a quote mark.
    return (
      <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
        <rect x={20} y={8} width={180} height={36} rx={10} fill="var(--m-paper)" stroke="var(--m-line)" strokeWidth={1.5} />
        <path d="M40 44 L40 52 L52 44 Z" fill="var(--m-paper)" stroke="var(--m-line)" strokeWidth={1.5} />
        <text x={32} y={32} fontFamily="Georgia, serif" fontSize={26} fill="var(--m-orange)">“</text>
        <rect x={56} y={16} width={128} height={6} rx={3} fill="var(--m-orange-3)" />
        <rect x={56} y={28} width={96} height={6} rx={3} fill="var(--m-line)" />
      </svg>
    );
  }
  // keepsake — a moving newspaper page with a small QR back to the living story.
  return (
    <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
      <rect x={26} y={6} width={120} height={48} rx={6} fill="var(--m-paper)" stroke="var(--m-line)" strokeWidth={1.5} />
      <rect x={36} y={13} width={100} height={9} rx={2} fill="var(--m-ink)" />
      <rect x={36} y={28} width={46} height={5} rx={2.5} fill="var(--m-line)" />
      <rect x={36} y={37} width={46} height={5} rx={2.5} fill="var(--m-line)" />
      <rect x={36} y={46} width={30} height={5} rx={2.5} fill="var(--m-orange-3)" />
      <rect x={92} y={28} width={44} height={24} rx={3} fill="var(--m-orange-4)" stroke="var(--m-orange-3)" strokeWidth={1} />
      <path d="M104 40 L110 46 L122 34" fill="none" stroke="var(--m-orange-2)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      {/* QR */}
      <rect x={160} y={14} width={40} height={40} rx={5} fill="var(--m-ink)" />
      {[
        [166, 20],
        [186, 20],
        [166, 40],
        [180, 34],
        [192, 44],
        [186, 28],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={6} height={6} rx={1} fill="var(--m-orange-3)" />
      ))}
    </svg>
  );
}

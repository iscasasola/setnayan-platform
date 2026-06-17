import Link from 'next/link';
import { Reveal, Blob } from './_motion';
import { HeroHandsComposite } from './HeroHandsComposite';

/**
 * OurStory — the "Living Memories" brand manifesto.
 *
 * Five acts:
 *  ACT 1 — Dark open. Alaala visual + three-era evolution.
 *  ACT 2 — The manifesto (light). Emotional core.
 *  ACT 3 — How we keep it alive. Four features as proof.
 *  ACT 3.5 — Personal Reel. Every guest gets their own story.
 *  ACT 4 — Dark close + CTA.
 */

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
    line: `The lola who couldn't travel. The cousin overseas. Brought into the room — to see your day as if they were standing in it.`,
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

const REEL_STATS = [
  { value: '1–30s', label: 'You choose the length' },
  { value: 'Same night', label: 'Delivered at the reception' },
  { value: 'Your music', label: 'Every single reel' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FULL PAGE BODY
// ─────────────────────────────────────────────────────────────────────────────
export function OurStoryManifesto() {
  return (
    <section className="text-[var(--m-ink)]">

      {/* ── ACT 1 — DARK OPEN ── */}
      <div className="relative overflow-hidden" style={{ background: '#0e0f12' }}>
        <Blob top={-80} left={-60} size={560} color="var(--m-orange)" opacity={0.12} />
        <Blob bottom={-140} right={-90} size={600} color="var(--m-mulberry)" opacity={0.18} />

        <div className="relative mx-auto max-w-[1100px] px-5 pt-16 pb-12 sm:px-8 sm:pt-20 lg:px-14">
          {/* Hero: orb + proposition */}
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16 lg:pb-4">
            <div className="flex flex-shrink-0 justify-center">
              <HeroHandsComposite className="w-[260px] sm:w-[310px] lg:w-[370px]" />
            </div>

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

          {/* Three-era evolution */}
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
                    style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: e.now ? 'var(--m-orange-3)' : 'rgba(251,251,250,.4)' }}
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
                    style={{ fontSize: 14, lineHeight: 1.55, marginTop: 8, color: e.now ? 'rgba(251,251,250,.72)' : 'rgba(251,251,250,.5)' }}
                  >
                    {e.line}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <div aria-hidden style={{ height: 120, background: 'linear-gradient(to bottom, #0e0f12 0%, var(--m-paper) 100%)' }} />
      </div>

      {/* ── ACT 2 — THE MANIFESTO ── */}
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
              <span className="m-serif italic text-[var(--m-ink)]">"I do."</span> The joke you missed —
              because you were busy getting married. The story your guests are{' '}
              <span className="m-serif italic text-[var(--m-ink)]">still</span> telling each other, one
              you've never even heard.
            </p>
          </Reveal>

          <Reveal delay={140}>
            <p
              className="m-serif italic mx-auto mt-10"
              style={{ fontSize: 'clamp(1.4rem, 3.6vw, 2rem)', lineHeight: 1.3, maxWidth: 560 }}
            >
              A photograph can't hold that. An album can't move.{' '}
              <span style={{ color: 'var(--m-mulberry)' }}>Until now.</span>
            </p>
          </Reveal>
        </div>

        {/* ── ACT 3 — FOUR FEATURES ── */}
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
                  <div style={{ background: 'var(--m-paper-2)', borderBottom: '1px solid var(--m-line)', padding: '20px 20px 16px' }}>
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
                      style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--m-slate-2)', borderTop: '1px solid var(--m-line-soft)' }}
                    >
                      We call it {k.via}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* ── ACT 3.5 — PERSONAL REEL ── */}
        <div className="relative overflow-hidden" style={{ background: 'var(--m-paper)', marginTop: 32 }}>
          {/* Soft divider */}
          <div aria-hidden style={{ height: 1, background: 'linear-gradient(to right, transparent, var(--m-line), transparent)', maxWidth: 640, margin: '0 auto 64px' }} />

          <div className="mx-auto max-w-[1100px] px-5 pb-24 sm:px-8 lg:px-14">
            <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-center lg:gap-20">

              {/* Reel phone mock */}
              <div className="flex flex-shrink-0 justify-center">
                <ReelPhoneMock />
              </div>

              {/* Copy */}
              <Reveal>
                <div
                  className="m-mono"
                  style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--m-orange-2)', marginBottom: 14 }}
                >
                  Before the night ends
                </div>
                <h2
                  className="m-serif italic"
                  style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.1, color: 'var(--m-ink)' }}
                >
                  Every guest leaves with{' '}
                  <span style={{ color: 'var(--m-mulberry)' }}>their story.</span>
                </h2>
                <p
                  className="mt-5 text-[var(--m-slate)]"
                  style={{ fontSize: 'clamp(1rem, 2.4vw, 1.1rem)', lineHeight: 1.65, maxWidth: 480 }}
                >
                  Each guest picks their five favourite moments — the ones where they laughed
                  the hardest, cried the longest, danced the most. We turn them into a
                  30-second personal reel, set to your wedding's own music. Ready the same night.
                </p>

                {/* Stats */}
                <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
                  {REEL_STATS.map((s) => (
                    <div key={s.value}>
                      <div
                        className="m-serif italic"
                        style={{ fontSize: 28, lineHeight: 1, color: 'var(--m-ink)' }}
                      >
                        {s.value}
                      </div>
                      <div
                        className="m-mono mt-1"
                        style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--m-slate-2)' }}
                      >
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>

        {/* ── ACT 4 — DARK CLOSE + CTA ── */}
        <div className="relative overflow-hidden" style={{ background: '#0e0f12' }}>
          <div aria-hidden style={{ height: 80, background: 'linear-gradient(to bottom, var(--m-paper) 0%, #0e0f12 100%)' }} />
          <Blob bottom={-160} left={-80} size={620} color="var(--m-mulberry)" opacity={0.2} />
          <Blob top={-60} right={-70} size={520} color="var(--m-orange)" opacity={0.12} />
          <div className="relative mx-auto max-w-[820px] px-5 pb-24 pt-6 text-center sm:px-8">
            <Reveal>
              <div
                className="m-mono"
                style={{ fontSize: 11, letterSpacing: '.26em', textTransform: 'uppercase', color: 'var(--m-orange-3)', marginBottom: 18 }}
              >
                Set na 'yan
              </div>
              <h2
                className="m-serif italic mx-auto"
                style={{ color: '#FBFBFA', fontSize: 'clamp(2.1rem, 5.8vw, 3.6rem)', lineHeight: 1.06, maxWidth: 680 }}
              >
                This isn't a better album. It's{' '}
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
// HOMEPAGE TEASER
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
            people who couldn't come, the stories your guests tell.
          </p>

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
              style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: '#FBFBFA', borderBottom: '1px solid var(--m-orange-3)', paddingBottom: 4 }}
            >
              Read our story <span style={{ color: 'var(--m-orange-3)' }}>→</span>
            </Link>
          </div>
        </Reveal>
      </div>

      <div aria-hidden style={{ height: 110, background: 'linear-gradient(to bottom, #0e0f12 0%, var(--m-paper) 100%)' }} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReelPhoneMock — vertical phone showing the personal reel builder UI
// ─────────────────────────────────────────────────────────────────────────────
function ReelPhoneMock() {
  const PW = 160;
  const PH = 300;

  return (
    <svg width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`} aria-hidden style={{ filter: 'drop-shadow(0 24px 48px rgba(14,15,18,.6))' }}>
      {/* Phone body */}
      <rect width={PW} height={PH} rx={24} fill="var(--m-ink)" stroke="rgba(197,160,89,.35)" strokeWidth={1.5} />
      {/* Screen area */}
      <rect x={6} y={12} width={PW - 12} height={PH - 24} rx={18} fill="#0a0b0d" />
      {/* Notch */}
      <rect x={54} y={12} width={52} height={9} rx={4} fill="var(--m-ink)" />

      {/* Video content — soft vertical strips suggesting a reel playing */}
      <rect x={6} y={22} width={PW - 12} height={PH - 34} rx={14} fill="rgba(197,160,89,.05)" />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={8}
          y={26 + i * 56}
          width={PW - 16}
          height={48}
          rx={4}
          fill={i === 1 ? 'rgba(197,160,89,.1)' : 'rgba(255,255,255,.03)'}
        />
      ))}

      {/* Center play glow */}
      <circle cx={PW / 2} cy={PH / 2 - 10} r={18} fill="rgba(197,160,89,.12)" />
      <circle cx={PW / 2} cy={PH / 2 - 10} r={11} fill="rgba(197,160,89,.2)" />
      <path
        d={`M ${PW / 2 - 5} ${PH / 2 - 18} L ${PW / 2 + 9} ${PH / 2 - 10} L ${PW / 2 - 5} ${PH / 2 - 2} Z`}
        fill="var(--m-orange)"
        opacity={0.9}
      />

      {/* Progress bar */}
      <rect x={12} y={PH - 50} width={PW - 24} height={3} rx={1.5} fill="rgba(255,255,255,.08)" />
      <rect x={12} y={PH - 50} width={(PW - 24) * 0.58} height={3} rx={1.5} fill="var(--m-orange)" />
      {/* Scrub handle */}
      <circle cx={12 + (PW - 24) * 0.58} cy={PH - 48.5} r={4} fill="var(--m-orange)" />

      {/* Bottom thumbnail strip — 5 picks */}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={12 + i * 27}
          y={PH - 38}
          width={22}
          height={22}
          rx={4}
          fill={i < 3 ? 'rgba(197,160,89,.25)' : 'rgba(255,255,255,.06)'}
          stroke={i < 3 ? 'rgba(197,160,89,.55)' : 'rgba(255,255,255,.1)'}
          strokeWidth={0.8}
        />
      ))}
      {/* "3/5 picked" label */}
      <rect x={PW - 44} y={PH - 37} width={36} height={12} rx={6} fill="rgba(197,160,89,.2)" />

      {/* Top status bar */}
      <rect x={10} y={24} width={40} height={7} rx={3} fill="rgba(255,255,255,.08)" />
      <rect x={PW - 50} y={24} width={40} height={7} rx={3} fill="rgba(197,160,89,.2)" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FeatureMock — cinematic UI previews for each of the four kept features.
// Pure SVG on --m-paper-2 canvas, 300×140 viewBox.
// ─────────────────────────────────────────────────────────────────────────────
type FeatureMockKind = 'moments' | 'people' | 'stories' | 'keepsake';

function FeatureMock({ kind }: { kind: FeatureMockKind }) {
  const H = 140;
  const W = 300;

  if (kind === 'moments') {
    // Papic capture grid — 3×2 tiles, one active (orange ring), two saved (gold), three pending
    const cols = [18, 108, 198];
    const rows = [12, 74];
    const active = (c: number, r: number) => c === 0 && r === 0;
    const saved  = (c: number, r: number) => (c === 1 && r === 0) || (c === 2 && r === 1);

    return (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
        {/* Canvas */}
        <rect width={W} height={H} rx={8} fill="rgba(14,15,18,.72)" />

        {cols.map((cx, ci) =>
          rows.map((ry, ri) => {
            const a = active(ci, ri);
            const s = saved(ci, ri);
            return (
              <g key={`${ci}-${ri}`}>
                <rect
                  x={cx} y={ry} width={82} height={52} rx={6}
                  fill={a ? 'rgba(197,160,89,.08)' : s ? 'rgba(197,160,89,.11)' : 'rgba(255,255,255,.04)'}
                  stroke={a ? 'var(--m-orange)' : s ? 'rgba(197,160,89,.45)' : 'rgba(255,255,255,.1)'}
                  strokeWidth={a ? 2 : 0.8}
                />
                {a && (
                  <>
                    <circle cx={cx + 41} cy={ry + 26} r={13} fill="none" stroke="var(--m-orange)" strokeWidth={1.5} opacity={0.5} />
                    <circle cx={cx + 41} cy={ry + 26} r={5} fill="var(--m-orange)" opacity={0.75} />
                  </>
                )}
                {s && (
                  <rect x={cx + 5} y={ry + 40} width={36} height={8} rx={4} fill="rgba(197,160,89,.65)" />
                )}
              </g>
            );
          })
        )}

        {/* Bottom stat bar */}
        <circle cx={20} cy={H - 8} r={3.5} fill="var(--m-mulberry)" />
        <rect x={30} y={H - 14} width={90} height={10} rx={5} fill="rgba(255,255,255,.1)" />
        <rect x={208} y={H - 14} width={80} height={10} rx={5} fill="rgba(197,160,89,.18)" />
      </svg>
    );
  }

  if (kind === 'people') {
    // Panood — broadcast screen with LIVE badge and location chips
    return (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <rect width={W} height={H} rx={8} fill="rgba(14,15,18,.72)" />

        {/* Screen frame */}
        <rect x={54} y={10} width={192} height={108} rx={8} fill="rgba(255,255,255,.04)" stroke="rgba(197,160,89,.3)" strokeWidth={1.2} />

        {/* Video content stripes inside screen */}
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={58} y={14 + i * 20} width={184} height={14} rx={3} fill={i === 2 ? 'rgba(197,160,89,.1)' : 'rgba(255,255,255,.04)'} />
        ))}
        {/* Center broadcast glow */}
        <ellipse cx={150} cy={64} rx={42} ry={28} fill="rgba(197,160,89,.06)" />
        <rect x={138} y={58} width={24} height={14} rx={2} fill="rgba(197,160,89,.15)" />

        {/* ● LIVE badge */}
        <rect x={58} y={12} width={44} height={14} rx={7} fill="rgba(180,40,40,.85)" />
        <circle cx={69} cy={19} r={3} fill="#fff" />
        <rect x={75} y={14} width={23} height={10} rx={5} fill="rgba(255,255,255,.0)" />

        {/* Viewer count */}
        <rect x={196} y={12} width={46} height={14} rx={7} fill="rgba(255,255,255,.1)" />

        {/* Location chips — left side */}
        <rect x={2} y={52} width={48} height={18} rx={9} fill="rgba(197,160,89,.15)" stroke="rgba(197,160,89,.4)" strokeWidth={0.8} />
        {/* connector line */}
        <line x1={52} y1={61} x2={54} y2={61} stroke="rgba(197,160,89,.35)" strokeWidth={0.8} strokeDasharray="2,2" />

        {/* Location chips — right of screen */}
        <rect x={250} y={36} width={48} height={18} rx={9} fill="rgba(197,160,89,.15)" stroke="rgba(197,160,89,.4)" strokeWidth={0.8} />
        <rect x={250} y={64} width={48} height={18} rx={9} fill="rgba(197,160,89,.1)" stroke="rgba(197,160,89,.25)" strokeWidth={0.8} />
        {/* connector lines */}
        <line x1={246} y1={45} x2={250} y2={45} stroke="rgba(197,160,89,.35)" strokeWidth={0.8} strokeDasharray="2,2" />
        <line x1={246} y1={73} x2={250} y2={73} stroke="rgba(197,160,89,.25)" strokeWidth={0.8} strokeDasharray="2,2" />

        {/* "Watching from everywhere" label */}
        <rect x={54} y={122} width={130} height={10} rx={5} fill="rgba(255,255,255,.07)" />
        <rect x={196} y={122} width={50} height={10} rx={5} fill="rgba(197,160,89,.15)" />
      </svg>
    );
  }

  if (kind === 'stories') {
    // Kwento — two overlapping guest message cards with photo thumbnail and reaction
    return (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <rect width={W} height={H} rx={8} fill="rgba(251,251,250,.02)" />

        {/* Back card (rotated suggestion) */}
        <g transform="translate(32,20) rotate(-3 120 52)">
          <rect width={236} height={88} rx={10} fill="var(--m-paper)" stroke="var(--m-line)" strokeWidth={1} />
          <rect x={12} y={18} width={180} height={8} rx={4} fill="var(--m-line)" />
          <rect x={12} y={32} width={140} height={8} rx={4} fill="var(--m-line)" />
          <rect x={12} y={46} width={90} height={8} rx={4} fill="var(--m-line-soft)" />
        </g>

        {/* Front card */}
        <rect x={18} y={16} width={244} height={100} rx={10} fill="var(--m-paper)" stroke="rgba(197,160,89,.3)" strokeWidth={1.2} />

        {/* Photo thumbnail — top right of card */}
        <rect x={210} y={24} width={44} height={44} rx={6} fill="var(--m-orange-4)" stroke="rgba(197,160,89,.4)" strokeWidth={0.8} />
        <circle cx={232} cy={40} r={8} fill="rgba(197,160,89,.3)" />
        <rect x={218} y={52} width={28} height={10} rx={3} fill="rgba(197,160,89,.2)" />

        {/* Quote mark */}
        <text x={26} y={46} fontFamily="Georgia, serif" fontSize={30} fill="var(--m-orange)" opacity={0.6}>{'"'}</text>

        {/* Message text lines */}
        <rect x={46} y={28} width={156} height={8} rx={4} fill="var(--m-orange-3)" />
        <rect x={46} y={42} width={140} height={8} rx={4} fill="var(--m-slate-2)" opacity={0.4} />
        <rect x={46} y={56} width={110} height={8} rx={4} fill="var(--m-slate-2)" opacity={0.4} />

        {/* Author badge */}
        <rect x={22} y={88} width={80} height={18} rx={9} fill="rgba(197,160,89,.12)" stroke="rgba(197,160,89,.3)" strokeWidth={0.8} />

        {/* Heart reaction */}
        <rect x={224} y={88} width={32} height={18} rx={9} fill="rgba(155,50,80,.15)" stroke="rgba(155,50,80,.35)" strokeWidth={0.8} />

        {/* "Card tail" pointing down */}
        <path d="M 40 116 L 40 128 L 56 116 Z" fill="var(--m-paper)" stroke="rgba(197,160,89,.3)" strokeWidth={1} />
      </svg>
    );
  }

  // keepsake — the Alaala living page: editorial layout with masthead + QR
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <rect width={W} height={H} rx={8} fill="var(--m-paper)" stroke="var(--m-line)" strokeWidth={0.8} />

      {/* Masthead bar */}
      <rect x={0} y={0} width={W} height={24} rx={8} fill="var(--m-ink)" />
      <rect x={0} y={16} width={W} height={8} fill="var(--m-ink)" />
      <rect x={10} y={6} width={80} height={10} rx={3} fill="rgba(197,160,89,.85)" />
      <rect x={220} y={6} width={70} height={10} rx={3} fill="rgba(255,255,255,.25)" />

      {/* Hero photo area */}
      <rect x={10} y={32} width={118} height={74} rx={6} fill="var(--m-orange-4)" stroke="rgba(197,160,89,.3)" strokeWidth={0.8} />
      {/* Couple silhouette hint */}
      <ellipse cx={52} cy={72} rx={10} ry={14} fill="rgba(197,160,89,.25)" />
      <ellipse cx={76} cy={74} rx={10} ry={12} fill="rgba(197,160,89,.2)" />

      {/* Text column */}
      <rect x={138} y={32} width={92} height={9} rx={3} fill="var(--m-ink)" />
      <rect x={138} y={48} width={100} height={7} rx={3} fill="var(--m-slate-2)" opacity={0.5} />
      <rect x={138} y={61} width={88} height={7} rx={3} fill="var(--m-slate-2)" opacity={0.5} />
      <rect x={138} y={74} width={74} height={7} rx={3} fill="var(--m-slate-2)" opacity={0.5} />
      <rect x={138} y={87} width={60} height={7} rx={3} fill="var(--m-orange-3)" />

      {/* Small second photo */}
      <rect x={244} y={32} width={46} height={34} rx={5} fill="var(--m-paper-2)" stroke="var(--m-line)" strokeWidth={0.8} />
      <circle cx={267} cy={46} r={7} fill="rgba(197,160,89,.2)" />

      {/* QR code */}
      <rect x={244} y={74} width={46} height={32} rx={5} fill="var(--m-ink)" />
      {[
        [248, 78], [264, 78], [248, 90], [264, 90],
        [258, 84], [270, 84], [258, 96], [270, 96],
      ].map(([x, y], idx) => (
        <rect key={idx} x={x} y={y} width={5} height={5} rx={1} fill="var(--m-orange-3)" />
      ))}

      {/* URL slug */}
      <rect x={10} y={114} width={120} height={8} rx={4} fill="rgba(197,160,89,.2)" />
      <rect x={140} y={114} width={60} height={8} rx={4} fill="var(--m-line)" />

      {/* Date chip */}
      <rect x={214} y={112} width={76} height={12} rx={6} fill="var(--m-paper-2)" stroke="var(--m-line)" strokeWidth={0.8} />
    </svg>
  );
}

'use client';

/**
 * FeaturesNarrative — the post-hero step-through experience.
 *
 * "Sixteen features. One home." → eight free tools → eight paid →
 * vendor marketplace → link to Our Story.
 *
 * Four panels, each advancing on button click. The section re-anchors
 * itself to the viewport top when the user advances so the panel always
 * fills the screen. Progress dots show position.
 *
 * Price-free by design — no SKU amounts (homepage sells the free-first
 * promise; prices live on their own surfaces). Reuses zero-dep Reveal/Blob
 * primitives + the --m-* Clean Editorial tokens.
 */

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Blob, Reveal } from './_motion';

// ─── Panel 0 data ──────────────────────────────────────────────────────────
// Abstract preview tiles for the "16 features" overview.
const OVERVIEW_FREE = [
  'Guest List',
  'Seat Plan',
  'Budget',
  'Timeline',
  'Mood Board',
  'Checklist',
  'Save the Date',
  'Website',
];
const OVERVIEW_PAID = [
  'Setnayan AI',
  'Monogram',
  'Papic',
  'Panood',
  'Pakanta',
  'Contracts',
  'Cinematic Reveal',
  'Patiktok',
];

// ─── Panel 1 data ──────────────────────────────────────────────────────────
type MockKind = 'guests' | 'seats' | 'budget' | 'timeline' | 'mood' | 'checklist' | 'std' | 'website';

const FREE_ROOMS: Array<{ mock: MockKind; name: string; line: string; ends: string }> = [
  {
    mock: 'guests',
    name: 'Guest List',
    line: 'Everyone you love, organized — with RSVPs and day-of check-in.',
    ends: 'Ends the "sino ba talaga ang pupunta?" group chat.',
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
    mock: 'checklist',
    name: 'Checklist',
    line: 'An adaptive to-do list that walks you through every decision — step by step.',
    ends: 'Ends the "what do we do next?" paralysis.',
  },
  {
    mock: 'std',
    name: 'Save the Date',
    line: 'A self-playing content film that announces your wedding date in style.',
    ends: 'Ends the forwarded group chat screenshot.',
  },
  {
    mock: 'website',
    name: 'Website',
    line: 'A 4-in-1 wedding site: RSVP · Event page · Editorial · with branded QR.',
    ends: 'Ends the "can you resend the details?" texts.',
  },
];

// ─── Panel 2 data ──────────────────────────────────────────────────────────
type PremiumMockKind = 'ai' | 'monogram' | 'papic' | 'panood' | 'pakanta' | 'contracts' | 'reveal' | 'patiktok';

const PAID_FEATURES: Array<{ mock: PremiumMockKind; name: string; line: string; tag: string }> = [
  {
    mock: 'ai',
    name: 'Setnayan AI',
    line: 'The intelligent planner that learns your style and guides every decision.',
    tag: 'Planning',
  },
  {
    mock: 'monogram',
    name: 'Animated Monogram',
    line: 'An AI-crafted living mark that lives across every surface of your wedding.',
    tag: 'Identity',
  },
  {
    mock: 'papic',
    name: 'Papic',
    line: 'Friends and family become your photo crew — QR-tagged, real-time gallery.',
    tag: 'Capture',
  },
  {
    mock: 'panood',
    name: 'Panood',
    line: 'Your ceremony, live-streamed directly to the event page.',
    tag: 'Broadcast',
  },
  {
    mock: 'pakanta',
    name: 'Pakanta',
    line: 'A custom original song written and composed for your wedding.',
    tag: 'Music',
  },
  {
    mock: 'contracts',
    name: 'Contract Intelligence',
    line: 'AI reviews every vendor contract before you sign.',
    tag: 'Legal',
  },
  {
    mock: 'reveal',
    name: 'Cinematic Reveal',
    line: 'A premium opening that unveils your Save the Date like a film — sheer veils, doors, and more.',
    tag: 'Film',
  },
  {
    mock: 'patiktok',
    name: 'Patiktok',
    line: 'Short personal reels — one for every guest to take home.',
    tag: 'Reels',
  },
];

// ─── Panel 3 data ──────────────────────────────────────────────────────────
const VENDOR_CATEGORIES = [
  'Venues',
  'Catering',
  'Photography',
  'Videography',
  'Flowers',
  'Hair & Make-up',
  'Lights & Sound',
  'Band / DJ',
  'Gown & Suit',
  'Wedding Cake',
  'Events Stylist',
  'Coordination',
];

// ─── Step dots ─────────────────────────────────────────────────────────────
function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div
      aria-hidden
      style={{ display: 'flex', gap: 7, justifyContent: 'center', marginBottom: 32 }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 20 : 6,
            height: 6,
            borderRadius: 999,
            background:
              i === current
                ? 'var(--m-orange)'
                : i < current
                  ? 'var(--m-orange-3)'
                  : 'rgba(30,34,41,.14)',
            transition: 'width .35s ease, background .35s ease',
          }}
        />
      ))}
    </div>
  );
}

// ─── Next button ───────────────────────────────────────────────────────────
function NextBtn({
  onClick,
  label,
  dark,
}: {
  onClick: () => void;
  label: string;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 28px',
        borderRadius: 999,
        border: dark ? '1px solid rgba(255,255,255,.18)' : '1px solid var(--m-line)',
        background: dark ? 'rgba(255,255,255,.06)' : 'var(--m-paper)',
        color: dark ? '#FBFBFA' : 'var(--m-ink)',
        fontSize: 13,
        letterSpacing: '.06em',
        cursor: 'pointer',
        boxShadow: dark ? '0 8px 30px rgba(0,0,0,.28)' : '0 2px 12px rgba(0,0,0,.06)',
        transition: 'opacity .2s',
      }}
    >
      {label}
      <svg width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden>
        <path
          d="M0 5h14M10 1l4 4-4 4"
          stroke={dark ? 'var(--m-orange-3)' : 'var(--m-orange)'}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// ─── Panel 0 — Overview ────────────────────────────────────────────────────
function PanelOverview({ onNext }: { onNext: () => void }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: '#0e0f12',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <Blob top={-80} left={-60} size={560} color="var(--m-orange)" opacity={0.1} />
      <Blob bottom={-100} right={-60} size={500} color="var(--m-mulberry)" opacity={0.14} />

      <div
        className="relative mx-auto w-full"
        style={{ maxWidth: 1100, padding: '80px 20px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <StepDots total={4} current={0} />

        <div
          className="m-mono text-center"
          style={{ fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--m-orange-3)', marginBottom: 20 }}
        >
          One platform
        </div>

        <h2
          className="m-serif italic text-center"
          style={{ color: '#FBFBFA', fontSize: 'clamp(2.4rem, 6.5vw, 4.2rem)', lineHeight: 1.05, maxWidth: 740, marginBottom: 20 }}
        >
          Sixteen features.{' '}
          <span style={{ color: 'var(--m-orange-3)' }}>One home.</span>
        </h2>

        <p
          className="text-center"
          style={{ color: 'rgba(251,251,250,.62)', fontSize: 'clamp(1rem, 2.4vw, 1.15rem)', lineHeight: 1.65, maxWidth: 540, marginBottom: 52 }}
        >
          Eight are free from the moment you sign up. Eight more transform your wedding into
          something your guests will never forget. All on one platform.
        </p>

        {/* The 14-tile preview: 6 bright (free) + 8 dimmer (paid) */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            maxWidth: 700,
            marginBottom: 52,
          }}
        >
          {OVERVIEW_FREE.map((name) => (
            <div
              key={name}
              style={{
                padding: '9px 16px',
                borderRadius: 10,
                background: 'rgba(197,160,89,.16)',
                border: '1px solid rgba(197,160,89,.32)',
                color: 'var(--m-orange-3)',
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: '.01em',
              }}
            >
              {name}
            </div>
          ))}
          {OVERVIEW_PAID.map((name) => (
            <div
              key={name}
              style={{
                padding: '9px 16px',
                borderRadius: 10,
                background: 'rgba(255,255,255,.04)',
                border: '1px solid rgba(255,255,255,.1)',
                color: 'rgba(251,251,250,.48)',
                fontSize: 13,
                letterSpacing: '.01em',
              }}
            >
              {name}
            </div>
          ))}
        </div>

        <NextBtn onClick={onNext} label="See what's free" dark />
      </div>
    </div>
  );
}

// ─── Panel 1 — Free tools ──────────────────────────────────────────────────
function PanelFree({ onNext }: { onNext: () => void }) {
  return (
    <div
      style={{
        background: 'var(--m-paper)',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="mx-auto w-full"
        style={{ maxWidth: 1100, padding: '64px 20px 80px', flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        <StepDots total={4} current={1} />

        <div
          className="m-mono text-center"
          style={{ fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--m-orange-2)', marginBottom: 16 }}
        >
          Free · no card needed
        </div>

        <h2
          className="m-serif italic text-center"
          style={{ fontSize: 'clamp(2rem, 5.5vw, 3.4rem)', lineHeight: 1.08, maxWidth: 680, margin: '0 auto', marginBottom: 12 }}
        >
          Yours from day one.
        </h2>

        <p
          className="text-center text-[var(--m-slate)]"
          style={{ fontSize: 'clamp(.95rem, 2.4vw, 1.1rem)', lineHeight: 1.6, maxWidth: 520, margin: '0 auto 44px' }}
        >
          Everything you need to build and run your wedding — no credit card, no subscription.
        </p>

        <div
          className="grid gap-3.5"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', flex: 1 }}
        >
          {FREE_ROOMS.map((r, i) => (
            <Reveal key={r.name} delay={i * 55}>
              <div
                className="m-card m-card-lift overflow-hidden"
                style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
              >
                <div
                  style={{
                    background: 'var(--m-ivory)',
                    borderBottom: '1px solid var(--m-line)',
                    padding: '16px 18px',
                  }}
                >
                  <RoomMock kind={r.mock} />
                </div>
                <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span className="m-serif italic text-[var(--m-ink)]" style={{ fontSize: 16 }}>
                      {r.name}
                    </span>
                    <span
                      className="m-mono"
                      style={{
                        fontSize: 9,
                        letterSpacing: '.14em',
                        textTransform: 'uppercase',
                        color: '#fff',
                        background: 'var(--m-sage-deep)',
                        borderRadius: 999,
                        padding: '3px 8px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Free
                    </span>
                  </div>
                  <p className="mt-2 text-[var(--m-slate)]" style={{ fontSize: 13, lineHeight: 1.5 }}>
                    {r.line}
                  </p>
                  <p
                    className="m-mono mt-auto pt-3"
                    style={{
                      fontSize: 11,
                      lineHeight: 1.5,
                      letterSpacing: '.02em',
                      fontStyle: 'italic',
                      color: 'var(--m-orange-2)',
                      borderTop: '1px solid var(--m-line-soft)',
                      marginTop: 12,
                    }}
                  >
                    {r.ends}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 48 }}>
          <NextBtn onClick={onNext} label="Now see the premium layer" />
        </div>
      </div>
    </div>
  );
}

// ─── Panel 2 — Paid features ───────────────────────────────────────────────
function PanelPremium({ onNext }: { onNext: () => void }) {
  return (
    <div
      style={{
        background: 'var(--m-paper-2)',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="mx-auto w-full"
        style={{ maxWidth: 1100, padding: '64px 20px 80px', flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        <StepDots total={4} current={2} />

        <div
          className="m-mono text-center"
          style={{ fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--m-mulberry)', marginBottom: 16 }}
        >
          Premium · when you&rsquo;re ready
        </div>

        <h2
          className="m-serif italic text-center"
          style={{ fontSize: 'clamp(2rem, 5.5vw, 3.4rem)', lineHeight: 1.08, maxWidth: 680, margin: '0 auto', marginBottom: 12 }}
        >
          Eight tools that set the day apart.
        </h2>

        <p
          className="text-center text-[var(--m-slate)]"
          style={{ fontSize: 'clamp(.95rem, 2.4vw, 1.1rem)', lineHeight: 1.6, maxWidth: 520, margin: '0 auto 44px' }}
        >
          Add only what you want. The planning always stays free.
        </p>

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', alignItems: 'start' }}
        >
          {PAID_FEATURES.map((f, i) => (
            <Reveal key={f.name} delay={i * 55}>
              <div
                className="m-card overflow-hidden"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid var(--m-line)',
                  borderRadius: 14,
                  background: 'var(--m-paper)',
                }}
              >
                <div
                  style={{
                    background: 'var(--m-ivory)',
                    borderBottom: '1px solid var(--m-line)',
                    padding: '14px 18px',
                  }}
                >
                  <PremiumMock kind={f.mock} />
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span className="m-serif italic text-[var(--m-ink)]" style={{ fontSize: 15 }}>
                      {f.name}
                    </span>
                    <span
                      className="m-mono"
                      style={{
                        fontSize: 9,
                        letterSpacing: '.12em',
                        textTransform: 'uppercase',
                        color: 'var(--m-mulberry)',
                        background: 'var(--m-mulberry-4)',
                        border: '1px solid var(--m-mulberry-3)',
                        borderRadius: 999,
                        padding: '3px 8px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.tag}
                    </span>
                  </div>
                  <p className="text-[var(--m-slate)]" style={{ fontSize: 13, lineHeight: 1.5 }}>
                    {f.line}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 48 }}>
          <NextBtn onClick={onNext} label="Meet the vendors" />
        </div>
      </div>
    </div>
  );
}

// ─── Panel 3 — Vendor marketplace ──────────────────────────────────────────
function PanelMarketplace() {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: '#0e0f12',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <Blob top={-80} right={-40} size={520} color="var(--m-mulberry)" opacity={0.12} />
      <Blob bottom={-60} left={-60} size={480} color="var(--m-orange)" opacity={0.1} />

      <div
        className="relative mx-auto w-full"
        style={{ maxWidth: 1100, padding: '80px 20px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <StepDots total={4} current={3} />

        <div
          className="m-mono text-center"
          style={{ fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--m-mulberry)', marginBottom: 20 }}
        >
          Vendor marketplace
        </div>

        <h2
          className="m-serif italic text-center"
          style={{ color: '#FBFBFA', fontSize: 'clamp(2.4rem, 6.5vw, 4.2rem)', lineHeight: 1.05, maxWidth: 700, marginBottom: 20 }}
        >
          Find your whole team.
        </h2>

        <p
          className="text-center"
          style={{ color: 'rgba(251,251,250,.62)', fontSize: 'clamp(1rem, 2.4vw, 1.15rem)', lineHeight: 1.65, maxWidth: 560, marginBottom: 48 }}
        >
          Verified vendors across the Philippines — filtered by date, location, and budget.
          Book at <strong style={{ color: '#FBFBFA', fontWeight: 500 }}>0% commission, always.</strong>
        </p>

        {/* Vendor category chips */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            maxWidth: 640,
            marginBottom: 60,
          }}
        >
          {VENDOR_CATEGORIES.map((cat) => (
            <div
              key={cat}
              style={{
                padding: '9px 16px',
                borderRadius: 999,
                background: 'rgba(255,255,255,.05)',
                border: '1px solid rgba(255,255,255,.12)',
                color: 'rgba(251,251,250,.72)',
                fontSize: 13,
                letterSpacing: '.01em',
              }}
            >
              {cat}
            </div>
          ))}
        </div>

        {/* Two CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <Link
            href="/onboarding/wedding"
            className="m-btn m-btn-primary m-btn-lg"
            style={{ minWidth: 220, justifyContent: 'center', textAlign: 'center' }}
          >
            Start planning <span style={{ color: 'var(--m-orange-3)' }}>· free</span>
          </Link>
          <Link
            href="/our-story"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'rgba(251,251,250,.6)',
              fontSize: 13,
              letterSpacing: '.04em',
              textDecoration: 'none',
              opacity: .85,
            }}
          >
            Read our story
            <svg width="14" height="8" viewBox="0 0 14 8" fill="none" aria-hidden>
              <path
                d="M0 4h12M9 1l3 3-3 3"
                stroke="var(--m-orange-3)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

const TOTAL_STEPS = 4;

// ─── Main export ───────────────────────────────────────────────────────────
export function FeaturesNarrative() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const sectionRef = useRef<HTMLDivElement>(null);
  // Prevents double-click/rapid-click from skipping multiple steps.
  const advancing = useRef(false);

  const advance = () => {
    if (advancing.current || step >= TOTAL_STEPS - 1) return;
    advancing.current = true;

    // Skip the fade if the visitor prefers reduced motion.
    const reduce = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce) {
      setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
      // Two rAFs: first fires before paint, second after layout is stable.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          sectionRef.current?.scrollIntoView({ block: 'start' });
          advancing.current = false;
        }),
      );
      return;
    }

    setVisible(false);
    setTimeout(() => {
      setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
      setVisible(true);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Unlock after the smooth scroll has had time to land (~600ms).
          setTimeout(() => { advancing.current = false; }, 600);
        }),
      );
    }, 260);
  };

  return (
    <div
      ref={sectionRef}
      aria-live="polite"
      aria-atomic="true"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.26s ease',
      }}
    >
      {step === 0 && <PanelOverview onNext={advance} />}
      {step === 1 && <PanelFree onNext={advance} />}
      {step === 2 && <PanelPremium onNext={advance} />}
      {step === 3 && <PanelMarketplace />}
    </div>
  );
}

// ─── RoomMock ──────────────────────────────────────────────────────────────
// Tiny theme-tokened product visuals — re-used from WhatYouGet.
function RoomMock({ kind }: { kind: MockKind }) {
  const H = 60;
  if (kind === 'guests') {
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
    return (
      <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
        <rect x={88} y={6} width={44} height={12} rx={6} fill="var(--m-mulberry-4)" stroke="var(--m-mulberry-3)" strokeWidth={1} />
        {([[34, 40], [80, 44], [128, 42], [176, 40], [186, 16]] as [number, number][]).map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={11} fill="var(--m-paper)" stroke="var(--m-orange)" strokeWidth={1.5} />
        ))}
        <circle cx={34} cy={40} r={4} fill="var(--m-orange)" />
      </svg>
    );
  }
  if (kind === 'budget') {
    return (
      <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
        {([[10, 150, 'var(--m-orange)'], [26, 110, 'var(--m-mulberry)'], [42, 180, 'var(--m-sage-deep)']] as [number, number, string][]).map(
          ([y, w, c], i) => (
            <g key={i}>
              <rect x={8} y={y} width={196} height={8} rx={4} fill="var(--m-ivory)" />
              <rect x={8} y={y} width={w} height={8} rx={4} fill={c} />
            </g>
          ),
        )}
      </svg>
    );
  }
  if (kind === 'timeline') {
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
    return (
      <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
        {(['var(--m-mulberry)', 'var(--m-orange)', 'var(--m-sage)', 'var(--m-ink)', 'var(--m-orange-4)'] as string[]).map((c, i) => (
          <rect key={i} x={10 + i * 41} y={12} width={36} height={36} rx={8} fill={c} stroke="var(--m-line)" strokeWidth={i === 4 ? 1 : 0} />
        ))}
      </svg>
    );
  }
  if (kind === 'checklist') {
    // Four checklist rows: first three checked, fourth pending.
    return (
      <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
        {[9, 22, 35, 48].map((y, i) => (
          <g key={y}>
            <rect x={8} y={y} width={14} height={10} rx={3} fill={i < 3 ? 'var(--m-sage-deep)' : 'var(--m-paper)'} stroke={i < 3 ? 'var(--m-sage-deep)' : 'var(--m-line)'} strokeWidth={1.2} />
            {i < 3 && (
              <path d={`M${10} ${y + 5} l3 3 l5 -5`} fill="none" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
            )}
            <rect x={28} y={y + 2} width={i < 3 ? 120 : 80} height={6} rx={3} fill={i < 3 ? 'var(--m-line)' : 'var(--m-orange-3)'} opacity={i < 3 ? 0.6 : 1} />
          </g>
        ))}
      </svg>
    );
  }
  if (kind === 'std') {
    // A film-frame card with a date announcement.
    return (
      <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
        <rect x={8} y={4} width={204} height={52} rx={8} fill="var(--m-ink)" />
        <rect x={8} y={4} width={204} height={52} rx={8} fill="none" stroke="var(--m-orange)" strokeWidth={1.5} />
        {/* Film sprocket holes */}
        {[16, 32, 48].map((x) => (
          <rect key={`t${x}`} x={x} y={7} width={6} height={5} rx={1.5} fill="var(--m-paper)" opacity={0.3} />
        ))}
        {[16, 32, 48].map((x) => (
          <rect key={`b${x}`} x={x} y={48} width={6} height={5} rx={1.5} fill="var(--m-paper)" opacity={0.3} />
        ))}
        {[166, 182, 198].map((x) => (
          <rect key={`tr${x}`} x={x} y={7} width={6} height={5} rx={1.5} fill="var(--m-paper)" opacity={0.3} />
        ))}
        {[166, 182, 198].map((x) => (
          <rect key={`br${x}`} x={x} y={48} width={6} height={5} rx={1.5} fill="var(--m-paper)" opacity={0.3} />
        ))}
        {/* Date text area */}
        <rect x={64} y={18} width={92} height={8} rx={4} fill="var(--m-orange-3)" opacity={0.9} />
        <rect x={76} y={32} width={68} height={6} rx={3} fill="var(--m-paper)" opacity={0.25} />
      </svg>
    );
  }
  return (
    <svg width="100%" height={H} viewBox="0 0 220 60" aria-hidden>
      <rect x={8} y={6} width={150} height={48} rx={7} fill="var(--m-paper)" stroke="var(--m-line)" strokeWidth={1.5} />
      <line x1={8} y1={19} x2={158} y2={19} stroke="var(--m-line)" strokeWidth={1} />
      {[15, 23, 31].map((cx) => (
        <circle key={cx} cx={cx} cy={12.5} r={2} fill="var(--m-line)" />
      ))}
      <rect x={18} y={28} width={70} height={7} rx={3.5} fill="var(--m-orange-3)" />
      <rect x={18} y={40} width={48} height={6} rx={3} fill="var(--m-line)" />
      <rect x={170} y={14} width={40} height={40} rx={6} fill="var(--m-ink)" />
      {([[176, 20], [196, 20], [176, 40], [190, 34], [200, 44], [196, 28]] as [number, number][]).map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={6} height={6} rx={1} fill="var(--m-orange-3)" />
      ))}
    </svg>
  );
}

// ─── PremiumMock ───────────────────────────────────────────────────────────
// Product-hinting illustrations for the eight paid features. Same height and
// token system as RoomMock so the two panels feel like one design language.
function PremiumMock({ kind }: { kind: PremiumMockKind }) {
  const H = 68;

  if (kind === 'ai') {
    // Step plan with AI suggestion chip — planning interface feel
    return (
      <svg width="100%" height={H} viewBox="0 0 220 68" aria-hidden>
        {([12, 27, 42] as number[]).map((y, i) => (
          <g key={y}>
            <circle cx={18} cy={y + 4} r={4} fill={i < 2 ? 'var(--m-mulberry)' : 'var(--m-line)'} />
            <line x1={18} y1={y + 8} x2={18} y2={y + 19} stroke="var(--m-line)" strokeWidth={1} strokeDasharray="2 2" />
            <rect x={28} y={y} width={i === 1 ? 100 : 78} height={7} rx={3.5} fill={i === 1 ? 'var(--m-mulberry-4)' : 'var(--m-line)'} />
            {i === 1 && <rect x={28} y={y} width={44} height={7} rx={3.5} fill="var(--m-mulberry-3)" opacity={0.45} />}
          </g>
        ))}
        <rect x={170} y={10} width={42} height={14} rx={7} fill="var(--m-mulberry-4)" stroke="var(--m-mulberry-3)" strokeWidth={1} />
        <circle cx={179} cy={17} r={3} fill="var(--m-mulberry)" />
        <rect x={185} y={14} width={20} height={6} rx={3} fill="var(--m-mulberry-3)" opacity={0.6} />
        <rect x={28} y={56} width={90} height={8} rx={4} fill="var(--m-mulberry)" opacity={0.12} />
        <rect x={28} y={56} width={90} height={8} rx={4} fill="none" stroke="var(--m-mulberry)" strokeWidth={0.75} />
        <rect x={124} y={58} width={50} height={4} rx={2} fill="var(--m-line)" />
      </svg>
    );
  }

  if (kind === 'monogram') {
    // Decorative interlocking initials with outer ring
    return (
      <svg width="100%" height={H} viewBox="0 0 220 68" aria-hidden>
        <circle cx={110} cy={34} r={28} fill="none" stroke="var(--m-mulberry)" strokeWidth={1} opacity={0.2} />
        <circle cx={110} cy={34} r={20} fill="var(--m-mulberry-4)" stroke="var(--m-mulberry-3)" strokeWidth={1} />
        {/* I — vertical serif letterform */}
        <rect x={100} y={23} width={6} height={2} rx={1} fill="var(--m-mulberry)" />
        <rect x={100} y={43} width={6} height={2} rx={1} fill="var(--m-mulberry)" />
        <rect x={102.5} y={23} width={1.5} height={22} fill="var(--m-mulberry)" />
        {/* C — open arc */}
        <path d="M 124 24 A 11 11 0 1 0 124 44" fill="none" stroke="var(--m-mulberry)" strokeWidth={1.8} strokeLinecap="round" />
        {/* Corner flourishes */}
        {([[16, 8], [204, 8], [16, 60], [204, 60]] as [number, number][]).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2} fill="var(--m-mulberry)" opacity={0.22} />
        ))}
        <rect x={42} y={34} width={26} height={1} fill="var(--m-mulberry)" opacity={0.15} />
        <rect x={152} y={34} width={26} height={1} fill="var(--m-mulberry)" opacity={0.15} />
      </svg>
    );
  }

  if (kind === 'papic') {
    // 3×2 photo grid with QR-tag check marks
    const cells: [number, number, string, boolean][] = [
      [8,  6,  'var(--m-orange-4)',  true],
      [80, 6,  'var(--m-line)',      false],
      [152,6,  'var(--m-mulberry-4)',true],
      [8,  38, 'var(--m-sage)',      false],
      [80, 38, 'var(--m-orange-3)', true],
      [152,38, 'var(--m-line)',      false],
    ];
    return (
      <svg width="100%" height={H} viewBox="0 0 220 68" aria-hidden>
        {cells.map(([x, y, fill, tagged], i) => (
          <g key={i}>
            <rect x={x} y={y} width={60} height={26} rx={5} fill={fill} />
            {tagged && <circle cx={x + 52} cy={y + 7} r={6} fill="var(--m-sage-deep)" />}
            {tagged && <path d={`M${x + 49} ${y + 7} l2.5 2.5 l5 -5`} fill="none" stroke="#fff" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />}
          </g>
        ))}
      </svg>
    );
  }

  if (kind === 'panood') {
    // Widescreen video player with live badge and progress
    return (
      <svg width="100%" height={H} viewBox="0 0 220 68" aria-hidden>
        <rect x={8} y={4} width={204} height={46} rx={6} fill="var(--m-ink)" />
        <circle cx={110} cy={27} r={13} fill="rgba(255,255,255,.1)" />
        <path d="M105 20 L119 27 L105 34 Z" fill="rgba(255,255,255,.82)" />
        <rect x={14} y={10} width={30} height={11} rx={3} fill="#e02929" />
        <circle cx={20} cy={15.5} r={3} fill="#fff" opacity={0.9} />
        <rect x={26} y={13} width={12} height={5} rx={2.5} fill="#fff" opacity={0.7} />
        <rect x={8} y={54} width={204} height={6} rx={3} fill="var(--m-line)" />
        <rect x={8} y={54} width={88} height={6} rx={3} fill="var(--m-mulberry)" />
        <circle cx={96} cy={57} r={5} fill="var(--m-mulberry)" />
      </svg>
    );
  }

  if (kind === 'pakanta') {
    // Audio waveform with playhead
    const bars = [14, 24, 38, 30, 46, 20, 34, 50, 28, 40, 34, 22, 44, 26, 48, 18, 36, 30, 24, 40, 20, 32, 44, 26, 34, 22, 30, 42, 16, 28];
    return (
      <svg width="100%" height={H} viewBox="0 0 220 68" aria-hidden>
        {bars.map((bh, i) => (
          <rect
            key={i}
            x={8 + i * 6.8}
            y={34 - bh / 2}
            width={4}
            height={bh}
            rx={2}
            fill={i < 14 ? 'var(--m-orange)' : 'var(--m-line)'}
            opacity={i < 14 ? 1 : 0.55}
          />
        ))}
        <line x1={104} y1={6} x2={104} y2={62} stroke="var(--m-mulberry)" strokeWidth={1.5} opacity={0.7} />
        <circle cx={200} cy={20} r={9} fill="var(--m-mulberry-4)" stroke="var(--m-mulberry-3)" strokeWidth={1} />
        <text x={200} y={24} textAnchor="middle" fontSize={10} fill="var(--m-mulberry)" fontFamily="serif">♪</text>
      </svg>
    );
  }

  if (kind === 'contracts') {
    // Document with highlighted clause and AI check badge
    return (
      <svg width="100%" height={H} viewBox="0 0 220 68" aria-hidden>
        <rect x={48} y={4} width={124} height={60} rx={5} fill="var(--m-paper)" stroke="var(--m-line)" strokeWidth={1} />
        <rect x={48} y={4} width={34} height={60} rx={5} fill="var(--m-ivory)" />
        <rect x={48} y={4} width={34} height={60} rx={0} fill="var(--m-ivory)" />
        <rect x={48} y={4} width={124} height={60} rx={5} fill="none" stroke="var(--m-line)" strokeWidth={1} />
        {([17, 28, 39, 50] as number[]).map((y, i) => (
          <rect key={y} x={90} y={y} width={i === 2 ? 64 : 72} height={5} rx={2.5}
            fill={i === 2 ? 'var(--m-orange-3)' : 'var(--m-line)'} opacity={i === 2 ? 1 : 0.7} />
        ))}
        {([17, 28, 39, 50] as number[]).map((y, i) => (
          <rect key={`n${y}`} x={54} y={y} width={28} height={5} rx={2.5} fill="var(--m-line)" opacity={0.4} />
        ))}
        <circle cx={162} cy={56} r={9} fill="var(--m-sage-deep)" />
        <path d="M157 56 l3 3 l7 -7" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        <rect x={54} y={7} width={22} height={7} rx={3.5} fill="var(--m-mulberry-4)" stroke="var(--m-mulberry-3)" strokeWidth={0.5} />
      </svg>
    );
  }

  if (kind === 'reveal') {
    // Two curtains parting to reveal glowing center text
    return (
      <svg width="100%" height={H} viewBox="0 0 220 68" aria-hidden>
        <rect x={8} y={4} width={204} height={60} rx={6} fill="var(--m-ink)" />
        <rect x={82} y={20} width={56} height={8} rx={4} fill="var(--m-orange-3)" opacity={0.88} />
        <rect x={90} y={34} width={40} height={5} rx={2.5} fill="rgba(255,255,255,.18)" />
        {/* Left curtain */}
        <path d="M8 4 Q8 4 78 4 Q54 34 78 64 Q8 64 8 64 Z" fill="var(--m-mulberry)" opacity={0.82} />
        {/* Right curtain */}
        <path d="M142 4 Q212 4 212 4 Q212 64 212 64 Q142 64 166 34 Z" fill="var(--m-mulberry)" opacity={0.82} />
        {/* Light seam lines */}
        <line x1={78} y1={4} x2={78} y2={64} stroke="var(--m-orange)" strokeWidth={1} opacity={0.5} />
        <line x1={142} y1={4} x2={142} y2={64} stroke="var(--m-orange)" strokeWidth={1} opacity={0.5} />
      </svg>
    );
  }

  // patiktok — two phone-sized vertical reels side by side
  return (
    <svg width="100%" height={H} viewBox="0 0 220 68" aria-hidden>
      {([72, 120] as number[]).map((x, pi) => (
        <g key={pi}>
          <rect x={x} y={5} width={38} height={58} rx={6} fill={pi === 0 ? 'var(--m-ink)' : 'var(--m-paper-2)'} stroke="var(--m-line)" strokeWidth={1} />
          <rect x={x + 3} y={9} width={32} height={44} rx={4} fill={pi === 0 ? 'var(--m-mulberry-4)' : 'var(--m-orange-4)'} />
          <rect x={x + 7} y={40} width={18} height={4} rx={2} fill={pi === 0 ? 'var(--m-mulberry-3)' : 'var(--m-orange-3)'} opacity={0.7} />
          <rect x={x + 7} y={46} width={12} height={3} rx={1.5} fill={pi === 0 ? 'var(--m-mulberry-3)' : 'var(--m-orange-3)'} opacity={0.4} />
          <circle cx={x + 19} cy={58} r={3} fill="var(--m-line)" />
        </g>
      ))}
      {/* Engagement icons — right side */}
      {([12, 28, 44] as number[]).map((y) => (
        <circle key={y} cx={176} cy={y} r={8} fill="var(--m-line)" opacity={0.5} />
      ))}
      <circle cx={44} cy={28} r={8} fill="var(--m-line)" opacity={0.5} />
    </svg>
  );
}

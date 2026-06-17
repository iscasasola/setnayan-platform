'use client';

/**
 * FeaturesNarrative — the post-hero step-through experience.
 *
 * "Fourteen features. One home." → six free tools → eight paid →
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
import { Blob } from './_motion';

// ─── Panel 0 data ──────────────────────────────────────────────────────────
// Abstract preview tiles for the "14 features" overview.
const OVERVIEW_FREE = [
  'Guest List',
  'Seat Plan',
  'Budget',
  'Timeline',
  'Mood Board',
  'Website',
];
const OVERVIEW_PAID = [
  'Setnayan AI',
  'Monogram',
  'Papic',
  'Panood',
  'Pakanta',
  'Contracts',
  'Save the Date',
  'Patiktok',
];

// ─── Panel 1 data ──────────────────────────────────────────────────────────
type MockKind = 'guests' | 'seats' | 'budget' | 'timeline' | 'mood' | 'website';

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
    mock: 'website',
    name: 'Website',
    line: 'A real wedding site with branded QR invitations.',
    ends: 'Ends the "can you resend the details?" texts.',
  },
];

// ─── Panel 2 data ──────────────────────────────────────────────────────────
const PAID_FEATURES: Array<{ icon: string; name: string; line: string; tag: string }> = [
  {
    icon: '✦',
    name: 'Setnayan AI',
    line: 'The intelligent planner that learns your style and guides every decision.',
    tag: 'Planning',
  },
  {
    icon: '◈',
    name: 'Animated Monogram',
    line: 'An AI-crafted living mark that lives across every surface of your wedding.',
    tag: 'Identity',
  },
  {
    icon: '⊙',
    name: 'Papic',
    line: 'Friends and family become your photo crew — QR-tagged, real-time gallery.',
    tag: 'Capture',
  },
  {
    icon: '▷',
    name: 'Panood',
    line: 'Your ceremony, live-streamed directly to the event page.',
    tag: 'Broadcast',
  },
  {
    icon: '♪',
    name: 'Pakanta',
    line: 'A custom original song written and composed for your wedding.',
    tag: 'Music',
  },
  {
    icon: '⚖',
    name: 'Contract Intelligence',
    line: 'AI reviews every vendor contract before you sign.',
    tag: 'Legal',
  },
  {
    icon: '◉',
    name: 'Save the Date',
    line: 'A cinematic reveal film your guests will share before the wedding.',
    tag: 'Film',
  },
  {
    icon: '◐',
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
          Fourteen features.{' '}
          <span style={{ color: 'var(--m-orange-3)' }}>One home.</span>
        </h2>

        <p
          className="text-center"
          style={{ color: 'rgba(251,251,250,.62)', fontSize: 'clamp(1rem, 2.4vw, 1.15rem)', lineHeight: 1.65, maxWidth: 540, marginBottom: 52 }}
        >
          Six are free from the moment you sign up. Eight transform your wedding into
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
          {FREE_ROOMS.map((r) => (
            <div
              key={r.name}
              className="m-card m-card-lift overflow-hidden"
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <div
                style={{
                  background: 'var(--m-paper-2)',
                  borderBottom: '1px solid var(--m-line)',
                  padding: '16px 18px',
                }}
              >
                <RoomMock kind={r.mock} />
              </div>
              <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span className="font-medium text-[var(--m-ink)]" style={{ fontSize: 15 }}>
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
                    color: 'var(--m-orange-2)',
                    borderTop: '1px solid var(--m-line-soft)',
                    marginTop: 12,
                  }}
                >
                  {r.ends}
                </p>
              </div>
            </div>
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
          Premium · when you're ready
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
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', flex: 1 }}
        >
          {PAID_FEATURES.map((f) => (
            <div
              key={f.name}
              className="m-card"
              style={{
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                border: '1px solid var(--m-line)',
                borderRadius: 14,
                background: 'var(--m-paper)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--m-paper-2)',
                    border: '1px solid var(--m-line)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    color: 'var(--m-mulberry)',
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  {f.icon}
                </span>
                <span
                  className="m-mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    color: 'var(--m-mulberry)',
                    background: 'color-mix(in srgb, var(--m-mulberry) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--m-mulberry) 24%, transparent)',
                    borderRadius: 999,
                    padding: '3px 8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.tag}
                </span>
              </div>
              <span className="font-semibold text-[var(--m-ink)]" style={{ fontSize: 14 }}>
                {f.name}
              </span>
              <p className="text-[var(--m-slate)]" style={{ fontSize: 13, lineHeight: 1.5 }}>
                {f.line}
              </p>
            </div>
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

// ─── Main export ───────────────────────────────────────────────────────────
export function FeaturesNarrative() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const sectionRef = useRef<HTMLDivElement>(null);

  const advance = () => {
    setVisible(false);
    setTimeout(() => {
      setStep((s) => s + 1);
      setVisible(true);
      requestAnimationFrame(() =>
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }, 260);
  };

  return (
    <div
      ref={sectionRef}
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

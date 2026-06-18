'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

/* ─────────────────────────────────────────────────────────
   Page detection
───────────────────────────────────────────────────────── */
type PageKey =
  | 'guests'
  | 'vendors'
  | 'budget'
  | 'schedule'
  | 'seating'
  | 'messages'
  | 'general';

function detectPage(): PageKey {
  if (typeof window === 'undefined') return 'general';
  const p = window.location.pathname;
  if (p.includes('/guests')) return 'guests';
  if (p.includes('/vendors')) return 'vendors';
  if (p.includes('/budget')) return 'budget';
  if (p.includes('/schedule')) return 'schedule';
  if (p.includes('/seating')) return 'seating';
  if (p.includes('/messages')) return 'messages';
  return 'general';
}

/* ─────────────────────────────────────────────────────────
   Content banks
───────────────────────────────────────────────────────── */
const WISDOM: Record<PageKey, string[]> = {
  general: [
    'Weddings with personalized details feel 3× more memorable to guests.',
    'The best vendors get booked 12–18 months in advance in Metro Manila.',
    'A clear wedding-day timeline prevents 90% of vendor conflicts.',
    'Telling your love story inspires vendors to go above and beyond.',
    'The average Filipino wedding has 250 guests — Setnayan handles all of them.',
  ],
  guests: [
    'Sending invites 8 weeks out doubles your RSVP response rate.',
    'Assigning seats reduces reception congestion by over 40%.',
    'QR-coded invites make it easier for guests to find parking and venues.',
    'Early RSVPs give your caterer time to lock in the best ingredients.',
    'Plus-one decisions are easiest when made before invites go out.',
  ],
  vendors: [
    'Couples who message vendors within 48 hours book 2× faster.',
    'Sharing your mood board helps vendors match your vision from day one.',
    'Asking for itemized quotes prevents budget surprises later.',
    'Reading reviews sorted by recency gives the most accurate picture.',
    'Locking your top vendors first frees you to be flexible on others.',
  ],
  budget: [
    'Venue + catering typically take 50% of the total wedding budget.',
    'A 10% contingency fund reduces wedding-day stress significantly.',
    'Couples who track milestones pay 25% fewer late fees.',
    'Food quality is the #1 thing guests remember from a reception.',
    'Getting 3 quotes per category saves an average of 15% on total spend.',
  ],
  schedule: [
    'Adding 15-minute buffers between events prevents domino delays.',
    'Vendors need your day-of timeline at least 1 week in advance.',
    'Church ceremonies in the Philippines typically run 60–90 minutes.',
    'The reception golden hour (7–8 PM) is when guests are most energetic.',
    'Printing the timeline for your coordinator saves countless phone calls.',
  ],
  seating: [
    'Mixing friend groups at tables sparks the best post-wedding stories.',
    'Round tables of 8–10 encourage conversation better than long tables.',
    'Placing elderly guests nearest to the exit is a quiet act of care.',
    'Sweetheart tables give couples a private moment amid the celebration.',
    'The best seat plans are finished at least 2 weeks before the wedding.',
  ],
  messages: [
    'Vendors who receive clear briefs deliver better results on time.',
    'Confirming logistics 3 days before the event prevents day-of confusion.',
    'A friendly message goes a long way — vendors are people too.',
    'Keeping all vendor conversations in one thread saves hours of searching.',
    'Thanking your vendors after the wedding opens doors for referrals.',
  ],
};

interface PickItem {
  prompt: string;
  a: string;
  b: string;
}
const PICKS: Record<PageKey, PickItem[]> = {
  general: [
    { prompt: 'For your big day, which matters more?', a: 'Stunning visuals', b: 'Warm atmosphere' },
    { prompt: 'Ceremony location preference?', a: 'Church wedding', b: 'Garden wedding' },
    { prompt: 'Reception vibe?', a: 'Intimate & elegant', b: 'Grand & festive' },
  ],
  guests: [
    { prompt: 'Guest list strategy?', a: 'Keep it intimate (≤100)', b: 'Go big (200+)' },
    { prompt: 'Seat assignments or free seating?', a: 'Assigned seats', b: 'Open seating' },
    { prompt: 'Kids at the reception?', a: 'Welcome all ages', b: 'Adults-only' },
  ],
  vendors: [
    { prompt: 'How do you pick a vendor?', a: 'Portfolio first', b: 'Reviews first' },
    { prompt: 'Vendor communication style?', a: 'Frequent updates', b: 'Only key milestones' },
    { prompt: 'When issues arise, you prefer vendors who…', a: 'Warn you early', b: 'Come with solutions' },
  ],
  budget: [
    { prompt: 'Splurge or save on florals?', a: 'Splurge — wow factor', b: 'Save — DIY touches' },
    { prompt: 'Food budget priority?', a: 'Full plated dinner', b: 'Grazing tables & stations' },
    { prompt: 'If you had to pick one: photo or video?', a: 'Photography', b: 'Videography' },
  ],
  schedule: [
    { prompt: 'Ceremony start time?', a: 'Morning (10 AM)', b: 'Afternoon (4 PM)' },
    { prompt: 'Reception length preference?', a: 'Keep it short (3 hrs)', b: 'Full evening (5+ hrs)' },
    { prompt: 'First dance: when?', a: 'Right after entrance', b: 'After dinner' },
  ],
  seating: [
    { prompt: 'Table style preference?', a: 'Round tables', b: 'Long banquet tables' },
    { prompt: 'Sweetheart table?', a: 'Yes — just us two', b: 'No — sit with family' },
    { prompt: 'Kids table?', a: 'Yes, separate', b: 'Seat with parents' },
  ],
  messages: [
    { prompt: 'Preferred vendor update cadence?', a: 'Daily check-ins', b: 'Only when there\'s news' },
    { prompt: 'If a vendor is slow to reply, you…', a: 'Follow up once', b: 'Wait patiently' },
    { prompt: 'Contract review style?', a: 'Read every clause', b: 'Trust and sign' },
  ],
};

/* ─────────────────────────────────────────────────────────
   Activity 1 — Tap Burst
───────────────────────────────────────────────────────── */
const BURST_COLORS = ['#C9A96E', '#6B2D5E', '#E8C99A', '#9B4F87', '#D4A574'];

interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  size: number;
}

function TapBurst() {
  const [taps, setTaps] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextId = useRef(0);

  const spawn = useCallback((x: number, y: number) => {
    const count = 10;
    const batch: Particle[] = Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const dist = 40 + Math.random() * 50;
      return {
        id: nextId.current++,
        x,
        y,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 20,
        color: BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)] ?? '#C9A96E',
        size: 6 + Math.floor(Math.random() * 6),
      };
    });
    setParticles(prev => [...prev.slice(-80), ...batch]);
    setTaps(t => t + 1);
    const ids = new Set(batch.map(p => p.id));
    setTimeout(() => setParticles(prev => prev.filter(p => !ids.has(p.id))), 700);
  }, []);

  const onPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    spawn(e.clientX - rect.left, e.clientY - rect.top);
  }, [spawn]);

  const label =
    taps === 0
      ? 'Tap anywhere while we load…'
      : taps < 5
      ? 'Keep going!'
      : taps < 15
      ? `${taps} taps! Nice rhythm!`
      : taps % 10 === 0
      ? `${taps} taps — you're on fire! 🔥`
      : `${taps} taps! Unstoppable!`;

  return (
    <>
      <style>{`
        @keyframes la-burst {
          0%   { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--la-dx, 0px), var(--la-dy, 0px)) scale(0); opacity: 0; }
        }
        .la-particle { animation: la-burst 0.65s cubic-bezier(0.2, 0.8, 0.4, 1) forwards; }
      `}</style>

      <div
        className="relative flex h-full w-full select-none items-center justify-center overflow-hidden"
        style={{ cursor: 'pointer' }}
        onPointerDown={onPointer}
      >
        {particles.map(p => (
          <div
            key={p.id}
            className="la-particle pointer-events-none absolute rounded-full"
            style={{
              left: p.x - p.size / 2,
              top: p.y - p.size / 2,
              width: p.size,
              height: p.size,
              background: p.color,
              '--la-dx': `${p.dx}px`,
              '--la-dy': `${p.dy}px`,
            } as CSSProperties}
          />
        ))}

        <div className="pointer-events-none z-10 text-center">
          <div
            className="text-7xl font-bold tabular-nums transition-transform duration-75"
            style={{ color: '#C9A96E', transform: taps > 0 ? 'scale(1.05)' : 'scale(1)' }}
          >
            {taps > 0 ? taps : '✦'}
          </div>
          <p className="mt-3 text-base font-medium" style={{ color: '#1E2229' }}>
            {label}
          </p>
          <p className="mt-1.5 text-xs opacity-40" style={{ color: '#1E2229' }}>
            Your wedding is loading…
          </p>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   Activity 2 — Wedding Wisdom
───────────────────────────────────────────────────────── */
function WisdomCard({ page }: { page: PageKey }) {
  const tips = WISDOM[page];
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  const advance = useCallback((to?: number) => {
    setVisible(false);
    setTimeout(() => {
      setIdx(i => to ?? (i + 1) % tips.length);
      setVisible(true);
    }, 200);
  }, [tips.length]);

  useEffect(() => {
    const t = setInterval(() => advance(), 5000);
    return () => clearInterval(t);
  }, [advance]);

  return (
    <div className="flex h-full w-full items-center justify-center px-8">
      <div className="max-w-md w-full text-center">
        <div className="text-4xl mb-6" style={{ color: '#C9A96E' }}>✦</div>
        <p
          className="text-lg font-medium leading-relaxed"
          style={{
            color: '#1E2229',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
        >
          {tips[idx]}
        </p>

        <button
          onClick={() => advance()}
          className="mt-7 text-xs font-semibold uppercase tracking-widest"
          style={{ color: '#1E2229', opacity: 0.35 }}
        >
          next tip →
        </button>

        <div className="mt-5 flex justify-center gap-2">
          {tips.map((_, i) => (
            <button
              key={i}
              onClick={() => advance(i)}
              className="rounded-full transition-all duration-200"
              style={{
                height: 6,
                width: i === idx ? 20 : 6,
                background: i === idx ? '#C9A96E' : '#1E2229',
                opacity: i === idx ? 1 : 0.18,
              }}
            />
          ))}
        </div>

        <p className="mt-6 text-xs opacity-30" style={{ color: '#1E2229' }}>
          Loading your Setnayan…
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Activity 3 — Quick Pick
───────────────────────────────────────────────────────── */
function QuickPick({ page }: { page: PageKey }) {
  const picks = PICKS[page];
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<'a' | 'b' | null>(null);
  const [count, setCount] = useState(0);

  const pick = useCallback(
    (choice: 'a' | 'b') => {
      if (chosen !== null) return;
      setChosen(choice);
      setCount(c => c + 1);
      setTimeout(() => {
        setChosen(null);
        setIdx(i => (i + 1) % picks.length);
      }, 850);
    },
    [chosen, picks.length],
  );

  const current = picks[idx];

  return (
    <div className="flex h-full w-full items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <p className="text-xs font-semibold uppercase tracking-widest mb-5 opacity-40" style={{ color: '#1E2229' }}>
          Quick preference
        </p>

        <p
          className="text-lg font-semibold leading-snug mb-7"
          style={{ color: '#1E2229' }}
        >
          {current.prompt}
        </p>

        <div className="grid grid-cols-2 gap-3">
          {(['a', 'b'] as const).map(opt => {
            const label = opt === 'a' ? current.a : current.b;
            const isChosen = chosen === opt;
            const isDimmed = chosen !== null && !isChosen;
            return (
              <button
                key={opt}
                onClick={() => pick(opt)}
                className="rounded-2xl border-2 px-4 py-5 text-sm font-medium text-left transition-all duration-200"
                style={{
                  borderColor: isChosen ? '#C9A96E' : 'rgba(30,34,41,0.15)',
                  background: isChosen ? '#C9A96E' : 'transparent',
                  color: isChosen ? '#F8F5F0' : '#1E2229',
                  opacity: isDimmed ? 0.25 : 1,
                  transform: isChosen ? 'scale(1.03)' : 'scale(1)',
                }}
              >
                <span className="block text-xs opacity-50 mb-1.5">{opt.toUpperCase()}</span>
                {label}
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-xs opacity-30" style={{ color: '#1E2229' }}>
          {count === 0
            ? 'Just for fun · loading your Setnayan…'
            : `${count} preference${count > 1 ? 's' : ''} noted · loading your Setnayan…`}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main export
───────────────────────────────────────────────────────── */
export function LoadingActivity() {
  const [activity, setActivity] = useState<-1 | 0 | 1 | 2>(-1);
  const [page, setPage] = useState<PageKey>('general');

  useEffect(() => {
    setActivity(Math.floor(Math.random() * 3) as 0 | 1 | 2);
    setPage(detectPage());
  }, []);

  if (activity === -1) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(248, 245, 240, 0.94)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      {activity === 0 && <TapBurst />}
      {activity === 1 && <WisdomCard page={page} />}
      {activity === 2 && <QuickPick page={page} />}
    </div>
  );
}

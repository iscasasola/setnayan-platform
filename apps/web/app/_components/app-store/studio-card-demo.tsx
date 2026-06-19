'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Play, Pause, Users, Check } from 'lucide-react';

// On-card demo engine — the auto-playing "what it does + how to operate it"
// preview that plays when a couple opens a Studio app card. Two frame sources,
// in priority order:
//   1. RICH_SCENES[slug] — high-fidelity native frames built from the REAL
//      Setnayan UI (so they look exactly like the app, no screenshots/data
//      needed). This is what ships for flagship features today.
//   2. `frames` (DemoFrame[]) — a real app screenshot (`image`) or a tint
//      fallback, for features whose literal screenshots are captured later.
// Either way: a result caption ("what it does") + an operation hint ("how to
// operate it"), auto-advancing, play/pause + step dots. One engine, every card.

export type DemoFrame = {
  /** What it does — the result line above the frame. */
  caption: string;
  /** How to operate it — the small hint under the caption. */
  hint?: string;
  /** Real app screenshot URL (preferred). Falls back to a tint when absent. */
  image?: string;
  /** Fallback frame tint (CSS color) when no screenshot yet. */
  accent?: string;
};

type RichFrame = { caption: string; hint?: string; scene: ReactNode };

const ADVANCE_MS = 3000;

// Warm, varied tints standing in for candid photos inside the mockup chrome.
const TILE = ['#F0997B', '#5DCAA5', '#AFA9EC', '#FAC775', '#ED93B1', '#85B7EB'];
function tiles(n: number) {
  return Array.from({ length: n }, (_, k) => (
    <span
      key={k}
      className="block aspect-square rounded-md"
      style={{ background: TILE[k % TILE.length] }}
    />
  ));
}

// ── Papic — four real-UI scenes (camera · gallery · auto-tag · photos of you) ──
const PAPIC_SCENES: RichFrame[] = [
  {
    caption: 'A friend’s phone becomes a candid camera.',
    hint: 'Tap to shoot — no app to install.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-ink text-cream">
        <div className="flex items-center justify-between px-3 py-2.5 text-[10px] text-cream/70">
          <span className="font-mono tracking-[0.12em]">PAPIC · SEAT 2</span>
          <span className="rounded-full bg-cream/10 px-2 py-0.5">3 / 8</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center text-cream/40">
            <Users aria-hidden className="mx-auto h-9 w-9 text-cream/30" strokeWidth={1.5} />
            <p className="mt-1.5 text-[11px]">the first dance</p>
          </div>
        </div>
        <div className="flex justify-center pb-7 pt-3">
          <span className="h-14 w-14 rounded-full border-4 border-cream" />
        </div>
      </div>
    ),
  },
  {
    caption: 'Every shot lands in your gallery, instantly.',
    hint: 'You never lift a finger — it just fills up.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream text-ink">
        <div className="px-3 pb-2 pt-3 text-[12px] font-semibold">Your gallery</div>
        <div className="flex flex-wrap gap-1 px-3">
          <span className="rounded-full bg-terracotta px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-cream">All</span>
          <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-ink/55">Photos of us</span>
          <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-ink/55">Videos</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 px-3">{tiles(9)}</div>
      </div>
    ),
  },
  {
    caption: 'The right people are found automatically.',
    hint: 'Or scan a guest’s QR to tag — no typing.',
    scene: (
      <div className="absolute inset-0 flex items-center justify-center bg-ink p-4">
        <div className="relative aspect-[3/4] w-[150px] overflow-hidden rounded-lg" style={{ background: '#F0997B' }}>
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-1 ring-white/70" />
          <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white">
            <Check aria-hidden className="h-3 w-3" strokeWidth={2.5} /> Maya
          </span>
        </div>
      </div>
    ),
  },
  {
    caption: 'Each guest finds the photos they’re in.',
    hint: '“Photos of you” fills through the day — theirs to keep.',
    scene: (
      <div className="absolute inset-0 flex flex-col bg-cream text-ink">
        <div className="flex items-center justify-between px-3 pt-3">
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-terracotta">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Photos of you
          </span>
          <span className="text-[10px] text-ink/55">12 tagged</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 px-3">{tiles(6)}</div>
      </div>
    ),
  },
];

const RICH_SCENES: Record<string, RichFrame[]> = { papic: PAPIC_SCENES };

export function StudioCardDemo({
  frames,
  slug,
  label = 'How it works',
}: {
  frames: DemoFrame[];
  /** Studio feature slug — enables high-fidelity native scenes when registered. */
  slug?: string;
  label?: string;
}) {
  const rich = slug ? RICH_SCENES[slug] : undefined;
  const useRich = Boolean(rich && rich.length > 0);
  const count = useRich ? rich!.length : frames.length;

  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || count < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % count), ADVANCE_MS);
    return () => clearInterval(t);
  }, [playing, count]);

  if (count === 0) return null;
  const idx = Math.min(i, count - 1);
  const richF = useRich ? rich![idx] : undefined;
  const dataF = useRich ? undefined : frames[idx];
  const caption = richF?.caption ?? dataF?.caption ?? '';
  const hint = richF?.hint ?? dataF?.hint;

  return (
    <figure className="m-0 flex flex-col items-center gap-4 rounded-2xl border border-ink/10 bg-cream/60 p-6 sm:p-8">
      <figcaption className="min-h-[52px] text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-terracotta">{label}</p>
        <p className="mt-1 text-base font-semibold tracking-tight text-ink">{caption}</p>
        {hint ? <p className="mt-1 text-xs text-ink/60">{hint}</p> : null}
      </figcaption>

      <div className="w-[244px] overflow-hidden rounded-[30px] border-[7px] border-ink bg-ink">
        <div key={idx} className="relative aspect-[9/19] w-full bg-ink animate-[studioDemoFade_.32s_ease]">
          {richF ? (
            richF.scene
          ) : dataF?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataF.image} alt={caption} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div
              aria-hidden
              className="flex h-full w-full items-center justify-center"
              style={{ background: dataF?.accent ?? '#1f1f22' }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cream/45">preview</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause demo' : 'Play demo'}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/70 transition hover:bg-ink/10"
        >
          {playing ? (
            <Pause aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <Play aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>
        <ul className="flex items-center gap-2" aria-label="Demo steps">
          {Array.from({ length: count }, (_, k) => (
            <li key={k}>
              <button
                type="button"
                onClick={() => setI(k)}
                aria-label={`Step ${k + 1}`}
                aria-current={k === idx}
                className={`h-2 w-2 rounded-full transition ${k === idx ? 'bg-ink' : 'bg-ink/25 hover:bg-ink/40'}`}
              />
            </li>
          ))}
        </ul>
      </div>

      <style>{`@keyframes studioDemoFade{from{opacity:.35}to{opacity:1}}`}</style>
    </figure>
  );
}

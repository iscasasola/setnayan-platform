'use client';

import { useEffect, useState } from 'react';
import { Play, Pause } from 'lucide-react';

// On-card demo engine — the auto-playing "here's what it does + how to operate
// it" preview that plays when a couple opens a Studio app card. Format-agnostic:
// each frame shows a real app SCREENSHOT (preferred) or a styled fallback, with
// a result caption ("what it does") + an operation hint ("how to operate it").
// Auto-advances, loops, with play/pause + step dots. One engine, every card.
//
// Frames carry an optional `image` (a hosted screenshot URL). Until a feature's
// real screenshots are captured, the fallback tint keeps the card on-brand and
// the motion intact — swap in `image` per frame with zero component change.

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

const ADVANCE_MS = 2900;

export function StudioCardDemo({
  frames,
  label = 'How it works',
}: {
  frames: DemoFrame[];
  label?: string;
}) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % frames.length), ADVANCE_MS);
    return () => clearInterval(t);
  }, [playing, frames.length]);

  if (frames.length === 0) return null;
  const f = frames[Math.min(i, frames.length - 1)];
  if (!f) return null;

  return (
    <figure className="m-0 flex flex-col items-center gap-4 rounded-2xl border border-ink/10 bg-cream/60 p-6 sm:p-8">
      <figcaption className="min-h-[52px] text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-terracotta">
          {label}
        </p>
        <p className="mt-1 text-base font-semibold tracking-tight text-ink">{f.caption}</p>
        {f.hint ? <p className="mt-1 text-xs text-ink/60">{f.hint}</p> : null}
      </figcaption>

      {/* Phone frame — the screenshot (or fallback) plays inside. */}
      <div className="w-[244px] overflow-hidden rounded-[30px] border-[7px] border-ink bg-ink">
        <div
          key={i}
          className="relative aspect-[9/19] w-full bg-ink animate-[studioDemoFade_.32s_ease]"
        >
          {f.image ? (
            // Real app screenshot. Plain img keeps these static assets out of the
            // optimizer/domain allowlist; they're already sized for the frame.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={f.image}
              alt={f.caption}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-full w-full items-center justify-center"
              style={{ background: f.accent ?? '#1f1f22' }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cream/45">
                preview
              </span>
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
          {frames.map((_, k) => (
            <li key={k}>
              <button
                type="button"
                onClick={() => setI(k)}
                aria-label={`Step ${k + 1}`}
                aria-current={k === i}
                className={`h-2 w-2 rounded-full transition ${k === i ? 'bg-ink' : 'bg-ink/25 hover:bg-ink/40'}`}
              />
            </li>
          ))}
        </ul>
      </div>

      <style>{`@keyframes studioDemoFade{from{opacity:.35}to{opacity:1}}`}</style>
    </figure>
  );
}

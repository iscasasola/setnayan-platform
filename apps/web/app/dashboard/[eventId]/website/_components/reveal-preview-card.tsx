'use client';

/**
 * "Opening reveal" card for the website editor (the couple's studio).
 *
 * Lets the couple PREVIEW how their wedding page opens — the envelope or the
 * bridal veil — without needing a published slug or production URL gymnastics.
 * Clicking a Preview plays the reveal full-screen over a sample of their own
 * Save-the-Date card; lifting/opening it uncovers the card, then Replay / Close.
 *
 * Reuses the exact reveal components that render on the live `[slug]` page, so
 * what they preview here is what guests get. three.js (the veil) is lazy-loaded.
 */

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { RotateCcw, Sparkles, X } from 'lucide-react';
import { FourFlapEnvelope } from '@/app/[slug]/_components/reveal/four-flap';

const VeilReveal = dynamic(() => import('@/app/[slug]/_components/reveal/veil-reveal'), {
  ssr: false,
});

type Tpl = 'veil' | 'four-flap';

function monogram(name: string): string {
  const p = name
    .split(/\s*&\s*|\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const a = p[0] ?? '';
  const b = p[1] ?? '';
  if (a && b) return `${a.charAt(0)} & ${b.charAt(0)}`.toUpperCase();
  return (name.trim().charAt(0) || '✦').toUpperCase();
}

type Props = {
  displayName: string;
  dateIso: string | null;
  /** Veil tulle colour — Mood-Board driven (ivory fallback). */
  veilColor?: string;
};

export function RevealPreviewCard({ displayName, dateIso, veilColor = '#f3ece1' }: Props) {
  const [tpl, setTpl] = useState<Tpl | null>(null);
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const mono = monogram(displayName || 'A & J');
  const dateLabel = dateIso
    ? new Date(dateIso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const launch = (t: Tpl) => {
    setTpl(t);
    setOpen(false);
    setRevealed(false);
  };
  const close = () => {
    setTpl(null);
    setOpen(false);
    setRevealed(false);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-ink/10 bg-white/70">
      <div className="space-y-4 p-6 sm:p-8">
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Opening reveal
          </p>
          <h2 className="font-serif text-xl italic">How your page opens</h2>
          <p className="max-w-prose text-sm text-ink/70">
            When a guest opens your invitation it begins with a reveal that uncovers your Save the
            Date. Preview the options — they recolour to your Mood Board.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => launch('veil')}
            className="inline-flex h-11 min-h-[44pt] items-center justify-center gap-2 rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry"
          >
            Preview the veil
          </button>
          <button
            type="button"
            onClick={() => launch('four-flap')}
            className="inline-flex h-11 min-h-[44pt] items-center justify-center gap-2 rounded-md border border-ink/20 bg-cream px-4 text-sm font-medium text-ink transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Preview the envelope
          </button>
        </div>
      </div>

      {tpl ? (
        <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
          {/* The Save-the-Date card beneath the reveal. */}
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(120%_100%_at_50%_38%,#2a221c_0%,#14110f_72%)] p-6">
            <div className="rounded-2xl border border-[#cb9e4b]/40 bg-[#e8ddc6] px-8 py-12 text-center shadow-2xl sm:px-12 sm:py-16">
              <p className="font-mono text-[11px] tracking-[0.28em] text-[#b8923f]">SAVE THE DATE</p>
              <p className="my-3 font-serif text-5xl italic text-[#cb9e4b] sm:text-6xl">{mono}</p>
              <p className="font-serif text-lg text-[#3a322a]">{displayName || 'Your names'}</p>
              {dateLabel ? <p className="mt-1 text-sm text-[#6b5a3f]">{dateLabel}</p> : null}
            </div>
          </div>

          {/* The reveal itself. */}
          {!revealed ? (
            tpl === 'veil' ? (
              <VeilReveal veilColor={veilColor} onRevealed={() => setRevealed(true)} />
            ) : (
              <FourFlapEnvelope
                monogram={mono}
                open={open}
                onOpen={() => {
                  setOpen(true);
                  window.setTimeout(() => setRevealed(true), 1200);
                }}
              />
            )
          ) : null}

          {tpl === 'veil' && !revealed ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-10 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cream/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">
                Lift the veil ↑
              </p>
            </div>
          ) : null}

          <div className="absolute right-4 top-4 flex gap-2">
            {revealed ? (
              <button
                type="button"
                onClick={() => launch(tpl)}
                aria-label="Replay"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
              >
                <RotateCcw aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={close}
              aria-label="Close preview"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
            >
              <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

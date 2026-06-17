'use client';

/**
 * "Opening reveal" card for the website editor (the couple's studio).
 *
 * Lets the couple PREVIEW how their wedding page opens — any of the reveal
 * library templates (envelopes · church doors · bridal veils) — without needing
 * a published slug or production URL gymnastics. Clicking a template plays the
 * reveal full-screen over a sample of their own Save-the-Date card: rigid
 * templates show the couple's monogram wax seal (swipe it off, then scroll to
 * open); veils lift on drag/scroll. Then Replay / Close.
 *
 * Reuses the exact reveal components that render on the live `[slug]` page, so
 * what they preview here is what guests get. three.js (the veils) is lazy-loaded.
 */

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Sparkles, X } from 'lucide-react';
import { FourFlapEnvelope } from '@/app/[slug]/_components/reveal/four-flap';
import { RigidReveal } from '@/app/[slug]/_components/reveal/rigid-reveal';
import {
  isVeilTemplate,
  REVEAL_LIBRARY,
  RIGID_REVEAL_MS,
  type RevealTemplate,
} from '@/app/[slug]/_components/reveal/reveal-templates';
import type { WaxSealConfig } from '@/lib/wax-seal/types';

const VeilReveal = dynamic(() => import('@/app/[slug]/_components/reveal/veil-reveal'), {
  ssr: false,
});
const VeilCrown = dynamic(() => import('@/app/[slug]/_components/reveal/veil-crown'), {
  ssr: false,
});

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
  /** The couple's monogram SVG markup — pressed into the wax seal. */
  markSvg?: string | null;
  /** Wax seal colour — Mood-Board deep accent (mulberry fallback). */
  waxColor?: string;
  /** The minted wax-seal recipe (candle-stamp maker). Null → default levers. */
  sealConfig?: WaxSealConfig | null;
  /** Stable seed for an un-minted seal (public_id-derived). */
  sealFallbackSeed?: number;
  /** Veil tulle colour — Mood-Board driven (ivory fallback). */
  veilColor?: string;
};

export function RevealPreviewCard({
  displayName,
  dateIso,
  markSvg = null,
  waxColor = '#5c2542',
  sealConfig = null,
  sealFallbackSeed,
  veilColor = '#f3ece1',
}: Props) {
  const [tpl, setTpl] = useState<RevealTemplate | null>(null);
  const [revealed, setRevealed] = useState(false);
  // The rigid fold-beat timer. Tracked so we can cancel it whenever the user
  // closes, replays, or switches template — otherwise a stale setRevealed(true)
  // fires later and unmounts a freshly-mounted veil mid-lift.
  const foldTimer = useRef<number | null>(null);
  const clearFoldTimer = () => {
    if (foldTimer.current !== null) {
      window.clearTimeout(foldTimer.current);
      foldTimer.current = null;
    }
  };
  useEffect(() => clearFoldTimer, []);

  const mono = monogram(displayName || 'A & J');
  const dateLabel = dateIso
    ? new Date(dateIso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const launch = (t: RevealTemplate) => {
    clearFoldTimer();
    setTpl(t);
    setRevealed(false);
  };
  const close = () => {
    clearFoldTimer();
    setTpl(null);
    setRevealed(false);
  };

  // Render the live reveal component for a template. Veils lift/fold themselves
  // clear (drag-driven → onRevealed); rigid templates gate on a seal-swipe then
  // scrub open with scroll, firing onOpened when fully clear (RigidStage).
  const renderReveal = (t: RevealTemplate) => {
    if (isVeilTemplate(t)) {
      const Veil = t === 'veil-crown' ? VeilCrown : VeilReveal;
      return <Veil veilColor={veilColor} onRevealed={() => setRevealed(true)} />;
    }
    if (t === 'two-flap-vertical' || t === 'two-flap-horizontal' || t === 'church-doors') {
      return (
        <RigidReveal
          variant={t}
          markSvg={markSvg}
          monogram={mono}
          waxColor={waxColor}
          config={sealConfig}
          fallbackSeed={sealFallbackSeed}
          onOpened={() => setRevealed(true)}
        />
      );
    }
    return (
      <FourFlapEnvelope
        markSvg={markSvg}
        monogram={mono}
        waxColor={waxColor}
        config={sealConfig}
        fallbackSeed={sealFallbackSeed}
        onOpened={() => setRevealed(true)}
      />
    );
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
            Date. Preview the openings — they recolour to your Mood Board.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {REVEAL_LIBRARY.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => launch(t.id)}
              className={`inline-flex min-h-[44pt] items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                t.family === 'veil'
                  ? 'bg-mulberry text-cream hover:bg-mulberry-600 focus-visible:outline-mulberry'
                  : 'border border-ink/20 bg-cream text-ink hover:border-ink/40 focus-visible:outline-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
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
          {!revealed ? renderReveal(tpl) : null}

          {isVeilTemplate(tpl) && !revealed ? (
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

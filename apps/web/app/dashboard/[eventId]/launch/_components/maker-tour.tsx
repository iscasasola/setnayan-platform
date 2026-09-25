'use client';

import { useRef, useState, useTransition } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import type { TourKey } from '@/lib/tours';
import { useModalA11y } from '@/lib/use-modal-a11y';
/* 🔴 The key and the slide filter live in `maker-bar.ts`, NOT here. This file is
   `'use client'`, and a server page that imports a CONSTANT from it gets a
   client reference, not the string — measured: `tour_seen_keys.includes(KEY)`
   was false for a couple who had finished the tour, so it replayed forever. */
import { MAKER_TOUR_KEY, makerTourSlides } from './maker-bar';

/**
 * THE EVENT HUB MAKER'S WELCOME — its own skin on the shared tour system.
 *
 * The SYSTEM is reused, not re-invented: slides live in `lib/tours.ts`, a first
 * visit is decided by `users.tour_seen_keys` on the server, and finishing calls
 * the shipped `completeTour` action. What is new is the skin the brief asks for
 * — no bordered card: glass + shadow, `--sn-*` motion — and two behaviours the
 * generic `GuidedTour` does not have:
 *
 *   · the last button is **Start**, and it lands the couple on the theme panel
 *     (`onStart`), because "pick a theme" is the first thing the tour tells them;
 *   · the ⓘ in the toolbar reopens it with `record = false`, so a re-read never
 *     writes `tour_seen_keys` a second time.
 */
export function MakerTour({
  storeShell,
  priceLabel,
  record,
  completeAction,
  onClose,
  onStart,
}: {
  storeShell: boolean;
  priceLabel: string | null;
  /** First visit: finishing or skipping records the tour as seen. */
  record: boolean;
  completeAction: (tourKey: TourKey) => Promise<void>;
  onClose: () => void;
  onStart: () => void;
}) {
  const [step, setStep] = useState(0);
  const [, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const slides = makerTourSlides({ storeShell, priceLabel });

  const finish = (start: boolean) => {
    if (record) {
      startTransition(async () => {
        await completeAction(MAKER_TOUR_KEY);
      });
    }
    if (start) onStart();
    else onClose();
  };

  useModalA11y({ open: true, onClose: () => finish(false), containerRef: dialogRef });

  const current = slides[step];
  if (!current) return null;
  const isLast = step === slides.length - 1;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="maker-tour-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm focus:outline-none"
    >
      <div className="sn-glass-bare relative w-full max-w-md overflow-hidden rounded-3xl">
        <button
          type="button"
          onClick={() => finish(false)}
          aria-label="Skip the tour"
          className="sn-press absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-ink/60 transition-colors duration-sn-control ease-sn hover:bg-ink/10 hover:text-ink"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>

        <div key={step} className="space-y-4 p-6 motion-safe:animate-[sn-peek-in_var(--sn-dur-elem)_var(--sn-ease)_backwards] sm:p-8">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
            <current.Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">
              Event Hub Maker · {step + 1} of {slides.length}
            </p>
            <h2 id="maker-tour-title" className="font-serif text-2xl leading-tight tracking-tight text-ink">
              {current.title}
            </h2>
            <p className="text-[15px] leading-relaxed text-ink/75" dangerouslySetInnerHTML={{ __html: current.body }} />
          </div>

          <div className="flex gap-1.5" aria-hidden>
            {slides.map((s, i) => (
              <span
                key={s.title}
                className={`h-1.5 rounded-full transition-all duration-sn-elem ease-sn ${
                  i === step ? 'w-6 bg-terracotta' : 'w-1.5 bg-ink/20'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full px-4 text-sm font-medium text-ink/70 hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
              Back
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={() => finish(true)}
                className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full bg-ink px-6 text-sm font-semibold text-cream hover:bg-ink/90"
              >
                Start
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(slides.length - 1, s + 1))}
                className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full bg-ink px-5 text-sm font-semibold text-cream hover:bg-ink/90"
              >
                Next
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

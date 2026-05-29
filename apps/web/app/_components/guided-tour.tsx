'use client';

import { useState, useTransition } from 'react';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { TOURS, type TourKey } from '@/lib/tours';

type Props = {
  tourKey: TourKey;
  // Server action invoked when the user finishes or skips the tour. The key
  // is passed back so the action can append to `users.tour_seen_keys`.
  completeAction: (tourKey: TourKey) => Promise<void>;
};

// Slides are looked up here (client side) rather than passed in as a prop.
// Each slide carries a Lucide `Icon` (a function reference), and Next 15 /
// React 19 refuses to serialize function-typed props across the server →
// client boundary — so passing `slides` from a server-component layout
// would crash with "Functions cannot be passed directly to Client
// Components". Reading TOURS in the client keeps the function refs
// entirely client-side.
export function GuidedTour({ tourKey, completeAction }: Props) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();

  const slides = TOURS[tourKey].slides;

  if (!open) return null;

  const current = slides[step];
  if (!current) return null;
  const isLast = step === slides.length - 1;

  const dismiss = (): void => {
    setOpen(false);
    startTransition(async () => {
      await completeAction(tourKey);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guided-tour-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-ink/10 bg-cream shadow-[0_30px_80px_-40px_rgba(26,26,26,0.5)]">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Skip tour"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/55 hover:bg-ink/10 hover:text-ink"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="space-y-4 p-6 sm:p-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
            <current.Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
          </div>

          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-terracotta">
              Step {step + 1} of {slides.length}
            </p>
            <h2 id="guided-tour-title" className="text-2xl font-semibold tracking-tight">
              {current.title}
            </h2>
            <p
              className="text-sm text-ink/70"
              dangerouslySetInnerHTML={{ __html: current.body }}
            />
          </div>

          <div className="flex h-1 w-full overflow-hidden rounded-full bg-ink/10">
            <span
              className="block h-full rounded-full bg-terracotta transition-all"
              style={{ width: `${((step + 1) / slides.length) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-ink/65 hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
              Back
            </button>
            <div className="flex items-center gap-2">
              {!isLast ? (
                <button
                  type="button"
                  onClick={dismiss}
                  className="text-xs text-ink/55 hover:text-ink"
                >
                  Skip
                </button>
              ) : null}
              {isLast ? (
                <button
                  type="button"
                  onClick={dismiss}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md bg-mulberry px-4 py-1.5 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Got it
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(slides.length - 1, s + 1))}
                  className="inline-flex items-center gap-1 rounded-md bg-mulberry px-4 py-1.5 text-sm font-medium text-cream hover:bg-mulberry-600"
                >
                  Next
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

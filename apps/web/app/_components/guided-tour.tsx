'use client';

import { useRef, useState, useTransition } from 'react';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { TOURS, type TourKey } from '@/lib/tours';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { InfoTip } from './info-tip';

type Props = {
  tourKey: TourKey;
  // Server action invoked when the user finishes or skips the tour. The key
  // is passed back so the action can append to `users.tour_seen_keys`.
  completeAction: (tourKey: TourKey) => Promise<void>;
  /** In the app-store shell a slide marked `sells` is dropped (App Review 3.1.1). */
  storeShell?: boolean;
};

// Slides are looked up here (client side) rather than passed in as a prop.
// Each slide carries a Lucide `Icon` (a function reference), and Next 15 /
// React 19 refuses to serialize function-typed props across the server →
// client boundary — so passing `slides` from a server-component layout
// would crash with "Functions cannot be passed directly to Client
// Components". Reading TOURS in the client keeps the function refs
// entirely client-side.
export function GuidedTour({ tourKey, completeAction, storeShell = false }: Props) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  const slides = TOURS[tourKey].slides.filter((s) => !(storeShell && s.sells));

  const dismiss = (): void => {
    setOpen(false);
    startTransition(async () => {
      await completeAction(tourKey);
    });
  };

  // Focus-in/trap/restore + Esc-to-close + scroll-lock. The tour is a centered
  // modal card — the user only acts on its own Back/Next/Skip buttons — so a
  // focus trap is the right behavior.
  useModalA11y({ open, onClose: dismiss, containerRef: dialogRef });

  if (!open) return null;

  const current = slides[step];
  if (!current) return null;
  const isLast = step === slides.length - 1;
  const tour = TOURS[tourKey];

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guided-tour-title"
      /* Centred on every size (owner, 2026-09-18). It was a bottom sheet on
         phones — the standard thumb-reach placement — and that is exactly
         where the `.sn-page-enter` transform bug hid it: the backdrop was
         sized to the DOCUMENT, so "the bottom" was 1300px below the fold and
         the card surfaced behind the bottom nav. #5582 fixes the sizing; the
         owner asked for centre regardless, so centre it is. */
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm focus:outline-none"
    >
      {/* House style (2026-09-25 · Maker Phase 11): no bordered card — this is
          `.sn-glass-bare` (borderless glass, seated by `--sn-sh-float`
          instead of a hairline) + shadow, the same skin `maker-tour.tsx`
          wears. Slide contracts (`lib/tours.ts`) are untouched — only the
          chrome around them moved. */}
      {/* No `overflow-hidden` here (unlike `maker-tour.tsx`'s otherwise-identical
          shell): the InfoTip popover below is `position: absolute` off its
          trigger, not a portal, and this card has no edge-bleeding content
          that needs clipping. */}
      <div className="sn-glass-bare relative w-full max-w-md rounded-3xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Skip tour"
          className="sn-press absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-ink/60 transition-colors duration-sn-control ease-sn hover:bg-ink/10 hover:text-ink"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>

        <div
          key={step}
          className="space-y-4 p-6 motion-safe:animate-[sn-peek-in_var(--sn-dur-elem)_var(--sn-ease)_backwards] sm:p-8"
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
            <current.Icon aria-hidden className="h-6 w-6" strokeWidth={1.75} />
          </span>

          <div className="space-y-2">
            {/* InfoTip for detail (design brief §2): the step count is the
                visible micro-label; what this tour is FOR (`tour.blurb`,
                already authored in lib/tours.ts and never rendered before
                now) sits behind the `(i)` instead of a second always-on
                line. */}
            <InfoTip
              label={`Step ${step + 1} of ${slides.length}`}
              labelClassName="font-mono text-[10px] uppercase tracking-[0.25em] text-terracotta"
              ariaLabel={`About ${tour.label}`}
              align="start"
            >
              {tour.blurb}
            </InfoTip>
            <h2 id="guided-tour-title" className="font-serif text-2xl leading-tight tracking-tight text-ink">
              {current.title}
            </h2>
            <p
              className="text-[15px] leading-relaxed text-ink/75"
              dangerouslySetInnerHTML={{ __html: current.body }}
            />
          </div>

          <div className="flex gap-1.5" aria-hidden>
            {slides.map((_, i) => (
              <span
                key={i}
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
              className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full px-4 text-sm font-medium text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Back
            </button>
            <div className="flex items-center gap-3">
              {!isLast ? (
                <button
                  type="button"
                  onClick={dismiss}
                  className="sn-press text-xs text-ink/55 transition-colors duration-sn-control ease-sn hover:text-ink"
                >
                  Skip
                </button>
              ) : null}
              {isLast ? (
                <button
                  type="button"
                  onClick={dismiss}
                  disabled={pending}
                  className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full bg-mulberry px-5 text-sm font-semibold text-cream transition-colors duration-sn-control ease-sn hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Got it
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(slides.length - 1, s + 1))}
                  className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full bg-mulberry px-5 text-sm font-semibold text-cream transition-colors duration-sn-control ease-sn hover:bg-mulberry-600"
                >
                  Next
                  <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';

// Reusable mobile-first sheet primitive. Slides up from the bottom on
// small screens (single-thumb reach) and docks as a right-side drawer on
// `lg:` and above. Same accessibility contract as the existing
// `app-store/choose-plan-sheet.tsx` — extracted so future sheets don't
// re-implement backdrop / focus trap / ESC handler / scroll lock from
// scratch.
//
// Layout breakpoints:
//   - phone/tablet (< 1024): full-width bottom sheet, rounded top corners,
//     max 90vh, respects `env(safe-area-inset-bottom)` so the bottom of
//     the sheet sits above the home indicator on notched iPhones.
//   - lg+ (>= 1024): right-docked drawer, full height, rounded left corners
//     (mobile pattern → desktop pattern per the "platform-appropriate
//     patterns" responsive memory).
//
// 🚨 THE DOCK POINT WAS `sm:` (640) AND THE APP DISAGREES WITH IT AT `lg:`
// (1024). `bottom-nav.tsx` is `lg:hidden` — the phone bar is on screen right up
// to 1023px. So between 640 and 1023 this app rendered its PHONE chrome and a
// DESKTOP side drawer at the same time: a floating bottom pill under a half-
// width panel pinned to the right edge. That band is every tablet, a large
// phone in landscape, a foldable, and any browser window that is not maximised.
// The owner hit it opening the Papic uploader and said the screen looked
// unfinished. It was not a styling accident — it was two components answering
// "is this a phone?" with two different numbers.
//
// 🔑 ONE APP, ONE ANSWER. The breakpoint is now the same line the navigation
// already draws. If that line ever moves, both must move together.
//
// Accessibility (all via the shared `useModalA11y` primitive):
//   - role="dialog" + aria-modal="true"
//   - aria-labelledby points at a heading the consumer renders
//   - ESC key closes the sheet (composes `useEscapeKey`)
//   - focus moves into the sheet on open, Tab is trapped inside it, and
//     focus is restored to the trigger on close
//   - body scroll locked while open (no background scrolling under
//     the sheet)
//   - backdrop click closes
//   - close-button is always rendered with a 40×40px hit target
//
// NOT handled here (consumer's responsibility):
//   - the heading element itself — consumer renders it so it can
//     style/translate freely. Pass the heading's `id` via
//     `labelledById`.

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  /** ID of the heading element inside `children`. Required by AT. */
  labelledById: string;
  /**
   * Optional brand strip rendered above the sheet body. When provided,
   * the close button sits next to it. When omitted, the close button
   * floats in the top-right of the sheet body.
   */
  title?: string;
  /**
   * Widen the lg+ drawer from 22rem to ~34rem. For sheets whose body is a
   * SETTINGS SURFACE rather than a single decision — long RTMP URLs, two-column
   * forms, a channel list with per-row controls — 22rem wraps every control onto
   * its own line and turns setup into scrolling. Default false: every existing
   * caller renders byte-identically.
   */
  wide?: boolean;
  children: ReactNode;
};

export function Sheet({
  open,
  onClose,
  labelledById,
  title,
  wide = false,
  children,
}: SheetProps) {
  // Esc-to-close + body-scroll-lock + focus management (focus-in, Tab trap,
  // restore on close) via the shared primitive.
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose, containerRef: dialogRef });

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledById}
      className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center lg:items-stretch lg:justify-end focus:outline-none"
    >
      {/* Backdrop — clicking dismisses. Rendered as a button so keyboard
          users get a focusable affordance, not just a div with onClick. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />

      {/* Sheet body */}
      <div
        className={`relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl border border-ink/10 bg-cream shadow-[0_-30px_80px_-40px_rgba(26,26,26,0.4)] lg:h-full lg:max-h-none lg:rounded-l-3xl lg:rounded-tr-none lg:shadow-[-30px_0_80px_-40px_rgba(26,26,26,0.4)] ${
          wide ? 'lg:w-[min(34rem,92vw)]' : 'lg:w-[22rem]'
        }`}
      >
        {title ? (
          <header className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-3">
            <p
              id={labelledById}
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta"
            >
              {title}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink/55 hover:bg-ink/5 hover:text-ink"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
          </header>
        ) : (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-cream/80 text-ink/55 backdrop-blur hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
        <div className="flex-1 overflow-y-auto pb-[max(env(safe-area-inset-bottom),16px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

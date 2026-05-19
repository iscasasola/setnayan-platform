'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

// Reusable mobile-first sheet primitive. Slides up from the bottom on
// small screens (single-thumb reach) and docks as a right-side drawer on
// `sm:` and above. Same accessibility contract as the existing
// `app-store/choose-plan-sheet.tsx` — extracted so future sheets don't
// re-implement backdrop / focus trap / ESC handler / scroll lock from
// scratch.
//
// Layout breakpoints:
//   - mobile (< 640): full-width bottom sheet, rounded top corners,
//     max 90vh, respects `env(safe-area-inset-bottom)` so the bottom of
//     the sheet sits above the home indicator on notched iPhones.
//   - sm+ (>= 640): right-docked drawer, full height, ~22rem wide,
//     rounded left corners (mobile pattern → desktop pattern per the
//     "platform-appropriate patterns" responsive memory).
//
// Accessibility:
//   - role="dialog" + aria-modal="true"
//   - aria-labelledby points at a heading the consumer renders
//   - ESC key closes the sheet
//   - body scroll locked while open (no background scrolling under
//     the sheet)
//   - backdrop click closes
//   - close-button is always rendered with a 40×40px hit target
//
// NOT handled here (consumer's responsibility):
//   - initial focus management (autofocus the close button or first
//     interactive element inside `children` if needed)
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
  children: ReactNode;
};

export function Sheet({
  open,
  onClose,
  labelledById,
  title,
  children,
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledById}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end"
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
        className="relative flex max-h-[90vh] w-full flex-col rounded-t-3xl border border-ink/10 bg-cream shadow-[0_-30px_80px_-40px_rgba(26,26,26,0.4)] sm:h-full sm:max-h-none sm:w-[22rem] sm:rounded-l-3xl sm:rounded-tr-none sm:shadow-[-30px_0_80px_-40px_rgba(26,26,26,0.4)]"
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

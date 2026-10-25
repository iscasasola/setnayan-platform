'use client';

import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { useBackCloses } from '@/lib/use-back-closes';
import { OverlayBackdrop } from './overlay-backdrop';
import { useShellBoundary, type ShellBoundary } from './shell-boundary';

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
// 📱→🖥 …AND SINCE 2026-10-19 THAT LINE IS PER SURFACE (owner, DECISION_LOG
// "APPROVED — COUPLE DASHBOARD DESKTOP + TABLET (AREA 2)"). The couple's event
// tree stops being a phone at 701 (`tab:`); every other tree still at 1024
// (`lg:`). The sheet reads the surface's answer from `useShellBoundary()` — the
// same prop that hides that surface's dock — so the two still agree everywhere.
// Each answer is ONE complete class set below, never a mix.
//
// 📱 FOLDABLES (2026-09-25) — the `FOLDABLES` block at the end of globals.css
// (never a `.css` import here: tests load this module under node), not
// Tailwind classes, because
// none of these is a desktop rule and the guard beside this file rightly
// forbids a second breakpoint among the classes:
//   - between 640 and the dock point the bottom sheet stays a bottom sheet but
//     stops at 40rem, centred (Material's large-screen bottom-sheet cap). On a
//     Galaxy Fold's 690px inner screen it spanned edge to edge;
//   - a phone folded like a BOOK (two side-by-side viewport segments — a
//     half-open Fold, a Surface Duo spanned) puts the sheet on the right-hand
//     segment instead of across the hinge;
//   - a phone folded like a LAPTOP (two stacked segments — Flex mode) keeps it
//     on the lower half.
// A resize never remounts the sheet: every one of these is CSS, so a fold or
// unfold mid-flow keeps what the person typed.
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
//   - close-button is always rendered with a 44×44px hit target (the template's floor, 2026-10-12)
//
// NOT handled here (consumer's responsibility):
//   - the heading element itself — consumer renders it so it can
//     style/translate freely. Pass the heading's `id` via
//     `labelledById`.

/**
 * The two complete geometries, one per boundary. Literal strings on purpose:
 * Tailwind only generates what it can read, and `sheet-agrees-with-the-nav`
 * reads each set to hold it to ONE breakpoint.
 */
const SHEET_AT: Record<
  ShellBoundary,
  { root: string; panel: string; narrow: string; wide: string }
> = {
  lg: {
    root: 'fixed inset-0 z-50 flex h-[100dvh] items-end justify-center lg:items-stretch lg:justify-end focus:outline-none',
    panel:
      'relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl border border-ink/10 bg-cream shadow-[0_-30px_80px_-40px_rgba(26,26,26,0.4)] lg:h-full lg:max-h-none lg:rounded-l-3xl lg:rounded-tr-none lg:shadow-[-30px_0_80px_-40px_rgba(26,26,26,0.4)]',
    narrow: 'lg:w-[22rem]',
    wide: 'lg:w-[min(34rem,92vw)]',
  },
  tab: {
    root: 'fixed inset-0 z-50 flex h-[100dvh] items-end justify-center tab:items-stretch tab:justify-end focus:outline-none',
    panel:
      'relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl border border-ink/10 bg-cream shadow-[0_-30px_80px_-40px_rgba(26,26,26,0.4)] tab:h-full tab:max-h-none tab:rounded-l-3xl tab:rounded-tr-none tab:shadow-[-30px_0_80px_-40px_rgba(26,26,26,0.4)]',
    /* 📐 ONE PANEL WIDTH ON THE COUPLE DASHBOARD — the system's 440 (owner 2026-10-19, DECISION_LOG "APPROVED —
       COUPLE DASHBOARD DESKTOP + TABLET (AREA 2)", Q2: "440 · one token"). `wide` is the SAME panel here: the
       prototype narrows the Suppliers date sheet (≈540 at 1280) to match. Other surfaces keep `lg` as shipped. */
    narrow: 'tab:w-[min(27.5rem,calc(100vw-3.5rem))]',
    wide: 'tab:w-[min(27.5rem,calc(100vw-3.5rem))]',
  },
};

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
  /**
   * The sheet RISES into place and its backdrop fades in (the Event Hub's
   * motion, owner 2026-09-21 — tokens in lib/motion.ts, off under reduced
   * motion). Default false: every existing caller renders byte-identically.
   */
  rise?: boolean;
  /**
   * The phone's Back closes the sheet (owner 2026-10-25, `lib/use-back-closes.ts`). Default true. Off only for a sheet
   * whose caller already owns the history entry for it (the reply panel's frame, Panood's setup step) — two entries
   * for one sheet would make Back press twice.
   */
  backCloses?: boolean;
  children: ReactNode;
};

export function Sheet({
  open,
  onClose,
  labelledById,
  title,
  wide = false,
  rise = false,
  backCloses = true,
  children,
}: SheetProps) {
  // Esc-to-close + the page held still and inert behind it + focus management (focus-in, Tab trap, restore on close)
  // via the shared primitive; Back through one history entry of our own.
  const dialogRef = useRef<HTMLDivElement>(null);
  const viaBack = useBackCloses(open && backCloses, onClose);
  const close = backCloses ? viaBack : onClose;
  useModalA11y({ open, onClose: close, containerRef: dialogRef });
  const at = SHEET_AT[useShellBoundary()];

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledById}
      data-sheet=""
      className={at.root}
    >
      {/* Backdrop — tapping the darkened space dismisses. THE shared one (`overlay-backdrop.tsx`): fixed to the screen,
          dark and blurred, a drag on it moves nothing (owner 2026-10-25). */}
      <OverlayBackdrop onClose={close} fade={rise} />

      {/* Sheet body — `data-sheet-panel` is the hook globals.css's FOLDABLES block sizes on a
          tablet, an unfolded foldable, and a phone folded at a hinge. */}
      <div
        data-sheet-panel=""
        className={`${rise ? 'sn-rise ' : ''}${at.panel} ${wide ? at.wide : at.narrow}`}
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
              onClick={close}
              aria-label="Close"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/55 hover:bg-ink/5 hover:text-ink"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
          </header>
        ) : (
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-[calc(0.75rem+var(--sn-safe-r))] top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-cream/80 text-ink/55 backdrop-blur hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-[max(env(safe-area-inset-bottom),16px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

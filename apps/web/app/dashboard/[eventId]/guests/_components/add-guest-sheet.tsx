'use client';

/**
 * add-guest-sheet.tsx — ONE way to add a guest, at every width: the round +.
 *
 * ⚖ Owner 2026-10-01 (via the controller): the phone's Add is a round + (frame
 * 2 of the approved simple phone app) → *"this also should be visible on desktop
 * mode?"* → *"okay keep it similar"*: the computer uses the SAME round + and the
 * SAME sheet. Tapping + opens it: first "Type a name…" (Enter adds — the shipped
 * `CaptureBar`, its parser and its `addSingleGuest`, reused whole), then the other
 * ways in, as rows: from your People · the full add form · import · a quick add
 * list (`AddDoors`, the same four the ⋯ lists). No new server action.
 *
 * The header's capture bar is gone; this is where it lives now.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';

const OPEN_EVENT = 'setnayan:add-guest-open';

/**
 * The round + — in the Guests page HEADER, beside ⋯, at every width (owner
 * 2026-10-01, DECISION_LOG "THE BOTTOM BAR IS HOME · GUESTS · SUPPLIERS · HUB ·
 * MORE": no floating button at the bottom). Same circle and size as the ⋯.
 */
export function OpenAddGuestButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
      data-guests-add-plus=""
      className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-cream hover:bg-ink/90"
    >
      <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
    </button>
  );
}

/**
 * The empty list's one button (first-timer fix 11, 2026-10-02): "No guests yet."
 * + **Add a guest** — the SAME sheet the header + opens, so there is one way in,
 * worded, where the eye lands on an empty page.
 */
export function OpenAddGuestTextButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
      data-guests-empty-add=""
      className="button-primary inline-flex min-h-[44px] items-center gap-2"
    >
      <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
      {label}
    </button>
  );
}

export function AddGuestSheet({
  nameBox,
  doors,
  tips,
}: {
  nameBox: React.ReactNode;
  doors: React.ReactNode;
  /** One example line + the Tips ▾ fold (`lib/quick-add-tips.ts`). */
  tips?: { example: string; tips: string[] };
}) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose: () => setOpen(false), containerRef: sheetRef });

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // The name box first, ready to type. `preventScroll`: the page behind must
  // not move (the owner's "the table nudges down" on the old row, 2026-09-21).
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() =>
      sheetRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }),
    );
  }, [open]);

  // ⚖ Drawn on <body> (guests-phone-menu.tsx says why: inside the page's
  // `view-transition-name` <main> no z-index rises above the bottom bar), and
  // only once the page has mounted — a portal on the server has no body.
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/[0.32] backdrop-blur-[1px] sm:items-center"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add a guest"
        data-add-guest-sheet=""
        className="max-h-[85vh] w-full space-y-4 overflow-y-auto rounded-t-3xl bg-cream px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Add a guest</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5"
          >
            <X className="h-5 w-5" strokeWidth={1.8} aria-hidden />
          </button>
        </div>
        <div data-add-guest-name="">{nameBox}</div>
        {/* ⚖ What the name box understands (owner 2026-10-01): ONE example line
            that fits this event, and one fold — never a wall of text. The words
            come from `lib/quick-add-tips.ts`, each read by the shipped parser. */}
        {tips ? (
          <div className="-mt-2 space-y-1.5" data-add-guest-tips="">
            <p className="text-xs text-ink/55">{tips.example}</p>
            <details className="group text-xs text-ink/60">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium text-ink/70">
                Tips
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" strokeWidth={1.8} aria-hidden />
              </summary>
              <ul className="mt-1.5 space-y-1">
                {tips.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </details>
          </div>
        ) : null}
        {/* Every other way in opens its own sheet or page — this one steps aside. */}
        <div
          className="space-y-0.5 border-t border-ink/10 pt-3"
          data-add-guest-doors=""
          onClickCapture={(e) => {
            if ((e.target as HTMLElement).closest('a, button')) setOpen(false);
          }}
        >
          {doors}
        </div>
      </div>
    </div>,
    document.body,
  );
}

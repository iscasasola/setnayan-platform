'use client';

import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';

/**
 * 🪟 THE GUEST'S SHEET — the one pop-up the guest page opens over itself: "My
 * QR" (`GuestHubBar`), and a plus-one's ticket on Me (`ticket-row.tsx` `show`, owner
 * 2026-10-21: *"the ticket opens big in the shipped sheet, where 'Save …'s
 * ticket' lives"*). One frame, so the two can never look like two products:
 * the dimmed page, the cream card, its close, its eyebrow and its title.
 * Mounted only while open; the repo's one modal hook gives focus, Escape and
 * the scroll lock.
 */
export function GuestSheet({
  titleId,
  eyebrow,
  title,
  onClose,
  children,
}: {
  titleId: string;
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose, containerRef: dialogRef });
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xs rounded-3xl border border-ink/10 bg-cream p-6 text-center shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/70 transition hover:bg-ink/5 hover:text-ink"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">{eyebrow}</p>
        <h2 id={titleId} className="mt-1 text-lg font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

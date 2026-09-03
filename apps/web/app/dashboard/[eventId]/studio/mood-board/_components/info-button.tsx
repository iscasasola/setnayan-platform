'use client';

/**
 * The one (i) affordance pattern, ported from the mood-board prototype's
 * `.info-btn` / `.info-pop` (2026-09-03) — a quiet round "i" beside a section
 * title that reveals a short, once-only explanation. The prototype shares a
 * single popover across every section (00/01/02/03/04/05); the real app
 * builds out sections one session at a time, so this starts as a small local
 * component (Inspiration is the first user, MB3) rather than a shared
 * app-wide popover with no second caller yet — later sections can adopt it
 * as they land without anyone needing to extract it first.
 *
 * Costs, balances, and warnings stay on the page itself; only the
 * once-only "what is this" explanation lives in here, exactly as the
 * prototype's own comment states: "Everything a couple needs BEFORE acting
 * … stays on the page; only the once-only explanation lives here."
 */

import { useEffect, useRef, useState } from 'react';

export function InfoButton({
  label,
  children,
}: {
  /** Accessible name for the button, e.g. "About inspiration". */
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (popRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        className="sn-press inline-flex h-4 w-4 items-center justify-center rounded-full border border-ink/25 text-[10px] font-semibold leading-none text-ink/55 transition hover:border-terracotta hover:text-terracotta"
      >
        <span aria-hidden="true">i</span>
      </button>
      {open ? (
        <div
          ref={popRef}
          role="note"
          aria-label={label}
          tabIndex={-1}
          className="absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-xl border border-ink/10 bg-white p-3 text-xs leading-relaxed text-ink/75 shadow-lg"
        >
          {children}
        </div>
      ) : null}
    </span>
  );
}

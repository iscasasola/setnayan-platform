'use client';

/**
 * The /for-suppliers ⓘ — "title + one short line visible, the rest inside" (owner 2026-10-23, `details-go-inside-the-
 * info-tip`). The approved prototype (`prototypes/for_suppliers_2026-11-06/index.html`) draws it as a labelled pill —
 * "ⓘ How the fee works" — that opens its words IN THE PAGE under the section, not as a hover note (`<InfoTip>`) or a
 * centred popup (`<Explain>`). Neither house piece does that, so this file draws its own, and is listed in
 * `there-is-one-info-dot.test.ts` with that reason.
 *
 * 🎯 THE "i" IS THE HOUSE ⓘ, class for class (`<Explain>`'s mark: 16 px, an ink/25 hairline, a 10-px semibold ink/55
 * "i", turning `sn-accent` when open) — the prototype's own 26-px ivory disc is NOT drawn. On a band that is dark in
 * both modes the module’s `.dark .info > span` gives the same mark the band's ink.
 *
 * Opening reveals the panel through the shared `useRevealOnOpen` (owner 2026-11-04, app-wide reveal-on-open).
 */
import { useId, useRef, useState, type ReactNode } from 'react';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import s from './supplier-front.module.css';

export function Info({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const intend = useRevealOnOpen(open, () => ({ head: btn.current, end: panel.current }));
  return (
    <div>
      <button
        ref={btn}
        type="button"
        className={`group/sfinfo ${s.info} ${open ? s.infoOpen : ''}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          intend();
          setOpen((o) => !o);
        }}
      >
        <span
          aria-hidden="true"
          className="sn-dot-btn sn-press-ring inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink/25 text-[10px] font-semibold leading-none text-ink/55 transition-all duration-sn-control ease-sn group-hover/sfinfo:border-sn-accent group-hover/sfinfo:text-sn-accent group-aria-expanded/sfinfo:border-sn-accent group-aria-expanded/sfinfo:text-sn-accent"
        >
          i
        </span>
        {label}
      </button>
      <div ref={panel} id={id} className={s.panel} hidden={!open}>
        {children}
      </div>
    </div>
  );
}

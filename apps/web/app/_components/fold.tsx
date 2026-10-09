'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { OneOpenScope, useOneOpen } from '@/lib/one-open';

/**
 * FOLD — keeps the less-used things out of the way; one line says what is inside (`INTERACTION_RULES.md` § 9,
 * kind 19; approved gallery `prototypes/control_templates_2026-10-08.html` § 19).
 *
 *   · it opens DOWNWARD and the arrow turns over (the arrow is the app's accent — the small mark that says "you can
 *     tap this");
 *   · ONE FOLD OPEN AT A TIME on a screen (`useOneOpen`: opening one closes another; a dropdown or an explanation
 *     opened INSIDE it never closes it — `OneOpenScope`);
 *   · what is inside STAYS MOUNTED while shut (a field in it keeps its words and its place in a form) — it is only
 *     out of reach (`inert`) and out of sight;
 *   · the height moves on `grid-template-rows` at the press family's one speed; nothing moves under "reduce motion".
 *
 * Neutral: it knows no screen, and writes no colour of its own.
 */
export function Fold({
  title,
  summary,
  defaultOpen = false,
  children,
  data,
  className = '',
}: {
  /** What the fold is — "More for guests". */
  title: string;
  /** One quiet line of what is inside — "the address, who can view, the QR". */
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  /** `data-fold="<data>"`. */
  data?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const scope = useOneOpen(open, setOpen);
  const id = useId();
  return (
    <div data-fold={data ?? ''} data-fold-open={open ? '' : undefined} className={className}>
      <button
        type="button"
        data-fold-head=""
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="sn-press flex min-h-[52px] w-full items-center gap-2 text-left text-[15px] font-semibold text-ink"
      >
        <span className="min-w-0 flex-1">
          {title}
          {summary ? <small className="text-[12.5px] font-normal text-ink/55"> · {summary}</small> : null}
        </span>
        <ChevronDown aria-hidden className={`h-4 w-4 flex-none text-sn-accent transition-transform duration-sn-pill ease-sn-spring motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>
      <div
        id={id}
        data-fold-body=""
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-sn-pill ease-sn motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        {/* 4 px of room each side, so a row's focus ring and an open field's highlight are not cut by the fold's edge. */}
        <div className={`-mx-1 min-h-0 overflow-hidden px-1 transition-opacity duration-sn-pill ease-sn motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`}>
          <OneOpenScope id={scope}>{children}</OneOpenScope>
        </div>
      </div>
    </div>
  );
}

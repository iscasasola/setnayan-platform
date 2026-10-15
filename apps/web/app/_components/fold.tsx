'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
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
  line,
  aside,
  lead,
  anchor,
}: {
  /** What the fold is — "More for guests". */
  title: string;
  /** One quiet line of what is inside — "the address, who can view, the QR". */
  summary?: string;
  /**
   * A LIST ROW THAT OPENS IN PLACE (a queue of asks — the supplier's "Also waiting"): the row's one line, UNDER the
   * title instead of beside it, each cut with "…" so the row stays one height. Absent → the head is exactly as it was.
   */
  line?: string;
  /** A state shown at the right, before the arrow — a `Badge` ("2 of 3"). Never something pressable. */
  aside?: ReactNode;
  /** A mark at the LEFT of the head — a list row's avatar, so a row that opens in place lines up with the rows that go
   *  somewhere. Never something pressable. Absent → the head is exactly as it was. */
  lead?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  /** `data-fold="<data>"`. */
  data?: string;
  /**
   * A LINK CAN OPEN IT. The fold carries `id="<anchor>"`, and an address ending in `#<anchor>` — on arrival or
   * from a link on the same page — opens it and brings it into view. No round trip: a link from elsewhere
   * (`/vendor-dashboard/profile#docs`) and the thumb row's "Add what is left" (`#docs`) both land on the open
   * fold. Absent → no id, and the fold is exactly as it was.
   */
  anchor?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const scope = useOneOpen(open, setOpen);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!anchor) return;
    const apply = () => {
      if (window.location.hash !== `#${anchor}`) return;
      setOpen(true);
      requestAnimationFrame(() => box.current?.scrollIntoView({ block: 'start' }));
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [anchor]);
  return (
    <div
      ref={box}
      id={anchor}
      data-fold={data ?? ''}
      data-fold-open={open ? '' : undefined}
      className={anchor ? `scroll-mt-24 ${className}` : className}
    >
      <button
        type="button"
        data-fold-head=""
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="sn-press flex min-h-[52px] w-full items-center gap-2 text-left text-[15px] font-semibold text-ink"
      >
        {lead}
        {line !== undefined ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate">{title}</span>
            {line ? <span className="block truncate text-[13px] font-normal text-ink/60">{line}</span> : null}
          </span>
        ) : (
          <span className="min-w-0 flex-1">
            {title}
            {summary ? <small className="text-[12.5px] font-normal text-ink/55"> · {summary}</small> : null}
          </span>
        )}
        {aside}
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

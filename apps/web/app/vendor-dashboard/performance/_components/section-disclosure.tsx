'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Collapsed-by-default disclosure for a performance section: `summary` stays
 * always visible (e.g. the Momentum card, which owns its own interactive
 * toggles), `children` renders only once expanded. The toggle is a slim
 * chevron strip rather than wrapping `summary` in a button, since summary
 * content often contains its own nested buttons/links — nesting those inside
 * an outer <button> would be invalid markup and double-fire clicks.
 */
export function SectionDisclosure({
  summary = null,
  children,
}: {
  summary?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      {summary}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors hover:bg-black/[0.03]"
        style={{ color: 'var(--m-slate-3)' }}
      >
        {open ? 'Show less' : 'Show more'}
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.75}
        />
      </button>
      {open ? <div className="space-y-6">{children}</div> : null}
    </div>
  );
}

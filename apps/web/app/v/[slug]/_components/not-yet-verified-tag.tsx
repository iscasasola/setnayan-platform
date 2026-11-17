'use client';

import { useId, useState, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { NOT_YET_VERIFIED_EXPLAIN, NOT_YET_VERIFIED_TAG } from '@/lib/not-yet-verified-markings';

/**
 * ⚠ ONE MARKING, ONE SHEET (v16 S6; owner 15 Nov: the unverified shop's markings — "each opening one explain sheet").
 * Every marking on the unverified page is this button: the drawing's `NV_TAG` (a circle-! + "Not yet verified", in the
 * warn tokens), optionally with the marking's own words beside it (`children`). A tap opens the shipped house `Sheet`
 * with the drawing's `nvExplain` words — the SAME sheet from every marking.
 */
export function NotYetVerifiedTag({
  children,
  label = NOT_YET_VERIFIED_TAG,
  className = '',
  pill = true,
}: {
  /** The marking's own words, after the tag (the band's sentence, the side card's list…). */
  children?: ReactNode;
  /** The tag's word — "Not yet verified" (`NV_TAG`), or "Not verified" on a card or photo stamp (`.nvp`). */
  label?: string;
  className?: string;
  /** false = no tag of its own: the button is the marking it wraps (the Awards row's "Not yet" slot opens the sheet). */
  pill?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-11 items-center gap-1.5 text-left ${pill ? 'text-warn-800' : ''} ${className}`}
        data-not-yet-verified-tag=""
      >
        {pill ? (
          <>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn-50 px-2 py-0.5 text-xs font-bold">
              <CircleAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />
              {label}
            </span>
            {children ? <span className="text-sm text-ink/80">{children}</span> : null}
          </>
        ) : (
          children
        )}
      </button>
      {open ? (
        <Sheet open onClose={() => setOpen(false)} labelledById={titleId} title={NOT_YET_VERIFIED_EXPLAIN.title}>
          <div className="space-y-3 p-4" data-not-yet-verified-sheet="">
            <h2 id={titleId} className="sr-only">
              {NOT_YET_VERIFIED_EXPLAIN.title}
            </h2>
            <p className="text-sm text-ink/75">{NOT_YET_VERIFIED_EXPLAIN.lead}</p>
            <ul className="space-y-2.5">
              {NOT_YET_VERIFIED_EXPLAIN.points.map((p) => (
                <li key={p.head} className="text-sm text-ink/80">
                  <b className="block font-semibold text-ink">{p.head}</b>
                  {p.body}
                </li>
              ))}
            </ul>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

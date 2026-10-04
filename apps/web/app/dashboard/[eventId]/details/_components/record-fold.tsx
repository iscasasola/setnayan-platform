'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { OneOpenScope, useOneOpen } from '@/lib/one-open';
import { RECORD_ROW_GROUP, recordRowOfPath } from '@/lib/event-details-record';

/** The phone, by the Maker's own breakpoint (`lg`) — the folds are the phone's. */
function onPhone(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1023.98px)').matches;
}

/**
 * Each fold's one-open id, by group — so a row's field, which arrives in the
 * page's `@field` slot (a different React tree from the fold), can still say
 * "I am this fold's child": a dropdown opening inside the field then never
 * closes the fold it belongs to (`OneOpenScope`, `lib/one-open.ts`). Written
 * while the fold renders — the record always renders before its field.
 */
const FOLD_IDS = new Map<string, string>();
export function recordFoldId(group: string): string | null {
  return FOLD_IDS.get(group) ?? null;
}

/**
 * 📁 ONE GROUP OF THE RECORD (owner 2026-10-04, DECISION_LOG "EVENT DETAILS /
 * MAKER: FOUR FIXES BEFORE BUILD" (2) — *"Event Details on the phone = four
 * folded groups with one-line summaries … tap opens a group"*; prototype screen 4).
 *
 *   · PHONE — one line: the group's name and its summary; a tap opens it. ONE
 *     OPEN AT A TIME through the app's one mechanism (`useOneOpen`): opening a
 *     group closes the open one, and a dropdown opening elsewhere closes a fold
 *     — never the fold it sits in.
 *   · DESKTOP — every group stays open, side by side; the line is a heading.
 *
 * The group whose row's field is open starts open (the address says which).
 * Folding it on the phone closes that field too — the half sheet would
 * otherwise hang over a folded group — by a plain navigation back to the
 * record, which writes nothing.
 *
 * 🔒 NOTHING HERE WRITES: opening and folding are state of the draw.
 */
export function RecordFold({
  group,
  title,
  summary,
  recordHref,
  children,
}: {
  group: string;
  title: string;
  /** The one-line summary the phone shows while folded. */
  summary: string;
  /** The record with nothing open — where folding an open field's group returns. */
  recordHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const fieldRow = recordRowOfPath(pathname);
  const fieldHere = fieldRow !== null && RECORD_ROW_GROUP[fieldRow] === group;
  const [open, setOpenState] = useState(fieldHere);
  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      if (!next && fieldHere && onPhone()) router.replace(recordHref, { scroll: false });
    },
    [fieldHere, recordHref, router],
  );
  const id = useOneOpen(open, setOpen);
  FOLD_IDS.set(group, id);
  return (
    <section
      data-record-group={group}
      data-record-group-open={open ? '' : undefined}
      aria-label={title}
      className="sn-tile overflow-hidden lg:overflow-visible"
    >
      <button
        type="button"
        aria-expanded={open}
        data-record-fold={group}
        onClick={() => setOpen(!open)}
        className="sn-press flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left lg:hidden"
      >
        <span className="shrink-0 text-[15px] font-semibold text-ink">{title}</span>
        <span className={`min-w-0 flex-1 truncate text-[13px] text-ink/55 ${open ? 'invisible' : ''}`} data-record-summary="">
          {summary}
        </span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-ink/45 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.75}
        />
      </button>
      <h2 className="hidden px-5 pb-1 pt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 lg:block">{title}</h2>
      <div data-record-group-body="" className={`px-4 pb-3 sm:px-5 ${open ? '' : 'max-lg:hidden'}`}>
        <OneOpenScope id={id}>{children}</OneOpenScope>
      </div>
    </section>
  );
}

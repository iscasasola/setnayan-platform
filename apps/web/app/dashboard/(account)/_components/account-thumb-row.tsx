'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { ThumbRow } from '@/components/thumb-row';
import { followColumn } from '@/app/dashboard/[eventId]/guests/_components/dock-follows-column';
import tr from './account-thumb-row.module.css';

/**
 * account-thumb-row.tsx — People's and Memories' bottom row, drawn as THE ONE THUMB ROW (owner 2026-10-22: "The one
 * on event-suppliers page is the one that looks the best" … "On people, and memories they should also have those").
 * Contract: `prototypes/one_thumb_row_2026-10-22.html` — the Couple › Suppliers (Find) row exactly as it ships
 * (`find-thumb-row.tsx` · `ThumbControls`): round tools at the LEFT · the field in the middle, ≥ 60 % · the one main
 * verb at the RIGHT as a round terracotta button. Each control is its own frosted glass (`.sn-glass-row`); the row
 * paints NOTHING — no band, no top border, no shadow. Controls are drawn at 44 px (the prototype's question 3).
 *
 * 🔁 SWAPPED 2026-10-22 (as this note planned): the row is now drawn by the shared `components/thumb-row.tsx` — the
 * same three seats (tools · field · action) handed in as ThumbNodes; the seat is the glass, so `ThumbTool` and
 * `ThumbField` no longer paint one of their own. This file keeps only where the row sits (the dock, the column).
 */
export function AccountThumbRow({
  tools,
  field,
  action,
  data,
}: {
  /** Round tools, left — ⇕ · ☑ · ≡ in that order, only the ones the screen has. */
  tools?: ReactNode;
  /** The field (`ThumbField`). */
  field?: ReactNode;
  /** The screen's one main verb, right — a round brand `ActionButton` (`filled`). */
  action?: ReactNode;
  /** A data mark for walks and guards (`data-people-thumb`). */
  data: Record<`data-${string}`, string>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // From 1024 (no dock) the row sits under the reading column, not across the stage.
  useEffect(() => {
    const el = hostRef.current;
    return el ? followColumn(el) : undefined;
  }, []);
  const name = Object.values(data)[0] || 'account';
  return (
    <div ref={hostRef} className="mx-auto w-full max-w-3xl" data-thumb-host="">
      <div
        {...data}
        data-one-thumb-row=""
        className="pointer-events-none fixed inset-x-0 bottom-[var(--sn-ride-h,var(--sn-bottomdock-h,64px))] z-[25] py-2.5 pl-[max(1rem,var(--sn-safe-l))] pr-[max(1rem,var(--sn-safe-r))] lg:bottom-4 lg:left-[var(--gs-left,0px)] lg:right-[var(--gs-right,0px)] lg:px-0"
      >
        <ThumbRow
          name={`people-${name}`}
          left={tools ? [{ node: tools }] : []}
          field={field ? { node: field } : null}
          action={action ? { node: action } : null}
        />
      </div>
    </div>
  );
}

/** One round tool, 44 × 44 — the shared row's round seat is its glass. */
export function ThumbTool({ children, tour }: { children: ReactNode; /** 🔦 A spotlight tour's anchor token. */ tour?: string }) {
  return (
    <span className={tr.tool} data-thumb-tool="" data-tour={tour}>
      {children}
    </span>
  );
}

/** The field's inside — the shared row's field seat is its glass; the placeholder is two or three words. */
export function ThumbField({ children, words, tour }: { children: ReactNode; words: string; /** 🔦 A spotlight tour's anchor token. */ tour?: string }) {
  return (
    <label data-thumb-field={words} data-tour={tour} className="flex h-full min-w-0 flex-1 items-center gap-2 pl-3 pr-2.5 text-ink">
      <Search className="h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.9} aria-hidden />
      {children}
    </label>
  );
}

'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { useFitRow } from '@/components/action-button';
import { followColumn } from '@/app/dashboard/[eventId]/guests/_components/dock-follows-column';
import { SUP_REACH_X } from '@/lib/suppliers-shell';
import tr from './account-thumb-row.module.css';

/**
 * account-thumb-row.tsx — People's and Memories' bottom row, drawn as THE ONE THUMB ROW (owner 2026-10-22: "The one
 * on event-suppliers page is the one that looks the best" … "On people, and memories they should also have those").
 * Contract: `prototypes/one_thumb_row_2026-10-22.html` — the Couple › Suppliers (Find) row exactly as it ships
 * (`find-thumb-row.tsx` · `ThumbControls`): round tools at the LEFT · the field in the middle, ≥ 60 % · the one main
 * verb at the RIGHT as a round terracotta button. Each control is its own frosted glass (`.sn-glass-row`); the row
 * paints NOTHING — no band, no top border, no shadow. Controls are drawn at 44 px (the prototype's question 3).
 *
 * 🔁 ONE SMALL COMPONENT ON PURPOSE: the prototype's shared `components/thumb-row.tsx` is being built separately;
 * when it lands, this file is the only thing People and Memories swap (same three seats: tools · field · action).
 * `useFitRow` mounts WITH the row (the Find row's lesson: measured from a parent it measured nothing).
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
  const rowRef = useRef<HTMLDivElement>(null);
  useFitRow(rowRef);
  // From 1024 (no dock) the row sits under the reading column, not across the stage.
  useEffect(() => {
    const el = hostRef.current;
    return el ? followColumn(el) : undefined;
  }, []);
  return (
    <div ref={hostRef} className="mx-auto w-full max-w-3xl" data-thumb-host="">
      <div
        {...data}
        data-one-thumb-row=""
        className="pointer-events-none fixed inset-x-0 bottom-[var(--sn-bottomdock-h,64px)] z-[25] py-2.5 pl-[max(1rem,var(--sn-safe-l))] pr-[max(1rem,var(--sn-safe-r))] lg:bottom-4 lg:left-[var(--gs-left,0px)] lg:right-[var(--gs-right,0px)] lg:px-0"
      >
        <div ref={rowRef} className="pointer-events-auto flex min-w-0 items-center gap-1.5">
          {tools}
          {field}
          {/* 👆 The 44-px reach is the wrapper's (the Find row's): a press on the reach is the button's press. */}
          {action ? (
            <span
              className={`${SUP_REACH_X} inline-flex shrink-0`}
              data-press-reach=""
              onClick={(e) => {
                if (!(e.target as Element).closest('button, a')) e.currentTarget.querySelector<HTMLElement>('button, a')?.click();
              }}
            >
              {action}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** One round tool — its own glass, 44 × 44 (the Find row's ⇕ wrapper). */
export function ThumbTool({ children }: { children: ReactNode }) {
  return (
    <span className={`sn-glass-row ${tr.tool}`} data-thumb-tool="">
      {children}
    </span>
  );
}

/** The field — the Find row's glass label, 44 tall, ≥ 60 % of the row; the placeholder is two or three words. */
export function ThumbField({ children, words }: { children: ReactNode; words: string }) {
  return (
    <label
      data-fit-field=""
      data-thumb-field={words}
      className="sn-glass-row flex h-11 min-w-[60%] flex-1 items-center gap-2 rounded-full px-3.5 text-ink"
    >
      <Search className="h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.9} aria-hidden />
      {children}
    </label>
  );
}

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { OneOpenScope } from '@/lib/one-open';
import { MakerHalfSheet } from '../../launch/_components/maker-sheet';
import { recordFoldId } from './record-fold';

/** A desktop, by the Maker's own breakpoint (`lg`): the field sits in place there. */
function onDesktop(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches;
}

/**
 * ✍ A ROW'S FIELD, OPEN — Event Details' one door into an editor (owner
 * 2026-10-04 "YES TO ALL": rows are edited in place; study § 4 + § 7 PR-1;
 * prototype screen 5).
 *
 *   · PHONE — the Maker's HALF SHEET (`MakerHalfSheet`, `maker-sheet.tsx`,
 *     #6329): it rests at half the screen with the row it edits scrolled into
 *     view above it; the grab handle drags it up for more; Peek (press and
 *     hold) hides it to see the whole record; × closes.
 *   · DESKTOP — in place, under its row, in the record's column (portalled
 *     into the row's slot, `record-row-link.tsx`).
 *
 * The editor inside is the Maker's own for that fact, handed in from the server
 * (`record-editor.tsx`) — never a second form for one fact. Its dropdowns are
 * the row's fold's children (`OneOpenScope`), so opening one never folds the
 * group it is editing.
 *
 * 🔒 NOTHING HERE WRITES. × is a navigation back to the record; opening,
 * dragging, peeking and collapsing are the half sheet's own draw state.
 */
export function RecordFieldSheet({
  row,
  group,
  title,
  recordHref,
  children,
}: {
  /** The row whose field this is (`RECORD_ROW_EDITOR`'s key) — the sheet's target. */
  row: string;
  /** The fold the row sits in (`RECORD_ROW_GROUP`). */
  group: string;
  title: string;
  /** The record with nothing open. */
  recordHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  /* Where the desktop draws it: the row's own slot. Unknown until mounted —
     until then a desktop draws nothing, so it never flashes at the page's foot. */
  const [inPlace, setInPlace] = useState<HTMLElement | null>(null);
  const [placed, setPlaced] = useState(false);
  useEffect(() => {
    const find = () => {
      setInPlace(onDesktop() ? document.querySelector<HTMLElement>(`[data-record-field-slot="${CSS.escape(row)}"]`) : null);
      setPlaced(true);
    };
    find();
    const mq = window.matchMedia('(min-width: 1024px)');
    mq.addEventListener('change', find);
    return () => mq.removeEventListener('change', find);
  }, [row]);
  const foldId = recordFoldId(group);
  const sheet = (
    <MakerHalfSheet
      label={`${title} — change it here`}
      title={title}
      target={row}
      closeLabel={`Close ${title}`}
      onClose={() => router.replace(recordHref, { scroll: false })}
      onReveal={(target) => {
        const el = document.querySelector<HTMLElement>(`[data-record-row="${CSS.escape(target)}"]`);
        el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }}
      /* Above the dashboard's bottom bar on the phone; in the column on a desktop. */
      desktopClassName={`max-lg:z-[45] lg:static lg:inset-auto lg:z-auto lg:mb-2 lg:mt-1 lg:h-auto lg:rounded-2xl lg:shadow-sm ${
        placed ? '' : 'lg:hidden'
      }`}
    >
      <div
        data-record-field={row}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2 lg:overflow-visible lg:pb-4"
      >
        {foldId ? <OneOpenScope id={foldId}>{children}</OneOpenScope> : children}
      </div>
    </MakerHalfSheet>
  );
  return inPlace ? createPortal(sheet, inPlace) : sheet;
}

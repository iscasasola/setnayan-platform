'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

/**
 * ✍ A ROW THAT OPENS ITS FIELD (owner 2026-10-04, "YES TO ALL": Event Details
 * rows are edited in place). The whole row is the door — label, value, › — and
 * a tap is a plain GET to the row's field address, so OPENING WRITES NOTHING.
 * While its field is open the row is marked and a second tap closes it.
 *
 * `slot` is where the field sits IN PLACE on a desktop (the half sheet portals
 * into it — `record-field-sheet.tsx`); on a phone the field is the half sheet.
 */
export function RecordRowLink({
  row,
  href,
  recordHref,
  children,
}: {
  row: string;
  /** The row's field address (`recordFieldHref`). */
  href: string;
  /** The record with nothing open. */
  recordHref: string;
  children: ReactNode;
}) {
  const open = usePathname() === href;
  return (
    <>
      <Link
        href={open ? recordHref : href}
        scroll={false}
        aria-expanded={open}
        data-record-opens={row}
        className={`sn-press -mx-2 flex min-h-11 items-start justify-between gap-4 rounded-lg px-2 py-2.5 ${open ? 'bg-ink/[0.05]' : 'hover:bg-ink/[0.03]'}`}
      >
        {children}
        <ChevronRight
          aria-hidden
          className={`mt-0.5 h-4 w-4 shrink-0 text-ink/40 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-90' : ''}`}
          strokeWidth={1.75}
        />
      </Link>
      <div data-record-field-slot={row} />
    </>
  );
}

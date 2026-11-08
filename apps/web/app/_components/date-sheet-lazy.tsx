'use client';

import { lazy, Suspense } from 'react';
import type { DateSheetProps } from './date-sheet';

/**
 * date-sheet-lazy.tsx — THE ONE DOOR to the date sheet (`date-sheet.tsx`). A screen mounts `LazyDateSheet` while its
 * date is being picked; the sheet's code is its OWN chunk, fetched on the first open — never in a page's first load,
 * never in the shared bundle (which has ~20 B of room: Build 3 rulings, "Lazy-load anything new and report the number").
 *
 * A bare `React.lazy`, not `next/dynamic` (the `couple-logo.tsx` reasoning): the sheet only exists after a tap, so it
 * needs none of `next/dynamic`'s server machinery. While the chunk arrives nothing is drawn — the pill that opened it
 * already reads "open". `loadDateSheet` is exported so a screen that knows a date is coming can warm it while idle.
 * 🔒 `app/_components/the-date-sheet.test.ts`: no other file imports `date-sheet.tsx` for its code.
 */
export const loadDateSheet = () => import('./date-sheet');
const DateSheet = lazy(() => loadDateSheet().then((m) => ({ default: m.DateSheet })));

export function LazyDateSheet(props: DateSheetProps) {
  return (
    <Suspense fallback={null}>
      <DateSheet {...props} />
    </Suspense>
  );
}

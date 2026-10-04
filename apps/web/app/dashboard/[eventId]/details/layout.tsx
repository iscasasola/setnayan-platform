import type { ReactNode } from 'react';

/**
 * Event Details · the record and its open field (owner 2026-10-04, "YES TO
 * ALL": rows are edited in place).
 *
 * `field` is the parallel slot a row's field arrives in. From the record, a
 * row's address (`…/details/field/<row>`) is INTERCEPTED into it
 * (`@field/(.)field/[row]`), so the record — its folds, its scroll — stays
 * exactly as it is and only the field appears. A hard load of any other address
 * draws the slot empty (`@field/default.tsx`); after a soft navigation away the
 * field hides itself, since its address is gone (`record-field-sheet.tsx`).
 */
export default function EventDetailsLayout({ children, field }: { children: ReactNode; field: ReactNode }) {
  return (
    <>
      {children}
      {field}
    </>
  );
}

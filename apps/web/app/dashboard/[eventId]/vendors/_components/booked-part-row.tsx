'use client';

/**
 * BOOKED'S COUNT, IN THE ONE ROW — "[ Booked · Team ▾ ]  3 booked · 1 without a price  ⚙".
 *
 * Owner 2026-10-29, *"so booked has budget and schedule."*; the approved final Suppliers design (2026-10-30) gave
 * Booked a first row of its own (`Team ▾` + its count). Owner 2026-10-31, live iPhone, on Booked › Schedule:
 * *"so many upper space not used"* · *"Suppliers. needs to have that drop down effect to be able to safely integrate
 * all. Booked has the 3 drop down Team, Budget, and Schedule"* — and DECISION_LOG 2026-10-30 "ONE SELECTOR FOR EVERY
 * PAGE" folds that row into the page's ONE row: the shell's `Page · View ▾` already lists Booked · Team / Budget /
 * Schedule, so this second dropdown is gone and only its COUNT stays, drawn after the shell's ▾.
 *
 *   Booked · Team ▾       3 booked · 1 without a price      (the Booked body)
 *   Booked · Budget ▾     ₱297,500 agreed · ₱120,000 paid   (the shipped Budget page)
 *   Booked · Schedule ▾   7 moments                          (the shipped Schedule page)
 *
 * The line is decided by the screen that owns the numbers — each a server-drawn page the shell only places — so it is
 * drawn INTO the shell's row (`SuppliersRowCountContext`, a portal), never as a row of its own. No shell (a test, any
 * other mount): no line. `action` (the Budget's files) is the part's own and stays in the part, at its top right.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { BookedPartKey } from '@/lib/pillar-parts';
import { useSuppliersRowCount } from './suppliers-mode';

export function BookedPartRow({
  current,
  line,
  action,
}: {
  /** Which part is on screen — marked on the line for the walk (`data-booked-part-line`). */
  current: BookedPartKey;
  /** "3 booked · 1 without a price" · "₱297,500 agreed · ₱120,000 paid" · "7 moments". */
  line?: ReactNode;
  /** The part's own actions (Budget: Share · Spreadsheet · Upcoming dates) — drawn in the part, not in the row. */
  action?: ReactNode;
}) {
  const { el, claim } = useSuppliersRowCount();
  /* 🪤 THE PORTAL WAITS FOR THIS PART'S OWN MOUNT. A part can hydrate in a later pass than the shell (a Suspense edge
     between them), when the row's slot is already known — a portal drawn in THAT pass is a child the server never drew,
     and every `useId` after it shifts (measured 2026-10-31: the date line's ⓘ `aria-describedby` mismatched). */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const drawn = Boolean(mounted && el && line);
  useEffect(() => {
    if (!drawn) return;
    claim(true);
    return () => claim(false);
  }, [drawn, claim]);
  const count =
    drawn && el
      ? createPortal(
          <span className="truncate" data-booked-part-line={current}>
            {line}
          </span>,
          el,
        )
      : null;
  return (
    <>
      {count}
      {action ? (
        <div className="flex justify-end pb-3" data-booked-part-action={current}>
          {action}
        </div>
      ) : null}
    </>
  );
}

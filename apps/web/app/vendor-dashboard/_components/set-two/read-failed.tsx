import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { PartFoot, PartNote, PartText } from './parts';
import { TryAgain } from './try-again';

/**
 * read-failed.tsx — WHEN A READ FAILS, THE PAGE STAYS, AND SAYS SO (supplier pages set two, 21 Nov 2026, the shared
 * "When a read fails" frame and its rule for the build):
 *
 *   · never a redirect, a "not found", an empty list, a hidden section, "—" alone, or ₱0 for a read that failed;
 *   · whole page unreadable → the page keeps its shell and its title (the caller draws those), then THIS: the note,
 *     a line under it, and Try again as the one main button (`ReadFailedBody`);
 *   · one part unreadable → that part's note in its place, Try again inside the note (`ReadFailedNote`);
 *   · words: "We couldn’t load {the thing} right now." — money adds "This is on our side, not a sign you owe nothing."
 *
 * Nothing that depends on the missing read is drawn by the caller. 🔒 app/vendor-dashboard/set-two-reads-are-honest.test.ts
 */

export const MONEY_NOT_OWED = 'This is on our side, not a sign you owe nothing.';

/** One part could not be read: its note, in its place, with Try again inside. */
export function ReadFailedNote({ children, mark }: { children: ReactNode; mark: string }) {
  return (
    <PartNote tone="warn" icon={Info} role="alert" end={<TryAgain />} mark={`read-failed:${mark}`}>
      {children}
    </PartNote>
  );
}

/** The whole page could not be read: the note, the line under it, Try again in the thumb zone. */
export function ReadFailedBody({ children, tail, mark }: { children: ReactNode; tail?: ReactNode; mark: string }) {
  return (
    <>
      <PartNote tone="warn" icon={Info} role="alert" mark={`read-failed:${mark}`}>
        {children}
      </PartNote>
      {tail ? <PartText>{tail}</PartText> : null}
      <PartFoot mark={`read-failed:${mark}`} label="Try again">
        <TryAgain main />
      </PartFoot>
    </>
  );
}

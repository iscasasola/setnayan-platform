/**
 * empty-shelf.tsx — what a Discover shelf says when it has nothing to show (or
 * could not read): ONE short line and ONE action. Owner rules, 23 Oct 2026:
 * visible copy is a line, every detail lives inside the ⓘ (`InfoTip`); a frame
 * only on what you press (the action is the only framed thing); and the shelf's
 * old dashed "invite" card — a framed box nobody could press — is gone.
 *
 * The line still says WHICH state it is: an empty shelf says what it is for,
 * a failed read says "couldn't load" — never "none" (the page's CountText rule).
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

import { InfoTip } from '@/app/_components/info-tip';

export function EmptyShelf({
  line,
  tip,
  href,
  go,
}: {
  /** The one visible line. */
  line: string;
  /** Anything more — read behind the ⓘ beside the line. */
  tip?: ReactNode;
  href: string;
  /** The one action's words. */
  go: string;
}) {
  return (
    <div className="fd-empty" data-empty-shelf="">
      {tip ? (
        <InfoTip label={line} labelAs="p" labelClassName="fd-empty-line" align="start">
          {tip}
        </InfoTip>
      ) : (
        <p className="fd-empty-line">{line}</p>
      )}
      <Link href={href} className="fd-btn-quiet">
        {go}
      </Link>
    </div>
  );
}

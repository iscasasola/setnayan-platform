'use client';

/**
 * challenge-row-swipe.tsx — 👈 A COUPLE'S OWN CHALLENGE ROW DELETES BY ITS SWIPE (owner 2026-11-03, DECISION_LOG
 * "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS").
 *
 * The Challenges page's row (`ChallengeRow` in ../couple-challenges-manager.tsx, a server component) is wrapped in the
 * ONE swipe (`app/_components/swipe-to-delete.tsx`): swipe left on a phone, the hover trash on a computer. The Delete
 * reaches the SAME action the old trash form posted — `deleteCoupleChallengeAction`, a SOFT remove (photos already
 * taken keep the challenge) — through the in-place door (`papicSaveInPlace`), so the page re-renders where it is. It
 * waits out the Undo window (`deleteWithUndo`): Undo writes nothing; a refusal brings the row back and says so.
 */

import { useState, type ReactNode } from 'react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { papicSaveInPlace } from '../in-place-actions';

export function ChallengeRowSwipe({
  eventId,
  missionId,
  name,
  dim,
  children,
}: {
  eventId: string;
  missionId: string;
  /** What the challenge asks, as the couple reads it — names the Delete for a screen reader. */
  name: string;
  /** Hidden from guests — the whole row reads faded, as it did. */
  dim: boolean;
  children: ReactNode;
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <SwipeToDelete
      as="li"
      label={`Delete challenge: ${name}`}
      onDelete={() =>
        deleteWithUndo({
          label: 'Challenge deleted',
          hide: () => setHidden(true),
          restore: () => setHidden(false),
          commit: () => {
            const fd = new FormData();
            fd.set('event_id', eventId);
            fd.set('mission_id', missionId);
            return papicSaveInPlace('deleteCoupleChallengeAction', fd);
          },
          failed: 'Couldn’t delete that challenge. It’s back — try again.',
        })
      }
      // The OUTER box rounds the row; the sliding front stays square inside it — a rounded front let the red behind
      // show as a hairline at its corners (measured on /dev/papic-camera-lab?lane=challenges).
      radiusClass=""
      className={`overflow-hidden rounded-xl ${dim ? 'opacity-60' : ''}`}
    >
      {children}
    </SwipeToDelete>
  );
}

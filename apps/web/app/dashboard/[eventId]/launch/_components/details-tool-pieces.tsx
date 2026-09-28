'use client';

import { useEffect } from 'react';
import { DETAILS_SCHEDULE_ANNOUNCE_SLOT, DETAILS_SCHEDULE_INSPECTOR_SLOT, SCHEDULE_ANNOUNCE_PIECE } from '@/lib/maker-details-items';
import { askScheduleFocus } from '../../schedule/_components/schedule-focus';
import { pickDetailsPiece } from './details-piece';
import { useDetailsPiece } from './details-go';
import { useMaker } from './maker-context';

/**
 * 🧩 THE SCHEDULE IN THE THREE PARTS (DECISION_LOG "A TOOL MOVED INTO THE MAKER
 * IS REBUILT INTO THE THREE PARTS"): LEFT its moments (and Announce), MIDDLE
 * the shipped rail with the picked moment selected, RIGHT that moment's
 * fields — the rail's OWN inspector (`MomentInspector`), drawn into the slot
 * below (`ScheduleDay` `inspectorSlot`), or, for Announce, the shipped
 * Announce button. Nothing re-drawn, no new save path.
 */
export function ScheduleSlots() {
  const [piece] = useDetailsPiece('schedule');
  const active = useMaker()?.detailsItem === 'schedule';
  useEffect(() => {
    if (active && piece && piece !== SCHEDULE_ANNOUNCE_PIECE) askScheduleFocus(piece);
  }, [active, piece]);
  const announce = piece === SCHEDULE_ANNOUNCE_PIECE;
  return (
    <>
      <div id={DETAILS_SCHEDULE_INSPECTOR_SLOT} hidden={announce} className={announce ? 'hidden' : 'flex flex-col'} data-details-schedule-inspector="" />
      <div id={DETAILS_SCHEDULE_ANNOUNCE_SLOT} hidden={!announce} className={announce ? 'flex flex-col gap-2' : 'hidden'} data-details-schedule-announce="">
        <p className="text-xs text-ink/60">Send your guests a short note — it shows at the top of their Event Hub as soon as it is sent.</p>
      </div>
    </>
  );
}

/**
 * 🧩 THE LOVE STORY IN THE THREE PARTS: LEFT its chapters, MIDDLE the scrapbook
 * brought to the picked chapter (the book's own `#ch-<chapter>` sections),
 * RIGHT that chapter's moments and words (the Story row's panel, one chapter
 * shown). A chapter tapped in the book is picked in the navigator too.
 */
export function LoveStoryPieceFocus() {
  const [piece] = useDetailsPiece('love-story');
  const active = useMaker()?.detailsItem === 'love-story';
  useEffect(() => {
    if (!active || !piece) return;
    const t = window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(`[data-details-love-story-book] [data-love-story-chapter="${CSS.escape(piece)}"]`)
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 60);
    return () => window.clearTimeout(t);
  }, [active, piece]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const chapter = (e.target as Element | null)
        ?.closest?.('[data-details-love-story-book] [data-love-story-chapter]')
        ?.getAttribute('data-love-story-chapter');
      if (chapter) pickDetailsPiece('love-story', chapter);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}

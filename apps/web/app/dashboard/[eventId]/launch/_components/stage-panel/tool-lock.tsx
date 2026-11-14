'use client';

import type { ReactNode } from 'react';
import { MousePointerClick } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { SP_ROWS } from '@/lib/maker-stage-room';

/**
 * 🔒 A LOCKED TAB'S ROWS — PROBLEM → SOLUTION (Maker Edit shell v3, owner-approved 2026-11-13; prototype
 * `maker-toolbar-fable.html` frame 5, `.lockp`). A tab with nothing to set on the picked part is never a dead tap and
 * never a toast that leaves the rows blank: it opens THIS, in rows 1–3 of the same four rows every tool stands in —
 * what is wrong, in one line; where it IS set, in one line; and, where the toolbar has one, the ONE tap that goes
 * there (a cover word's Background → "Select the Cover Scene ›"). Nothing here saves anything.
 */
const LOCK_TAG = 'mr-1.5 text-[10px] font-bold uppercase not-italic tracking-[.12em] text-[var(--sp-ink2)]';

export function ToolLock({ problem, solution, door = null, more = null }: { problem: string; solution: ReactNode; door?: { label: string; onPress: () => void } | null; more?: ReactNode }) {
  return (
    <div className={SP_ROWS} data-stage-lock="">
      <div className="row-span-3 row-start-1 flex min-w-0 flex-col justify-center gap-1.5 px-1 text-[13.5px] text-[var(--sp-ink)]" data-stage-lock-body="">
        <p className="m-0" data-stage-lock-problem="">
          <InfoTip label="Problem" labelClassName={LOCK_TAG} ariaLabel="Why is this tab locked?" align="start">
            Every part has the same four tabs. A tab with a 🔒 has nothing to set on this part — the line under it says where
            it is set instead.
          </InfoTip>{' '}
          {problem}
        </p>
        <p className="m-0" data-stage-lock-solution="">
          <i className={LOCK_TAG}>Solution</i>
          {solution}
        </p>
        {more}
        {door ? (
          <div>
            <ActionButton tone="neutral" icon={MousePointerClick} label={door.label} onClick={door.onPress} className="!h-11" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

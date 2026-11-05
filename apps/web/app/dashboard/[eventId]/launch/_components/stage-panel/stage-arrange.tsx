'use client';

import type { ReactNode } from 'react';
import { Dd } from './kit';

/**
 * ↕ STYLE › ARRANGE — the prototype's three rows (`S.sphase === 'arrange'`):
 *
 *   ON THIS STAGE  Shown ▾          the scene's own Show (Shown · Auto · Hidden where the
 *                                   event lets guests browse, else Shown · Hidden)
 *   (ORDER is gone — owner 2026-10-07, Arrange "yes": the grip and ↑/↓ move a part)
 *   ALIGNMENT  Centre ▾ · SPACING Regular ▾   the scene's words, every part at once, and the
 *                                   room above and below it (`SceneAlignRow`; Spacing is
 *                                   `HubSectionCanvas.spacing`, owner 2026-10-07)
 *
 * Every pick is the SHIPPED write the scene inspector's Arrange made (`SceneArrangeTab`,
 * `editor-shell.tsx`'s `modeWrite` / `eyeWrite` / `move`); only the drawing is new.
 */
/** On this stage ▾'s ⓘ (owner 2026-10-07). */
const SHOW_ABOUT = 'Auto shows it when it has content · Shown always · Hidden never.';

export function StageArrange({
  openBrowse,
  mode,
  isVisible,
  hasContent,
  pending,
  onMode,
  onEye,
  alignRow = null,
  removeForm = null,
}: {
  openBrowse: boolean;
  mode: 'auto' | 'shown' | 'hidden';
  isVisible: boolean;
  hasContent: boolean;
  pending: boolean;
  onMode: (m: 'auto' | 'shown' | 'hidden') => void;
  onEye: () => void;
  /* Order is not a row any more (owner 2026-10-07, Arrange "yes": the grip and ↑/↓ move a part); callers still
     hand these over, unread. */
  at?: number;
  of?: number;
  canUp?: boolean;
  canDown?: boolean;
  onUp?: () => void;
  onDown?: () => void;
  alignRow?: ReactNode;
  removeForm?: ReactNode;
}) {
  return (
    <>
      <div className="flex h-11 shrink-0 gap-1.5" data-stage-arrange="show">
        {openBrowse ? (
          <Dd
            small="On this stage"
            label="Show this scene"
            data="arrange-show"
            about={SHOW_ABOUT}
            value={mode}
            options={[
              { key: 'shown', label: 'Shown', ...(hasContent ? {} : { disabledNote: 'Add content first' }) },
              { key: 'auto', label: 'Auto' },
              { key: 'hidden', label: 'Hidden' },
            ]}
            onPick={(k) => !pending && k !== mode && onMode(k as 'auto' | 'shown' | 'hidden')}
          />
        ) : (
          <Dd
            small="On this stage"
            label="Show this scene"
            data="arrange-show"
            about={SHOW_ABOUT}
            value={isVisible ? 'shown' : 'hidden'}
            options={[
              { key: 'shown', label: 'Shown' },
              { key: 'hidden', label: 'Hidden' },
            ]}
            onPick={(k) => !pending && (k === 'shown') !== isVisible && onEye()}
          />
        )}
      </div>
      {alignRow}
      {removeForm ? <div className="shrink-0">{removeForm}</div> : null}
    </>
  );
}

'use client';

import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SP_DD, SP_DD_LABEL, SP_STEP_BUTTON } from '@/lib/maker-stage-room';
import { Dd } from './kit';
import { formatCount } from '@/lib/format-number';

/**
 * ↕ STYLE › ARRANGE — the prototype's three rows (`S.sphase === 'arrange'`):
 *
 *   ON THIS STAGE  Shown ▾          the scene's own Show (Shown · Auto · Hidden where the
 *                                   event lets guests browse, else Shown · Hidden)
 *   ORDER  3 of 9   ‹  ›            the navigator's own one-step move
 *   ALIGNMENT  Centre ▾ · SPACING Regular ▾   the scene's words, every part at once, and the
 *                                   room above and below it (`SceneAlignRow`; Spacing is
 *                                   `HubSectionCanvas.spacing`, owner 2026-10-07)
 *
 * Every pick is the SHIPPED write the scene inspector's Arrange made (`SceneArrangeTab`,
 * `editor-shell.tsx`'s `modeWrite` / `eyeWrite` / `move`); only the drawing is new.
 */
export function StageArrange({
  openBrowse,
  mode,
  isVisible,
  hasContent,
  pending,
  onMode,
  onEye,
  at,
  of,
  canUp,
  canDown,
  onUp,
  onDown,
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
  /** Its place on this stage, 1-based, and how many there are. */
  at: number;
  of: number;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
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
            value={isVisible ? 'shown' : 'hidden'}
            options={[
              { key: 'shown', label: 'Shown' },
              { key: 'hidden', label: 'Hidden' },
            ]}
            onPick={(k) => !pending && (k === 'shown') !== isVisible && onEye()}
          />
        )}
      </div>
      <div className="flex h-11 shrink-0 gap-1.5" data-stage-arrange="order">
        <span className={SP_DD}>
          <span className={SP_DD_LABEL}>Order</span>
          <span className="pl-1.5 text-[14px] font-medium text-[var(--sp-ink)]">
            {formatCount(at)} of {formatCount(of)}
          </span>
        </span>
        <button type="button" aria-label="Move up" data-stage-order="up" disabled={pending || !canUp} onClick={onUp} className={SP_STEP_BUTTON}>
          <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2.2} />
        </button>
        <button type="button" aria-label="Move down" data-stage-order="down" disabled={pending || !canDown} onClick={onDown} className={SP_STEP_BUTTON}>
          <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2.2} />
        </button>
      </div>
      {alignRow}
      {removeForm ? <div className="shrink-0">{removeForm}</div> : null}
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { FormRows, SwitchRow } from '@/app/_components/form-row';
import { SP_ROWS_ROW } from '@/lib/maker-stage-room';
import { keepPostEventShown, postEventSceneNow, type PostEventSceneNow } from './post-event-edit';

/**
 * 👁 "SHOWN TO GUESTS" — EDIT'S ROW 2 ON A POST EVENT SCENE (owner 2026-10-09, `TOOLBAR-SPEC-2026-10-09.md` § EDIT:
 * *"Post Event scenes: heading field + 'Shown to guests' switch"*; the approved prototype's row 2).
 *
 * The app's ONE switch (`SwitchRow`): on while guests meet the scene, its name the same on and off. It was a row of
 * the scene's panel under Style's cards, out of reach on a phone (`post-event-scene-panel.tsx`). The save is that
 * panel's own (`post-event-edit.ts` `keepPostEventShown` → `{ editorial: postEventShow(…) }`): flipped at the tap,
 * saved behind it, put back — and said — when the save does not land.
 *
 * A scene with no switch of its own (the cover, Were you there?, a song …) draws nothing here: row 2 stays empty.
 * Switched OFF, the scene leaves the page (the canvas draws only what guests meet) and stays picked, so it can be
 * switched on again right here.
 */
/** The switch's row laid along one of the four rows: the template's own line, at the row's 44 px. */
const SHOWN_FIT = '[&>[data-form-row]]:min-w-0 [&>[data-form-row]]:flex-1 [&_[data-form-row]>div]:!min-h-11';

export function PostEventShown({
  canvasKey,
  stamp,
  onRefused,
}: {
  /** The picked scene's canvas key (`p:<scene>`). */
  canvasKey: string;
  /** The Maker's render stamp — the scene is read again after every render. */
  stamp: string | undefined;
  /** A save that did not land — said through the toolbar's toast. */
  onRefused: (words: string) => void;
}) {
  const [now, setNow] = useState<PostEventSceneNow | null>(null);
  /** What the switch shows from the tap until the render that follows the save. */
  const [drawn, setDrawn] = useState<boolean | null>(null);
  useEffect(() => {
    setNow(postEventSceneNow(canvasKey));
    setDrawn(null);
  }, [canvasKey, stamp]);
  if (!now?.switchKey) return null;
  const shown = drawn ?? !now.hidden;
  return (
    /* (The rows' frame is outside the row, as Edit's words rows have it: the row's own box is the template row's parent.) */
    <FormRows data="stage-edit-shown" className="!contents">
      <div className={`${SP_ROWS_ROW} row-start-2 ${SHOWN_FIT}`} data-stage-edit-row="shown">
        <SwitchRow
          data="shown"
          name="Shown to guests"
          on={shown}
          onChange={(next) => {
            setDrawn(next);
            void keepPostEventShown(now, canvasKey, next).then((r) => {
              if (r.ok) return;
              setDrawn(null);
              onRefused(r.error);
            });
          }}
          attrs={{ 'data-post-event-shown': shown ? 'shown' : 'hidden' }}
        />
      </div>
    </FormRows>
  );
}

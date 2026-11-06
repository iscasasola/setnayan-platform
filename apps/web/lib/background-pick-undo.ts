/**
 * lib/background-pick-undo.ts — ↺ A BACKGROUND PICK, DRAWN BACKWARDS AT ONCE (`lib/maker-drawn-undo.ts`).
 *
 * Owner, live on his phone 2026-10-26: *"when undo is pressed on event hub. it blinks quickly for around 5-6 seconds
 * before undo is done"*. The three background savers — a scene's (`scene-background-row.tsx` › save), the Cover
 * Scene's (`cover-words-background.tsx` › put) and Studio › Look's (`main-background-panel.tsx` › pickLook) — handed
 * no inverse to the ↺ journal (they sat in `UNDO_NOT_DRAWN` as "phase 2"), so the ↺ after a background pick met a
 * barrier and took the SLOW path: an unheld undo, a whole-Maker render and a NEW canvas page, swapped in behind the
 * old one — the 6–10 s the undo plan measured, seen on a phone as the page blinking until the new page lands.
 *
 * Each of them already knows how to draw its BEFORE: its refused branch puts it back (the canvas preview, the Maker's
 * own copy, the row). Its ↺ is that same put-back, run at the press — then ONE held undo is sent behind it, and once
 * it lands the page redraws itself IN PLACE (`requestCanvasRedraw` — the same frame, the same scroll) where the bridge
 * could not draw all of it (a clip, a card coming or going, a colour the server measures). A refused ↺ draws the
 * AFTER again. No Maker render, no new canvas page: the preview changes once.
 *
 * Held by `the-background-undo-is-drawn-at-once.test.ts`.
 */
import type { DrawnUndo, UndoStep } from './maker-drawn-undo';
import { requestCanvasRedraw } from './maker-refresh';

export type BackgroundPickUndo = {
  /** Draw the BEFORE now: the canvas, the Maker's own copy, the row. */
  back: () => void;
  /** A refused ↺: draw the AFTER again. */
  forward: () => void;
  /** The page must redraw itself in place once the ↺ lands (the bridge could not draw all of the BEFORE). */
  redrawAfter: boolean;
};

export function backgroundPickUndo(o: BackgroundPickUndo, redraw: () => void = requestCanvasRedraw): UndoStep {
  return {
    undraw: (): DrawnUndo => {
      o.back();
      return {
        settle: Promise.resolve('shown'),
        now: true,
        landed: (ok) => {
          if (!ok) return o.forward();
          if (o.redrawAfter) redraw();
        },
      };
    },
  };
}

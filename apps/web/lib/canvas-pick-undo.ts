/**
 * lib/canvas-pick-undo.ts — ↺ A SCENE-CANVAS PICK, DRAWN BACKWARDS AT ONCE (`lib/maker-drawn-undo.ts`).
 *
 * Every held canvas pick (Style · Text · Animate · size · colour in `element-sheet.tsx` and Style's last row
 * `part-look.ts`; words in `part-words.ts` and `type-in-place.tsx`) already draws itself first and already puts itself
 * back when its save is refused. Its ↺ is that same put-back, run at the press: the BEFORE canvas on every page the
 * Maker shows (the bridge's own messages — `elStyle`, `typeText`) and in the Maker's own copy (`noteDraftedCanvas`, so
 * every open panel re-reads it through `hearDraftedCanvas` and the next pick builds on the undone state — the 110 %
 * case of #6485 cannot come back). A refused ↺ draws `next` again. Lazy: only those pickers import it.
 */
import type { HubSectionCanvas } from './hub-canvas';
import { canvasWriteKey, noteDraftedCanvas } from './maker-draft-store';
import { drawnNow, type UndoStep } from './maker-drawn-undo';

/** Every canvas frame the Maker holds (the stage on show and its warm stages). */
export function postToMakerCanvases(messages: readonly unknown[]): void {
  if (typeof document === 'undefined') return;
  document.querySelectorAll<HTMLIFrameElement>('iframe[data-maker-canvas-frame]').forEach((frame) => {
    for (const m of messages) frame.contentWindow?.postMessage(m, window.location.origin);
  });
}

/**
 * The ↺ of one canvas pick: `draw(from, to)` are the bridge messages that lay `to` over a page showing `from` (the
 * picker's own — the same ones its refused branch posts). Folded with the run's other picks under the canvas's write
 * key (`canvasWriteKey`), so a burst of − / + taps is ONE ↺, as it is one save.
 */
export function canvasPickUndo(
  type: string,
  before: HubSectionCanvas,
  next: HubSectionCanvas,
  server: HubSectionCanvas | null | undefined,
  draw: (from: HubSectionCanvas, to: HubSectionCanvas) => readonly unknown[],
): UndoStep {
  return {
    key: canvasWriteKey(type),
    undraw: () => {
      postToMakerCanvases(draw(next, before));
      noteDraftedCanvas(type, before, server);
      return drawnNow(() => {
        postToMakerCanvases(draw(before, next));
        noteDraftedCanvas(type, next, server);
      });
    },
  };
}

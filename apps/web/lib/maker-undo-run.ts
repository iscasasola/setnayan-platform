/**
 * lib/maker-undo-run.ts — ↺ THE PRESS THAT DRAWS ITS OWN UNDO (LAZY: loaded by the draft bar after the first step the
 * journal notes, never in the Maker's first load — `lib/maker-drawn-undo.ts` is the tiny half that is).
 *
 * In the ↺'s own click: the journal's newest step is drawn backwards NOW (the page and the Maker's own copy — ≤ 100 ms,
 * a scene's glide ≈ 200 ms), and ONE held undo is sent behind it — no whole-Maker render, no new canvas page. Its
 * answer decides:
 *   · ok and `matched`   → the drawing stays; "Saved to your draft".
 *   · refused            → the step goes back on the page and on top of the journal, and the line says why.
 *   · not matched        → the server stepped back from a state the Maker did not draw (another tab, a write it does
 *                          not know): the first render after this ↺ is the truth (#6485) — announced unheld, refreshed.
 * One press = one undo step: one entry off, one undo sent. Presses in a row each draw at once; their undos go one after
 * another (each waits for the answer before it, and for the save it takes back).
 */
import type { HubDraftActionResult } from './hub-draft';
import { stampOf, undoJournal, type DrawnUndo, type UndoEntry } from './maker-drawn-undo';
import { flushMakerWrites } from './maker-refresh';
import { announceMakerSave } from './maker-save-status';

export type UndoIo = {
  /** Send the HELD undo naming the state it expects to step back from (null: none known). Answered, never thrown. */
  send: (expect: string | null) => Promise<HubDraftActionResult>;
  /** The draft changed where the Maker did not draw it: the next render is the truth. */
  truth: () => void;
  /** The answer, for the bar's own line. */
  answered: (result: HubDraftActionResult) => void;
};

/** A ↺ the server refused: the step is back, and why. */
export const UNDO_REFUSED_WORDS = 'That Undo did not go through, so the change is back.';
/** A ↺ that stepped back from a state the Maker did not draw. */
export const UNDO_ELSEWHERE_WORDS = 'Your draft changed elsewhere — showing it as saved.';

let chain: Promise<void> = Promise.resolve();

/** ↺ in its click: the newest drawn step taken back NOW — or null (nothing the Maker can draw: the slow path). */
export function runDrawnUndo(io: UndoIo): DrawnUndo | null {
  const top = undoJournal.top();
  if (top === null || top === 'barrier') return null;
  const drawn = top.step.undraw();
  if (!drawn) return null;
  undoJournal.pop();
  announceMakerSave({ state: 'saving' });
  chain = chain.then(() => finish(top, drawn, io)).catch(() => {});
  return drawn;
}

async function finish(entry: UndoEntry, drawn: DrawnUndo, io: UndoIo): Promise<void> {
  /* The save it takes back goes first — a pick still waiting for its beat is sent now. */
  flushMakerWrites();
  let first: unknown;
  try {
    first = await entry.result;
  } catch {
    first = null;
  }
  /* That save never landed (refused, carried by a later pick, never answered): the page already shows the state the
     draft holds — nothing to take back on the server. */
  if (!first || typeof first !== 'object' || (first as { ok?: unknown }).ok !== true) {
    drawn.landed(true);
    return;
  }
  const r = await io.send(stampOf(first));
  if (!r.ok) {
    drawn.landed(false);
    undoJournal.putBack(entry);
    announceMakerSave({ state: 'error', text: `${UNDO_REFUSED_WORDS} ${r.error}`.trim() });
    io.answered(r);
    return;
  }
  drawn.landed(true);
  if (r.matched !== true) {
    io.truth();
    undoJournal.clear();
    announceMakerSave({ state: 'error', text: UNDO_ELSEWHERE_WORDS });
    io.answered(r);
    return;
  }
  announceMakerSave({ state: 'saved' });
  io.answered(r);
}

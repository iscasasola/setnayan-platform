/**
 * lib/maker-settle.ts — ⏳ "THE PAGE SHOWS IT NOW": when a write that owes the canvas a reload has reached the screen.
 *
 * Owner, 2026-10-11, on his own event in the new Maker (a Vercel preview, a real round trip):
 *   · Message › Earlier — *"first press a pop up says it moved but didn't only moved on the second click"* (the draft
 *     held exactly ONE move);
 *   · ↺ — *"pressed undo twice before it reversed that edit. not once"*.
 * One fault. A move, an undo, a part brought back are NOT drawn by the bridge: the save lands, the Maker asks for
 * one render, and the canvas reloads behind the page it shows and swaps when the new one is ready
 * (`buffered-canvas-frame.tsx`). On a real connection that is seconds. In those seconds nothing on screen had
 * changed, the toast had already said "moved", and every control was live again — so the natural second press
 * landed as a SECOND action (a second undo step), or as nothing.
 *
 * `whenCanvasShowsIt()` is the one answer to "has it reached the screen?": it resolves when no Maker save is in
 * flight, no canvas is loading, and the canvas ON SHOW is a different frame from the one that was on show at the
 * press (a reload always mounts a new frame — the old one is never patched). Callers hold their control busy until
 * then, and say what happened only then.
 *
 *   'shown'    the page on screen is the new one
 *   'failed'   the write was refused (the toolbar's own line says why — `lib/maker-save-status.ts`)
 *   'timeout'  nothing came in `timeoutMs`: the control is given back; the caller says nothing it cannot see
 *
 * `settleVerdict` is the rule, pure (`maker-settle.test.ts`); the rest reads the document.
 */
import { makerSavesInFlight } from './maker-refresh';
import { MAKER_SAVE_STATUS_EVENT, type MakerSaveStatus } from './maker-save-status';

export type CanvasSettle = 'shown' | 'failed' | 'timeout';

/** What is read each look: saves still on their way, canvases still loading, and the frame on show (any identity). */
export type SettleSample = { saves: number; loading: number; shown: unknown };

/**
 * THE RULE. `before` is the frame on show at the press (null: there was none — nothing to wait for but the save).
 * 'wait' while anything is still on its way, or the page on show is still the one from before the press.
 */
export function settleVerdict(before: unknown, now: SettleSample): 'wait' | 'shown' {
  if (now.saves > 0 || now.loading > 0) return 'wait';
  if (before === null || before === undefined) return 'shown';
  return now.shown !== null && now.shown !== undefined && now.shown !== before ? 'shown' : 'wait';
}

const SHOWN = 'iframe[data-maker-canvas-frame="shown"]';
const LOADING = 'iframe[data-maker-canvas-frame="loading"]';

/** How long a control is held for a page that never comes — a slow phone on a slow line, then it is given back. */
export const CANVAS_SETTLE_TIMEOUT_MS = 20_000;

/**
 * WATCH FROM THE PRESS. Call it AT the press (the frame on show is read now); `done` resolves as above; `cancel()`
 * ends it at once as 'failed' — for a caller that learns its write was refused before the toolbar says so.
 *
 * ⚠ Never `await` it inside a React transition: the Maker's render is a transition too, and React holds every
 * transition's commit until an async one has finished — the wait would be waiting on itself.
 */
export function canvasSettleWatch(timeoutMs: number = CANVAS_SETTLE_TIMEOUT_MS): { done: Promise<CanvasSettle>; cancel: () => void } {
  if (typeof window === 'undefined' || typeof document === 'undefined') return { done: Promise.resolve('shown'), cancel: () => {} };
  const before = document.querySelector(SHOWN);
  let end: (how: CanvasSettle) => void = () => {};
  const done = new Promise<CanvasSettle>((resolve) => {
    const started = Date.now();
    let over = false;
    end = (how) => {
      if (over) return;
      over = true;
      window.clearInterval(tick);
      window.removeEventListener(MAKER_SAVE_STATUS_EVENT, onStatus);
      resolve(how);
    };
    const onStatus = (e: Event) => {
      if ((e as CustomEvent<MakerSaveStatus>).detail?.state === 'error') end('failed');
    };
    window.addEventListener(MAKER_SAVE_STATUS_EVENT, onStatus);
    const tick = window.setInterval(() => {
      const sample = { saves: makerSavesInFlight(), loading: document.querySelectorAll(LOADING).length, shown: document.querySelector(SHOWN) };
      if (settleVerdict(before, sample) === 'shown') end('shown');
      else if (Date.now() - started > timeoutMs) end('timeout');
    }, 120);
  });
  return { done, cancel: () => end('failed') };
}

/** The same, for a caller with nothing to cancel. */
export function whenCanvasShowsIt(timeoutMs: number = CANVAS_SETTLE_TIMEOUT_MS): Promise<CanvasSettle> {
  return canvasSettleWatch(timeoutMs).done;
}

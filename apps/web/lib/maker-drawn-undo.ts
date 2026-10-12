/**
 * lib/maker-drawn-undo.ts — ↺ AN UNDO THE PAGE ALREADY SHOWS (owner rule: "the Maker never slow, ≤100 ms per tap,
 * saves in the background"; 2026-10-12 lab: ↺ after a drag reloaded the page 4–7 s later).
 *
 * When ↺ takes back a step the drag made (a move, a scene taken off, a part added — `scene-drag.tsx`), the drag draws
 * the step's inverse on the page AT the press and CLAIMS this press here, from its capture listener on the Undo button.
 * The draft bar (`hub-draft-bar.tsx`) takes the claim in that same click: its save is then HELD — no whole-Maker
 * render, no new canvas page — and the claim is told how the save ended (`landed`): a refused undo puts the page back
 * to the truth and the bar says why. The bar waits on `settle` (the page shows it) instead of a new canvas frame.
 *
 * A claim lives for ONE click: one not taken within `DRAWN_UNDO_TTL_MS` is void (the Undo the click aimed at did not
 * run). Tiny on purpose — the draft bar is in the Maker's first load.
 */
export type DrawnUndo = { settle: Promise<'shown' | 'failed' | 'timeout'>; landed: (ok: boolean) => void };

export const DRAWN_UNDO_TTL_MS = 600;

let claim: { undo: DrawnUndo; at: number } | null = null;

/** The drag drew this Undo's inverse: the press that follows saves it held. */
export function claimDrawnUndo(undo: DrawnUndo, now: number = Date.now()): void {
  claim = { undo, at: now };
}

/** The draft bar, in the Undo's own click: the claim made for it, or null (an Undo nobody drew — the reload as ever). */
export function takeDrawnUndo(now: number = Date.now()): DrawnUndo | null {
  const c = claim;
  claim = null;
  return c && now - c.at <= DRAWN_UNDO_TTL_MS ? c.undo : null;
}

/** Still waiting for its click (the Undo never ran): withdrawn here — the drag then takes its drawing back. */
export function withdrawDrawnUndo(undo: DrawnUndo): boolean {
  if (claim?.undo !== undo) return false;
  claim = null;
  return true;
}

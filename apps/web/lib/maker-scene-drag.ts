/**
 * apps/web/lib/maker-scene-drag.ts
 *
 * ✋ A SCENE IS MOVED BY HOLDING IT ON THE PAGE AND DRAGGING IT, AND REMOVED BY DROPPING IT ON A BIN.
 *
 * Owner, 2026-10-11 (DECISION_LOG "IN THE MAKER, A SCENE IS MOVED BY DRAGGING IT ON THE PAGE AND REMOVED BY DROPPING
 * IT ON A BIN"): *"what if we drag the scene on the preview instead of having this. then there is a delete button
 * where they can drag the scene to the delete button to delete it"* · *"just like instagram"* · *"when we drag
 * something the bottom toolbar collapses and shows the whole page. make sure animation to collapse and expand
 * shows"* · *"our build is the drag by scene"*. The approved prototype is
 * `prototypes/maker_drag_scenes_2026-10-11.html`; every number and every word below is that file's own.
 *
 * THE RULES, pure — the drag's hands are `scene-canvas-drag.ts` (the frame's document) and `scene-drag.tsx` (the
 * Maker's side); this file decides. `maker-scene-drag.test.ts` executes it.
 *
 *   WHAT MOVES      a SCENE (or a Post Event scene with a place in the run) — `sceneMovesAmong` answers with the
 *                   parts it may land among, which is exactly the list the tag menu's Move up · Move down walk
 *                   (`add-part-sheet.tsx` `moveTargets` reads it). A fixed part, the Reveal, the reply card: never.
 *   WHERE IT LANDS  only where the page CHANGES (`stepChangesThePage`): never across the Wedding March. The gap
 *                   opens only among those parts, so it cannot open above the Reveal or the reply card either.
 *   ONE DROP        one target and one side (`sceneDropTarget`) → the shipped drop rule (`makerDropDelta`) → ONE
 *                   order write of the stage's own order (`stageOrderPatch`, under the stage's key) = one Undo step.
 *   BUSY            no second lift while a press is still on its way to the page (`sceneLiftAllowed`).
 */
import type { MakerTile } from './maker-scene-list';
import { stepChangesThePage } from './stage-scenes';

/* ── the prototype's numbers ─────────────────────────────────────────────────────────────────────────────────── */

/** A finger must rest this long before the scene lifts (prototype `HOLD_MS`). */
export const SCENE_HOLD_MS = 350;
/** A finger that moves this far before the hold ends is scrolling — the hold is cancelled (prototype `SLOP`). */
export const SCENE_SCROLL_PX = 8;
/** A mouse lifts on the first real move: this far, no hold (the prototype's `> 6`). */
export const SCENE_MOUSE_LIFT_PX = 6;
/** Near the page's top or bottom edge the page scrolls by itself (prototype `EDGE`). */
export const SCENE_EDGE_PX = 56;
/** The fastest the page scrolls by itself, per frame (the prototype's `14`). */
export const SCENE_EDGE_MAX_STEP = 14;
/** The lower third slides away while a scene is held, and back on release (prototype `--dur`, `--ease`). */
export const SCENE_COLLAPSE_MS = 280;
export const SCENE_COLLAPSE_EASE = 'cubic-bezier(.4,0,.2,1)';
/** …and under Reduce Motion: a short fade (the prototype's `.2s`). */
export const SCENE_COLLAPSE_CALM_MS = 200;
/** How far outside the bin's circle a finger still counts as on it (the prototype's `pad = 26`). */
export const SCENE_BIN_REACH_PX = 26;
/** The others glide to make room; the dropped scene settles (the prototype's `.18s`). */
export const SCENE_GLIDE_MS = 180;
/** A scene dropped on the bin shrinks into it (the prototype's `200`). */
export const SCENE_BIN_MS = 200;
/** A line that is not kept leaves by itself (the prototype's `3200`). */
export const SCENE_STATUS_MS = 3200;
/** The tap a drop leaves behind is not a pick. */
export const SCENE_SWALLOW_MS = 450;

/* ── the prototype's words — exactly, no synonyms ────────────────────────────────────────────────────────────── */

export const SCENE_DRAG_WORDS = {
  /** Over the bin, while a scene is lifted. */
  bin: 'Drop here to remove',
  /** The line under the tools, from the drop until the page shows it. */
  saving: 'Saving…',
  /** The save was refused: the scene slid back, and this is said. */
  failed: 'That did not save. Nothing changed — please try again.',
  /** After a drop on the bin — beside the Undo button. */
  removed: (label: string) => `${label} removed`,
  undo: 'Undo',
  /** After that Undo. */
  back: (label: string) => `${label} is back`,
  /** After ↺ took a move back. */
  moveUndone: 'Move undone',
  /** The fallback for someone who cannot drag: the picked scene's name tag opens these three. */
  up: 'Move up',
  down: 'Move down',
  remove: 'Remove',
  /** What the name tag says to a screen reader. */
  tag: (label: string) => `${label} — move or remove`,
  /** The Reveal's own reason (every other part says the shipped `makerPartStepWhy`). */
  revealWhy: 'The Reveal is always first on this page.',
} as const;

/**
 * ↺ THE MAKER'S OWN UNDO — the ONE button in its top bar, and nothing else on the page.
 *
 * Named by what only that button carries: `data-bar-item="Undo"` (`hub-draft-button.tsx`), inside the draft bar's own
 * actions (`hub-draft-bar.tsx` `data-maker-draft-actions`). 🔒 NEVER BY ITS `aria-label`: the line's own Undo is an
 * `ActionButton`, and an ActionButton's `aria-label` is its word — "Undo" too. Named by the label, the line's button
 * WAS "the Maker's Undo": its own press was heard as ↺ (the step was forgotten and the line cleared before anything
 * was asked of the draft), and the press it then made found nothing to say (measured in the lab, 2026-10-11 → 12 —
 * "the line clears, nothing comes back"). One selector, no second spelling.
 */
export const SCENE_UNDO_BUTTON = '[data-maker-shell] [data-maker-draft-actions] button[data-bar-item="Undo"]';

/**
 * ▾ THE THREE STEPS FOR WHOEVER CANNOT DRAG, in the prototype's order and words (`#menu`: Move up · Move down ·
 * Remove) — "Delete" where the part is a scene of the couple's own (it asks first, and is gone for good at Apply).
 * `on: false` is a step the part cannot take: it is drawn grey and STILL answers — a tap says why, never nothing.
 */
export type SceneMenuStep = 'up' | 'down' | 'remove';
export function sceneMenuRows(can: { up: boolean; down: boolean; remove: boolean }, removeWord: 'Remove' | 'Delete'): Array<{ step: SceneMenuStep; words: string; on: boolean; danger: boolean }> {
  return [
    { step: 'up', words: SCENE_DRAG_WORDS.up, on: can.up, danger: false },
    { step: 'down', words: SCENE_DRAG_WORDS.down, on: can.down, danger: false },
    { step: 'remove', words: removeWord === 'Delete' ? removeWord : SCENE_DRAG_WORDS.remove, on: can.remove, danger: true },
  ];
}

/* ── what moves, and among what ──────────────────────────────────────────────────────────────────────────────── */

/** What is held, in the stage list's terms. */
export type SceneHeld = { kind: 'scene'; type: string } | { kind: 'post-event'; runKey: string | null } | { kind: 'fixed' };

/** One part the held scene may land above or below. `key` is its canvas marker; `id` is what the order write names. */
export type SceneNeighbour = { key: string; id: string };

/**
 * THE PARTS A HELD SCENE MAY LAND AMONG, in the stage list's order — never itself. A scene lands among scenes on its
 * own side of the Wedding March (`stepChangesThePage`: across it the order would change and the page would not); a
 * Post Event scene among the others that have a place in the run; a fixed part among nothing.
 */
export function sceneMovesAmong(stage: string, shown: readonly MakerTile[], held: SceneHeld, heldKey: string | null): SceneNeighbour[] {
  const out: SceneNeighbour[] = [];
  if (held.kind === 'fixed') return out;
  for (const t of shown) {
    const key = t.kind === 'post-event' ? t.anchor : t.key;
    if (!key || key === heldKey) continue;
    if (held.kind === 'scene') {
      if (t.kind !== 'scene' || !stepChangesThePage(stage, held.type, t.type)) continue;
      out.push({ key, id: t.widgetId });
    } else {
      if (t.kind !== 'post-event' || !t.runKey || t.runKey === held.runKey) continue;
      out.push({ key, id: t.runKey });
    }
  }
  return out;
}

/* ── where it lands ──────────────────────────────────────────────────────────────────────────────────────────── */

/** A row of the page as it was laid out at the lift: its top on the page, and its height. */
export type SceneRow = { top: number; height: number };

/** The page with the gap at `slot`: each row's new top, where the gap is, and how far the page between two slots moved. */
export type SceneReflow = {
  /** By ORIGINAL index: where that row's top stands now (the held row: where its gap stands). */
  tops: number[];
  /** The gap the held scene would land in. */
  gap: SceneRow;
  /** By slot: how far whatever stands just BEFORE that slot (a fixed part between two scenes) moved. `between[0]` is 0. */
  between: number[];
};

/**
 * THE PAGE WITH THE GAP OPENED AT `slot`. `rows` are the held scene and the parts it may land among, in page order;
 * `at` is the held one; `slot` counts among the OTHERS (0 = before the first of them … n − 1 = after the last).
 *
 * The scenes change places IN THE SLOTS SCENES ALREADY TAKE — whatever stands between two slots (a fixed part) keeps
 * its place among them, and only shifts by the difference in height of what now stands above it. That is what the
 * page draws once the order is saved (`lib/maker-reorder.ts` `optimisticStageList`), so what is seen while dragging
 * is what the save brings.
 */
export function sceneReflow(rows: readonly SceneRow[], at: number, slot: number): SceneReflow {
  const n = rows.length;
  const others = rows.map((_, i) => i).filter((i) => i !== at);
  const s = Math.max(0, Math.min(others.length, slot));
  const order = [...others.slice(0, s), at, ...others.slice(s)];
  const tops = new Array<number>(n).fill(0);
  const between = new Array<number>(n).fill(0);
  let moved = 0;
  for (let j = 0; j < n; j++) {
    between[j] = moved;
    tops[order[j]!] = rows[j]!.top + moved;
    moved += rows[order[j]!]!.height - rows[j]!.height;
  }
  return { tops, gap: { top: tops[at] ?? 0, height: rows[at]?.height ?? 0 }, between };
}

/**
 * WHERE THE HELD SCENE WOULD LAND with the finger at `y` (on the page): before the first of the others whose MIDDLE
 * is below the finger, else after the last — measured on the page as it stands with the gap where it is now
 * (`slot`), the prototype's own rule (`place()`: layout positions, never the gliding ones).
 */
export function sceneDropSlot(rows: readonly SceneRow[], at: number, slot: number, y: number): number {
  const others = rows.map((_, i) => i).filter((i) => i !== at);
  const now = sceneReflow(rows, at, slot);
  for (let p = 0; p < others.length; p++) {
    const i = others[p]!;
    if (y < now.tops[i]! + rows[i]!.height / 2) return p;
  }
  return others.length;
}

/**
 * THE DROP, AS THE ORDER WRITE NAMES IT: the neighbour it lands beside, and on which side — null when it settles
 * back where it was (nothing is saved, no Undo step). `names` are the rows' names in page order, the held one at `at`.
 */
export function sceneDropTarget<N>(names: readonly N[], at: number, slot: number): { target: N; where: 'above' | 'below' } | null {
  const others = names.filter((_, i) => i !== at);
  if (others.length === 0 || slot === at) return null;
  if (slot < others.length) return { target: others[slot]!, where: 'above' };
  return { target: others[others.length - 1]!, where: 'below' };
}

/** The rows' names with the held one dropped at `slot` — the page order the drop makes. */
export function sceneOrderAfter<N>(names: readonly N[], at: number, slot: number): N[] {
  const others = names.filter((_, i) => i !== at);
  const s = Math.max(0, Math.min(others.length, slot));
  return [...others.slice(0, s), names[at]!, ...others.slice(s)];
}

/* ── the bin, the edges, the busy rule ───────────────────────────────────────────────────────────────────────── */

export type SceneBox = { left: number; top: number; right: number; bottom: number };

/** Is the finger on the bin — its circle, and `SCENE_BIN_REACH_PX` around it? */
export function sceneOverBin(x: number, y: number, bin: SceneBox | null, reach: number = SCENE_BIN_REACH_PX): boolean {
  if (!bin) return false;
  return x > bin.left - reach && x < bin.right + reach && y > bin.top - reach && y < bin.bottom + reach;
}

/**
 * HOW FAR THE PAGE SCROLLS BY ITSELF THIS FRAME (px; negative = up) with the finger at `y` between the page's `top`
 * and `bottom` — the prototype's `tick()`: within `SCENE_EDGE_PX` of an edge, faster the nearer; never while the
 * finger is on the bin (the bin sits in that band), never once the finger is past the bottom.
 */
export function sceneEdgeScroll(y: number, top: number, bottom: number, overBin: boolean): number {
  if (y < top + SCENE_EDGE_PX) return -Math.min(SCENE_EDGE_MAX_STEP, Math.ceil((top + SCENE_EDGE_PX - y) / 5));
  if (y > bottom - SCENE_EDGE_PX && y < bottom && !overBin) return Math.min(SCENE_EDGE_MAX_STEP, Math.ceil((y - (bottom - SCENE_EDGE_PX)) / 5));
  return 0;
}

/** What a press on the page may do right now. */
export type SceneLiftVerdict = 'lift' | 'busy' | 'no';

/**
 * MAY A SCENE BE LIFTED NOW? Never while a sheet or a menu is open, the page plays, the couple types or previews
 * ('no' — the press is not the drag's at all); and never while an earlier drop is still on its way to the page
 * ('busy' — the same one-press-at-a-time rule as every step, `lib/maker-settle.ts`: the scene stays put, and the
 * line says the page is catching up).
 */
export function sceneLiftAllowed(now: { working: boolean; away: boolean; sheetOpen: boolean }): SceneLiftVerdict {
  if (now.away || now.sheetOpen) return 'no';
  return now.working ? 'busy' : 'lift';
}

/**
 * A HELD SAVE HAS ANSWERED (a scene taken off is drawn at once by the bridge and no reload follows — there is no new
 * page to wait for): the save this press started has begun (`started` moved on from what it was at the press) and
 * none is in flight.
 */
export function sceneHeldSaveDone(startedAtPress: number, now: { started: number; inFlight: number }): boolean {
  return now.started > startedAtPress && now.inFlight === 0;
}

/**
 * 📐 THE PAGE KEEPS ITS PLACE WHILE THE LOWER THIRD IS AWAY. While a scene is held the page is taller ON SCREEN by
 * the lower third's height; a page scrolled near its end would be pulled down as it grew. So it is given exactly
 * that much room at its end BEFORE it grows, and the room is taken away only AFTER the panel is back — at both
 * moments the furthest it can scroll is what it always was. `scenePadDone` is the last check: the room goes only
 * when taking it would leave the page where it is (else it waits for a scroll that makes that true).
 * `scrollHeight` is read with the room still on.
 */
export function scenePadDone(scrollTop: number, scrollHeight: number, clientHeight: number, pad: number): boolean {
  return scrollTop <= scrollHeight - pad - clientHeight;
}

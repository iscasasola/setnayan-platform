/**
 * lib/maker-drawn-undo.ts — ↺ EVERY UNDO THE MAKER CAN DRAW ITSELF, ANSWERED AT ONCE (owner rule: "a press answers at
 * once"; plan `UNDO_PLAN_2026-10-13.md`). Until 2026-10-13 the Maker remembered ONE step it could draw backwards — the
 * last scene drag — and every other ↺ (the 2nd of a run of moves, any Style · Text · Animate · words · RSVP line, at any
 * depth) became an UNHELD save: a whole-Maker render and a new canvas page, 6–10 s at production speed.
 *
 * 📒 THE JOURNAL. Every held save that can be drawn backwards leaves its inverse here AT THE MOMENT IT IS SENT
 * (`makerSave(…, { held: true, undo })`, or the work area's own `noteUndoStep` for a scene step): `undraw` draws it
 * back on the page and in the Maker's own copy NOW and returns how to hear the undo's save (`DrawnUndo`). A write the
 * Maker did NOT draw — an unheld save, a form, a held save with no inverse — leaves a BARRIER: the ↺ that meets it takes
 * the slow path (the truth). A quick run of picks under one write key (`makerLatestWrite`) is ONE server step: an entry
 * whose write a later pick carried (`SUPERSEDED`) is folded into that later one — its undraw then goes back to the run's
 * FIRST before (each inverse drawn newest first), its put-back forward again.
 *
 * Each entry keeps the save's ANSWER, whose `stamp` names the state the server was left in (`lib/hub-draft-stamp.ts`).
 * The ↺ (`lib/maker-undo-run.ts`, lazy) sends that stamp as `expect`: a mismatch is the truth path, never a guess.
 *
 * The core is pure (`createUndoJournal`, tested bare); `undoJournal` is the one shared instance. Tiny on purpose — the
 * draft bar and `maker-refresh.ts` are in the Maker's first load. No imports.
 */

/** How the undo's held save ended, told to the drawing: `landed(false)` puts the step back on the page. */
export type DrawnUndo = { settle: Promise<'shown' | 'failed' | 'timeout'>; landed: (ok: boolean) => void };

/** A step the Maker drew, and how to draw it backwards. */
export type UndoStep = {
  /** The write key of a run of quick picks (`makerLatestWrite`): a step a later pick of the run carried folds into it. */
  key?: string;
  /** Draw the step's inverse NOW (page and the Maker's own copy). Null: it cannot be drawn here — the slow path. */
  undraw: () => DrawnUndo | null;
};

export type UndoEntry = { step: UndoStep; result: Promise<unknown>; answered: boolean; answer: unknown };
type Barrier = { barrier: true };
type Slot = UndoEntry | Barrier;

/** The server keeps ten Undo states (`HUB_DRAFT_HISTORY_LIMIT`); the journal never holds more. */
export const UNDO_JOURNAL_LIMIT = 10;

/** ↺ The form field a drawn undo names the state it expects to step back from with (`hub-draft-actions.ts`). */
export const HUB_DRAFT_EXPECT_FIELD = 'expect';

const isBarrier = (s: Slot | undefined): s is Barrier => Boolean(s && 'barrier' in s);
const refused = (a: unknown) => Boolean(a && typeof a === 'object' && (a as { ok?: unknown }).ok !== true);

/** The stamp a save's answer carries (`HubDraftActionResult.stamp`). */
export function stampOf(answer: unknown): string | null {
  const s = answer && typeof answer === 'object' ? (answer as { stamp?: unknown }).stamp : null;
  return typeof s === 'string' && s ? s : null;
}

/** A folded run's inverse: the newer drawn back first, then the older; put back the other way round. */
function fold(newer: UndoStep['undraw'], older: UndoStep['undraw']): UndoStep['undraw'] {
  return () => {
    const a = newer();
    if (!a) return null;
    const b = older();
    if (!b) {
      a.landed(false);
      return null;
    }
    return {
      settle: Promise.all([a.settle, b.settle]).then(([x, y]) => (x !== 'shown' ? x : y)),
      landed: (ok) => {
        if (ok) {
          a.landed(true);
          b.landed(true);
          return;
        }
        b.landed(false);
        a.landed(false);
      },
    };
  };
}

export type UndoJournal = {
  /** A drawn step was SENT; `result` is its save (the answer, or `SUPERSEDED`). Refused or thrown: it leaves the journal. */
  push(step: UndoStep, result: Promise<unknown>): UndoEntry;
  /** A write the Maker did not draw: the ↺ that meets it takes the slow path. */
  barrier(): void;
  /** Restore · Apply · a reload: nothing here is the server's any more. */
  clear(): void;
  /** The newest slot after folding — an entry, `'barrier'`, or null (empty). */
  top(): UndoEntry | 'barrier' | null;
  /** Take the newest slot off. */
  pop(): void;
  /** A refused ↺: its step is the newest again. */
  putBack(entry: UndoEntry): void;
  /** After a slow ↺: off the top until the newest entry's state IS the server's (`stamp`) — else empty. */
  trimTo(stamp: string | null): void;
  /** Slots held — the test's probe. */
  size(): number;
};

/** `superseded(answer)`: a later pick carried this write (`maker-refresh.ts` `SUPERSEDED`). */
export function createUndoJournal(superseded: (answer: unknown) => boolean, limit = UNDO_JOURNAL_LIMIT): UndoJournal {
  let list: Slot[] = [];
  const add = (s: Slot) => {
    /* Two barriers in a row say no more than one. */
    if (isBarrier(s) && isBarrier(list[list.length - 1])) return;
    list.push(s);
    if (list.length > limit) list = list.slice(list.length - limit);
  };
  const remove = (e: UndoEntry) => {
    list = list.filter((s) => s !== e);
  };
  const compact = () => {
    for (let i = 0; i < list.length; i += 1) {
      const s = list[i]!;
      if (isBarrier(s) || !s.answered || !superseded(s.answer)) continue;
      /* Carried by a later pick of the same run: that one is the server's step for both. */
      const j = list.findIndex((x, k) => k > i && !isBarrier(x) && x.step.key !== undefined && x.step.key === s.step.key);
      if (j < 0) list[i] = { barrier: true };
      else {
        const later = list[j] as UndoEntry;
        later.step = { key: later.step.key, undraw: fold(later.step.undraw, s.step.undraw) };
        list.splice(i, 1);
      }
      i -= 1;
    }
  };
  return {
    push(step, result) {
      const entry: UndoEntry = { step, result, answered: false, answer: undefined };
      add(entry);
      result.then(
        (a) => {
          entry.answered = true;
          entry.answer = a;
          /* Refused: the step never happened on the server (its own put-back already ran). */
          if (!superseded(a) && refused(a)) remove(entry);
        },
        () => remove(entry),
      );
      return entry;
    },
    barrier() {
      add({ barrier: true });
    },
    clear() {
      list = [];
    },
    top() {
      compact();
      const s = list[list.length - 1];
      return s === undefined ? null : isBarrier(s) ? 'barrier' : s;
    },
    pop() {
      list.pop();
    },
    putBack(entry) {
      add(entry);
    },
    trimTo(stamp) {
      compact();
      while (list.length > 0) {
        const s = list[list.length - 1]!;
        if (stamp && !isBarrier(s) && s.answered && stampOf(s.answer) === stamp) return;
        list.pop();
      }
    },
    size: () => list.length,
  };
}

/** The one journal of this Maker (a symbol answer is `SUPERSEDED` — the only one a save resolves to). */
const journal = createUndoJournal((a) => typeof a === 'symbol');
export const undoJournal: UndoJournal = {
  ...journal,
  push(step, result) {
    const e = journal.push(step, result);
    fireFirst();
    return e;
  },
};

/** True while the ↺ itself sends: its own write is not a step of the journal (no barrier). */
let quiet = false;
export function undoJournalQuiet<T>(fn: () => T, on = true): T {
  if (!on) return fn();
  quiet = true;
  try {
    return fn();
  } finally {
    quiet = false;
  }
}
export function undoJournalIsQuiet(): boolean {
  return quiet;
}

/** A step the work area drew itself, noted at the press (its save may wait in a queue). */
export function noteUndoStep(step: UndoStep, result: Promise<unknown>): void {
  undoJournal.push(step, result);
}

/** 🔥 Told once, at the first step noted — the draft bar warms the ↺'s lazy runner then, so the first ↺ never waits. */
let firstNote: (() => void) | null = null;
export function onFirstUndoStep(fn: () => void): void {
  firstNote = fn;
  if (undoJournal.size() > 0) fireFirst();
}
function fireFirst() {
  const fn = firstNote;
  firstNote = null;
  fn?.();
}

/* ── the scene steps: the page's drawer (`scene-drag.tsx`) lends itself here; the work area's entries call it ── */

/** A scene step the work area drew (`editor-shell.tsx`): what its ↺ needs, by value — never "the last one". */
export type SceneUndoData = {
  kind: 'move' | 'remove' | 'add';
  id: string;
  stage: string;
  /** The scene's page key and name (`w:<type>`, the line's words). */
  key: string;
  label: string;
  /** A move: the stage's order before and after. */
  prior?: readonly string[];
  moved?: readonly string[];
  /** A ＋: the render stamp its own Maker render landed at (undefined: not yet — the slow path). */
  landedAt?: string;
};
let sceneUndrawer: ((d: SceneUndoData) => DrawnUndo | null) | null = null;
/** The drag lends the page its drawer while it is mounted; returns the hand-back. */
export function setSceneUndrawer(fn: (d: SceneUndoData) => DrawnUndo | null): () => void {
  sceneUndrawer = fn;
  return () => {
    if (sceneUndrawer === fn) sceneUndrawer = null;
  };
}
/** A scene step's inverse — by the page's drawer, or null (no drawer mounted: the slow path). */
export function undrawScene(d: SceneUndoData): DrawnUndo | null {
  return sceneUndrawer ? sceneUndrawer(d) : null;
}

/** Drawn at once with nothing to wait for — a bridge message and the Maker's copy (`settle` is now). */
export function drawnNow(putBack: () => void): DrawnUndo {
  return {
    settle: Promise.resolve('shown'),
    landed: (ok) => {
      if (!ok) putBack();
    },
  };
}

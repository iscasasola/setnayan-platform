'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Undo2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { CANVAS_REFRESH_MESSAGE, MAKER_UNHELD_WRITE_EVENT, makerSavesInFlight, makerSavesStarted, requestMakerRefresh } from '@/lib/maker-refresh';
import { onMakerSave } from '@/lib/maker-save-status';
import { CANVAS_SETTLE_TIMEOUT_MS, type CanvasSettle } from '@/lib/maker-settle';
import {
  SCENE_COLLAPSE_CALM_MS,
  SCENE_COLLAPSE_EASE,
  SCENE_COLLAPSE_MS,
  SCENE_DRAG_WORDS,
  SCENE_STATUS_MS,
  SCENE_UNDO_BUTTON,
  sceneHeldSaveDone,
  sceneLiftAllowed,
  scenePadDone,
  type SceneBox,
} from '@/lib/maker-scene-drag';
import { setSceneUndrawer, type DrawnUndo, type SceneUndoData } from '@/lib/maker-drawn-undo';
import { attachSceneDrag, type SceneDragHost, type SceneDragSubject, type SceneDragWired, type SceneDrop } from './scene-canvas-drag';

/**
 * ✋ 🗑 THE DRAG, ON THE MAKER'S SIDE (owner 2026-10-11, DECISION_LOG "IN THE MAKER, A SCENE IS MOVED BY DRAGGING IT
 * ON THE PAGE AND REMOVED BY DROPPING IT ON A BIN"; approved prototype `prototypes/maker_drag_scenes_2026-10-11.html`).
 *
 * The scene itself is held in the canvas's own document (`scene-canvas-drag.ts`). What is the MAKER'S is here:
 *
 *   THE BIN       comes up in the thumb zone while a scene is lifted — "Drop here to remove" — and goes with it.
 *   THE COLLAPSE  `held` is true from the lift to the release: whoever holds the lower third slides it away so the
 *                 whole page shows, and back (`SCENE_COLLAPSE_MS`, `SCENE_COLLAPSE_EASE` — both motions seen; a
 *                 short fade under Reduce Motion). The page keeps its place: it is given room at its end for as
 *                 long as it is taller, and the room goes only once the panel is back (`scenePadDone`).
 *   THE LINE      under the tools (the toolbar's row 4, where Earlier · Later · Remove stood): "Saving…" from the
 *                 drop until the page shows it; "<Scene> removed" beside Undo; "That did not save. Nothing changed —
 *                 please try again." after the scene has slid back; why a part keeps its place.
 *   ↺             the Maker's own Undo, one press: the line's Undo button PRESSES it (never a second door to the
 *                 draft), and whichever way it was pressed the line says "Move undone" / "<Scene> is back" — only
 *                 when the step it took back is the one made here (no other save since).
 *
 * 🔒 NOTHING HERE WRITES. Every move and every remove is the work area's own, handed in (`drop`, `remove` —
 * `add-part-sheet.tsx`); this file waits for how each ended and says it.
 *
 * In the lazy Stages chunk: none of it is in the Maker's first load, none of it in a guest's page.
 */

/**
 * ✋ THE PART A HOLD ON THE PAGE PICKED — by its canvas key. It is picked WHERE IT IS: the toolbar does not bring the
 * page to its middle for this pick (`stage-tools.tsx` `centrePart`), because the page must stay still under the
 * finger that holds a scene — and stay where a drop left it. Read once, then cleared by any other pick. (Kept in this
 * file, which only the lazy Stages panel loads — never in a module the Maker's first load shares.)
 */
export const stageStill: { key: string | null } = { key: null };

/** A step of the drag's (or of its menu, or ＋): what the line says of it, and what ↺ would take back. `id`: the scene's
 *  row, when the step knows it (＋ — the part is not on the Maker's list yet). */
export type SceneStep = { type: 'move' | 'remove' | 'add'; label: string; key: string | null; id?: string };

export type SceneDragInput = {
  /** The stage's own canvas is on show and takes a hold. */
  on: boolean;
  /** The frame the stage's page is drawn in. */
  frameSel: string;
  /** A press is still on its way to the page — no second lift. */
  working: boolean;
  /** A sheet or a menu of the part's is open — the press is not the drag's. */
  sheetOpen: boolean;
  subject: (target: Element, doc: Document) => SceneDragSubject | null;
  /** Why a part keeps its place. */
  why: (subject: SceneDragSubject) => string;
  /** What is said of a hold while the page is still catching up. */
  busyWhy: string;
  /** Held (or lifted): it is the picked part. */
  pick: (subject: SceneDragSubject) => void;
  /** Land it beside `target` — ONE order write. Null: nothing to write. */
  drop: (subject: SceneDragSubject, target: string, where: 'above' | 'below') => Promise<CanvasSettle> | null;
  /** Off the page. 'asking': a scene of their own — its Delete sheet is open and nothing has gone. Null: it stays. */
  remove: (subject: SceneDragSubject) => 'asking' | Promise<CanvasSettle> | null;
  /** ↺ took one of these steps back, and the page shows it. */
  undone: (step: SceneStep) => void;
  /** ↺ is about to take this step back (the journal's — `data` by value): draw its inverse on the page NOW and say how
   *  the Undo's held save ended (`lib/maker-drawn-undo.ts`). Null: it cannot be drawn here — the Undo reloads, as ever. */
  undraw?: (step: SceneStep, data: SceneUndoData) => DrawnUndo | null;
};

export type SceneDragNow = {
  held: boolean;
  /** The bin — portalled onto the Maker's shell. */
  node: ReactNode;
  /** The line under the tools; null when it has nothing to say. */
  status: ReactNode;
  /** Which saying it is — a new number each time the line speaks; null with nothing to say. */
  statusKey: number | null;
  say: (words: string) => void;
  /** A step made without a drag (the tag's menu): the line follows it the same way. */
  run: (step: SceneStep, done: Promise<CanvasSettle>, revert?: () => void) => void;
  /** …and the page shows it at once: the part under `target` slides `by` places among the parts it may land among.
   *  The slide-back for a refused save — null when nothing could be slid (the page then waits for the save). */
  slide: (target: Element, by: -1 | 1) => (() => void) | null;
  /** The same, to the slot `slotOf` names among the others (given the parts' keys in page order and where it stands). */
  slideTo: (target: Element, slotOf: (keys: string[], at: number) => number | null) => (() => void) | null;
};

type LineBody = { kind: 'saving' } | { kind: 'words'; words: string; err: boolean } | { kind: 'removed'; label: string };
type Line = LineBody & { n: number };

/** The Maker's own Undo, in its top bar — and never the line's own button (`SCENE_UNDO_BUTTON`). */
const UNDO_BUTTON = SCENE_UNDO_BUTTON;

/**
 * A HELD save (the bridge already drew it — no reload follows, so there is no new page to wait for): done when the
 * save this press started has answered (`sceneHeldSaveDone`); 'failed' the moment the Maker says it was refused.
 * Call it AT the press.
 */
export function heldSaveWatch(timeoutMs: number = CANVAS_SETTLE_TIMEOUT_MS): Promise<CanvasSettle> {
  if (typeof window === 'undefined') return Promise.resolve('shown');
  const from = makerSavesStarted();
  return new Promise<CanvasSettle>((resolve) => {
    const began = Date.now();
    let over = false;
    const end = (how: CanvasSettle) => {
      if (over) return;
      over = true;
      window.clearInterval(tick);
      off();
      resolve(how);
    };
    const off = onMakerSave((s) => {
      if (s.state === 'error') end('failed');
    });
    const tick = window.setInterval(() => {
      if (sceneHeldSaveDone(from, { started: makerSavesStarted(), inFlight: makerSavesInFlight() })) end('shown');
      else if (Date.now() - began > timeoutMs) end('timeout');
    }, 120);
  });
}

/** The canvas on show said its in-place redraw has painted (`editor-bridge.tsx` → `{ t: 'redrawn' }`). */
function isRedrawn(e: MessageEvent): boolean {
  const d = e.data as { source?: unknown; t?: unknown } | null;
  if (e.origin !== window.location.origin || !d || d.source !== 'setnayan-site' || d.t !== 'redrawn') return false;
  return e.source === (document.querySelector<HTMLIFrameElement>(SHOWN_CANVAS)?.contentWindow ?? null);
}
const SHOWN_CANVAS = 'iframe[data-maker-canvas-frame="shown"]';
/** A held redraw not painted this long after its save landed is asked for again (once). */
export const REDRAW_ASK_AGAIN_MS = 5_000;

/** The next in-place redraw of the canvas on show, from now. */
export function redrawnWatch(timeoutMs: number = CANVAS_SETTLE_TIMEOUT_MS): Promise<CanvasSettle> {
  if (typeof window === 'undefined') return Promise.resolve('shown');
  return new Promise<CanvasSettle>((resolve) => {
    const on = (e: MessageEvent) => {
      if (!isRedrawn(e)) return;
      window.removeEventListener('message', on);
      window.clearTimeout(timer);
      resolve('shown');
    };
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', on);
      resolve('timeout');
    }, timeoutMs);
    window.addEventListener('message', on);
  });
}

/**
 * ✋ A HELD MOVE / ＋ (the page already shows it — slid, or its place held — and redraws ITSELF once the save lands, no
 * new page): done when the save this press started has answered AND the canvas on show has redrawn; 'failed' the
 * moment the Maker says the save was refused. Call it AT the press.
 */
export function heldRedrawWatch(timeoutMs: number = CANVAS_SETTLE_TIMEOUT_MS): Promise<CanvasSettle> {
  if (typeof window === 'undefined') return Promise.resolve('shown');
  let redrawn = false;
  const on = (e: MessageEvent) => {
    if (isRedrawn(e)) redrawn = true;
  };
  window.addEventListener('message', on);
  const saved = heldSaveWatch(timeoutMs);
  const began = Date.now();
  return saved.then(
    (how) =>
      new Promise<CanvasSettle>((resolve) => {
        if (how !== 'shown') {
          window.removeEventListener('message', on);
          return resolve(how);
        }
        const savedAt = Date.now();
        let asked = false;
        const tick = window.setInterval(() => {
          /* A redraw that never answered is asked for once more… */
          if (!redrawn && !asked && Date.now() - savedAt > REDRAW_ASK_AGAIN_MS) {
            asked = true;
            document.querySelector<HTMLIFrameElement>(SHOWN_CANVAS)?.contentWindow?.postMessage(CANVAS_REFRESH_MESSAGE, window.location.origin);
          }
          if (!redrawn && Date.now() - began <= timeoutMs) return;
          window.clearInterval(tick);
          window.removeEventListener('message', on);
          /* …and past the wait the page is reloaded to the truth: what was laid on it ahead of the save must never be
             left there for good (an unheld write releases the canvas; its render brings the page). */
          if (!redrawn) {
            window.dispatchEvent(new Event(MAKER_UNHELD_WRITE_EVENT));
            requestMakerRefresh();
          }
          resolve(redrawn ? 'shown' : 'timeout');
        }, 40);
      }),
  );
}

export function useSceneDrag(input: SceneDragInput): SceneDragNow {
  const now = useRef(input);
  now.current = input;
  const [held, setHeld] = useState(false);
  const [over, setOver] = useState(false);
  const [line, setLine] = useState<Line | null>(null);
  const lineN = useRef(0);
  const binRef = useRef<HTMLDivElement>(null);
  /** The save the line is waiting for. */
  const saving = useRef(false);

  const put = useCallback((next: LineBody | null) => {
    lineN.current += 1;
    setLine(next ? { ...next, n: lineN.current } : null);
  }, []);
  const say = useCallback((words: string, err = false) => put(words ? { kind: 'words', words, err } : null), [put]);
  /* A line that is not kept leaves by itself (the prototype's `say`: Saving… and "<Scene> removed" · Undo stay). */
  useEffect(() => {
    if (line?.kind !== 'words') return;
    const n = line.n;
    const id = window.setTimeout(() => setLine((l) => (l?.n === n ? null : l)), SCENE_STATUS_MS);
    return () => window.clearTimeout(id);
  }, [line]);

  const run = useCallback(
    (step: SceneStep, done: Promise<CanvasSettle>, revert?: () => void) => {
      saving.current = true;
      put({ kind: 'saving' });
      void done.then((how) => {
        saving.current = false;
        if (how === 'failed') {
          /* The scene slides back, THEN the honest line. */
          revert?.();
          return say(SCENE_DRAG_WORDS.failed, true);
        }
        /* A page that never came says nothing it cannot show. */
        if (how === 'timeout') return put(null);
        put(step.type === 'remove' ? { kind: 'removed', label: step.label } : null);
      });
    },
    [put, say],
  );

  /* ── ↺ the Maker's own Undo: ANY scene step of the journal (`lib/maker-drawn-undo.ts`) — the 2nd, 3rd… of a run too —
     is drawn back on the page by this drag, at the press; the line says so once the page shows it. Lent while mounted
     (`setSceneUndrawer`); with no drag mounted the step takes the slow path. ── */
  useEffect(
    () =>
      setSceneUndrawer((data) => {
        const step: SceneStep = { type: data.kind, label: data.label, key: data.key, id: data.id };
        const drawn = now.current.undraw?.(step, data) ?? null;
        if (!drawn) return null;
        put(null);
        void drawn.settle.then((how) => {
          if (how !== 'shown') return;
          say(step.type === 'remove' ? SCENE_DRAG_WORDS.back(step.label) : step.type === 'add' ? SCENE_DRAG_WORDS.addUndone(step.label) : SCENE_DRAG_WORDS.moveUndone);
          now.current.undone(step);
        });
        return drawn;
      }),
    [put, say],
  );
  /** The line's Undo PRESSES the Maker's own (one door to the draft; its busy rule and its reload are that button's) —
   *  so it does exactly what ↺ does for this removal: the listener above hears that one press, the scene comes back
   *  where it was, and the line says "<Scene> is back". */
  const pressUndo = () => {
    let tries = 0;
    const press = () => {
      const button = document.querySelector<HTMLButtonElement>(UNDO_BUTTON);
      if (!button) return;
      /* The count that enables it comes back with the save — a moment after the line could be pressed. The line
         stays until the press is taken: a press ↺ cannot take is never heard above, so nothing is said of it. */
      if (button.disabled) {
        if (tries++ < 10) window.setTimeout(press, 120);
        return;
      }
      button.click();
    };
    press();
  };

  /* ── the canvas: the hold, the lift, the drop ── */
  const pad = useRef<{ doc: Document; base: string; extra: number; off: () => void } | null>(null);
  /** When the scene now held was lifted — the bin is not up before the toolbar has slid away. */
  const liftedAt = useRef(0);
  /** The frame's box on the screen, and how much it is scaled. */
  const frameNow = () => {
    const frame = document.querySelector<HTMLIFrameElement>(now.current.frameSel);
    if (!frame) return null;
    const r = frame.getBoundingClientRect();
    return { frame, r, k: frame.clientWidth > 0 ? r.width / frame.clientWidth : 1 };
  };
  const host = useRef<SceneDragHost | null>(null);
  host.current = {
    subject: (target) => now.current.subject(target, target.ownerDocument),
    verdict: () => sceneLiftAllowed({ working: now.current.working || saving.current, away: !now.current.on, sheetOpen: now.current.sheetOpen }),
    onRefuse: (subject, why) => {
      if (why === 'busy') return say(now.current.busyWhy);
      now.current.pick(subject);
      say(now.current.why(subject));
    },
    onLift: (subject) => {
      /* The page is about to be taller on screen by the lower third's height: it is given that much room at its end
         FIRST, so its place cannot be pulled from under the finger when it grows. */
      const f = frameNow();
      const lt = document.querySelector('[data-maker-lower-third]')?.getBoundingClientRect();
      const doc = subject.el.ownerDocument;
      const win = doc.defaultView;
      if (f && lt && win && lt.height > 0) {
        /* (A room still waiting from the last hold is taken first — it is measured afresh.) */
        pad.current?.off();
        const base = doc.body.style.paddingBottom;
        const had = Number.parseFloat(win.getComputedStyle(doc.body).paddingBottom) || 0;
        const extra = Math.ceil(lt.height / f.k);
        doc.body.style.paddingBottom = `${had + extra}px`;
        pad.current = { doc, base, extra, off: () => {} };
      }
      put(null);
      setOver(false);
      setHeld(true);
      liftedAt.current = Date.now();
      now.current.pick(subject);
    },
    onBin: (on) => setOver(on),
    binBox: (): SceneBox | null => {
      /* 🗑 THE BIN COUNTS ONLY ONCE IT IS UP. It comes up from where the lower third's top edge was — exactly where a
         thumb takes hold of the last scene on the screen. Read before it had arrived, a scene lifted there was "on
         the bin" at once, and letting go would have taken it off the page (measured in the lab, 2026-10-11). */
      if (Date.now() - liftedAt.current < SCENE_COLLAPSE_MS) return null;
      const f = frameNow();
      const b = binRef.current?.getBoundingClientRect();
      if (!f || !b || b.width === 0) return null;
      return { left: (b.left - f.r.left) / f.k, right: (b.right - f.r.left) / f.k, top: (b.top - f.r.top) / f.k, bottom: (b.bottom - f.r.top) / f.k };
    },
    band: () => {
      const f = frameNow();
      if (!f) return { top: 0, bottom: 0 };
      /* The page ends where the guests' bar begins (it lies over the frame's foot), or at the lower third. */
      const bar = document.querySelector('[data-stage-guest-bar]')?.getBoundingClientRect();
      const lt = document.querySelector('[data-maker-lower-third]')?.getBoundingClientRect();
      const bottom = Math.min(f.r.bottom, bar && bar.height > 0 ? bar.top : Infinity, lt && lt.height > 0 ? lt.top : Infinity);
      return { top: 0, bottom: (bottom - f.r.top) / f.k };
    },
    onRelease: () => {
      /* The room at the page's end goes once the panel is BACK (never while the page is still taller on screen) —
         and only when taking it leaves the page where it is (`scenePadDone`); else at the first scroll that does. */
      const p = pad.current;
      const win = p?.doc.defaultView;
      if (p && win) {
        const root = p.doc.scrollingElement ?? p.doc.documentElement;
        const take = () => {
          if (!scenePadDone(win.scrollY, root.scrollHeight, win.innerHeight, p.extra)) return false;
          p.doc.body.style.paddingBottom = p.base;
          return true;
        };
        const onScroll = () => {
          if (take()) win.removeEventListener('scroll', onScroll);
        };
        const timer = win.setTimeout(() => {
          if (!take()) win.addEventListener('scroll', onScroll, { passive: true });
        }, SCENE_COLLAPSE_MS + 80);
        p.off = () => {
          win.clearTimeout(timer);
          win.removeEventListener('scroll', onScroll);
          p.doc.body.style.paddingBottom = p.base;
        };
      }
      setHeld(false);
      setOver(false);
    },
    onDrop: (subject, drop: SceneDrop) => {
      const step = (type: SceneStep['type']): SceneStep => ({ type, label: subject.label, key: subject.key });
      if (drop.kind === 'none') return;
      if (drop.kind === 'move') {
        const done = now.current.drop(subject, drop.target, drop.where);
        if (!done) return drop.revert();
        return run(step('move'), done, drop.revert);
      }
      const done = now.current.remove(subject);
      if (!done || done === 'asking') return drop.restore();
      drop.gone();
      run(step('remove'), done, drop.restore);
    },
  };
  /* The engine is wired to the canvas ON SHOW — and again to each page a reload brings (a reload always mounts a new
     frame; the old document, and whatever a drop left slid on it, goes with it). */
  const on = input.on;
  const frameSel = input.frameSel;
  const wiredNow = useRef<SceneDragWired | null>(null);
  const slide = useCallback((target: Element, by: -1 | 1) => {
    const subject = now.current.subject(target, target.ownerDocument);
    const at = subject ? subject.beside.findIndex((b) => b.el === subject.el) : -1;
    return subject && subject.movable && at >= 0 ? (wiredNow.current?.place(subject, at + by) ?? null) : null;
  }, []);
  const slideTo = useCallback((target: Element, slotOf: (keys: string[], at: number) => number | null) => {
    const subject = now.current.subject(target, target.ownerDocument);
    const at = subject ? subject.beside.findIndex((b) => b.el === subject.el) : -1;
    const slot = subject && subject.movable && at >= 0 ? slotOf(subject.beside.map((b) => b.key), at) : null;
    return subject && slot !== null ? (wiredNow.current?.place(subject, slot) ?? null) : null;
  }, []);
  useEffect(() => {
    if (!on) return;
    let doc: Document | null = null;
    let wired: SceneDragWired | null = null;
    const through: SceneDragHost = {
      subject: (t) => host.current!.subject(t),
      verdict: () => host.current!.verdict(),
      onRefuse: (s, w) => host.current!.onRefuse(s, w),
      onLift: (s) => host.current!.onLift(s),
      onBin: (o) => host.current!.onBin(o),
      onRelease: () => host.current!.onRelease(),
      binBox: () => host.current!.binBox(),
      band: () => host.current!.band(),
      onDrop: (s, d) => host.current!.onDrop(s, d),
    };
    const look = () => {
      let next: Document | null = null;
      try {
        next = document.querySelector<HTMLIFrameElement>(frameSel)?.contentDocument ?? null;
      } catch {
        next = null;
      }
      /* A page still arriving has no parts to hold yet. */
      if (next && (next.readyState === 'loading' || !next.body || !next.querySelector('[data-maker-section]'))) next = null;
      if (next === doc) return;
      wired?.detach();
      wired = null;
      doc = next;
      if (next) wired = attachSceneDrag(next, through);
      wiredNow.current = wired;
    };
    look();
    const id = window.setInterval(look, 250);
    return () => {
      window.clearInterval(id);
      wired?.detach();
      wiredNow.current = null;
      setHeld(false);
      setOver(false);
    };
  }, [on, frameSel]);
  useEffect(() => () => pad.current?.off(), []);

  /* The bin stands on the Maker's shell, over the foot of the page (found once the hook is on the page — the first
     render in the browser is the server's: `the-maker-first-render-is-the-servers.test.ts`). */
  const [shell, setShell] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setShell(document.querySelector<HTMLElement>('[data-maker-shell]')), []);
  const node =
    shell && on
      ? createPortal(
          <div
            ref={binRef}
            data-scene-bin=""
            data-scene-bin-up={held ? '' : undefined}
            data-scene-bin-hot={held && over ? '' : undefined}
            aria-hidden
            /* The prototype's `.bin`: a 64 px circle in the thumb zone, 30 px over the foot of the page (the guests'
               bar, where the stage has one), up only while a scene is lifted; red, larger and tilted under the finger. */
            className={`pointer-events-none absolute left-1/2 z-[27] grid h-16 w-16 place-items-center rounded-full motion-reduce:!transition-opacity lg:hidden ${
              held && over ? 'bg-[var(--sp-bad)] text-[rgb(var(--sn-on-accent))]' : 'bg-[var(--sp-paper)] text-[var(--sp-ink)]'
            } ${held ? 'opacity-100' : 'opacity-0'}`}
            style={{
              bottom: 'calc(var(--maker-lt-h) + env(safe-area-inset-bottom) + var(--scene-bin-over, 30px))',
              transform: `translate(-50%, ${held ? 0 : 24}px) scale(${held ? (over ? 1.22 : 1) : 0.6})`,
              /* Its line and its lift: the toolbar's own line, the app's own shadow — tokens, never a colour typed here. */
              boxShadow: `0 0 0 1.5px var(${held && over ? '--sp-bad' : '--sp-line2'}), var(--m-shadow-md)`,
              transition: `transform ${SCENE_COLLAPSE_MS}ms ${SCENE_COLLAPSE_EASE}, opacity ${held ? SCENE_COLLAPSE_MS : SCENE_COLLAPSE_CALM_MS}ms ${SCENE_COLLAPSE_EASE}, bottom ${SCENE_COLLAPSE_MS}ms ${SCENE_COLLAPSE_EASE}, background-color 200ms ease, box-shadow 200ms ease`,
            }}
          >
            <Trash2 aria-hidden className={`h-[26px] w-[26px] transition-transform duration-200 ${held && over ? '-rotate-12' : ''}`} strokeWidth={1.8} />
            {/* (walk F4, 2026-10-12: over the foot of a large lifted scene the paper pill was paper on paper — it wears the
                bin's own line around it, so it reads over any scene. Its place is the prototype's.) */}
            <span
              data-scene-bin-word=""
              style={{ boxShadow: `0 0 0 1.5px var(${held && over ? '--sp-bad' : '--sp-line2'}), var(--m-shadow-sm)` }}
              className={`absolute -top-[30px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--sp-paper)] px-2.5 py-[3px] text-[12px] tracking-[0.02em] ${
                held && over ? 'font-semibold text-[var(--sp-bad)]' : 'text-[var(--sp-ink)]'
              }`}
            >
              {SCENE_DRAG_WORDS.bin}
            </span>
          </div>,
          shell,
        )
      : null;

  const status = line ? (
    <div
      data-scene-status={line.kind}
      role={line.kind === 'words' && line.err ? 'alert' : 'status'}
      aria-live="polite"
      className={`flex w-full min-w-0 items-center justify-center gap-3 px-1 text-center text-[14px] leading-tight ${line.kind === 'words' && line.err ? 'text-[var(--sp-bad)]' : 'text-[var(--sp-ink2)]'}`}
    >
      {line.kind === 'saving' ? (
        <>
          <span aria-hidden className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--sp-line2)] border-t-[var(--sp-cta)] motion-reduce:animate-none" />
          <span>{SCENE_DRAG_WORDS.saving}</span>
        </>
      ) : line.kind === 'removed' ? (
        <>
          <span className="min-w-0 truncate">{SCENE_DRAG_WORDS.removed(line.label)}</span>
          <span className="contents" data-scene-undo="">
            <ActionButton tone="neutral" icon={Undo2} label={SCENE_DRAG_WORDS.undo} onClick={pressUndo} className="!h-11 shrink-0" />
          </span>
        </>
      ) : (
        <span>{line.words}</span>
      )}
    </div>
  ) : null;

  return { held, node, status, statusKey: line?.n ?? null, say, run, slide, slideTo };
}

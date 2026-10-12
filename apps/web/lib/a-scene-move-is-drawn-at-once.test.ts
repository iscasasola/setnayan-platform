import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCENE_EDGE_PX, sceneBringIntoView, sceneDropSlot, sceneEdgeScroll, sceneEdgeScrollKept, sceneReflow, type SceneRow } from './maker-scene-drag';
import { DRAWN_UNDO_TTL_MS, claimDrawnUndo, takeDrawnUndo, withdrawDrawnUndo, type DrawnUndo } from './maker-drawn-undo';
import { CANVAS_REDRAW_COMMITS_EVENT } from '../app/[slug]/_components/maker-section-find';
import { attachSceneDrag, type SceneDragHost, type SceneDragSubject } from '../app/dashboard/[eventId]/launch/_components/scene-canvas-drag';
import { stripComments } from './strip-comments';

/**
 * ⚡ A MOVE, A SCENE TAKEN OFF, A PART ＋ ADDED — AND THEIR ↺ — ARE ON THE PAGE AT ONCE, AND SAVED IN THE BACKGROUND.
 *
 * Owner rules (DECISION_LOG / INTERACTION_RULES): *"the Maker never slow (≤100 ms per tap, saves in the background)"* ·
 * *"a press shows pressed and what is loading — the tapped thing answers at once, one line says the step"*. Owner on
 * the batch preview, 2026-10-12: after letting go of a dragged scene, a drop on the bin, or ＋, the page took 3–6 s.
 * MEASURED in the Maker lab (production latencies, `?slow=1`): the drop was slid into place at once, but "Saving…" ran
 * 7.7 s, ↺ stayed grey 6.7 s, the WHOLE MAKER re-rendered and the canvas loaded a NEW page; every ↺ and every ＋ waited
 * for that render and that page (4–7 s).
 *
 * Now a step the page already SHOWS is saved HELD (no Maker render, no new page) and the page on show redraws ITSELF
 * in place once the save lands — the slides coming off in the very commit that draws the order for real. Held here:
 *   (1) THE SLIDES COME OFF IN THE REDRAW'S OWN COMMIT — synchronously, with no glide (the drag engine, executed on a
 *       stand-in page), so the order is never drawn twice; the bridge fires it from React's before-commit moment.
 *   (2) A HELD STEP OWES NO MAKER RENDER AND NO NEW PAGE — the shell's move / ＋ wiring, the draft bar's ↺.
 *   (3) ↺ OF A DRAWN STEP IS DRAWN TOO — one claim per click, never left on the page when the Undo did not run.
 *   (4) THE WALK'S F1 (2026-10-12): the gap is never carried off the screen, and a drop is seen where it landed.
 */

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const SHELL = 'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx';
const SHEET = 'app/dashboard/[eventId]/launch/_components/add-part-sheet.tsx';
const DRAG = 'app/dashboard/[eventId]/launch/_components/scene-drag.tsx';
const BRIDGE = 'app/[slug]/_components/editor-bridge.tsx';
const BAR = 'app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx';
/** The body of `const name = (…) => { … }` / `function name(…) { … }`, by brace counting. */
function bodyOf(src: string, start: string): string {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `${start} is in the file`);
  const open = src.indexOf('{', src.indexOf('=>', i));
  let depth = 0;
  for (let k = open; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(open, k + 1);
  }
  throw new Error(`unclosed ${start}`);
}

/* ── a stand-in page for the drag engine: three scenes stacked, nothing else ── */
type FakeEl = {
  tagName: string;
  style: Record<string, string>;
  isConnected: boolean;
  nextElementSibling: FakeEl | null;
  parentElement: FakeEl | null;
  firstElementChild: FakeEl | null;
  offsetWidth: number;
  top: number;
  height: number;
  contains: (o: unknown) => boolean;
  getBoundingClientRect: () => { top: number; bottom: number; left: number; right: number; width: number; height: number };
  setAttribute: () => void;
  removeAttribute: () => void;
  hasAttribute: () => boolean;
  animate: () => void;
  appendChild: () => void;
  remove: () => void;
};
function standIn(bandBottom = 700) {
  const body = { tagName: 'BODY' } as unknown as FakeEl;
  const mk = (top: number, height: number): FakeEl => {
    const el: FakeEl = {
      tagName: 'SECTION',
      style: { transform: '', transition: '' },
      isConnected: true,
      nextElementSibling: null,
      parentElement: body,
      firstElementChild: null,
      offsetWidth: 375,
      top,
      height,
      contains: (o) => o === el,
      getBoundingClientRect: () => {
        const m = /translateY\((-?[\d.]+)px\)/.exec(el.style.transform);
        const t = top + (m ? Number(m[1]) : 0);
        return { top: t, bottom: t + height, left: 0, right: 375, width: 375, height };
      },
      setAttribute: () => {},
      removeAttribute: () => {},
      hasAttribute: () => false,
      animate: () => {},
      appendChild: () => {},
      remove: () => {},
    };
    return el;
  };
  const els = [mk(0, 300), mk(300, 200), mk(500, 400)];
  els[0]!.nextElementSibling = els[1]!;
  els[1]!.nextElementSibling = els[2]!;
  const frames: Array<() => void> = [];
  const scrolls: number[] = [];
  const win = {
    scrollY: 0,
    scrollX: 0,
    innerWidth: 375,
    innerHeight: 700,
    matchMedia: () => ({ matches: false }),
    CSS: { supports: () => true },
    setTimeout: (f: () => void) => {
      frames.push(f);
      return frames.length;
    },
    clearTimeout: () => {},
    requestAnimationFrame: (f: () => void) => {
      frames.push(f);
      return frames.length;
    },
    cancelAnimationFrame: () => {},
    scrollBy: (o: number | { top: number }) => scrolls.push(typeof o === 'number' ? o : o.top),
    getComputedStyle: () => ({ position: 'relative', backgroundColor: 'rgb(255, 255, 255)', backgroundImage: 'none', display: 'block', opacity: '1' }),
    getSelection: () => null,
    navigator: {},
  };
  const doc = Object.assign(new EventTarget(), {
    defaultView: win,
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
    documentElement: { setAttribute: () => {}, removeAttribute: () => {}, hasAttribute: () => false, setPointerCapture: () => {}, releasePointerCapture: () => {} },
    createElement: () => ({ setAttribute: () => {}, style: {}, remove: () => {} }),
  });
  const host: SceneDragHost = {
    subject: () => null,
    verdict: () => 'lift',
    onRefuse: () => {},
    onLift: () => {},
    onBin: () => {},
    onRelease: () => {},
    binBox: () => null,
    band: () => ({ top: 0, bottom: bandBottom }),
    onDrop: () => {},
  };
  const subject = (at: number): SceneDragSubject => ({
    key: `w:s${at}`,
    el: els[at] as unknown as HTMLElement,
    target: els[at] as unknown as Element,
    label: `S${at}`,
    movable: true,
    beside: els.map((el, i) => ({ key: `w:s${i}`, el: el as unknown as HTMLElement })),
  });
  const wired = attachSceneDrag(doc as unknown as Document, host);
  const runFrames = () => {
    while (frames.length) frames.shift()!();
  };
  return { els, doc, wired, subject, runFrames, scrolls };
}

test('(1) the slides come off IN the redraw’s own commit — at once, with no glide — and the page takes a lift again', () => {
  const { els, doc, wired, subject, runFrames } = standIn();
  const back = wired.place(subject(0), 1);
  assert.ok(back, 'the first scene slides one place down');
  assert.match(els[0]!.style.transform!, /translateY\(200px\)/, 'it stands where the step puts it');
  assert.match(els[1]!.style.transform!, /translateY\(-300px\)/);
  assert.equal(wired.optimistic(), true, 'the order is held by the slides until the page draws it');
  /* The bridge fires the event from React's before-commit moment (`BeforeRedrawCommits`): what is checked here is what
     the page wears the instant after — before any frame could be painted. */
  doc.dispatchEvent(new Event(CANVAS_REDRAW_COMMITS_EVENT));
  for (const el of els) {
    assert.equal(el.style.transform, '', 'the slide is off — the page’s own order now stands');
    if (el !== els[2]) assert.equal(el.style.transition, 'none', 'and it did not glide (that would move the scene twice)');
  }
  assert.equal(wired.optimistic(), false, 'a second hold is taken at once — the page no longer waits for a reload');
  runFrames();
  assert.ok(els.every((el) => el.style.transition !== 'none'), 'its own transitions come back a frame later');
  /* …and a slide-back for a save refused AFTER the redraw has nothing left to take back */
  back!();
  assert.ok(els.every((el) => el.style.transform === ''));
});

test('(1) the bridge fires it from React’s before-commit moment, synchronously, and says when the redraw has painted', () => {
  const src = read(BRIDGE);
  const run = bodyOf(src, 'const undoLaidPreviews = () =>');
  assert.match(run, /document\.dispatchEvent\(new Event\(CANVAS_REDRAW_COMMITS_EVENT\)\)/, 'dispatched on the page’s own document');
  assert.doesNotMatch(run, /setTimeout|requestAnimationFrame|postMessage/, 'never later than the commit');
  assert.match(src, /<BeforeRedrawCommits pending=\{redrawing\} run=\{undoLaidPreviews\} \/>/);
  assert.match(src, /t: 'redrawn'/, 'the Maker is told once the redraw is on screen');
  /* the engine listens on that same document */
  assert.match(read('app/dashboard/[eventId]/launch/_components/scene-canvas-drag.ts'), /doc\.addEventListener\(CANVAS_REDRAW_COMMITS_EVENT, onRedrawCommits\)/);
});

test('(2) a step the page shows is HELD: no whole-Maker render, no new page — the page on show redraws itself', () => {
  const shell = read(SHELL);
  const move = bodyOf(shell, 'const move = (id: string, delta: number, drawn = false) =>');
  assert.match(move, /makerSave\(\(\) => draftAction\(eventId, fd\), requestMakerRefresh, \{ held: held !== null \}\)/, 'a drawn move saves held');
  assert.match(move, /if \(held !== null\) \{[^}]*canvasHold\.current = holdChange/, 'its canvas is held with the moved order');
  assert.match(move, /\} else releaseCanvas\(\);/, 'only a move the page does not show releases the canvas');
  assert.match(move, /if \(held !== null\) redrawShown\(held\)/, 'it lands: the page redraws in place');
  assert.match(move, /fd\.set\(HUB_DRAFT_BAR_FIELD, '1'\)/, 'the Apply · Undo count rides on the save');
  const redraw = bodyOf(shell, 'const redrawShown = (order: string) =>');
  assert.match(redraw, /postToShownCanvases\(CANVAS_REFRESH_MESSAGE\)/, 'ONE page redraws — the one on show, never every warm stage');
  const add = bodyOf(shell, 'const addHere = (scene: MakerScene, delta: number, drawn = false) =>');
  assert.match(add, /\{ held: held !== null \}/, '＋ saves held too');
  assert.match(add, /makerNeedsRender\(\)/, '…and still owes the Maker’s list its one render (the canvas kept by the hold)');
  assert.match(add, /scenePlaceholderOff/, 'a refused ＋ takes its place-holder off the page');
  /* the drag and the tag's steps hand `drawn` only when the page really shows it */
  const sheet = read(SHEET);
  const step = bodyOf(sheet, 'const stepMove = (dir: -1 | 1) =>');
  assert.ok(step.indexOf('drag.slide(') < step.indexOf('dropOn('), 'the step slides FIRST, then saves');
  assert.match(step, /dropOn\(o, t, dir < 0 \? 'above' : 'below', here, back !== null\)/, 'drawn only if it was slid');
  assert.match(bodyOf(sheet, 'const dropOn ='), /const done = heldRedrawWatch\(\);[\s\S]*o\.move\(m\.id, delta, true\)/, 'the wait is read AT the press');
});

test('(3) ↺ of a drawn step is drawn too: the bar’s save is held for it — one claim, one click', () => {
  const undo: DrawnUndo = { settle: Promise.resolve('shown'), landed: () => {} };
  claimDrawnUndo(undo, 1000);
  assert.equal(takeDrawnUndo(1000 + DRAWN_UNDO_TTL_MS), undo, 'the click that follows takes it');
  assert.equal(takeDrawnUndo(1001), null, 'once');
  claimDrawnUndo(undo, 1000);
  assert.equal(takeDrawnUndo(1001 + DRAWN_UNDO_TTL_MS), null, 'a claim no click took in time is void');
  claimDrawnUndo(undo, 1000);
  assert.equal(withdrawDrawnUndo(undo), true, 'an Undo that never ran: withdrawn (the drag then puts the page back)');
  assert.equal(takeDrawnUndo(1001), null);
  const bar = read(BAR);
  assert.match(bar, /const drawn = intent === 'undo' \? takeDrawnUndo\(\) : null;/);
  assert.match(bar, /makerSave\(\(\) => action\(eventId, fd\), \(\) => router\.refresh\(\), \{ held: drawn !== null \}\)/, 'a drawn ↺ owes no render');
  assert.match(bar, /drawn\?\.landed\(r\.ok\)/, 'and is told how it ended — a refused one is put back');
  const drag = read(DRAG);
  assert.match(drag, /if \(withdrawDrawnUndo\(drawn\)\) drawn\.landed\(false\)/, 'a claim the Undo never took is taken back off the page');
});

/* ── (4) the walk's F1 ── */
/** Schedule (the held one) and the two scenes before the March: the March and Reminders lie below, out of its reach. */
const F1_ROWS: SceneRow[] = [
  { top: 0, height: 600 },
  { top: 600, height: 500 },
  { top: 1100, height: 900 },
];
/** The finger rests at the screen's foot, the page scrolls by itself (`sceneEdgeScroll`), frame after frame. */
function carry(kept: boolean) {
  const band = { top: 0, bottom: 700 };
  const y = band.bottom - 20;
  let scrollY = 0;
  let slot = 0;
  for (let f = 0; f < 600; f++) {
    slot = sceneDropSlot(F1_ROWS, 0, slot, y + scrollY);
    let v = sceneEdgeScroll(y, band.top, band.bottom, false);
    const gap = sceneReflow(F1_ROWS, 0, slot).gap;
    if (kept) v = sceneEdgeScrollKept(v, y, { top: gap.top - scrollY, bottom: gap.top + gap.height - scrollY }, slot, F1_ROWS.length - 1);
    scrollY = Math.min(scrollY + v, 6000);
  }
  const gap = sceneReflow(F1_ROWS, 0, slot).gap;
  return { slot, gapTop: gap.top - scrollY, gapBottom: gap.top + gap.height - scrollY, y };
}

test('(4) F1: carried past the last place it may land, the gap is never scrolled off the screen — it stays by the finger', () => {
  const was = carry(false);
  assert.ok(was.gapBottom < 0, `the fault, as walked: the page scrolled on and the gap left the screen (its foot at ${was.gapBottom}px)`);
  const now = carry(true);
  assert.equal(now.slot, F1_ROWS.length - 1, 'it still lands at the last place it may');
  assert.ok(now.gapBottom >= now.y - 1 && now.gapTop < 700, `the gap stands by the finger, on the screen (${now.gapTop}–${now.gapBottom}, finger ${now.y})`);
  /* …and where the gap can still move on, the page scrolls exactly as before */
  assert.equal(sceneEdgeScrollKept(9, 680, { top: 100, bottom: 400 }, 1, 2), 9);
  assert.equal(sceneEdgeScrollKept(-9, 20, { top: 100, bottom: 400 }, 1, 2), -9);
  assert.equal(sceneEdgeScrollKept(-9, 20, { top: 15, bottom: 400 }, 0, 2), -5, 'going up at the first place: up to the finger, no further');
});

test('(4) F1: a drop is seen where it landed — brought into the page’s band when it is out of sight, left alone when in it', () => {
  const band = { top: 0, bottom: 700 };
  assert.equal(sceneBringIntoView({ top: 200, bottom: 600 }, band), 0);
  assert.equal(sceneBringIntoView({ top: -100, bottom: 400 }, band), 0, 'a scene mostly in sight is in sight');
  assert.equal(sceneBringIntoView({ top: -1240, bottom: -740 }, band), -1240 - SCENE_EDGE_PX, 'the walk’s 1240 px above: brought down');
  assert.equal(sceneBringIntoView({ top: 1500, bottom: 1900 }, band), 1500 - SCENE_EDGE_PX);
  /* executed on the stand-in: a step that slides the scene out of the band scrolls it back in */
  const { wired, subject, runFrames, scrolls } = standIn();
  wired.place(subject(0), 2);
  runFrames();
  assert.equal(scrolls.length, 0, 'still in the band (0–700): nothing scrolls');
  const s = standIn(500);
  s.wired.place(s.subject(0), 2);
  s.runFrames();
  assert.deepEqual(s.scrolls, [600 - SCENE_EDGE_PX], 'slid below the band (its top at 600 on a 500 px band): brought into sight');
  assert.match(read('app/dashboard/[eventId]/launch/_components/scene-canvas-drag.ts'), /v = sceneEdgeScrollKept\(v, h\.y,/, 'the engine’s edge scroll is the kept one');
});

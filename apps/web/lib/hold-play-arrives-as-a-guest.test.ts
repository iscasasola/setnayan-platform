/**
 * hold-play-arrives-as-a-guest.test.ts — HOLD ▶ (THE WHOLE PAGE AS A GUEST) PLAYS EACH ARRIVAL AS A GUEST GETS IT,
 * AND THE LAB'S GUEST PAGE HAS THE REAL OBSERVER (the 2026-10-15 Animate walk, F6 · S3).
 *
 *   (1) ON ENTRY: a scene on screen replays its arrival; a scene or a list row below the screen is put back to "not
 *       reached" and arrives as it is scrolled to (marked 32 px early, rows numbered one by one as the page's observer
 *       numbers them); a hero part with its own Build in on screen replays it. ON EXIT every mark is back.
 *       Sabotage: nothing re-armed → red.
 *   (2) Reduced motion: nothing is touched.
 *   (3) THE BRIDGE starts it with the guest mode and stops it with it.
 *   (4) THE LAB'S GUEST PAGE mounts the real page's flag + observer wherever it mounts the bridge (and on the guest
 *       render), so an "On arrival" scene binds there as on `/[slug]` — before, every lab walk saw it stand still.
 *   (5) ▶ for a Slow lift says so only where it moves something: `hubLiftMoves` is true for a photo or clip behind the
 *       words and false for a colour, no background or "Words only"; Animate › Action offers it accordingly (F11).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startGuestArrivals } from '../app/[slug]/_components/guest-preview-arrivals';
import { hubLiftMoves, sanitizeHubCanvas } from './hub-canvas';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

type El = { name: string; top: number; bottom: number; cls: Set<string>; vars: Map<string, string>; frame: boolean; row: boolean; motion: boolean; inFrame: boolean };
function el(name: string, top: number, opts: Partial<Pick<El, 'frame' | 'row' | 'motion' | 'inFrame'>> & { inn?: boolean } = {}): El {
  return { name, top, bottom: top + 200, cls: new Set(opts.inn === false ? [] : ['pahina-in']), vars: new Map(), frame: !!opts.frame, row: !!opts.row, motion: !!opts.motion, inFrame: !!opts.inFrame };
}
function world(els: El[], reduce = false) {
  const observed = new Set<El>();
  let cb: ((es: Array<{ isIntersecting: boolean; target: unknown }>) => void) | null = null;
  const wrap = (e: El) => ({
    e,
    classList: { add: (c: string) => void e.cls.add(c), remove: (c: string) => void e.cls.delete(c), contains: (c: string) => e.cls.has(c) },
    style: { setProperty: (k: string, v: string) => void e.vars.set(k, v) },
    getClientRects: () => [1],
    getBoundingClientRect: () => ({ top: e.top, bottom: e.bottom }),
    matches: (s: string) => (s.startsWith('.hub-canvas') ? e.frame : false),
    closest: (s: string) => (s === '.hub-canvas' && e.inFrame ? {} : null),
    parentElement: { hasAttribute: (a: string) => a === 'data-hub-rows' && e.row },
  });
  const wrapped = new Map(els.map((e) => [e, wrap(e)]));
  const doc = {
    documentElement: { clientHeight: 800 },
    querySelectorAll: (sel: string) => (sel === '[data-el-motion]' ? els.filter((e) => e.motion) : els.filter((e) => e.frame || e.row)).map((e) => wrapped.get(e)!),
  };
  class IO {
    constructor(f: typeof cb) { cb = f; }
    observe(t: { e: El }) { observed.add(t.e); }
    unobserve(t: { e: El }) { observed.delete(t.e); }
    disconnect() { observed.clear(); }
  }
  const win = { innerHeight: 800, matchMedia: () => ({ matches: reduce }), IntersectionObserver: IO };
  return { doc, win, observed, fire: (es: El[]) => cb?.(es.map((e) => ({ isIntersecting: true, target: wrapped.get(e) }))) };
}

test('(1) on entry: on screen replays, below is re-armed and arrives on scroll, rows one by one; on exit all is back', () => {
  const onScreen = el('schedule', 100, { frame: true });
  const below = el('dress', 1400, { frame: true });
  const r1 = el('row1', 1500, { row: true });
  const r2 = el('row2', 1560, { row: true });
  const names = el('names', 50, { motion: true });
  const sceneOwn = el('heading', 120, { motion: true, inFrame: true });
  const w = world([onScreen, below, r1, r2, names, sceneOwn]);
  const replayed: string[] = [];
  const parts: string[] = [];
  const stop = startGuestArrivals(w.doc as never, w.win as never, (f) => void replayed.push((f as unknown as { e: El }).e.name), (p) => void parts.push((p as unknown as { e: El }).e.name));
  assert.deepEqual(replayed, ['schedule'], 'the scene on screen did not arrive');
  assert.deepEqual(parts, ['names'], 'the hero part on screen did not arrive (a scene’s own part is the scene’s replay)');
  for (const e of [below, r1, r2]) assert.equal(e.cls.has('pahina-in'), false, `${e.name} is still "reached" — it cannot arrive`);
  assert.deepEqual([...w.observed].map((e) => e.name).sort(), ['dress', 'row1', 'row2']);
  assert.equal(onScreen.cls.has('pahina-in'), true);
  w.fire([below, r1, r2]);
  assert.ok([below, r1, r2].every((e) => e.cls.has('pahina-in')), 'scrolled to, it did not arrive');
  assert.deepEqual([r1.vars.get('--hub-row-at'), r2.vars.get('--hub-row-at')], ['1', '2'], 'rows arrived together');
  /* Leave: anything not yet reached is marked again, the watch is off. */
  const late = el('venue', 2400, { frame: true });
  const w2 = world([late]);
  const stop2 = startGuestArrivals(w2.doc as never, w2.win as never, () => {});
  assert.equal(late.cls.has('pahina-in'), false);
  stop2();
  assert.equal(late.cls.has('pahina-in'), true, 'the Maker’s canvas is left with a scene un-reached');
  assert.equal(w2.observed.size, 0);
  stop();
});

test('(2) reduced motion: nothing is touched', () => {
  const below = el('dress', 1400, { frame: true });
  const w = world([below], true);
  let n = 0;
  startGuestArrivals(w.doc as never, w.win as never, () => void n++)();
  assert.equal(below.cls.has('pahina-in'), true);
  assert.equal(n, 0);
});

test('(3) the bridge starts it with the guest mode and stops it with it', () => {
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  assert.match(bridge, /document\.documentElement\.setAttribute\('data-maker-guest', ''\);[^]*?arrivals = startGuestArrivals\(document, window,/);
  assert.match(bridge, /\} else \{\s*arrivals\?\.\(\);\s*arrivals = null;\s*document\.documentElement\.removeAttribute\('data-maker-guest'\);/);
});

test('(4) the lab’s guest page mounts the real observer wherever it mounts the bridge', () => {
  const lab = read('app/dev/maker-lab/guest/page.tsx');
  const bridges = (lab.match(/<EditorBridge \/>/g) ?? []).length;
  assert.ok(bridges >= 2, 'anti-vacuity');
  assert.equal((lab.match(/\{!preview \? <PahinaMotionRootFlag \/> : null\}\s*\{!preview \? <PahinaMotionObserver \/> : null\}/g) ?? []).length, bridges, 'a lab render where On arrival can never bind');
  assert.match(lab, /import \{ PahinaMotionObserver, PahinaMotionRootFlag \} from '@\/app\/\[slug\]\/_components\/pahina-motion';/);
});

test('(5) Slow lift is offered where it moves something', () => {
  const at = (canvas: Record<string, unknown>) => hubLiftMoves(sanitizeHubCanvas({ canvas }));
  assert.equal(at({ kind: 'photo', media: 'r2://setnayan-media/a.jpg' }), true, 'a photo behind the words');
  assert.equal(at({}), false, 'no background');
  assert.equal(at({ kind: 'color', color: '#223344' }), false, 'a colour does not move');
  assert.equal(at({ kind: 'none' }), false);
  assert.equal(at({ kind: 'photo', media: 'r2://setnayan-media/a.jpg', arrangement: 'text' }), false, 'Words only draws no photo');
  const tab = read('app/dashboard/[eventId]/website/editor/_components/scene-animate-tab.tsx');
  assert.match(tab, /const liftMoves = hubLiftMoves\(shown\);\s*const lift = liftMoves \|\| \(shown\.during \?\? m\.during\) === 'lift';/);
  assert.match(tab, /options: \(lift \? \(\['still', 'lift'\] as const\) : \(\['still'\] as const\)\)/);
  assert.match(tab, /note=\{!liftMoves && animatePhase === 'act' \? LIFT_NEEDS_A_PHOTO : null\}/);
});

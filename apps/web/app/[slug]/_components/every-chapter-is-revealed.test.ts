/**
 * EVERY CHAPTER ON THE EVENT HUB SHOWS — even one that arrives after the
 * observer attached. Runs the SHIPPED `PahinaMotionObserver` script in a fake
 * DOM, the way `the-choreography-waits-for-the-page.test.ts` does.
 *
 * ── 🔴 THE DEFECT (2026-10-05, owner on his iPhone: "nothing is showing
 * anything") ────────────────────────────────────────────────────────────────
 * On /maria-and-jose seen as "Guest who hasn't replied", the greeting and the
 * "YOUR INVITATION · RSVP for the event" link stayed at opacity 0. The
 * observer attached ONCE to the chapters that existed at load; a client
 * navigation, a `router.refresh()` or a client-rendered section mounted new
 * chapter nodes that nobody observed, while `.pahina-js` — on <html>, which
 * outlives the page — kept the CSS hiding them. A guest could not reach the
 * reply button.
 *
 * The fake models exactly what mattered: chapters that can be added after the
 * attach, a MutationObserver that reports it, a box (or none, for a hidden
 * tab) with a `top`, a scroll listener, timers, and an IntersectionObserver
 * that may NEVER deliver (a hidden document, a webview).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function shippedScript(): string {
  const file = readFileSync(join(process.cwd(), 'app/[slug]/_components/pahina-motion.tsx'), 'utf8');
  const start = file.indexOf('export function PahinaMotionObserver');
  assert.ok(start > 0, 'PahinaMotionObserver is gone — this test is pointing at nothing');
  const m = file.slice(start).match(/__html: `([\s\S]*?)`,\n/);
  assert.ok(m, 'could not lift the observer script out of the component');
  return m![1]!;
}

type Chapter = {
  classes: Set<string>;
  classList: { add(c: string): void; contains(c: string): boolean; remove(c: string): void };
  /** false = inside a `hidden` tab: no box at all. */
  rendered: boolean;
  top: number;
  getClientRects(): unknown[];
  getBoundingClientRect(): { top: number };
  name: string;
};

/** Every class change is reported to the page's MutationObserver, as a real
 *  DOM would — so a sweep that keeps re-triggering itself shows up as a loop. */
type Report = (r: { attributeName: string; target: Chapter }) => void;
let report: Report = () => {};

function chapter(name: string, top: number, rendered = true): Chapter {
  const classes = new Set<string>();
  const c: Chapter = {
    name,
    classes,
    rendered,
    top,
    classList: {
      add: (x) => { if (!classes.has(x)) { classes.add(x); report({ attributeName: 'class', target: c }); } },
      contains: (x) => classes.has(x),
      remove: (x) => { if (classes.delete(x)) report({ attributeName: 'class', target: c }); },
    },
    getClientRects: () => (c.rendered ? [{}] : []),
    getBoundingClientRect: () => ({ top: c.top }),
  };
  return c;
}

const VH = 800;

function page(initial: Chapter[]) {
  const rootClasses = new Set<string>(['pahina-js']);
  const chapters = [...initial];
  const observed = new Set<Chapter>();
  const timers: Array<() => void> = [];
  const winListeners: Record<string, Array<() => void>> = {};
  let ioCb: ((es: Array<{ isIntersecting: boolean; target: Chapter }>) => void) | null = null;
  let moCb: ((records?: Array<{ attributeName: string; target: Chapter }>) => void) | null = null;
  let moConnected = false;
  let moTarget: unknown = null;
  let moOpts: { childList?: boolean; subtree?: boolean; attributes?: boolean; attributeFilter?: string[] } | null = null;
  let throwOnQuery = false;

  const body = { tag: 'BODY' };
  const document = {
    readyState: 'complete',
    body,
    documentElement: {
      clientHeight: VH,
      classList: {
        contains: (c: string) => rootClasses.has(c),
        add: (c: string) => void rootClasses.add(c),
        remove: (c: string) => void rootClasses.delete(c),
      },
    },
    querySelectorAll: (sel: string) => {
      if (!sel.includes('data-pahina-chapters')) return [];
      if (throwOnQuery) throw new Error('boom');
      return [...chapters];
    },
    addEventListener() {},
  };
  const window: Record<string, unknown> = {
    innerHeight: VH,
    addEventListener: (ev: string, fn: () => void) => void (winListeners[ev] ??= []).push(fn),
    removeEventListener: (ev: string, fn: () => void) => {
      winListeners[ev] = (winListeners[ev] ?? []).filter((f) => f !== fn);
    },
  };
  class FakeIO {
    private hub: boolean;
    constructor(cb: typeof ioCb, opts?: { rootMargin?: string }) {
      this.hub = /^0px 0px \d/.test(opts?.rootMargin ?? '');
      if (!this.hub) ioCb = cb;
    }
    observe(t: Chapter) { if (!this.hub) observed.add(t); }
    unobserve(t: Chapter) { if (!this.hub) observed.delete(t); }
  }
  class FakeMO {
    constructor(cb: typeof moCb) { moCb = cb; }
    observe(t: unknown, o: typeof moOpts) { moTarget = t; moOpts = o; moConnected = true; }
    disconnect() { moConnected = false; }
  }
  // A real MutationObserver delivers records only while connected, and in a
  // batch after the current task — modelled as: delivered on the next settle
  // step, unless a test hands them over itself.
  const queued: Array<{ attributeName: string; target: Chapter }> = [];
  report = (rec) => { if (moConnected) queued.push(rec); };
  const setTimeout = (fn: () => void) => void timers.push(fn);

  new Function(
    'document', 'window', 'IntersectionObserver', 'MutationObserver', 'console', 'setTimeout',
    shippedScript(),
  )(document, window, FakeIO, FakeMO, { warn() {} }, setTimeout);

  const deliver = () => { if (queued.length && moCb) moCb(queued.splice(0)); };
  /** Run every pending timer and mutation batch, including any they cause.
   *  It FAILS rather than stops if they keep causing each other. */
  const settle = () => {
    let guard = 0;
    for (; (timers.length || queued.length) && guard < 50; guard++) {
      deliver();
      timers.splice(0).forEach((f) => f());
    }
    assert.ok(guard < 50, 'the sweep keeps re-triggering itself — a mutation loop');
  };

  return {
    rootClasses, chapters, observed, body,
    mo: () => ({ cb: moCb, target: moTarget, opts: moOpts }),
    /** React mounts a new chapter (client nav / refresh / client render) — the DOM reports it. */
    mount(c: Chapter) { chapters.push(c); if (moConnected) moCb?.([]); },
    /** Any class/hidden change the MutationObserver would see. */
    mutate() { if (moConnected) moCb?.([]); },
    /** Deliver the class records queued so far — what the browser does before the next paint. */
    deliver,
    listeners: (ev: string) => (winListeners[ev] ?? []).length,
    moConnected: () => moConnected,
    setHeight(h: number) { window.innerHeight = h; document.documentElement.clientHeight = h; },
    scroll() { (winListeners.scroll ?? []).forEach((f) => f()); },
    intersect(c: Chapter) { ioCb?.([{ isIntersecting: true, target: c }]); },
    settle,
    breakQueries() { throwOnQuery = true; },
    pending: () => timers.length,
  };
}

const shown = (c: Chapter) => c.classes.has('pahina-in');

test('🔴 THE REGRESSION: a chapter mounted after the attach is observed and fades in', () => {
  const p = page([chapter('masthead', 0)]);
  p.settle(); // the load is long over — every timer the attach armed has fired
  const greeting = chapter('greeting', 1200); // below the screen when it arrives
  p.mount(greeting);
  p.settle();
  assert.ok(p.observed.has(greeting), 'a chapter that arrived after the attach is observed by nobody — the iPhone defect, back');
  assert.ok(!shown(greeting), 'below the screen it must still wait for its fade');
  p.intersect(greeting);
  assert.ok(shown(greeting), 'the late chapter never got its reveal');
});

test('🔴 …and even if IntersectionObserver NEVER delivers, a late chapter on screen is shown', () => {
  const p = page([chapter('masthead', 0)]);
  p.settle();
  const rsvp = chapter('rsvp link', 400);
  p.mount(rsvp);
  p.settle(); // no intersect() — a hidden document, a webview
  assert.ok(shown(rsvp), 'the RSVP link sat on screen at opacity 0 — a guest cannot reply');
});

test('the 1.2s pass shows what is on screen with no mutation and no scroll at all', () => {
  const a = chapter('greeting', 300);
  const p = page([a]);
  assert.ok(p.observed.has(a));
  p.settle();
  assert.ok(shown(a), 'an on-screen chapter stayed hidden when IntersectionObserver never fired');
});

test('a chapter scrolled to is shown on scroll, even with a silent IntersectionObserver', () => {
  const low = chapter('details', 2000);
  const p = page([low]);
  p.settle();
  assert.ok(!shown(low), 'a chapter below the screen was revealed early — the choreography is gone');
  low.top = 500; // the guest scrolled down
  p.scroll();
  p.settle();
  assert.ok(shown(low), 'a chapter the guest scrolled to stayed hidden');
});

test('a chapter ABOVE the screen (a jump past it) is shown too', () => {
  const skipped = chapter('story', -900);
  const p = page([skipped]);
  p.settle();
  assert.ok(shown(skipped), 'a chapter the guest jumped past was left invisible above them');
});

test('a hidden tab\'s chapters wait for their tab, then show', () => {
  const me = chapter('me tab', 100, false);
  const p = page([chapter('welcome', 0)]);
  p.mount(me);
  p.settle();
  assert.ok(!shown(me), 'a chapter with no box (a hidden tab) was revealed — it has not been seen');
  me.rendered = true; // the tab opens: its `hidden` attribute flips
  p.mutate();
  p.settle();
  assert.ok(shown(me), 'a tab that opened kept its chapters invisible');
});

test('a re-render that wipes `.pahina-in` (a className rewrite) gets it back BEFORE the next paint', () => {
  const g = chapter('greeting', 200);
  const p = page([g]);
  p.intersect(g);
  p.deliver();
  assert.ok(shown(g));
  g.classList.remove('pahina-in'); // React writes className afresh (router.refresh, the live tick)
  p.deliver(); // the MutationObserver batch — no timer has run
  assert.ok(shown(g), 'a chapter already seen dipped to opacity 0 and waited for a timer — it flickers on every refresh');
});

test('…and a chapter never seen is NOT forced visible by a class change', () => {
  const low = chapter('details', 2000);
  const p = page([low]);
  low.classList.add('some-other-class');
  p.deliver();
  assert.ok(!shown(low), 'a class change revealed a chapter the guest has not reached');
});

test('the sweep and the watcher settle — revealing a chapter does not loop', () => {
  const p = page([chapter('a', 0), chapter('b', 300), chapter('c', 600)]);
  p.settle(); // asserts it finishes
  assert.equal(p.pending(), 0, 'something is still scheduled after the page settled');
});

test('🔒 a viewport with no height un-hides the page instead of guessing', () => {
  const p = page([chapter('masthead', 0)]);
  p.setHeight(0);
  p.settle();
  assert.ok(!p.rootClasses.has('pahina-js'), 'with no height to measure, chapters were left hidden');
});

test('once the flag is gone the watcher lets go — no work on the pages after', () => {
  const p = page([chapter('masthead', 0)]);
  p.settle();
  assert.ok(p.moConnected() && p.listeners('scroll') === 1);
  p.rootClasses.delete('pahina-js');
  p.mutate();
  p.settle();
  assert.ok(!p.moConnected(), 'the MutationObserver kept watching a page with nothing hidden');
  assert.equal(p.listeners('scroll'), 0, 'the scroll listener outlived the flag');
});

test('the watcher sits on <body> — it must outlive the page a client navigation replaces', () => {
  const p = page([chapter('masthead', 0)]);
  const { target, opts } = p.mo();
  assert.equal(target, p.body, 'watching anything below <body> dies with the page it was attached to');
  assert.ok(opts?.childList && opts.subtree, 'it must see nodes added anywhere');
  assert.ok(opts?.attributeFilter?.includes('hidden'), 'a tab switch (`hidden`) must trigger a sweep');
  assert.ok(opts?.attributeFilter?.includes('class'), 'a wiped `.pahina-in` must trigger a sweep');
});

test('a burst of mutations schedules ONE sweep, not one each', () => {
  const p = page([chapter('masthead', 0)]);
  p.settle();
  for (let i = 0; i < 25; i++) p.mutate();
  assert.equal(p.pending(), 1, 'every mutation queued its own sweep');
});

test('🔒 fail-visible: a sweep that throws un-hides the whole page', () => {
  const p = page([chapter('masthead', 0)]);
  p.breakQueries();
  p.mutate();
  p.settle();
  assert.ok(!p.rootClasses.has('pahina-js'), 'a broken sweep left `.pahina-js` hiding chapters');
});

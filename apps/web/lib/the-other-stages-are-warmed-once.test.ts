/**
 * the-other-stages-are-warmed-once.test.ts — 🔥 THE MAKER WARMS THE OTHER STAGES
 * ONCE PER OPEN, AND A SAVE NEVER FETCHES A PAGE NOBODY IS LOOKING AT.
 *
 * Production incident, 2026-10-08: the Maker fetched the three stages nobody
 * had opened — a full server render of the guest page each — on idle AND again
 * after every save. One person editing took the database from ~200 to
 * 3,000–11,000 requests per five minutes. The fetch-ahead was removed; the
 * owner then ruled on what a first visit to another stage may cost, verbatim:
 * *"For as long as it doesnt take kore than 1 second"*.
 *
 * So the warm is back with one shape only, and this file COUNTS it. Owner,
 * 2026-10-12, asked "every stage up front or only the next?", verbatim:
 * *"which has the fewest requests and fastest load time"* — the NEXT one only:
 *
 *   · PER OPEN  — the page on screen, then ONE other stage — the next (the
 *                 previous one from the last stage) — ONCE, on idle, after the
 *                 page on screen said `ready`; none with the tab hidden, none
 *                 on save-data or a small phone. A stage the couple opened is
 *                 still kept (up to `MAX_WARM_FRAMES`);
 *   · PER SAVE  — nothing but the page on screen. The first save of the open
 *                 ENDS the warm; nothing is warmed while one is in flight, or
 *                 after one, or again. A save's redraw (a server render) goes
 *                 to the page on screen; a kept stage pays when it is shown.
 *
 * A "fetch" here is what costs the server a render of the guest page: an
 * iframe mounted for a frame id that was not mounted before, or a refresh
 * message posted to a frame. The driver below is the component's own wiring
 * (`BufferedCanvasFrame`) over the same pure functions it calls — section 4
 * holds the component to that wiring.
 *
 *   · AND THE PAGE ON SCREEN IS FETCHED ONCE (section 3): the server's HTML
 *     carries no iframe, so nothing is loaded before React has placed it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import {
  MAX_WARM_AHEAD,
  MAX_WARM_FRAMES,
  canvasFrameId,
  canvasPosts,
  dropWarmFrames,
  planCanvasFrames,
  promoteCanvasFrame,
  trimWarmFrames,
  warmCanvasBudget,
  warmOnce,
  warmStageOrder,
  type CanvasFrame,
  type CanvasFrames,
} from '../app/dashboard/[eventId]/website/editor/_components/buffered-canvas-frame';
import { announceUnheldWrite, makerLatestWrite, makerSave, makerSavesStarted } from './maker-refresh';
import { PUBLIC_STAGE_ORDER } from './public-site-stage-labels';

const STAGES = ['save_the_date', 'rsvp', 'event', 'editorial'] as const;
type Stage = (typeof STAGES)[number];

/** One Maker open, driven as `BufferedCanvasFrame` drives it. Counts every fetch. */
class MakerOpen {
  s: CanvasFrames;
  left: readonly CanvasFrame[] | null = null;
  up = new Set<string>();
  owed = new Set<string>();
  /** Frame ids mounted, in order — each one is a guest page the server rendered. */
  loads: string[] = [];
  /** Refresh messages posted, by frame id — each one is a server render too. */
  refreshes: string[] = [];
  /** A save on its way (`makerSavesInFlight() > 0`) — the warm waits. */
  busy = false;
  /** Saves started (`makerSavesStarted()`), and what the last warm decision was made at. */
  saves = 0;
  private warmedAt = 0;
  private warmedFor: string | null = null;
  hidden = false;
  stamp = 1;
  seeAs = false;
  private mounted = new Set<string>();

  constructor(
    public stage: Stage = 'rsvp',
    public max = MAX_WARM_FRAMES,
  ) {
    this.s = { shown: this.frame(stage), loading: null };
    this.see();
  }
  frame(stage: Stage): CanvasFrame {
    return { key: `${stage}:${this.stamp}:`, group: `${stage}:`, src: `/ana-ben?phase=${stage}&editor=1` };
  }
  /** What the shell passes as `warm`: the other stages in `warmStageOrder`, at the canvas's stamp; none in "view as". */
  wanted(): CanvasFrame[] {
    return this.seeAs ? [] : warmStageOrder<Stage>(this.stage, STAGES).map((x) => this.frame(x));
  }
  private all(): CanvasFrame[] {
    return [this.s.shown, this.s.loading, ...(this.s.warm ?? [])].filter((f): f is CanvasFrame => f !== null);
  }
  /** An iframe that leaves the state is unmounted: the same frame coming back is a NEW load. */
  private see() {
    const now = new Set(this.all().map(canvasFrameId));
    for (const id of now) if (!this.mounted.has(id)) this.loads.push(id);
    for (const id of this.mounted) if (!now.has(id)) this.up.delete(id);
    this.mounted = now;
  }
  fetches(): number {
    return this.loads.length + this.refreshes.length;
  }
  /** Frames mounted that have not said `ready` — what is loading right now. */
  loadingNow(): number {
    return this.all().filter((f) => !this.up.has(canvasFrameId(f))).length;
  }
  /** Every mounted frame says `ready`; a frame loading for the shown stage is promoted. */
  settle() {
    for (const f of this.all()) {
      this.up.add(canvasFrameId(f));
      this.waiting.delete(canvasFrameId(f));
    }
    if (this.s.loading) this.s = promoteCanvasFrame(this.s, canvasFrameId(this.s.loading));
  }
  /** An idle moment — the component's warm effect (it warms `min(budget, MAX_WARM_AHEAD)`). */
  idle() {
    /* as the component: a new stage on screen, or saves that have all landed since the last warm → one fresh decision */
    if (!this.busy && (this.saves !== this.warmedAt || this.s.shown.group !== this.warmedFor)) {
      this.left = null;
      this.warmedAt = this.saves;
      this.warmedFor = this.s.shown.group;
    }
    if (this.left?.length === 0) return;
    const step = warmOnce(this.s, this.left, this.wanted(), Math.min(this.max, MAX_WARM_AHEAD), {
      ready: (f) => this.up.has(canvasFrameId(f)),
      hidden: this.hidden,
      saved: this.busy,
    });
    this.left = step.left;
    this.s = step.state;
    this.see();
  }
  /** As many idle moments and `ready`s as it takes for the warm to finish. */
  warmFully() {
    for (let i = 0; i < 12; i += 1) {
      this.settle();
      this.idle();
    }
    this.settle();
  }
  /** Drawn picks waiting for a kept frame still loading, by id — posted at its `ready`. */
  waiting = new Map<string, number>();
  broadcast(refresh: boolean) {
    const to = canvasPosts(this.s, (id) => this.up.has(id), refresh);
    if (refresh) this.refreshes.push(...to.post);
    for (const id of to.wait) this.waiting.set(id, (this.waiting.get(id) ?? 0) + 1);
    for (const id of to.owe) this.owed.add(id);
    if (to.drop.length > 0) this.s = dropWarmFrames(this.s, new Set(to.drop));
  }
  /**
   * A save. `drawn` — the bridge drew it (no render); `redraw` — the pages
   * redraw in place once it lands; `render` — the Maker re-renders and the
   * canvas reloads (a new stamp).
   */
  save(kind: 'drawn' | 'redraw' | 'render', stillOnItsWay = false) {
    this.saves += 1;
    this.busy = stillOnItsWay;
    if (kind === 'drawn') this.broadcast(false);
    if (kind === 'redraw') this.broadcast(true);
    if (kind === 'render') {
      this.stamp += 1;
      this.plan();
    }
  }
  show(stage: Stage) {
    this.stage = stage;
    this.plan();
    const id = canvasFrameId(this.s.shown);
    if (this.owed.delete(id) && !this.s.loading) this.refreshes.push(id);
  }
  private plan() {
    this.s = trimWarmFrames(planCanvasFrames(this.s, this.frame(this.stage)), this.wanted(), this.max);
    this.see();
  }
}

/* ═══ 1 · PER OPEN ═══════════════════════════════════════════════════════ */

test('one open: the page on screen, then the NEXT stage ONCE — 2 guest pages, and not one more however long it idles', () => {
  const m = new MakerOpen('rsvp');
  assert.equal(m.fetches(), 1, 'opening the Maker loads the stage on screen');
  m.warmFully();
  assert.equal(m.fetches(), 2, `one open fetched ${m.fetches()} guest pages: ${m.loads.join(' · ')}`);
  assert.deepEqual(m.loads.map((id) => id.split(':')[0]), ['rsvp', 'event'], 'the stage on screen, then the next one');
  assert.deepEqual(m.left, [], 'the warm is spent');
  // …and a hundred more idle moments, `ready`s and tab switches add nothing.
  for (let i = 0; i < 100; i += 1) {
    m.hidden = i % 2 === 0;
    m.settle();
    m.idle();
  }
  assert.equal(m.fetches(), 2);
  assert.equal(m.refreshes.length, 0, 'an open posts no refresh');
});

test('🔥 the one stage warmed is the NEXT one — the previous one from the last stage — on every stage', () => {
  // Owner 2026-10-12: *"which has the fewest requests and fastest load time"* → the next stage only.
  assert.equal(MAX_WARM_AHEAD, 1, 'an open warms ONE stage');
  assert.deepEqual([...STAGES], [...PUBLIC_STAGE_ORDER], 'this driver walks the stages in the order the Maker does');
  const next = { save_the_date: 'rsvp', rsvp: 'event', event: 'editorial', editorial: 'event' } as const;
  for (const st of STAGES) {
    assert.equal(warmStageOrder(st, PUBLIC_STAGE_ORDER)[0], next[st], `from ${st}`);
    const m = new MakerOpen(st);
    m.warmFully();
    assert.deepEqual(m.loads.map((id) => id.split(':')[0]), [st, next[st]], `an open on ${st} fetched ${m.loads.join(' · ')}`);
  }
  // The rest stay in nearest-first order — the order the KEPT stages are let go in when the budget is short.
  assert.deepEqual(warmStageOrder('rsvp', PUBLIC_STAGE_ORDER), ['event', 'save_the_date', 'editorial']);
  assert.deepEqual(warmStageOrder('editorial', PUBLIC_STAGE_ORDER), ['event', 'rsvp', 'save_the_date']);
});

test('nothing is warmed before the stage on screen has said ready — and then one stage at a time', () => {
  const m = new MakerOpen('rsvp');
  for (let i = 0; i < 5; i += 1) m.idle();
  assert.equal(m.fetches(), 1, 'a stage was warmed before the page on screen was up');
  assert.equal(m.left, null, 'and the warm is still to come, not spent');
  m.settle();
  let most = 0;
  for (let i = 0; i < 12; i += 1) {
    m.idle();
    most = Math.max(most, m.loadingNow());
    // An idle moment while the last warmed stage is still loading adds nothing.
    const before = m.fetches();
    m.idle();
    assert.equal(m.fetches(), before, 'a second stage was started while one was still loading');
    m.settle();
  }
  assert.equal(most, 1, 'never two pages loading at once');
  assert.equal(m.fetches(), 2);
});

test('a warmed stage whose bridge never says ready does not stall the warm — its document having LOADED is enough to start the next', () => {
  // A real browser, 2026-10-08 (dev harness): the first warmed stage finished loading and still had not
  // said `ready` 13 s later, so the other two were never warmed. "Up" is `ready` OR the iframe's `load`.
  // The pure step at a count of 3 (the component asks it for 1 since 2026-10-12 — the chaining rule stays true).
  const m = new MakerOpen('rsvp');
  const loaded = new Set<string>();
  const step = () => {
    const s = warmOnce(m.s, m.left, m.wanted(), m.max, { ready: (f) => m.up.has(canvasFrameId(f)) || loaded.has(canvasFrameId(f)), hidden: false, saved: false });
    m.left = s.left;
    m.s = s.state;
  };
  m.settle(); // the page on screen says ready
  for (let i = 0; i < 6; i += 1) {
    step();
    const loading = (m.s.warm ?? []).filter((f) => !loaded.has(canvasFrameId(f)));
    assert.ok(loading.length <= 1, 'never two pages loading at once');
    step(); // an idle moment while it is still loading: nothing
    assert.equal((m.s.warm ?? []).filter((f) => !loaded.has(canvasFrameId(f))).length, loading.length);
    for (const f of m.s.warm ?? []) loaded.add(canvasFrameId(f)); // `load` fires; `ready` never does
  }
  assert.equal((m.s.warm ?? []).length, 3, 'all three other stages were warmed');
  assert.deepEqual(m.left, []);
});

test('a hidden tab warms nothing; back in view, the warm happens — once', () => {
  const m = new MakerOpen('event');
  m.hidden = true;
  m.warmFully();
  assert.equal(m.fetches(), 1, 'a stage was warmed for a tab nobody is looking at');
  m.hidden = false;
  m.warmFully();
  assert.equal(m.fetches(), 2);
});

test('save-data, and a small phone: no budget, nothing warmed', () => {
  for (const device of [{ phone: false, saveData: true }, { phone: true, deviceMemory: 4 }, { phone: true, deviceMemory: 8, saveData: true }]) {
    const m = new MakerOpen('rsvp', warmCanvasBudget(device));
    m.warmFully();
    assert.equal(m.fetches(), 1, `warmed on ${JSON.stringify(device)}`);
  }
  // 🔎 Positive control: the same open on a laptop does warm — one stage.
  const laptop = new MakerOpen('rsvp', warmCanvasBudget({ phone: false }));
  laptop.warmFully();
  assert.equal(laptop.fetches(), 2);
  // A budget of 1 warms the same one stage — the next — and stops.
  const one = new MakerOpen('rsvp', 1);
  one.warmFully();
  assert.equal(one.fetches(), 2);
  // The budget is known a moment after the canvas mounts (the shell reads the device in an effect):
  // "no budget yet" is a WAIT, never a spent warm — or no laptop would ever be warmed.
  const late = new MakerOpen('rsvp', 0);
  late.warmFully();
  assert.equal(late.left, null);
  late.max = MAX_WARM_FRAMES;
  late.warmFully();
  assert.equal(late.fetches(), 2);
});

test('the warm is ONE list, decided once: a stage let go afterwards is not fetched again by an idle moment', () => {
  const m = new MakerOpen('rsvp');
  m.warmFully();
  assert.equal(m.fetches(), 2);
  // "View as" lets go of every kept stage; back from it, the Maker idles for as long as you like.
  m.seeAs = true;
  m.show('rsvp');
  assert.equal(m.s.warm, undefined, 'the kept stages were let go');
  m.seeAs = false;
  m.show('rsvp');
  m.warmFully();
  assert.equal(m.fetches(), 2, `a stage was warmed a second time in one open: ${m.loads.join(' · ')}`);
  // The couple opening one themselves still loads it — that is a tap, not a warm.
  m.show('event');
  assert.equal(m.fetches(), 3);
});

test('"view as" warms nothing, and a stage the couple opened themselves is not fetched a second time', () => {
  const as = new MakerOpen('rsvp');
  as.seeAs = true;
  as.warmFully();
  assert.equal(as.fetches(), 1, 'a "view as" page was warmed');

  const m = new MakerOpen('rsvp');
  m.settle();
  m.show('event'); // opened by hand before any idle moment
  assert.equal(m.fetches(), 2);
  m.warmFully();
  assert.equal(m.fetches(), 3, 'rsvp and event were loaded by the couple; only the stage next to the one on screen is warmed');
  assert.equal(m.loads.filter((id) => id.startsWith('event:')).length, 1);
  assert.ok(m.loads.at(-1)!.startsWith('editorial:'), `the warm took ${m.loads.at(-1)}`);
  // Touring every stage afterwards loads only the one never opened nor warmed — once; the rest are held.
  for (const st of STAGES) m.show(st);
  for (const st of STAGES) m.show(st);
  assert.equal(m.fetches(), 4);
  assert.equal(m.loads.filter((id) => id.startsWith('save_the_date:')).length, 1);
});

/* ═══ 2 · PER SAVE ═══════════════════════════════════════════════════════ */

test('⏳ a save before the warm PUTS IT OFF: nothing is warmed while it is on its way — once it has landed, the next stage ONCE', () => {
  /* (2026-10-15, rd/maker-fast-edits — measured on the production build: after any edit EVERY stage switch loaded a cold
     guest page, 3.0–4.4 s at production latency, because the first save ended the warm for the whole visit.) */
  for (const kind of ['drawn', 'redraw', 'render'] as const) {
    const m = new MakerOpen('rsvp');
    m.settle();
    m.save(kind, true);
    const afterSave = m.fetches();
    m.warmFully();
    assert.equal(m.fetches(), afterSave, `a stage was warmed while a "${kind}" save was on its way`);
    m.busy = false; // it landed
    m.warmFully();
    assert.equal(m.fetches(), afterSave + 1, `the next stage is warmed once the "${kind}" save has landed`);
    assert.ok(m.loads.at(-1)!.startsWith('event:'), `the warm took ${m.loads.at(-1)} — not the next stage`);
    m.warmFully();
    m.warmFully();
    assert.equal(m.fetches(), afterSave + 1, 'warmed ONCE — idle moments alone fetch nothing more');
  }
});

test('a save in the middle of the warm: the stage being warmed is kept — nothing more is fetched, during or after', () => {
  const m = new MakerOpen('rsvp');
  m.settle();
  m.idle(); // one stage warming
  assert.equal(m.fetches(), 2);
  m.save('drawn', true);
  m.warmFully();
  assert.equal(m.fetches(), 2, 'the warm went on during a save');
  m.busy = false;
  m.warmFully();
  assert.equal(m.fetches(), 2, 'the next stage is already kept — landing fetches it again');
});

test('after a full warm, every kind of save costs the page on screen and nothing else — 0 · 1 · 1', () => {
  const m = new MakerOpen('rsvp');
  m.warmFully();
  assert.equal(m.fetches(), 2);
  const cost = (kind: 'drawn' | 'redraw' | 'render') => {
    const before = m.fetches();
    m.save(kind);
    m.warmFully();
    return m.fetches() - before;
  };
  assert.equal(cost('drawn'), 0, 'a pick the bridge drew fetches nothing');
  assert.equal(cost('redraw'), 1, 'a redraw is ONE render: the page on screen');
  assert.equal(cost('render'), 1, 'a Maker render reloads ONE page: the one on screen');
  // Twenty more edits: twenty-something fetches of the shown page, never a kept stage.
  const before = m.fetches();
  for (let i = 0; i < 20; i += 1) {
    m.save(i % 2 ? 'redraw' : 'render');
    m.warmFully();
  }
  assert.equal(m.fetches() - before, 20);
  assert.ok(m.refreshes.every((id) => id.startsWith('rsvp:')), `a kept stage was re-rendered behind the couple: ${m.refreshes.join(' · ')}`);
  assert.ok(m.loads.slice(2).every((id) => id.startsWith('rsvp:')), `a kept stage was reloaded: ${m.loads.slice(2).join(' · ')}`);
});

test('a kept stage that missed a redraw pays ONCE, when it is shown — never a stale page kept, never paid twice', () => {
  const m = new MakerOpen('rsvp');
  m.warmFully();
  m.save('redraw');
  m.save('redraw');
  const before = m.fetches();
  m.show('event');
  assert.equal(m.fetches() - before, 1, 'the kept stage did not redraw when shown (a stale page), or redrew more than once');
  assert.ok(m.refreshes.at(-1)!.startsWith('event:'));
  m.show('rsvp');
  m.show('event');
  assert.equal(m.fetches() - before, 1, 'shown again, it owes nothing');
  // A kept stage older than the canvas (a Maker render since) is shown at once and ONE fresh page loads behind it.
  m.save('render');
  m.settle();
  const mid = m.fetches();
  assert.ok((m.s.warm ?? []).some((f) => f.key === 'rsvp:1:'), 'rsvp is kept, from before the render');
  m.show('rsvp');
  assert.equal(m.fetches() - mid, 1, 'ONE fetch: the fresh page carries the redraw it owed, so the old frame is not re-rendered as well');
  assert.ok(m.loads.at(-1)!.startsWith('rsvp:2:'));
  assert.equal(canvasFrameId(m.s.shown).split(':')[0], 'rsvp');
});

test('🔥 the Maker’s open pick, drawn while the warmed stage is still loading, does NOT throw it away — and opening that stage then loads nothing', () => {
  // Lab, 2026-10-12 (request log + frame events): the warmed stage was mounted, the open pick's `markEl` dropped it
  // 300 ms later, before its page said `ready` — the server render wasted, the stage loaded again when opened.
  const m = new MakerOpen('rsvp');
  m.settle(); // the page on screen is up
  m.idle(); // the next stage is warmed — mounted, still loading
  assert.equal(m.fetches(), 2);
  const warmId = canvasFrameId((m.s.warm ?? [])[0]!);
  m.broadcast(false); // the Maker's open pick, drawn by the bridge
  assert.equal(m.s.warm?.length, 1, 'the warmed stage was let go by a pick drawn while it loaded');
  assert.equal(m.waiting.get(warmId), 1, 'the pick waits for it');
  m.settle(); // it says ready — and is posted what it missed
  assert.equal(m.waiting.has(warmId), false);
  m.show('event');
  assert.equal(m.fetches(), 2, `opening the warmed stage loaded it again: ${m.loads.join(' · ')}`);
});

test('the routing itself: a refresh never reaches a kept frame; what the bridge draws reaches every frame that is up', () => {
  const fr = (st: string): CanvasFrame => ({ key: `${st}:1:`, group: `${st}:`, src: `/x?phase=${st}` });
  const s: CanvasFrames = { shown: fr('rsvp'), loading: fr('rsvp2'), warm: [fr('event'), fr('editorial')] };
  const up = (id: string) => id !== canvasFrameId(fr('editorial'));
  const refresh = canvasPosts(s, up, true);
  assert.deepEqual(refresh.post, [canvasFrameId(fr('rsvp')), canvasFrameId(fr('rsvp2'))]);
  assert.deepEqual(refresh.owe, [canvasFrameId(fr('event'))]);
  assert.deepEqual(refresh.drop, [canvasFrameId(fr('editorial'))], 'a redraw for a frame still loading: it may predate the save — let go');
  assert.deepEqual(refresh.wait, []);
  const pick = canvasPosts(s, up, false);
  assert.deepEqual(pick.post, [canvasFrameId(fr('rsvp')), canvasFrameId(fr('rsvp2')), canvasFrameId(fr('event'))]);
  assert.deepEqual(pick.owe, []);
  assert.deepEqual(pick.wait, [canvasFrameId(fr('editorial'))], 'a drawn pick WAITS for a kept frame still loading');
  assert.deepEqual(pick.drop, [], 'a drawn pick threw a loading kept frame away');
});

/* ═══ 3 · ONE CANVAS DOCUMENT PER OPEN — NO IFRAME IN THE SERVER'S HTML ══ */

test('🧯 the server renders NO iframe for the canvas — so the browser cannot fetch the page before React has placed it', async () => {
  // Production, 2026-10-08: the canvas document was fetched TWICE on every open.
  // The server's HTML carried `<iframe src>` inside a streamed Suspense segment;
  // the browser began loading it there, React moved the segment into place, and a
  // moved iframe loads again. This renders the component exactly as the server
  // does and COUNTS the iframes in what it sends.
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { BufferedCanvasFrame } = await import('../app/dashboard/[eventId]/website/editor/_components/buffered-canvas-frame');
  const wanted = ['save_the_date', 'event', 'editorial'].map((st) => ({ key: `${st}:1:`, group: `${st}:`, src: `/ana-ben?phase=${st}&editor=1` }));
  for (const pageFrame of [false, true]) {
    const html = renderToStaticMarkup(
      React.createElement(BufferedCanvasFrame, {
        frameKey: 'rsvp:1:',
        group: 'rsvp:',
        src: '/ana-ben?phase=rsvp&editor=1',
        title: 'Your Event Hub',
        className: 'x',
        frameRef: { current: null },
        loadingRef: { current: null },
        warm: wanted,
        warmMax: MAX_WARM_FRAMES,
        anchorKey: () => null,
        onShown: () => {},
        onSwapped: () => {},
        pageFrame,
      }),
    );
    // 🔎 Positive control: the component DID render — its box is in the HTML.
    assert.match(html, pageFrame ? /data-maker-page-frames="shown"/ : /data-maker-canvas-frames="shown"/);
    assert.equal((html.match(/<iframe/g) ?? []).length, 0, `the server's HTML carries an iframe: ${html}`);
    assert.doesNotMatch(html, /\ssrc=/, 'the server hands the browser an address to fetch');
    // The box still names the page it will show — an attribute fetches nothing.
    assert.match(html, /data-canvas-src="\/ana-ben\?phase=rsvp&amp;editor=1"/);
    assert.equal((html.match(/ana-ben/g) ?? []).length, 1, 'no other stage is named, let alone fetched');
  }
});

test('…and the client mounts the frames once it has mounted itself — the shown frame is then wired as before', () => {
  const buffer = stripComments(readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/website/editor/_components', 'buffered-canvas-frame.tsx'), 'utf8'));
  assert.match(buffer, /const \[mounted, setMounted\] = useState\(false\);\s+useEffect\(\(\) => setMounted\(true\), \[\]\);/);
  assert.match(buffer, /\{mounted && list\.map\(\(f\) => \{/);
  assert.equal((buffer.match(/<iframe/g) ?? []).length, 1, 'ONE place draws a frame');
  // The Maker talks to the frame SHOWN: that ref is filled when the frames mount, not only when the list changes.
  assert.match(buffer, /\}, \[frames, frameRef, loadingRef, backgroundRef, mounted\]\);/);
});

/* ═══ 4 · THE COMPONENT IS WIRED AS THE DRIVER ABOVE ═════════════════════ */

test('every Maker write moves the count the canvas reads — a held pick, a draft save, a form', async () => {
  const at = makerSavesStarted();
  void makerLatestWrite('warm-once:test', async () => ({ ok: true })).catch(() => {});
  assert.ok(makerSavesStarted() > at, 'a pick waiting for its beat is a write that has started');
  const b = makerSavesStarted();
  await makerSave(async () => ({ ok: true }), () => {}, { held: true });
  assert.ok(makerSavesStarted() > b, 'a held save');
  const c = makerSavesStarted();
  await makerSave(async () => ({ ok: false }), () => {});
  assert.ok(makerSavesStarted() > c, 'an unheld save — even one that is refused');
  const d = makerSavesStarted();
  announceUnheldWrite();
  assert.ok(makerSavesStarted() > d, 'a form the shell submits');
});

test('the component: one warm effect, on idle, reading saves, the Maker render, the tab — and the redraw routed by canvasPosts', () => {
  const WEB = join(__dirname, '..');
  const dir = 'app/dashboard/[eventId]/website/editor/_components';
  const buffer = stripComments(readFileSync(join(WEB, dir, 'buffered-canvas-frame.tsx'), 'utf8'));
  const shell = stripComments(readFileSync(join(WEB, dir, 'editor-shell.tsx'), 'utf8'));

  // The ONLY things that put a frame into the state: the stage shown (planCanvasFrames) and warmOnce.
  assert.equal((buffer.match(/warmOnce\(/g) ?? []).length, 2, 'warmOnce: its definition and ONE call');
  const effect = buffer.slice(buffer.indexOf('const warmLeft = useRef'), buffer.indexOf('const shownId = '));
  assert.ok(effect.length > 300, 'the warm effect moved — re-anchor this test');
  assert.match(effect, /return whenIdle\(\(\) => \{/, 'on an idle moment, cancelled on unmount');
  assert.match(effect, /ready: \(f\) => canvasFrameId\(f\) in readyOf\.current \|\| loaded\.current\.has\(canvasFrameId\(f\)\),/, 'after the frames are up: `ready`, or `load`');
  // A frame is "loaded" only from its own iframe's `load` event — the server has finished rendering it.
  assert.match(buffer, /onLoad=\{\(\) => \{\s+loaded\.current\.add\(canvasFrameId\(f\)\);\s+setWarmTick\(\(n\) => n \+ 1\);/);
  assert.equal((buffer.match(/loaded\.current\.add\(/g) ?? []).length, 1, 'ONE thing marks a frame loaded: its load event');
  assert.match(effect, /hidden: document\.visibilityState === 'hidden',/);
  /* (2026-10-15, rd/maker-fast-edits) a save on its way PUTS OFF the warm; once every save has landed (one event,
     `MAKER_SAVES_QUIET_EVENT`) — or a new stage is on screen — ONE fresh decision is made. */
  assert.match(effect, /const busy = makerSavesInFlight\(\) > 0;/);
  assert.match(effect, /saved: busy,/);
  assert.match(effect, /if \(!busy && \(savesNow !== warmedAt\.current \|\| s\.shown\.group !== warmedFor\.current\)\) \{\s*warmLeft\.current = null;/, 're-armed ONLY by a new stage on screen or saves that have landed');
  assert.equal((effect.match(/warmLeft\.current = null/g) ?? []).length, 1, 'one way to re-arm the warm');
  assert.match(effect, /if \(warmLeft\.current\?\.length === 0\) return;/, 'a spent decision fetches nothing more');
  assert.match(effect, /warmLeft\.current = step\.left;/);
  assert.match(effect, /window\.addEventListener\(MAKER_SAVES_QUIET_EVENT, quiet\);/);
  // No timer or interval drives it: a `ready`, the tab coming back, the budget, a Maker render, the saves landing.
  assert.match(effect, /\}, \[warmTick, warmMax, warmOver, frames\.shown\.group\]\);/);
  // 🔥 It warms the NEXT stage only: the budget handed to the step is capped at MAX_WARM_AHEAD (owner 2026-10-12).
  assert.match(effect, /const step = warmOnce\(s, warmLeft\.current, wantedRef\.current, Math\.min\(warmMax, MAX_WARM_AHEAD\), \{/);
  // …and the saves-quiet moment is told by the one save door, after the last save in flight (`lib/maker-refresh.ts`).
  const door = stripComments(readFileSync(join(WEB, 'lib/maker-refresh.ts'), 'utf8'));
  assert.match(door, /if \(!options\.held\) unheldInFlight -= 1;\s*announceSavesQuiet\(\);/);
  assert.match(door, /if \(shared\.inFlight\(\) \+ writer\.pending\(\) === 0\) window\.dispatchEvent\(new Event\(MAKER_SAVES_QUIET_EVENT\)\);/);
  // …in the order the Maker hands it: `warmStageOrder` over the stages as the site lives through them.
  assert.match(shell, /\? warmStageOrder<LifecyclePhase>\(stage, PUBLIC_STAGE_ORDER\)\.map\(\(s\) => \(\{/);
  assert.doesNotMatch(shell, /function warmStageOrder/, 'ONE warm order — the one this file tests');
  assert.doesNotMatch(buffer, /setInterval|requestIdleCallback|nextWarmFrame/);

  // The redraw goes where `canvasPosts` says, and a kept stage pays when shown.
  const cast = buffer.slice(buffer.indexOf('broadcastRef.current = (message: unknown) => {'), buffer.indexOf('broadcastRef.current = null'));
  assert.match(cast, /canvasPosts\(framesRef\.current, \(id\) => id in readyOf\.current, message === CANVAS_REFRESH_MESSAGE\)/);
  assert.match(cast, /for \(const id of to\.post\) els\.current\[id\]\?\.contentWindow\?\.postMessage\(message, window\.location\.origin\);/);
  assert.equal((cast.match(/postMessage\(/g) ?? []).length, 1, 'one way out of the broadcast: the ids canvasPosts allows');
  assert.match(cast, /for \(const id of to\.wait\) \{\s+const q = \(waiting\.current\[id\] \?\?= \[\]\);/, 'a drawn pick waits for a kept frame still loading');
  // …and is posted, in order, the moment that frame says `ready`.
  assert.match(buffer, /readyOf\.current\[id\] = data;\s+const missed = waiting\.current\[id\];\s+delete waiting\.current\[id\];\s+for \(const m of missed \?\? \[\]\) el\.contentWindow\?\.postMessage\(m, window\.location\.origin\);/);
  assert.match(buffer, /if \(owed\.current\.delete\(shownId\) && !framesRef\.current\.loading\) els\.current\[shownId\]\?\.contentWindow\?\.postMessage\(CANVAS_REFRESH_MESSAGE, window\.location\.origin\);/);

  // The shell hands the canvas its budget (save-data and small phones → 0), and says when the Maker has
  // rendered again since the open — a boolean that can only STOP the warm; the render stamp itself never
  // reaches the frame (`element-preview.test.ts` holds that).
  assert.match(shell, /saveData: nav\.connection\?\.saveData \?\? null,/);
  assert.match(shell, /const \[openStamp\] = useState\(maker\?\.renderStamp \?\? ''\);\s+const warmOver = \(maker\?\.renderStamp \?\? ''\) !== openStamp;/);
  assert.match(shell, /warmMax=\{warmBudget\}\s+warmOver=\{warmOver\}/);
  assert.equal((shell.match(/warmOver=/g) ?? []).length, 1, 'only the stage canvas warms — never the phone pane, never a page frame');
  assert.equal((buffer.match(/warmOver/g) ?? []).length, 3, 'warmOver re-runs the warm decision on a Maker render (prop · type · deps)');
  // The redraw event is still sent through the broadcast (so through canvasPosts).
  assert.match(shell, /broadcastToCanvasRef\.current\(CANVAS_REFRESH_MESSAGE\);/);
});

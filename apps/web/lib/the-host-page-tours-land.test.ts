/**
 * the-host-page-tours-land.test.ts — 🔦 the host's five page tours, and the engine rule that stops a tour sitting
 * silent (owner "yes to all" 2026-10-22, prototype `journey_fixes_later_2026-10-22.html` § Host 4 + Simple-event
 * stall Option A).
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. Each host page tour (`HOST_PAGE_TOURS`) is a spotlight of 3–4 stops, lights NO anchor the journey
 *      (`host_spotlight_v1`) already lit, and names no price (App Review 3.1.1; prices live in
 *      `platform_retail_catalog_v2`, never in a tour).
 *   2. Each is MOUNTED, after the journey (or, inside the Maker, after the Maker's own tour) — and the old carousel
 *      mounts for the pages it replaces are gone, so two first-visit things never stack.
 *   3. Only a mount inside the Maker says `inMaker`, and the engine's Maker pause yields to exactly that.
 *   4. A MISSING DOORWAY TAKES ITS PAGE WITH IT: on a Simple event's Home (no Guests, no Suppliers tab) the journey
 *      reaches its finale with an honest count — and a page that is merely ELSEWHERE (the event-type picker, while
 *      the host makes the event) drops nothing. Tested on the pure rule (`lib/spotlight-drops.ts`) the engine runs.
 *
 * Comments stripped before source matching (`lib/strip-comments.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { TOURS } from '@/lib/tours';
import { HOST_PAGE_TOURS, HOST_PAGE_TOURS_AFTER, MAKER_INNER_TOURS_AFTER } from '@/lib/host-page-tours';
import { missingGroups, nextKept, spotlightCount } from '@/lib/spotlight-drops';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
const KEYS = Object.entries(HOST_PAGE_TOURS) as Array<[keyof typeof HOST_PAGE_TOURS, (typeof HOST_PAGE_TOURS)[keyof typeof HOST_PAGE_TOURS]]>;

// ── 1 · the scripts ───────────────────────────────────────────────────────
test('each host page tour is a short spotlight that repeats no journey stop and names no price', () => {
  const journey = new Set((TOURS[HOST_PAGE_TOURS_AFTER].spotlight?.steps ?? []).map((s) => s.anchor));
  assert.ok(journey.size >= 5, 'the journey has no stops — did host_spotlight_v1 move?');
  for (const [, key] of KEYS) {
    const sp = TOURS[key].spotlight;
    assert.ok(sp, `${key} has no spotlight script`);
    assert.ok(sp.steps.length >= 3 && sp.steps.length <= 4, `${key} has ${sp.steps.length} stops — a page tour is 3 or 4`);
    const anchors = sp.steps.map((s) => s.anchor);
    assert.equal(new Set(anchors).size, anchors.length, `${key} lights one anchor twice`);
    for (const a of anchors) assert.ok(!journey.has(a), `${key} repeats the journey's stop "${a}"`);
    assert.ok(!sp.steps.some((s) => s.welcome), `${key} repeats the journey's once-only welcome`);
    const words = [...sp.steps.flatMap((s) => [s.title, s.body]), sp.finale.title, sp.finale.body].join(' ');
    assert.doesNotMatch(words, /₱|\bPHP\b|\bpesos?\b|\d[\d,]*\s*(?:\/|per)\s*(?:yr|year|mo)/i, `${key} names a price: "${words}"`);
  }
});

// ── 2 · the mounts ────────────────────────────────────────────────────────
type Mount = { file: string; key: keyof typeof HOST_PAGE_TOURS; after: 'journey' | 'maker'; inMaker: boolean };
const MOUNTS: Mount[] = [
  { file: 'app/dashboard/[eventId]/launch/page.tsx', key: 'maker', after: 'journey', inMaker: true },
  { file: 'app/dashboard/[eventId]/budget/page.tsx', key: 'budget', after: 'journey', inMaker: false },
  { file: 'app/dashboard/[eventId]/memories/page.tsx', key: 'memories', after: 'journey', inMaker: false },
  { file: 'app/dashboard/[eventId]/page.tsx', key: 'home', after: 'journey', inMaker: false },
  { file: 'app/dashboard/[eventId]/studio/papic/page.tsx', key: 'papic', after: 'journey', inMaker: false },
  { file: 'app/dashboard/[eventId]/seating/page.tsx', key: 'seatPlan', after: 'journey', inMaker: false },
  { file: 'app/dashboard/[eventId]/seating/page.tsx', key: 'seatPlan', after: 'maker', inMaker: true },
  { file: 'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx', key: 'moodBoard', after: 'journey', inMaker: false },
  { file: 'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx', key: 'moodBoard', after: 'maker', inMaker: true },
];

/** Every `<Spotlight …/>` tag in a file, attributes as written. */
function spotlightTags(src: string): string[] {
  return [...src.matchAll(/<Spotlight\b([^>]*?)\/>/g)].map((m) => m[1]!);
}

for (const m of MOUNTS) {
  test(`${HOST_PAGE_TOURS[m.key]} is mounted in ${m.file}${m.inMaker ? ' (inside the Maker)' : ''}, after ${m.after === 'journey' ? 'the journey' : "the Maker's own tour"}`, () => {
    const tags = spotlightTags(read(m.file)).filter((t) => new RegExp(`tourKey=\\{HOST_PAGE_TOURS\\.${m.key}\\}`).test(t));
    const after = m.after === 'journey' ? /after=\{HOST_PAGE_TOURS_AFTER\}/ : /after=\{MAKER_INNER_TOURS_AFTER\}/;
    const hit = tags.filter((t) => after.test(t) && /\binMaker\b/.test(t) === m.inMaker);
    assert.ok(hit.length >= 1, `no <Spotlight tourKey={HOST_PAGE_TOURS.${m.key}} …> with that order in ${m.file}; found ${JSON.stringify(tags)}`);
  });
}

test('inside the Maker, every page tour waits for the Maker’s own (one tour at a time there too)', () => {
  assert.equal(MAKER_INNER_TOURS_AFTER, HOST_PAGE_TOURS.maker);
  // Every inMaker mount but the Maker's own waits for the Maker's tour — none may wait only for the journey.
  for (const f of [...new Set(MOUNTS.map((m) => m.file))]) {
    for (const t of spotlightTags(read(f)).filter((t) => /\binMaker\b/.test(t))) {
      if (/tourKey=\{HOST_PAGE_TOURS\.maker\}/.test(t)) continue;
      assert.match(t, /after=\{MAKER_INNER_TOURS_AFTER\}/, `${f}: an inMaker page tour does not wait for the Maker's own — two would stack`);
    }
  }
});

test('the old carousels for the replaced pages are gone (two first-visit things never stack)', () => {
  for (const f of ['app/dashboard/[eventId]/budget/page.tsx', 'app/dashboard/[eventId]/studio/papic/page.tsx', 'app/dashboard/[eventId]/seating/page.tsx']) {
    assert.doesNotMatch(read(f), /<MiniTour\b/, `${f} still mounts a MiniTour beside its spotlight`);
  }
});

test('the Maker’s quiet line shows while its tour is due — it is stop 1', () => {
  const page = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(page, /tourHint=\{makerSpotlightDue\}/, 'the launch page no longer tells the shell the tour is due');
  const shell = read('app/dashboard/[eventId]/launch/_components/maker-shell.tsx');
  assert.match(shell, /useState\(\(firstVisit \|\| tourHint\) && hasWork\)/, 'the quiet line no longer shows for a due tour');
  assert.match(shell, /data-tour="maker-hint"/);
  // ⋯ › About the Maker replays THIS tour where it is mounted, and the short slides only where it is not.
  const about = shell.slice(shell.indexOf('const aboutTheMaker'), shell.indexOf('const aboutTheMaker') + 500);
  assert.match(about, /getAttribute\('data-spotlight-page'\) === HOST_PAGE_TOURS\.maker/, 'About the Maker no longer asks for the Maker spotlight');
  assert.match(about, /detail: \{ tourKey: HOST_PAGE_TOURS\.maker \}/);
  assert.match(about, /else setTour\(true\)/, 'About the Maker lost its fallback');
});

// ── 3 · the Maker pause ───────────────────────────────────────────────────
test('only mounts inside the Maker say inMaker, and the engine’s Maker pause yields to exactly that', () => {
  const engine = read('app/_components/spotlight-tour.tsx');
  assert.match(engine, /if \(!inMaker && document\.querySelector\('\[data-maker-shell\]'\)\)/, 'the Maker pause no longer yields to an inMaker mount');
  const layout = read('app/dashboard/layout.tsx');
  for (const t of spotlightTags(layout)) assert.doesNotMatch(t, /\binMaker\b/, 'the journey mount says inMaker — it would run on top of the Maker');
});

// ── 4 · a missing doorway takes its page with it ──────────────────────────
const JOURNEY = TOURS.host_spotlight_v1.spotlight!.steps;
const at = (anchors: string[]) => (j: number) => anchors.includes(JOURNEY[j]!.anchor);
const idx = (anchor: string) => JOURNEY.findIndex((s) => s.anchor === anchor && !s.welcome);

/** Drop every group the rule names, again and again, as the engine does tick after tick. */
function settle(i: number, present: (j: number) => boolean): Set<number> {
  const dropped = new Set<number>();
  for (let guard = 0; guard < 20; guard++) {
    const groups = missingGroups(JOURNEY, i, dropped, present);
    if (groups.length === 0) break;
    for (const g of groups) for (const j of g) dropped.add(j);
    if (dropped.has(i)) {
      const to = nextKept(JOURNEY, i, dropped);
      if (to === null) break;
      i = to;
    }
  }
  return dropped;
}

test('a Simple event’s Home: the hidden tabs take their pages, the count is honest, and Next reaches the finale', () => {
  // (The Event Hub stop lights the bar's Hub tab since Home's door pills came off — owner 2026-10-23.)
  // (Home's stop rings the control row since the Next card went — owner-approved 2026-10-24.)
  const i = idx('home-tiles');
  assert.ok(i > 0 && JOURNEY[idx('tab-guests')]!.go && JOURNEY[idx('tab-vendors')]!.go, 'the journey shape moved');
  const dropped = settle(i, at(['home-tiles', 'tab-launch']));
  for (const a of ['tab-guests', 'guests-add', 'guests-setup', 'tab-vendors', 'suppliers-find']) {
    assert.ok(dropped.has(idx(a)), `"${a}" was not dropped on a Simple event — the tour would sit silent`);
  }
  const { n, of } = spotlightCount(JOURNEY, i, dropped);
  assert.ok(of < JOURNEY.filter((s) => !s.welcome).length && n <= of, `the count was not recounted (${n} of ${of})`);
  assert.equal(nextKept(JOURNEY, idx('tab-launch'), dropped), null, 'after the last Home stop the tour does not reach its finale');
});

test('a full event’s Home drops nothing', () => {
  assert.deepEqual([...settle(idx('home-tiles'), at(['home-tiles', 'tab-launch', 'tab-guests', 'tab-vendors']))], []);
});

test('a page that is merely elsewhere drops nothing (the host is still in the event-type picker)', () => {
  // The picker holds none of Home's stops — nor the event's tabs. Waiting, not dropping, is right there.
  assert.deepEqual([...settle(1, at([]))], []);
  assert.deepEqual([...settle(idx('home-tiles'), at(['create-event']))], []);
});

test('the engine runs the rule and counts from what is left', () => {
  const engine = read('app/_components/spotlight-tour.tsx');
  assert.match(engine, /missingGroups\(steps, iRef\.current, droppedRef\.current,/, 'the engine no longer drops a missing page');
  assert.match(engine, /spotlightCount\(steps, i, dropped\)/, '"Step N of M" no longer counts from what is left');
  assert.match(engine, /nextKept\(steps, iRef\.current, droppedRef\.current\)/, 'Next no longer skips dropped steps');
});

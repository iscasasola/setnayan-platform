/**
 * the-lab-plays-the-scrub-chain.test.ts — THE REAL SCRUB, IN THE MAKER LAB, AND WHAT A SCRUB SCENE IS WHILE EDITING
 * (controller 2026-10-09: "`?scrub=1` opens the Maker lab's sample with the same chain as the prototype … so the
 * owner tries the REAL thing; ▶ preview (hold) must show it working inside the Maker"; "the editor must stay a place
 * where every part can be picked — holds OFF while editing and ON only under ▶ held").
 *
 * 🧪 The behaviour is played in a browser by `scripts/scrub-browser-check.mjs` case 7 (the page's own island, on a
 * page with a Maker marker: nothing held while editing, every scene the top thing at its own place; armed when the
 * page is shown as a guest, the scene that was mid-screen still there and readable; every mark gone on the way
 * back). This file holds what makes that true in the unit suite:
 *
 *   (1) THE CHAIN IS THE PROTOTYPE'S, THROUGH THE REAL RENDERER — executed: the lab's six canvases through
 *       `HubScenes` give two short hand-overs, a Schedule whose rows build one by one and which then hands over, a
 *       scene with no Build out that holds nothing, an ordinary one that hands over, and a last arrival nobody
 *       arranged. Sabotage: the Schedule's rows built together → red.
 *   (2) ONE CHAIN — the page the browser check plays takes its canvases from the lab's chain, in its order.
 *       Sabotage: a canvas written in the check page → red.
 *   (3) THE LAB DRAWS IT THE WAY THE GUEST PAGE DOES — `HubScenes`, one node a scene with its marker, the markers
 *       only on the Maker's canvas; the Maker is given an address it can write its query after; the chain's saves
 *       ride their own cookie. Sabotage: the markers drawn for a guest too → red.
 *   (4) WHILE EDITING NOTHING IS HELD — executed (`scrubArmsNow`), and the island reads the two real signals: the
 *       Maker's marker (drawn by the server for a verified host only) and the bridge's "as a guest" mark. The
 *       place-keeping is fetched on the Maker's canvas only. Sabotage: the canvas armed while editing → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { stripComments } from './strip-comments';
import { hubCanvasClass, resolveHubMotion, sanitizeHubCanvas } from './hub-canvas';
import { HubScenes } from '../app/[slug]/_components/hub-scenes';
import { scrubArmsNow } from '../app/[slug]/_components/hub-scrub';
import { LAB_SCRUB_CHAIN, LAB_SCRUB_GUEST, LAB_SCRUB_NAME, LAB_SCRUB_SAMPLE, labScrubCanvases, labScrubLabel, labWidgetsCookie } from '../app/dev/maker-lab/lab-scrub';
import { readScrubBadge } from '../app/dev/maker-lab/guest/scrub-badge';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));

test('(1) the lab’s chain, through the real renderer, is the prototype’s minus the cover: a short hand-over, a list row by row, a note that stays, an ordinary one, a last arrival', () => {
  /* 🔁 2026-10-09 (8d): the chain was six scenes with the prototype's effects one step off their contents (the names
     are the cover, which is not a scene). It is now the prototype's five scenes after the names, each with the
     settings the prototype gave THAT content. */
  assert.deepEqual([...LAB_SCRUB_CHAIN], ['countdown', 'schedule', 'special_message', 'dress_code', 'venue_map']);
  const canvas = (t: (typeof LAB_SCRUB_CHAIN)[number]) => sanitizeHubCanvas({ canvas: LAB_SCRUB_SAMPLE[t] });
  const leaves = (t: (typeof LAB_SCRUB_CHAIN)[number]) => canvas(t).transition === 'scrub' && resolveHubMotion(canvas(t)).out !== 'none';
  assert.deepEqual(LAB_SCRUB_CHAIN.map(leaves), [true, true, false, true, false], 'which scenes hand over');
  /* The Schedule: rows one by one, an arrival effect to build them with, and a Build out to leave by. */
  assert.match(hubCanvasClass(canvas('schedule')), /\bhub-seq-parts\b/, 'the Schedule’s rows build together');
  assert.notEqual(resolveHubMotion(canvas('schedule')).in, 'none');
  /* The note that stays has NO Build out and still builds in; the last arrival has nothing arranged at all. */
  assert.equal(resolveHubMotion(canvas('special_message')).out, 'none');
  assert.notEqual(resolveHubMotion(canvas('special_message')).in, 'none');
  assert.deepEqual(canvas('venue_map'), {});
  /* The prototype's settings, on the contents it gave them to — said in the words each card wears. */
  const says = (t: (typeof LAB_SCRUB_CHAIN)[number], i: number) => labScrubLabel({ canvas: LAB_SCRUB_SAMPLE[t] }, { last: i === LAB_SCRUB_CHAIN.length - 1 }).map((l) => `${l.name} ${l.value}`).join(' · ');
  assert.deepEqual(LAB_SCRUB_CHAIN.map(says), [
    'Build in From below + Fade · Build out Shrink + Fade · Leaves Scrub out',
    'Rows build in From the right + Fade, one by one · Build out Blur + Fade · Leaves Scrub out',
    'Build in Grow + Fade · Build out none — it stays on the page · Leaves As it scrolls away',
    'Build in From the left + Fade · Build out Fade · Leaves Scrub out',
    'Nothing arranged on it the last scene — it arrives with the hand-over’s own fade',
  ]);
  /* …and a label is READ from the canvas: arrange the scene differently and the card says so. */
  assert.match(labScrubLabel({ canvas: { in: 'fade', out: 'none', transition: 'scrub' } }, { last: false }).map((l) => l.value).join('|'), /^Fade\|none — it stays on the page\|Scrub out, with nothing to play$/);
  /* Through `HubScenes`: three hand-overs, nested in page order, every scene's effects under the thumb, the engine mounted. */
  const widgets = LAB_SCRUB_CHAIN.map((t) => ({ widget_id: `lab-${t}`, widget_type: t, config_json: { canvas: LAB_SCRUB_SAMPLE[t] } }));
  const nodes = LAB_SCRUB_CHAIN.map((t) => React.createElement('section', { key: t, 'data-scene': t }));
  /* (The scenes are handed over as `createElement`'s own children — this file has no JSX.) */
  const Scenes = HubScenes as unknown as React.FC<{ widgets: unknown; scrubAllowed: boolean }>;
  const html = renderToStaticMarkup(React.createElement(Scenes, { widgets, scrubAllowed: true }, ...nodes));
  assert.equal((html.match(/class="hub-cell"/g) ?? []).length, 3, 'the chain’s hand-overs');
  assert.equal((html.match(/data-hub-fx=""/g) ?? []).length, 5, 'every scene of the chain is played under the thumb');
  const order = [...html.matchAll(/data-scene="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, [...LAB_SCRUB_CHAIN], 'the page order');
  /* The note that stays is NOT wrapped in a hold of its own: what follows it is its ordinary neighbour. */
  assert.doesNotMatch(html, /class="hub-stage"><div class="hub-scene hub-scroll"[^>]*><section data-scene="special_message"/);
  for (const held of ['countdown', 'schedule', 'dress_code']) {
    assert.match(html, new RegExp(`class="hub-stage"><div class="hub-scene hub-scroll"[^>]*><section data-scene="${held}"`), `${held} is not held for its hand-over`);
  }
  /* Without Event Hub Pro nothing is held — the lab passes it (below). */
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Scenes, { widgets, scrubAllowed: false }, ...nodes)), /hub-cell/);
});

test('(2) one chain: the page the browser check plays takes its canvases from the lab’s chain — all but the cover’s', () => {
  const page = read('scripts/scrub-check-page.tsx');
  assert.match(page, /import \{ LAB_SCRUB_CHAIN, LAB_SCRUB_SAMPLE \} from '\.\.\/app\/dev\/maker-lab\/lab-scrub';/);
  assert.match(page, /\.map\(\(s, i\) => \(\{ \.\.\.s, canvas: LAB_SCRUB_SAMPLE\[LAB_SCRUB_CHAIN\[i\]!\] \}\)\)/);
  assert.equal((page.match(/\{ name: '\w+', rows: \d+ \}/g) ?? []).length, LAB_SCRUB_CHAIN.length, 'the check page’s scenes and the lab’s chain are not the same length');
  /* 🔁 2026-10-09 (8d): ONE canvas is the check page's own — its first scene, standing in for the cover, which the
     lab no longer shows (a real page cannot hand the cover over yet). Exactly one, named. */
  assert.match(page, /const COVER = \{ in: 'fade', out: 'move_fade', outTo: 'above', transition: 'scrub' \} as const;/);
  assert.match(page, /\{ name: 'Names', rows: 0, canvas: COVER \},/);
  assert.equal((page.match(/transition: '|sequence: '|outFx:|inFx:/g) ?? []).length, 1, 'the check page writes more than the cover’s canvas');
  /* …and it is the REAL renderer and the REAL island it plays. */
  assert.match(page, /<HubScenes widgets=\{widgets as never\} scrubAllowed>/);
  /* (8d: the lab's badge is mounted beside the island, so the check reads what the badge says in each state.) */
  assert.match(read('scripts/scrub-check-island.tsx'), /import \{ HubScrub \} from '\.\.\/app\/\[slug\]\/_components\/hub-scrub';[\s\S]*render\(\s*<>\s*<HubScrub \/>\s*<LabScrubBadge \/>\s*<\/>,\s*\)/);
});

test('(3) the lab draws the chain as the guest page draws scenes, and the Maker can reach it', () => {
  const guest = read('app/dev/maker-lab/guest/page.tsx');
  assert.match(guest, /const scrub = sp\.scrub === '1';/);
  /* The real renderer, Pro on, one node a scene: its marker and its framed scene in one fragment. */
  assert.match(
    guest,
    /<HubScenes widgets=\{LAB_SCRUB_CHAIN\.map\(\(t\) => \(\{ \.\.\.rowOf\(t\), widget_id: `lab-\$\{t\}` \}\)\) as never\} scrubAllowed>\s*\{LAB_SCRUB_CHAIN\.map\(\(t, i\) => \(\s*<Fragment key=\{t\}>\s*\{mark\(`w:\$\{t\}`\)\}\s*\{chainCard\(t, i\)\}\s*<\/Fragment>\s*\)\)\}\s*<\/HubScenes>/,
  );
  /* Every scene of the chain is a labelled CARD inside the real frame (its Build in / out are the frame's, so the
     card itself moves) — the label read from the canvas the scene is drawn with, the first card saying the cover is
     not in the chain (8d: a hold with nothing saying what is happening reads as a stuck page). */
  assert.match(
    guest,
    /const chainCard = \(type: LabScrubScene, i: number\) => \(\s*<HubCanvasFrame widget=\{\{ \.\.\.rowOf\(type\), widget_id: `lab-\$\{type\}` \} as never\}[^>]*>\s*<section\s+data-lab-scene=\{type\}\s+data-lab-name=\{LAB_SCRUB_NAME\[type\]\}/,
  );
  assert.match(guest, /labScrubLabel\(rowOf\(type\)\.config_json, \{ last: i === LAB_SCRUB_CHAIN\.length - 1 \}\)/);
  assert.match(guest, /\{i === 0 \? <span[^>]*>The cover above is not part of the chain yet\.<\/span> : null\}/);
  assert.match(guest, /<div className="sn-editorial mx-auto max-w-\[430px\] px-4 pb-6" data-lab-scrub="">/, 'the chain lost its phone-wide column');
  assert.deepEqual(Object.keys(LAB_SCRUB_NAME), [...LAB_SCRUB_CHAIN]);
  /* The markers as the real page draws them: on the Maker's canvas only — the island reads them. */
  assert.match(guest, /const mark = \(key: string\) => \(scrub && sp\.editor !== '1' \? null : <span hidden data-maker-section=\{key\} \/>\);/);
  assert.match(read('app/[slug]/_components/site-body.tsx'), /isEditorCanvas && editorBridge \? <span hidden data-maker-section=\{key\} \/> : null;/, 'the real page’s marker is no longer the Maker’s canvas alone');
  /* The chain's canvases: its start, and what was saved here — from the chain's own cookie, on both sides. */
  assert.match(guest, /get\(labWidgetsCookie\(scrub\)\)[\s\S]*?drafted = labScrubCanvases\(scrub, drafted\);/);
  const lab = read('app/dev/maker-lab/page.tsx');
  assert.match(lab, /const scrub = sp\.scrub === '1';[\s\S]*?get\(labWidgetsCookie\(scrub\)\)[\s\S]*?drafted = labScrubCanvases\(scrub, drafted\);/);
  assert.match(lab, /scrub=\{scrub\}/);
  assert.notEqual(labWidgetsCookie(true), labWidgetsCookie(false));
  assert.deepEqual(labScrubCanvases(false, { schedule: { style: 'a' } }), { schedule: { style: 'a' } }, 'the ordinary lab was changed');
  const merged = labScrubCanvases(true, { schedule: { out: 'none' } });
  assert.deepEqual(merged.schedule, { out: 'none' }, 'a canvas saved on the chain is the WHOLE canvas — the start is not laid back under it');
  assert.deepEqual(merged.countdown, LAB_SCRUB_SAMPLE.countdown);
  const shell = read('app/dev/maker-lab/maker-lab-shell.tsx');
  assert.match(shell, /publicLandingUrl=\{scrub \? LAB_SCRUB_GUEST : '\/dev\/maker-lab\/guest'\}/);
  assert.match(shell, /const jar = labWidgetsCookie\(new URLSearchParams\(window\.location\.search\)\.get\('scrub'\) === '1'\);/);
  assert.match(shell, /document\.cookie = `\$\{jar\}=/);
  /* The Maker writes `?phase=…&editor=1` after the address: it must be a path with a page behind it that turns the chain on. */
  assert.doesNotMatch(LAB_SCRUB_GUEST, /[?#]/);
  assert.equal(LAB_SCRUB_GUEST, '/dev/maker-lab/guest/scrub');
  assert.match(read('app/dev/maker-lab/guest/scrub/page.tsx'), /MakerLabGuestPage\(\{ searchParams: searchParams\.then\(\(sp\) => \(\{ \.\.\.sp, scrub: '1' \}\)\) \}\)/);
});

test('(4) while editing nothing is held: the Maker’s canvas arms only when the page is shown as a guest', () => {
  assert.equal(scrubArmsNow(false, false), true, 'a guest’s page');
  assert.equal(scrubArmsNow(true, false), false, 'the Maker’s canvas, editing');
  assert.equal(scrubArmsNow(true, true), true, 'the Maker’s canvas, ▶ held');
  const island = read('app/[slug]/_components/hub-scrub.tsx');
  assert.match(island, /const makerCanvas = document\.querySelector\('\[data-maker-section\]'\) !== null;/);
  assert.match(island, /const want = scrubArmsNow\(makerCanvas, html\.hasAttribute\('data-maker-guest'\)\);/);
  assert.match(island, /new MutationObserver\(sync\)[\s\S]*?attributeFilter: \['data-maker-guest'\]/);
  /* Off → the engine's own `stop` (every mark taken off — `scrub-is-a-held-hand-over` (4)). */
  assert.match(island, /const disarm = \(\) => \{\s*for \(const stop of stops\.splice\(0\)\) stop\(\);\s*\};/);
  /* The bridge is who says "as a guest". */
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  assert.match(bridge, /document\.documentElement\.setAttribute\('data-maker-guest', ''\)/);
  assert.match(bridge, /document\.documentElement\.removeAttribute\('data-maker-guest'\)/);
  /* The one script that moves a page is fetched on the Maker's canvas only, and is not the engine. */
  assert.match(island, /Promise\.all\(\[import\('\.\/hub-scrub-engine'\), makerCanvas \? import\('\.\/hub-scrub-place'\) : null\]\)/);
  assert.doesNotMatch(island, /\bscrollTo\b|\bscrollBy\b|scrollIntoView|^import .*hub-scrub-place/m, 'the island moves the page itself');
  const place = read('app/[slug]/_components/hub-scrub-place.ts');
  assert.equal((place.match(/\bscrollBy\b/g) ?? []).length, 1);
  assert.doesNotMatch(place, /addEventListener|preventDefault/, 'the place-keeping listens to the thumb');
  assert.match(place, /const STEPS = \d;/, 'the place-keeping has no end');
});

/* ── (5) OFF IS NEVER SILENT, AND THE LAB SAYS WHAT THE PAGE SAYS (8d, 2026-10-09) ──────────────────────────────────
   Owner, on a page where Scrub was on: "as a guest nothing scrubbed". Nobody could tell "off" from "on but not
   noticeable", and the engine's `catch` swallowed its own reason. Now the scenes block carries WHY it is off, and the
   lab's badge has no numbers of its own: it reads the page. Sabotages: the engine failing without saying why → red;
   the badge reporting ON for a page that says it is off → red. */
type Fake = { vars?: Record<string, string>; attrs?: Record<string, string>; one?: Record<string, Fake | null>; all?: Record<string, Fake[]> };
const fake = (o: Fake) => ({
  style: { getPropertyValue: (k: string) => o.vars?.[k] ?? '' },
  getAttribute: (k: string) => o.attrs?.[k] ?? null,
  hasAttribute: (k: string) => k in (o.attrs ?? {}),
  querySelector: (sel: string): unknown => (o.one?.[sel] ? fake(o.one[sel]!) : null),
  querySelectorAll: (sel: string): unknown[] => (o.all?.[sel] ?? []).map(fake),
});
const page = (root: Fake | null) => ({ querySelector: (sel: string) => (sel === '.hub-scenes' && root ? rootOf(root) : null) }) as unknown as Document;
/* One object per element, so `scenes.indexOf(scene)` finds the leaving scene among the page's scenes. */
function rootOf(root: Fake) {
  const scenes = (root.all?.['.hub-scene'] ?? []).map(fake);
  const cells = (root.all?.['.hub-cell'] ?? []).map((c, i) => ({ ...fake(c), querySelector: (sel: string) => (sel === ':scope > .hub-stage > .hub-scene' ? scenes[Number(c.attrs?.scene ?? i)] : null) }));
  return { ...fake(root), querySelectorAll: (sel: string) => (sel === '.hub-cell' ? cells : sel === '.hub-scene' ? scenes : []) };
}
const named = (name: string, vars: Record<string, string> = {}, rows: Fake[] = []): Fake => ({ vars, one: { '[data-lab-name]': { attrs: { 'data-lab-name': name } } }, all: { '[data-hub-rows] > *': rows } });

test('(5) off is never silent: the page carries the reason, and the lab’s badge says exactly what the page says', () => {
  /* The badge, executed against what a page can say. */
  assert.equal(readScrubBadge(page(null), true), 'Scrub: OFF — no scene on this page leaves by Scrub');
  assert.equal(readScrubBadge(page({ attrs: { 'data-hub-scrub-off': 'reduce motion' } }), true), 'Scrub: OFF — reduce motion');
  /* …a page that says it is off is OFF, whatever else is still marked on it. */
  assert.equal(readScrubBadge(page({ attrs: { 'data-hub-scrub-off': 'the script stopped: boom', 'data-hub-scrub-on': '' } }), true), 'Scrub: OFF — the script stopped: boom');
  assert.equal(readScrubBadge(page({}), false), 'Scrub: starting…');
  assert.equal(readScrubBadge(page({}), true), 'Scrub: OFF — the page’s script has not started');
  const chain = (vars: Array<Record<string, string>>, rows: Fake[] = []): Fake => ({
    attrs: { 'data-hub-scrub-on': '' },
    all: {
      '.hub-scene': [named('Countdown', vars[0]), named('Schedule', vars[1], rows), named('A note from us', vars[2])],
      '.hub-cell': [{ vars: { '--hub-len': '500px' }, attrs: { scene: '0' } }, { vars: { '--hub-len': '500px' }, attrs: { scene: '1' } }],
    },
  });
  assert.equal(readScrubBadge(page(chain([{}, {}, {}])), true), 'Scrub: ON · hand-over 1 of 2 · next to leave: Countdown');
  assert.equal(readScrubBadge(page(chain([{ '--hub-pout': '0.46' }, { '--hub-pbin': '0' }, {}])), true), 'Scrub: ON · hand-over 1 of 2 · Countdown leaves 46 % · Schedule arrives 0 %');
  assert.equal(
    readScrubBadge(page(chain([{ '--hub-pout': '1' }, { '--hub-pbin': '1' }, {}], [{ vars: { '--hub-pp': '1' } }, { vars: { '--hub-pp': '1' } }, { vars: { '--hub-pp': '0.3' } }, { vars: { '--hub-pp': '0' } }])), true),
    'Scrub: ON · hand-over 2 of 2 · Schedule: row 2 of 4',
  );
  assert.equal(readScrubBadge(page(chain([{ '--hub-pout': '1' }, { '--hub-pout': '1' }, {}])), true), 'Scrub: ON · all 2 hand-overs done');
  /* A cell with no length is an empty scene's — not a hand-over. */
  assert.equal(readScrubBadge(page({ attrs: { 'data-hub-scrub-on': '' }, all: { '.hub-scene': [named('Countdown')], '.hub-cell': [{ vars: {} }] } }), true), 'Scrub: ON — no hand-over on this page');
  /* The badge has no numbers of its own, and is drawn on the lab's chain only. */
  const badge = read('app/dev/maker-lab/guest/scrub-badge.tsx');
  assert.doesNotMatch(badge, /hub-scrub-(?:engine|math)|scrubPair|scrubMoment|SCRUB\b/, 'the badge computes the hand-over itself');
  const guest = read('app/dev/maker-lab/guest/page.tsx');
  assert.match(guest, /\{scrub && !only && !preview \? <LabScrubBadge \/> : null\}\s*\{mark\('f:hero'\)\}/, 'the badge is not before the first marker, on the chain alone');
  assert.deepEqual(
    [...read('app/[slug]/_components/site-body.tsx').matchAll(/scrub-badge|LabScrubBadge/g)].length + [...read('app/[slug]/_components/hub-scenes.tsx').matchAll(/scrub-badge|LabScrubBadge/g)].length,
    0,
    'the lab’s badge reached a guest’s page',
  );
  /* THE ENGINE says its own two reasons — and no `catch` of it is silent any more. */
  const engine = read('app/[slug]/_components/hub-scrub-engine.ts');
  assert.match(engine, /export const HUB_SCRUB_OFF = 'data-hub-scrub-off';/);
  assert.match(engine, /if \(window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches\) \{\s*root\.setAttribute\(HUB_SCRUB_OFF, 'reduce motion'\);\s*return \(\) => root\.removeAttribute\(HUB_SCRUB_OFF\);\s*\}/);
  assert.match(engine, /function fail\(e: unknown\) \{\s*stop\(\);\s*root\.setAttribute\(HUB_SCRUB_OFF, `the script stopped: \$\{e instanceof Error \? e\.message : String\(e\)\}`\.slice\(0, 160\)\);\s*\}/);
  assert.equal((engine.match(/catch \(e\) \{\s*fail\(e\);\s*\}/g) ?? []).length, 3);
  assert.equal((engine.match(/\bcatch\b/g) ?? []).length, 3, 'a catch of the engine does not say why it stopped');
  /* …and arming clears it: a page cannot say "off" while it is on. */
  assert.match(engine, /root\.removeAttribute\(HUB_SCRUB_OFF\);\s*const marked = /);
  /* THE ISLAND says the two that are its own, under the same name. */
  const island = read('app/[slug]/_components/hub-scrub.tsx');
  assert.match(island, /const OFF = 'data-hub-scrub-off';/);
  assert.match(island, /\.catch\(\(\) => \{\s*say\(NOT_LOADED\);\s*\}\)/);
  assert.match(island, /if \(!on\) say\(EDITING\);\s*\};\s*if \(makerCanvas\) say\(EDITING\);/);
});

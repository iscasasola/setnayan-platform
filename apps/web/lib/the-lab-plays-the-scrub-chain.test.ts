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
import { LAB_SCRUB_CHAIN, LAB_SCRUB_GUEST, LAB_SCRUB_SAMPLE, labScrubCanvases, labWidgetsCookie } from '../app/dev/maker-lab/lab-scrub';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));

test('(1) the lab’s chain, through the real renderer, is the prototype’s: two short hand-overs, a list row by row, a scene that stays, an ordinary one, a last arrival', () => {
  assert.deepEqual([...LAB_SCRUB_CHAIN], ['countdown', 'special_message', 'schedule', 'venue_map', 'dress_code', 'our_love_story']);
  const canvas = (t: (typeof LAB_SCRUB_CHAIN)[number]) => sanitizeHubCanvas({ canvas: LAB_SCRUB_SAMPLE[t] });
  const leaves = (t: (typeof LAB_SCRUB_CHAIN)[number]) => canvas(t).transition === 'scrub' && resolveHubMotion(canvas(t)).out !== 'none';
  assert.deepEqual(LAB_SCRUB_CHAIN.map(leaves), [true, true, true, false, true, false], 'which scenes hand over');
  /* The Schedule: rows one by one, an arrival effect to build them with, and a Build out to leave by. */
  assert.match(hubCanvasClass(canvas('schedule')), /\bhub-seq-parts\b/, 'the Schedule’s rows build together');
  assert.notEqual(resolveHubMotion(canvas('schedule')).in, 'none');
  /* The scene that stays has NO Build out and still builds in; the last arrival has nothing arranged at all. */
  assert.equal(resolveHubMotion(canvas('venue_map')).out, 'none');
  assert.notEqual(resolveHubMotion(canvas('venue_map')).in, 'none');
  assert.deepEqual(canvas('our_love_story'), {});
  /* Through `HubScenes`: four hand-overs, nested in page order, every scene's effects under the thumb, the engine mounted. */
  const widgets = LAB_SCRUB_CHAIN.map((t) => ({ widget_id: `lab-${t}`, widget_type: t, config_json: { canvas: LAB_SCRUB_SAMPLE[t] } }));
  const nodes = LAB_SCRUB_CHAIN.map((t) => React.createElement('section', { key: t, 'data-scene': t }));
  /* (The scenes are handed over as `createElement`'s own children — this file has no JSX.) */
  const Scenes = HubScenes as unknown as React.FC<{ widgets: unknown; scrubAllowed: boolean }>;
  const html = renderToStaticMarkup(React.createElement(Scenes, { widgets, scrubAllowed: true }, ...nodes));
  assert.equal((html.match(/class="hub-cell"/g) ?? []).length, 4, 'the chain’s hand-overs');
  assert.equal((html.match(/data-hub-fx=""/g) ?? []).length, 6, 'every scene of the chain is played under the thumb');
  const order = [...html.matchAll(/data-scene="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, [...LAB_SCRUB_CHAIN], 'the page order');
  /* The scene that stays is NOT wrapped in a hold of its own: what follows it is its ordinary neighbour. */
  assert.doesNotMatch(html, /class="hub-stage"><div class="hub-scene hub-scroll"[^>]*><section data-scene="venue_map"/);
  for (const held of ['countdown', 'special_message', 'schedule', 'dress_code']) {
    assert.match(html, new RegExp(`class="hub-stage"><div class="hub-scene hub-scroll"[^>]*><section data-scene="${held}"`), `${held} is not held for its hand-over`);
  }
  /* Without Event Hub Pro nothing is held — the lab passes it (below). */
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Scenes, { widgets, scrubAllowed: false }, ...nodes)), /hub-cell/);
});

test('(2) one chain: the page the browser check plays takes its six canvases from the lab’s chain', () => {
  const page = read('scripts/scrub-check-page.tsx');
  assert.match(page, /import \{ LAB_SCRUB_CHAIN, LAB_SCRUB_SAMPLE \} from '\.\.\/app\/dev\/maker-lab\/lab-scrub';/);
  assert.match(page, /\.map\(\(s, i\) => \(\{ \.\.\.s, canvas: LAB_SCRUB_SAMPLE\[LAB_SCRUB_CHAIN\[i\]!\] \}\)\)/);
  assert.equal((page.match(/\{ name: '\w+', rows: \d+ \}/g) ?? []).length, LAB_SCRUB_CHAIN.length, 'the check page’s scenes and the lab’s chain are not the same length');
  assert.doesNotMatch(page, /transition: '|sequence: '|outFx:|inFx:|\bout: '/, 'the check page writes a canvas of its own');
  /* …and it is the REAL renderer and the REAL island it plays. */
  assert.match(page, /<HubScenes widgets=\{widgets as never\} scrubAllowed>/);
  assert.match(read('scripts/scrub-check-island.tsx'), /import \{ HubScrub \} from '\.\.\/app\/\[slug\]\/_components\/hub-scrub';[\s\S]*render\(<HubScrub \/>\)/);
});

test('(3) the lab draws the chain as the guest page draws scenes, and the Maker can reach it', () => {
  const guest = read('app/dev/maker-lab/guest/page.tsx');
  assert.match(guest, /const scrub = sp\.scrub === '1';/);
  /* The real renderer, Pro on, one node a scene: its marker and its framed scene in one fragment. */
  assert.match(
    guest,
    /<HubScenes widgets=\{LAB_SCRUB_CHAIN\.map\(\(t\) => \(\{ \.\.\.rowOf\(t\), widget_id: `lab-\$\{t\}` \}\)\) as never\} scrubAllowed>\s*\{LAB_SCRUB_CHAIN\.map\(\(t\) => \(\s*<Fragment key=\{t\}>\s*\{mark\(`w:\$\{t\}`\)\}\s*\{framed\(t\)\}\s*<\/Fragment>\s*\)\)\}\s*<\/HubScenes>/,
  );
  /* Every scene of the chain sits in the real frame (its Build in / out are the frame's). */
  assert.match(guest, /type === 'countdown' \|\| type === 'dress_code' \|\| type === 'our_love_story' \? \(\s*<HubCanvasFrame widget=\{\{ \.\.\.rowOf\(type\), widget_id: `lab-\$\{type\}` \} as never\}/);
  for (const t of ['special_message', 'schedule', 'venue_map']) assert.match(guest, new RegExp(`<HubCanvasFrame widget=\\{\\{ \\.\\.\\.rowOf\\('${t}'\\)`), `${t} lost its frame`);
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

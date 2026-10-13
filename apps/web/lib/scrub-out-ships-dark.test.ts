/**
 * scrub-out-ships-dark.test.ts — THE "SCRUB OUT" SWITCH. (The file keeps its 2026-10-09 name, from when the held
 * hand-over shipped dark; other guards and notes point at it by that name.)
 *
 * 🔁 RE-AIMED 2026-10-13 — owner, verbatim: "Turn on scrub" (his call, before his own iPhone check). The switch is
 * now ON; every claim below says the new truth, and each keeps the strength it had while dark: what was proven
 * byte-identical-to-plain is now proven DIFFERENT-from-plain and the hand-over itself, executed the same way.
 *
 *   (1) THE SWITCH IS A CONSTANT, AND IT IS ON — no environment variable, nothing to configure.
 *       Sabotage: the constant turned off → (1), (2) and (3) red.
 *   (2) THE GUEST PAGE PLAYS A STORED SCRUB — executed against the real renderer, with NO door (as `SiteBody` asks):
 *       a page whose scenes STORE Scrub draws the held pairs (the same three the lab's door draws), it differs from
 *       the same page storing the plain transition, the plain one draws none of it, and the page's own hold wraps it.
 *       (Was 2026-10-09: byte-identical to the plain page.)
 *   (3) EVERY CONTROL OFFERS IT, AND A STORED ONE READS AS SCRUB — executed (the Leaves list, the reading), and
 *       every control that names a transition still goes through the one module (so turning it off is one line).
 *   (4) THE LAB'S DOORS STAY THE LAB'S — the server door (an explicit `scrubOut`) and the browser door
 *       (`offerScrubOutInTheLab`) are used under `app/dev/` and `scripts/` only, and every page under `app/dev/`
 *       answers 404 in production. Sabotage: the lab's page no longer asking → red.
 *   (5) THE MAKER'S FIRST LOAD DOES NOT CARRY IT — the module is imported by lazy and guest-page code only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { stripComments } from './strip-comments';
import { leavesOptions, LEAVES_OPTIONS } from './animate-feel';
import { SCRUB_OUT_OFFERED, offerScrubOutInTheLab, offeredTransition, scrubOutOffered } from './scrub-out-offered';
import { HubPageHold, HubScenes, hubScrubHolds, hubScrubHoldsAtMost } from '../app/[slug]/_components/hub-scenes';
import { LAB_SCRUB_CHAIN, LAB_SCRUB_SAMPLE } from '../app/dev/maker-lab/lab-scrub';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));
const walk = (dir: string): string[] =>
  readdirSync(join(WEB, dir)).flatMap((name) => {
    const rel = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(join(WEB, rel)).isDirectory() ? walk(rel) : /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [rel] : [];
  });

test('(1) the switch is a constant, and it is on', () => {
  /* 🔁 2026-10-13 (owner: "Turn on scrub"): was `false` — "it ships dark until an iPhone has played it". */
  assert.equal(SCRUB_OUT_OFFERED, true, '"Scrub out" is not offered — the owner turned it on 2026-10-13');
  assert.equal(scrubOutOffered(), true);
  const src = read('lib/scrub-out-offered.ts');
  assert.match(src, /export const SCRUB_OUT_OFFERED = true;/);
  assert.doesNotMatch(src, /process\.env|NEXT_PUBLIC|localStorage|cookie|searchParams|location/, 'the switch became a setting');
});

test('(2) the guest page plays a stored Scrub: the held pairs, through no door, unlike the same page storing the plain transition', () => {
  const Scenes = HubScenes as unknown as React.FC<{ widgets: unknown; scrubAllowed: boolean; stageMarks?: boolean; scrubOut?: boolean }>;
  const rows = (plain: boolean, extra: Array<Record<string, unknown>> = []) =>
    [...LAB_SCRUB_CHAIN.map((t) => LAB_SCRUB_SAMPLE[t] as Record<string, unknown>), ...extra].map((canvas, i) => {
      const { transition, ...rest } = canvas;
      return { widget_id: `w${i}`, widget_type: 'custom_1', config_json: { canvas: plain && transition === 'scrub' ? rest : canvas } };
    });
  const draw = (widgets: unknown[], props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(React.createElement(Scenes, { widgets, scrubAllowed: true, ...props }, ...widgets.map((_, i) => React.createElement('section', { key: i }, `scene ${i}`))));
  /* A page of Scrub scenes (the lab's own chain: three hand-overs when it is drawn)… */
  assert.ok(rows(false).filter((r) => (r.config_json.canvas as { transition?: string }).transition === 'scrub').length >= 3, 'anti-vacuity: the page stores no Scrub');
  /* 🔁 2026-10-13: was "a stored Scrub changes the page → red"; now a stored Scrub MUST change it — and into exactly
     what the lab's door draws (the real page's drawing IS the proven one, not a third thing). */
  for (const props of [{}, { stageMarks: true }]) {
    assert.notEqual(draw(rows(false), props), draw(rows(true), props), `a stored Scrub does not change the page (${JSON.stringify(props)})`);
    assert.equal(draw(rows(false), props), draw(rows(false), { ...props, scrubOut: true }), `the real page's Scrub is not the lab's (${JSON.stringify(props)})`);
  }
  /* …the HELD pairs: the lab's chain draws three hand-overs. */
  assert.equal((draw(rows(false)).match(/class="hub-cell"/g) ?? []).length, 3, 'the stored Scrub page does not draw its three hand-overs');
  /* …and the PLAIN page stays plain: nothing of the hand-over's markup at all (so the line above is not the
     renderer drawing hand-overs for everything). */
  assert.doesNotMatch(draw(rows(true)), /hub-scenes|hub-cell|hub-stage|hub-after|data-hub-fx/);
  /* Beside an Auto run too (Auto scroll keeps working, and the Scrub pairs are drawn beside it). */
  const auto = [{ transition: 'auto' }, {}];
  assert.match(draw(rows(false, auto)), /hub-arun/, 'anti-vacuity: the Auto run was not drawn');
  assert.match(draw(rows(false, auto)), /class="hub-cell"/, 'beside an Auto run the stored Scrub is not drawn');
  assert.doesNotMatch(draw(rows(true, auto)), /hub-cell|data-hub-fx/);
  /* The page's own hold asks for the pairs, through no door, and wraps the page; the plain page asks for none. */
  assert.ok(hubScrubHolds(rows(false) as never, true) > 0, 'the page’s hold asks for nothing');
  assert.ok(hubScrubHoldsAtMost(rows(false) as never, true) > 0);
  assert.equal(hubScrubHoldsAtMost(rows(false) as never, true), hubScrubHoldsAtMost(rows(false) as never, true, true), 'the real page’s hold is not the lab’s');
  assert.equal(hubScrubHoldsAtMost(rows(true) as never, true), 0);
  assert.notEqual(renderToStaticMarkup(React.createElement(HubPageHold, { holds: hubScrubHoldsAtMost(rows(false) as never, true) }, React.createElement('article'))), '<article></article>', 'the page’s hold wraps nothing');
  /* A free event (the renderer's own Pro read, `scrubAllowed`) still draws a stored Scrub plainly — unchanged rule. */
  assert.doesNotMatch(draw(rows(false), { scrubAllowed: false }), /hub-cell|data-hub-fx/);
  /* The real page passes neither door: it gets the constant. */
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /const pageHolds = hubScrubHoldsAtMost\(widgets, proWatermarkHidden\);/);
  assert.equal((body.match(/<HubScenes /g) ?? []).length, 5, 'anti-vacuity: site-body’s scenes blocks');
  /* The ONE place the transition is resolved for drawing. */
  assert.match(read('app/[slug]/_components/hub-scenes.tsx'), /transition: offeredTransition\(renderedTransition\(resolveTransition\(canvas\), scrubAllowed\), scrubOut\),/);
  /* Closing the door by hand still draws the plain page (turning the constant off again is one line, and works). */
  assert.equal(draw(rows(false), { scrubOut: false }), draw(rows(true), { scrubOut: false }));
});

test('(3) every control offers it, and a stored Scrub reads as Scrub', () => {
  /* 🔁 2026-10-13: was ['scroll', 'auto'] and a stored Scrub reading as 'scroll'. */
  assert.deepEqual(leavesOptions().map((o) => o.key), ['scroll', 'scrub', 'auto']);
  assert.deepEqual(leavesOptions().map((o) => o.key), LEAVES_OPTIONS.map((o) => o.key), 'a Leaves choice is still held back');
  assert.equal(offeredTransition('scrub'), 'scrub');
  assert.equal(offeredTransition('auto'), 'auto');
  assert.equal(offeredTransition('scroll'), 'scroll');
  assert.equal(offeredTransition('scrub', false), 'scroll', 'the off arm (one line away) no longer reads a stored Scrub as scroll');
  /* Every control that names a scene's transition reads and offers through the one module. */
  const E = 'app/dashboard/[eventId]/website/editor/_components';
  const tab = read(`${E}/scene-animate-tab.tsx`);
  assert.match(tab, /const transition = offeredTransition\(resolveTransition\(shown\)\);/);
  assert.match(tab, /options: leavesOptions\(\)/);
  assert.match(tab, /HUB_TRANSITIONS\.filter\(\(t\) => t !== 'scrub' \|\| scrubOutOffered\(\)\)\.map\(/);
  const sheet = read(`${E}/element-sheet.tsx`);
  assert.match(sheet, /value: offeredTransition\(canvas\.transition \?\? 'scroll'\),\s*options: leavesOptions\(\),/);
  const panel = read(`${E}/sections-panel.tsx`);
  assert.match(panel, /const transition = offeredTransition\(resolveTransition\(canvas\), SCRUB_OUT_OFFERED\);/);
  assert.match(panel, /HUB_TRANSITIONS\.filter\(\(t\) => t !== 'scrub' \|\| SCRUB_OUT_OFFERED\)\.map\(/);
  assert.match(read('app/dashboard/[eventId]/website/editor/page.tsx'), /HUB_TRANSITION_LABEL\[offeredTransition\(resolveTransition\(sanitizeHubCanvas\(row\.config_json\)\), SCRUB_OUT_OFFERED\)\]/);
  /* …and nothing lists the transitions, or the Leaves choices, around it. */
  for (const f of [...walk('app/dashboard'), ...walk('lib')]) {
    const src = read(f);
    if (f !== 'lib/animate-feel.ts') assert.doesNotMatch(src, /\bLEAVES_OPTIONS\b/, `${f} offers the Leaves choices past the switch`);
    for (const m of src.matchAll(/HUB_TRANSITIONS\.map\(/g)) assert.fail(`${f} lists every transition past the switch (at ${m.index})`);
  }
});

test('(4) the lab’s doors stay the lab’s', () => {
  /* The browser door, executed: on → offered. 🔁 2026-10-13: closing it again no longer hides Scrub — the constant
     offers it (was: "off again → not"). */
  try {
    offerScrubOutInTheLab(true);
    assert.equal(scrubOutOffered(), true);
    assert.deepEqual(leavesOptions().map((o) => o.key), ['scroll', 'scrub', 'auto']);
    assert.equal(offeredTransition('scrub'), 'scrub');
  } finally {
    offerScrubOutInTheLab(false);
  }
  assert.equal(scrubOutOffered(), true, 'the lab’s door, closed, turned the constant off');
  /* The lab USES both doors… */
  assert.match(read('app/dev/maker-lab/guest/page.tsx'), /as never\} scrubAllowed scrubOut>/);
  assert.match(read('app/dev/maker-lab/guest/page.tsx'), /hubScrubHoldsAtMost\(LAB_SCRUB_CHAIN\.map\(\(t\) => rowOf\(t\)\) as never, true, true\)/);
  assert.match(read('app/dev/maker-lab/maker-lab-shell.tsx'), /useEffect\(\(\) => \{\s*offerScrubOutInTheLab\(scrub\);\s*return \(\) => offerScrubOutInTheLab\(false\);\s*\}, \[scrub\]\);/);
  /* …and NOTHING ELSE in the app does: no file outside `app/dev/` opens the browser door, hands the renderer the
     server door, or asks the page's hold with it. (The renderer itself only RECEIVES it.) */
  for (const f of [...walk('app'), ...walk('lib'), ...walk('components')].filter((x) => !x.startsWith('app/dev/'))) {
    const src = read(f);
    if (f !== 'lib/scrub-out-offered.ts') assert.doesNotMatch(src, /offerScrubOutInTheLab/, `${f} opens the lab’s door`);
    if (f === 'app/[slug]/_components/hub-scenes.tsx') continue; /* the renderer DEFINES the door — judged just below */
    assert.doesNotMatch(src, /\bscrubOut\b/, `${f} hands the renderer the lab’s door`);
    assert.doesNotMatch(src, /hubScrubHolds(?:AtMost)?\([^()]*,[^()]*,[^()]*\)/, `${f} asks the page’s hold through the lab’s door`);
    /* 🎬 2026-10-10 — the cover's hand-over is asked through the same door, and no real page may open it either. */
    assert.doesNotMatch(src, /hubCoverLeaves\([^()]*,[^()]*,[^()]*\)/, `${f} asks whether the cover leaves through the lab’s door`);
  }
  /* The server door is a parameter with the constant as its default — never module state (a server's would leak). */
  const renderer = read('app/[slug]/_components/hub-scenes.tsx');
  assert.equal((renderer.match(/scrubOut: boolean = SCRUB_OUT_OFFERED/g) ?? []).length, 3 /* the two counts of a page's holds, and `hubCoverLeaves` */);
  assert.match(renderer, /scrubOut = SCRUB_OUT_OFFERED,/);
  assert.doesNotMatch(renderer, /scrubOutOffered\(|offerScrubOutInTheLab/);
  /* Every page under `app/dev/` answers 404 in production — itself, or the lab page it hands straight to. */
  const pages = walk('app/dev').filter((f) => /\/page\.tsx$/.test(f));
  assert.ok(pages.length >= 8, 'anti-vacuity: the lab’s pages were found');
  for (const f of pages) {
    const src = read(f);
    assert.ok(/if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/.test(src) || /return MakerLabGuestPage\(/.test(src), `${relative('app/dev', f)} can be reached in production`);
  }
});

test('(5) the Maker’s first load does not carry the switch', () => {
  const importers = [...walk('app'), ...walk('lib')].filter((f) => /scrub-out-offered/.test(read(f)) && f !== 'lib/scrub-out-offered.ts').sort();
  assert.deepEqual(importers, [
    'app/[slug]/_components/hub-scenes.tsx',
    'app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx',
    'app/dashboard/[eventId]/website/editor/_components/scene-animate-tab.tsx',
    'app/dashboard/[eventId]/website/editor/_components/sections-panel.tsx',
    'app/dashboard/[eventId]/website/editor/page.tsx',
    'app/dev/maker-lab/maker-lab-shell.tsx',
    'lib/animate-feel.ts',
  ]);
  /* `lib/animate-feel.ts` is itself lazy-only (the Animate tab's chunk) — and the named first-load files stay clear. */
  for (const f of ['app/dashboard/[eventId]/launch/_components/maker-shell.tsx', 'app/dashboard/[eventId]/launch/_components/details-workspace.tsx', 'lib/hub-draft.ts', 'lib/hub-canvas.ts', 'lib/hub-scenes.ts']) {
    assert.doesNotMatch(read(f), /scrub-out-offered|animate-feel/, `${f} pulls the switch into the Maker’s first load`);
  }
  assert.match(read('app/dashboard/[eventId]/launch/_components/details-lazy.tsx'), /export const SceneAnimateTab = dynamic\(/);
});

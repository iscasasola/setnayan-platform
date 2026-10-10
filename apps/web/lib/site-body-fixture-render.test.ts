/**
 * site-body-fixture-render.test.ts — THE REAL GUEST PAGE, RENDERED WITH NO DATABASE, AND HELD BYTE FOR BYTE.
 *
 * Until this file nothing on a developer's machine could draw `SiteBody` (`app/[slug]/_components/site-body.tsx`):
 * an async server component of some fifty props that reads the database, imported by one page and rendered by no
 * test — the Maker lab's guest route is a stand-in. So "this change leaves every guest page as it was" could only
 * be argued, never shown. `lib/site-body-fixture-render.ts` draws the REAL component for one fixture invitation
 * (`lib/site-body-fixture.ts`: the lab's Maria & Jose, a listed guest who has not replied, 63 days before the day).
 * Read that helper's docblock first: the seam (the database client, an empty database), exactly what is normalised
 * (the clock, the time zone, the default locale, the environment — and not one byte of the HTML), and what the render
 * is NOT (no document shell, no flight payload, no browser).
 *
 *   (1) IT IS THE REAL TREE, NOT A SHELL — the names, the date, the Countdown's label, both venues, the note, the
 *       dress code and the run of show the fixture put in are in the HTML; so is the guest tree's own article and
 *       its first group; React said nothing; and the tables the page asked the database for are exactly the listed
 *       ones (a new read on the guest page arrives here as a named difference).
 *   (2) BYTE FOR BYTE — two renders are identical, and equal to the committed `site-body-fixture.golden.html`.
 *       After an INTENDED change to a guest page: `UPDATE_GOLDEN=1 ../../node_modules/.bin/tsx --test
 *       lib/site-body-fixture-render.test.ts`, then READ THE DIFF of the golden — that diff is the change every
 *       guest page of every event is about to get.
 *   (3) A PAGE WITH NO SCRUB SCENE HAS NO SCRUB — none of the boxes a held hand-over is made of, and the island
 *       that arms the engine is never mounted. The marker names are not typed from memory: they are taken from
 *       what the real renderer draws when it IS asked for a hand-over (anti-vacuity, through the lab's door).
 *   (4) A STORED SCRUB SCENE ON A REAL PAGE — while "Scrub out" ships dark (`lib/scrub-out-offered.ts`) the page
 *       draws that scene as "as it scrolls away": its own frame, and NOT ONE Scrub box, no page pair, no island.
 *       The day the switch is turned on, the same test demands the held pair instead (one page pair per hand-over,
 *       the scenes block's cell, the island) — both arms were run before this was committed.
 *   (5) IT IS TOOLING — no file of the app imports the fixture or the helper: they add nothing to any page or bundle.
 *
 * 📌 MEASURED WITH THE SWITCH TURNED ON BY HAND (2026-10-10), for whoever turns it on for good: on this tabbed
 * Invitation the Countdown and the note are each drawn in a scenes block of their OWN on Welcome, so a Countdown
 * stored to leave by Scrub hands over to nothing there — no cell, no island — while the page still wraps itself in
 * one pair for it (`hubScrubHoldsAtMost` counts rows, not blocks: "a pair too many is a plain box"). The Schedule,
 * on Details with scenes after it in one block, draws the full held pair; that is the scene (4) uses.
 *
 * SABOTAGES RUN (2026-10-10), each put back and re-checked by hash afterwards:
 *   A · one attribute added to the guest tree's `<article data-pahina-chapters className="space-y-12">` in
 *       `site-body.tsx` → (1) (2) red, (2) naming the character where the page changed;
 *   B · the same on the cover's `<header>` in `pahina-masthead.tsx` → (1) (2) red (the guard reads the whole page,
 *       not only the file it is named for);
 *   C · "wrapping anyway": the guest tree's `<HubPageHold holds={pageHolds}>` forced to `holds={1}` → (2) (3) (4) red;
 *   D · `SCRUB_OUT_OFFERED` set to `true` → (4) takes its other arm and passes; (1) (2) (3) stay green (the fixture
 *       page stores no Scrub);
 *   E · the fixture's venue renamed → (2) red ((1) follows the fixture by design: it checks the page against it);
 *   F · the pinned clock moved past the day → (2) red (the page reads the pinned clock: the arrival row changes);
 *   G · `SiteBody` made to draw neither tree → (1) red ("an empty shell"), (2) (4) red;
 *   H · `hub-scenes` imported before the helper → the file fails to load, naming the module that escaped the seam.
 *   I · an app file made to import the fixture → (5) red.
 * And the same golden under TZ=Asia/Manila + fil_PH + NODE_ENV=production + the menu switch set "false" in the
 * shell, and under TZ=America/New_York + de_DE: green (the German run was RED until the default locale was pinned —
 * the run of show's times follow the server's locale).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
/* FIRST, before anything that draws the guest page: this import installs the seam (see `installSeam`). */
import { renderSiteBodyFixture, renderSiteBodyFixtureFull } from './site-body-fixture-render';
import { FIXTURE_BLOCKS, FIXTURE_SCRUB_SCENE, FIXTURE_WORDS, fixtureWidgets, fixtureWidgetsWithAScrubScene } from './site-body-fixture';
import { SCRUB_OUT_OFFERED } from './scrub-out-offered';
import { HubCoverHold, HubPageHold, HubScenes, hubScrubHoldsAtMost } from '../app/[slug]/_components/hub-scenes';

const GOLDEN = join(__dirname, 'site-body-fixture.golden.html');

/** Where two strings first differ, with a little of each side — a 41 KB diff in a test log helps nobody. */
function firstDifference(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const cut = (s: string) => JSON.stringify(s.slice(Math.max(0, i - 80), i + 120));
  return `first difference at character ${i} of ${a.length} / ${b.length}\n  rendered: ${cut(a)}\n  expected: ${cut(b)}`;
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

/**
 * THE BOXES A HELD HAND-OVER IS MADE OF — read off the real renderer, drawn with the lab's door open: the page's own
 * pair (`HubPageHold`), the cover's three boxes (`HubCoverHold`), and a scenes block with one hand-over (`HubScenes`).
 */
function scrubMarkers(): string[] {
  const rows = fixtureWidgetsWithAScrubScene().filter((w) => ['schedule', 'dress_code'].includes(w.widget_type));
  const scenes = React.createElement(
    HubScenes as unknown as React.FC<{ widgets: unknown; scrubAllowed: boolean; scrubOut: boolean }>,
    { widgets: rows, scrubAllowed: true, scrubOut: true },
    ...rows.map((w) => React.createElement('section', { key: w.widget_id }, w.widget_type)),
  );
  const cover = React.createElement(HubCoverHold, { leaves: true, cover: React.createElement('header', null, 'cover') }, scenes);
  const drawn = renderToStaticMarkup(React.createElement(HubPageHold, { holds: 1 }, cover));
  const classes = new Set<string>();
  for (const m of drawn.matchAll(/class="([^"]+)"/g)) for (const c of m[1]!.split(/\s+/)) if (c.startsWith('hub-')) classes.add(`${c}`);
  const markers = [...classes].sort();
  if (drawn.includes('data-hub-fx')) markers.push('data-hub-fx');
  return markers;
}

test('(1) the fixture page is the real guest tree: what the fixture put in is on the page, and the page asked the database only for what is listed', async () => {
  const page = await renderSiteBodyFixtureFull();
  const { html } = page;
  assert.ok(html.length > 20_000, `the page is ${html.length} bytes — an empty shell`);
  assert.deepEqual(page.complaints, [], 'React or the page complained while rendering');

  /* The guest tree's own article, once, and the cover in its first group — the shape the cover's hand-over will meet. */
  assert.equal(count(html, '<article data-pahina-chapters="true" class="space-y-12">'), 1, 'the guest tree’s article');
  assert.match(html, /<article data-pahina-chapters="true" class="space-y-12"><div data-hub-tab="home" data-pahina-first-screen="" data-pahina-chapters="" class="space-y-12 empty:hidden">/);
  assert.match(html, /<header data-pahina-first-screen="" class="text-center">/, 'the cover (`PahinaMasthead`) is drawn');
  /* The cover: the two names, the mark, the date. */
  const [first, second] = FIXTURE_WORDS.names.split(' & ');
  assert.match(html, new RegExp(`<h1[^>]*data-hub-names=""[^>]*><span class="block">${first}</span><span[^>]*>and</span><span class="block">${second}</span></h1>`));
  assert.ok(html.includes('>M &amp; J</span>'), 'the monogram');
  assert.ok(count(html, FIXTURE_WORDS.dateWords) >= 2, 'the date, on the cover and in the details');
  /* The scenes. */
  assert.ok(html.includes('Until we say ‘I do’'), 'the Countdown’s label');
  assert.ok(html.includes(FIXTURE_WORDS.message), 'the note');
  assert.ok(html.includes(FIXTURE_WORDS.dressTitle), 'the dress code');
  assert.ok(count(html, FIXTURE_WORDS.venue) >= 3 && count(html, FIXTURE_WORDS.ceremony) >= 3, 'both venues, in the details, the run of show and the map');
  for (const b of FIXTURE_BLOCKS) assert.ok(html.includes(b.label.replace('&', '&amp;')), `the run of show: ${b.label}`);
  /* A GUEST's page, not a stranger's: their own line, their reply sheet, their name on the place card. */
  assert.ok(html.includes('You’re joining us as'), 'the guest’s own line');
  assert.ok(html.includes('id="rsvp-sheet-heading"'), 'the reply sheet');
  assert.ok(html.includes(FIXTURE_WORDS.guestFirst), 'the guest’s name');
  assert.doesNotMatch(html, /Scan your personal QR/, 'this is the stranger’s page');

  /* What the page asked the (empty) database — as a set: this renderer may run an async component more than once. */
  const asked = [...new Set(page.reads.map((r) => `${r.client} ${r.kind} ${r.name}`))].sort();
  assert.deepEqual(asked, [
    'admin rpc event_basket_orders_granting',
    'admin rpc event_has_comp_for_sku',
    'admin rpc event_host_holds_founder_seat',
    'admin rpc event_host_is_internal',
    'admin table bundle_components',
    'admin table events',
    'admin table orders',
    'admin table reveal_studio_config',
    'session table event_type_profiles',
  ]);
});

test('(2) byte for byte: the fixture page renders the same twice, and is the committed page', async () => {
  const a = await renderSiteBodyFixture();
  const b = await renderSiteBodyFixture();
  assert.ok(a === b, `two renders of one page differ — ${firstDifference(a, b)}`);

  if (process.env.UPDATE_GOLDEN === '1') {
    writeFileSync(GOLDEN, `${a}\n`);
    return;
  }
  assert.ok(existsSync(GOLDEN), 'site-body-fixture.golden.html is missing — it is never written unless UPDATE_GOLDEN=1');
  const golden = readFileSync(GOLDEN, 'utf8');
  assert.ok(
    `${a}\n` === golden,
    `the guest page changed — ${firstDifference(`${a}\n`, golden)}\n  (intended? UPDATE_GOLDEN=1, then read the golden's diff: it is what every guest page gets)`,
  );
});

test('(3) a page with no Scrub scene has no Scrub: not one of the hand-over’s boxes, and the island is never mounted', async () => {
  const markers = scrubMarkers();
  /* Anti-vacuity: these are what the real renderer draws for a hand-over today. */
  for (const m of ['hub-page-cell', 'hub-page-stage', 'hub-cover-cell', 'hub-cover', 'hub-cover-after', 'hub-scenes', 'hub-cell', 'hub-stage', 'hub-after', 'hub-scene', 'data-hub-fx']) {
    assert.ok(markers.includes(m), `the renderer no longer draws ${m} for a hand-over — this guard would be looking for nothing (drawn: ${markers.join(' ')})`);
  }
  const widgets = fixtureWidgets();
  assert.equal(hubScrubHoldsAtMost(widgets, true, true), 0, 'anti-vacuity: the fixture page stores a Scrub scene');

  /* On a free event, and on a Pro one (where Scrub is allowed at all). */
  for (const pro of [false, true]) {
    const page = await renderSiteBodyFixtureFull({ proWatermarkHidden: pro });
    for (const m of markers) {
      const hit = m.startsWith('data-') ? page.html.includes(m) : new RegExp(`class="(?:[^"]* )?${m}(?: [^"]*)?"`).test(page.html);
      assert.equal(hit, false, `a page with no Scrub scene draws ${m} (${pro ? 'Pro' : 'free'} event)`);
    }
    assert.equal(page.mounts.HubScrub, 0, `a page with no Scrub scene mounts the Scrub island (${pro ? 'Pro' : 'free'} event)`);
    assert.deepEqual(page.complaints, []);
  }
});

test('(4) a scene stored to leave by Scrub, on a real page: while Scrub ships dark it is the plain page; switched on, the held pair', async () => {
  const widgets = fixtureWidgetsWithAScrubScene();
  /* Anti-vacuity: the row really stores Scrub with a Build out, and would hand over the moment it is offered. */
  assert.equal(hubScrubHoldsAtMost(widgets, true, true), 1, 'the variant page stores no hand-over');
  const plain = await renderSiteBodyFixtureFull({ proWatermarkHidden: true });
  const page = await renderSiteBodyFixtureFull({ proWatermarkHidden: true, widgets });
  assert.deepEqual(page.complaints, []);
  /* The stored canvas reached the page: the Schedule is drawn in a frame of its own, which the plain page has not. */
  assert.ok(page.html !== plain.html, 'the stored canvas changed nothing on the page — the variant never reached the renderer');
  for (const b of FIXTURE_BLOCKS) assert.ok(page.html.includes(b.label.replace('&', '&amp;')), `the ${FIXTURE_SCRUB_SCENE} scene is still drawn: ${b.label}`);
  assert.ok(count(page.html, 'hub-canvas') > count(plain.html, 'hub-canvas'), 'the arranged scene is drawn in its frame');

  const pairs = count(page.html, 'class="hub-page-cell"');
  const cells = count(page.html, 'class="hub-cell"');
  if (!SCRUB_OUT_OFFERED) {
    /* 🌑 DARK: `SiteBody` hands the renderer no door, so a stored Scrub is drawn "as it scrolls away". */
    for (const m of scrubMarkers()) {
      const hit = m.startsWith('data-') ? page.html.includes(m) : new RegExp(`class="(?:[^"]* )?${m}(?: [^"]*)?"`).test(page.html);
      assert.equal(hit, false, `Scrub ships dark, and a real page with a stored Scrub scene draws ${m}`);
    }
    assert.equal(page.mounts.HubScrub, 0, 'Scrub ships dark, and a real page mounts the Scrub island');
    /* …and a free event's page (Scrub is not allowed there at all) is the same in this respect. */
    const free = await renderSiteBodyFixtureFull({ widgets });
    assert.equal(count(free.html, 'class="hub-page-cell"') + count(free.html, 'class="hub-cell"') + free.mounts.HubScrub!, 0);
    return;
  }
  /* ☀ OFFERED: the held pair that already ships — one page pair per hand-over, the scenes block's cell, the island. */
  assert.equal(pairs, hubScrubHoldsAtMost(widgets, true), 'the page wraps itself in one pair per hand-over');
  assert.equal(count(page.html, 'class="hub-page-stage"'), pairs);
  assert.equal(cells, 1, 'the scenes block holds the leaving scene and what arrives in one cell');
  assert.ok(page.html.includes('data-hub-fx'), 'the leaving scene is marked for the engine');
  assert.ok(page.mounts.HubScrub! > 0, 'the island that arms the engine is mounted');
  /* A free event may not Scrub: its page stays the plain page even with the switch on. */
  const free = await renderSiteBodyFixtureFull({ widgets });
  assert.equal(count(free.html, 'class="hub-page-cell"') + count(free.html, 'class="hub-cell"') + free.mounts.HubScrub!, 0);
});

test('(5) it is tooling: no file of the app imports the fixture, the helper or the golden', () => {
  const WEB = join(__dirname, '..');
  const OURS = new Set(['lib/site-body-fixture.ts', 'lib/site-body-fixture-render.ts', 'lib/site-body-fixture-render.test.ts']);
  const walk = (dir: string): string[] =>
    readdirSync(join(WEB, dir)).flatMap((name) => {
      const rel = `${dir}/${name}`;
      if (name === 'node_modules' || name.startsWith('.')) return [];
      return statSync(join(WEB, rel)).isDirectory() ? walk(rel) : /\.(?:tsx?|mjs)$/.test(name) ? [rel] : [];
    });
  const files = ['app', 'lib', 'components', 'scripts'].flatMap(walk);
  assert.ok(files.length > 1000 && files.includes('app/[slug]/page.tsx'), `anti-vacuity: walked ${files.length} files`);
  for (const f of OURS) assert.ok(files.includes(f), `${f} was not walked`);
  const importers = files.filter((f) => !OURS.has(f) && /site-body-fixture/.test(readFileSync(join(WEB, f), 'utf8')));
  assert.deepEqual(importers, [], 'the fixture is test tooling — a page that imports it ships the sample couple');
});

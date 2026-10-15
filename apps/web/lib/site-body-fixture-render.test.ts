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
 *   (6) A COVER STORED TO LEAVE BY SCRUB (the hero row: hand-over zero, `hub-scenes.tsx` `HubCoverHold`) — while
 *       "Scrub out" ships dark the page is TODAY'S PAGE, byte for byte, and mounts no island: the fence the cover's
 *       hand-over is wired inside. Written BEFORE the wiring (2026-10-10), so it was green on the unwired page.
 *       Sabotage, before the wiring: the page's own count asked through the lab's door
 *       (`hubScrubHoldsAtMost(widgets, proWatermarkHidden, true)`) → (6) red, naming the first changed character.
 *       WIRED 2026-10-10 (`site-body.tsx`, the guest tree's two mastheads through `HubCoverHold`): (2) stayed green
 *       with the golden untouched, and (6) took its second arm — switched on, the cover's cell exactly once in the
 *       page's first group, one page pair, the island mounted, and the page with those boxes taken off is today's
 *       page byte for byte. Sabotages after the wiring, each seen red and put back: the cover asked through the
 *       lab's door (`hubCoverLeaves(widgets, proWatermarkHidden, true)`) → (6) dark arm red; and, with the constant
 *       turned on by hand, `leaves={false}` → "the cover's cell, exactly once" red · `holds={pageHolds + 1}` → "one
 *       pair — not two" red (and (2) (3) (4): every page) · the rest box's `mt-12` dropped → "the reply row is not
 *       what follows" red · the cell's first-screen mark dropped → "the masthead is not in the cover's box" red.
 *   (7) THE STRANGER'S TREE (`fixtureStranger`: the link and no key) — the page's other tree is drawn too, both of
 *       its mastheads (text-only in its first-screen wrapper; the photo cover alone in the first group), held byte
 *       for byte by its own golden (`site-body-fixture-stranger.golden.html`), with no Scrub on it.
 *   (8) THE STRANGER'S COVER STORED TO LEAVE BY SCRUB — dark: today's page, byte for byte, no island (written before
 *       the stranger's tree was wired, so it was green on the unwired page). WIRED 2026-10-10: (7) stayed green with
 *       its golden untouched; switched on, each masthead's cell exactly once, one page pair, the island, and the
 *       page with the boxes taken off is today's byte for byte. Sabotages, seen red and put back: the stranger's
 *       `leaves` asked through the lab's door → dark arm red; with the constant on by hand, the text-only cover's
 *       rest box given no `mt-6` → red, and the photo cover's `leaves={false}` → "the cover's cell, exactly once" red.
 *       What the wrapped page LOOKS like — its boxes, its rhythm, its chapters, the hand-over itself — is not
 *       proven here: `scripts/scrub-browser-check.mjs` (16) plays this same render in a browser.
 *   (9) SAVE THE DATE IS NOT WIRED FOR SCRUB (2026-10-13, the day the switch went on): a Save the Date whose cover and
 *       scenes store Scrub draws no hand-over box, no engine mark, no cover cell, and mounts no island; with the
 *       page's unarmed hold taken off it is the plain page byte for byte (Pro and free).
 *
 * 🔁 2026-10-13 — "SCRUB OUT" IS ON (owner: "Turn on scrub"). (4) (6) (8) now run their OFFERED arm by default; their
 * dark arm runs again the moment the constant is turned off (both arms were run by hand before that commit).
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
import { FIXTURE_BLOCKS, FIXTURE_SCRUB_SCENE, FIXTURE_WORDS, fixtureStranger, fixtureWidgets, fixtureWidgetsWithAScrubScene } from './site-body-fixture';
import { SCRUB_OUT_OFFERED } from './scrub-out-offered';
import { HubCoverHold, HubPageHold, HubScenes, hubCoverLeaves, hubScrubHoldsAtMost } from '../app/[slug]/_components/hub-scenes';
import { LAB_SCRUB_COVER } from '../app/dev/maker-lab/lab-scrub';

const GOLDEN = join(__dirname, 'site-body-fixture.golden.html');
/** 🚶 The stranger's tree of the same invitation (`fixtureStranger`) — its own committed page. */
const STRANGER_GOLDEN = join(__dirname, 'site-body-fixture-stranger.golden.html');
const PHOTO = { heroPhotoUrl: 'https://cdn.test/fixture-hero.jpg' } as const;

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
  /* A GUEST's page, not a stranger's: their own line, their door to the reply, their name on the place card.
     🔁 RE-AIMED 2026-10-11 (owner, "ONE REPLY FORM"): a guest's page no longer draws the reply SHEET; every reply
     door on it opens the reply PAGE. */
  assert.ok(html.includes('You’re joining us as'), 'the guest’s own line');
  assert.ok(!html.includes('id="rsvp-sheet-heading"'), 'the reply sheet is drawn for a guest again — two reply forms');
  assert.ok(html.includes('href="/maria-and-jose/invite/reply"'), 'the guest has no door to the reply page');
  assert.ok(!html.includes('#your-details'), 'a door on the guest page still points at the sheet');
  /* (The guest's NAME was on this page only inside the reply card. It is on the reply page and on Me now, which
     this component does not draw — so it is no longer looked for here.) */
  assert.doesNotMatch(html, /Scan your personal QR/, 'this is the stranger’s page');

  /* What the page asked the (empty) database — as a set: this renderer may run an async component more than once. */
  const asked = [...new Set(page.reads.map((r) => `${r.client} ${r.kind} ${r.name}`))].sort();
  assert.deepEqual(asked, [
    'admin rpc event_basket_orders_granting',
    'admin rpc event_has_comp_for_sku',
    'admin rpc event_host_holds_founder_seat',
    'admin rpc event_host_is_internal',
    'admin table bundle_components',
    // The event type's profile is read with the service client since 2026-10-13 (public-read rows,
    // remembered across requests — lib/global-settings-cache.ts), no longer through the viewer's session.
    'admin table event_type_profiles',
    'admin table events',
    'admin table orders',
    'admin table reveal_studio_config',
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

test('(6) a COVER stored to leave by Scrub, on a real page: while Scrub ships dark it is today’s page, byte for byte, and no island', async () => {
  const widgets = fixtureWidgets({ hero: LAB_SCRUB_COVER });
  /* Anti-vacuity: the hero row really stores it — it would hand over, and the page would wrap itself for it, the
     moment "Scrub out" is offered (asked through the lab's door, as (3) and (4) do). */
  assert.equal(hubCoverLeaves(widgets, true, true), true, 'the variant page’s cover stores no hand-over');
  assert.equal(hubScrubHoldsAtMost(widgets, true, true), 1, 'the hero row is not counted by the page’s own hold');
  assert.equal(hubScrubHoldsAtMost(fixtureWidgets(), true, true), 0, 'anti-vacuity: the plain fixture page stores a Scrub');
  /* BOTH MASTHEADS of the guest tree — the monogram cover, and the one with a photo under the type (the page's other
     `PahinaMasthead` branch, `hasHeroMedia`) — each on a Pro event (where Scrub is allowed at all) and on a free one. */
  const monogram = await renderSiteBodyFixture({ proWatermarkHidden: true });
  const photo = { heroPhotoUrl: 'https://cdn.test/fixture-hero.jpg' };
  assert.ok((await renderSiteBodyFixture({ proWatermarkHidden: true, ...photo })) !== monogram, 'anti-vacuity: the photo did not reach the cover — one masthead is being tested twice');
  for (const [cover, pro] of [[{}, true], [{}, false], [photo, true], [photo, false]] as const) {
    const today = await renderSiteBodyFixture({ proWatermarkHidden: pro, ...cover });
    const stored = await renderSiteBodyFixtureFull({ proWatermarkHidden: pro, ...cover, widgets });
    assert.deepEqual(stored.complaints, []);
    assert.ok(stored.html.length > 20_000, 'an empty shell');
    if (SCRUB_OUT_OFFERED && pro) {
      /* ☀ OFFERED (a Pro event): the GUEST tree hands its cover over — three plain boxes, once; ONE page pair, the
         cover's (the hero row is counted once, by the page's own count: never a pair too many); the island mounted. */
      assert.equal(count(stored.html, 'class="hub-cover-cell"'), 1, 'the cover’s cell, exactly once');
      assert.ok(stored.mounts.HubScrub! > 0, 'the island that arms the engine is mounted');
      assert.equal(count(stored.html, 'class="hub-page-cell"'), 1, 'the page wraps one pair for its cover — not two');
      assert.equal(count(stored.html, 'class="hub-page-stage"'), 1);
      /* The cover is IN the cover's box and the reply row in the rest of ITS GROUP — the page's first group, on the
         first tab alone; and each box says what keeps the wrapped page the page (`GUEST_COVER_BOXES`). */
      const CELL = '<div data-pahina-first-screen="" class="hub-cover-cell"><div data-pahina-chapters="" class="hub-cover" data-hub-fx="">';
      const REST = '<div data-pahina-chapters="" class="hub-cover-after mt-12 space-y-12 empty:hidden">';
      assert.ok(stored.html.includes(`${CELL}<header data-pahina-first-screen=""`), 'the masthead is not in the cover’s box');
      assert.ok(stored.html.includes(`</header></div>${REST}<div data-arrival-action="ask"`), 'the reply row is not what follows the cover in its box');
      const lead = stored.html.slice(stored.html.indexOf('<div data-hub-tab="home"'), stored.html.indexOf('<div data-hub-tab="home"', stored.html.indexOf('<div data-hub-tab="home"') + 1));
      assert.ok(lead.includes(CELL) && lead.includes(REST), 'the cover’s hand-over is not in the page’s first group');
      assert.equal(count(stored.html, 'data-hub-fx'), 1, 'something else on this page is marked for the engine');
      /* …AND NOTHING ELSE CHANGED: take the page pair and the three boxes off, and it is today's page, byte for byte. */
      const unwrapped = stored.html
        .replace('<div class="hub-page-cell"><div class="hub-page-stage"><article', '<article')
        .replace('</article></div></div>', '</article>')
        .replace(CELL, '')
        .replace(new RegExp(`</header></div>${REST}(<div data-arrival-action="ask"[\\s\\S]*?</div>)</div></div>`), '</header>$1');
      assert.ok(unwrapped === today, `with its boxes taken off the page is not today’s page — ${firstDifference(unwrapped, today)}`);
      continue;
    }
    /* 🌑 DARK (and a free event, always): today's page — not a box, not a class, not a mark, not a script. */
    const which = `${'heroPhotoUrl' in cover ? 'a photo cover' : 'the monogram cover'}, ${pro ? 'Pro' : 'free'} event`;
    assert.ok(stored.html === today, `a cover stored to leave by Scrub changed the page (${which}) — ${firstDifference(stored.html, today)}`);
    assert.equal(stored.mounts.HubScrub, 0, `a page whose cover does not leave mounts the Scrub island (${which})`);
  }
});

test('(7) the STRANGER’s tree is drawn too — the real one, byte for byte, with no Scrub on it', async () => {
  const page = await renderSiteBodyFixtureFull({ identity: fixtureStranger() });
  const { html } = page;
  assert.deepEqual(page.complaints, [], 'React or the page complained while rendering');
  assert.ok(html.length > 15_000, `the page is ${html.length} bytes — an empty shell`);
  /* IT IS THE OTHER TREE: its own article (no rhythm class — the guest tree's has `space-y-12`), the masthead inside
     the marked first-screen wrapper with the ONE door under it, the general details — and nothing of a guest's. */
  assert.equal(count(html, '<article data-pahina-chapters="true">'), 1, 'the stranger’s article');
  assert.equal(count(html, '<article data-pahina-chapters="true" class="space-y-12">'), 0, 'this is the guest’s tree');
  assert.match(html, /<div data-pahina-first-screen="" class="space-y-6 text-center"><header data-pahina-first-screen="" class="text-center">/, 'the text-only masthead, in its marked wrapper');
  /* (2026-10-11 on main: the door's row draws no box of its own now — `sn-door-row`, `display: contents`.) */
  assert.match(html, /<\/header><div class="sn-door-row">[\s\S]{0,400}data-get-inside="/, 'the one door, right under the masthead');
  const [first, second] = FIXTURE_WORDS.names.split(' & ');
  assert.match(html, new RegExp(`<h1[^>]*data-hub-names=""[^>]*><span class="block">${first}</span><span[^>]*>and</span><span class="block">${second}</span></h1>`));
  assert.ok(html.includes('Until we say ‘I do’') && html.includes(FIXTURE_WORDS.venue), 'the general details');
  assert.ok(!html.includes('You’re joining us as') && !html.includes('data-arrival-action=') && !html.includes(FIXTURE_WORDS.guestFirst), 'a guest’s own line, row or name is on a stranger’s page');
  /* …and with a photo the stranger's OTHER masthead: the cover alone in the page's first group, the door in the next. */
  const photo = await renderSiteBodyFixtureFull({ identity: fixtureStranger(), ...PHOTO });
  assert.deepEqual(photo.complaints, []);
  assert.match(photo.html, /<div id="site-home" aria-hidden="true" class="scroll-mt-6"><\/div><header data-pahina-first-screen="" class="text-center">[\s\S]*?<\/header><\/div><div data-hub-tab="home" data-pahina-first-screen="" data-pahina-chapters="" class="empty:hidden"><div data-pahina-first-screen="" class="space-y-6 text-center"><div class="sn-door-row">/, 'the photo cover is not the last thing in the first group, with the door in the next');
  assert.ok(photo.html.includes('fixture-hero.jpg'));

  /* BYTE FOR BYTE: twice the same, and the committed page (`UPDATE_GOLDEN=1` to accept an intended change). */
  const again = await renderSiteBodyFixture({ identity: fixtureStranger() });
  assert.ok(html === again, `two renders of one page differ — ${firstDifference(html, again)}`);
  if (process.env.UPDATE_GOLDEN === '1') writeFileSync(STRANGER_GOLDEN, `${html}\n`);
  assert.ok(existsSync(STRANGER_GOLDEN), 'site-body-fixture-stranger.golden.html is missing — it is never written unless UPDATE_GOLDEN=1');
  const golden = readFileSync(STRANGER_GOLDEN, 'utf8');
  assert.ok(`${html}\n` === golden, `the stranger’s page changed — ${firstDifference(`${html}\n`, golden)}\n  (intended? UPDATE_GOLDEN=1, then read the golden's diff: it is what every stranger's page gets)`);

  /* NO SCRUB on it: not one of the hand-over's boxes, and the island never mounted — free and Pro, both mastheads. */
  for (const props of [{}, { proWatermarkHidden: true }, { proWatermarkHidden: true, ...PHOTO }]) {
    const plain = await renderSiteBodyFixtureFull({ identity: fixtureStranger(), ...props });
    for (const m of scrubMarkers()) {
      const hit = m.startsWith('data-') ? plain.html.includes(m) : new RegExp(`class="(?:[^"]* )?${m}(?: [^"]*)?"`).test(plain.html);
      assert.equal(hit, false, `a stranger’s page with no Scrub scene draws ${m} (${JSON.stringify(props)})`);
    }
    assert.equal(plain.mounts.HubScrub, 0);
  }
});

test('(8) the STRANGER’s cover stored to leave by Scrub: while Scrub ships dark it is today’s page, byte for byte, and no island', async () => {
  const widgets = fixtureWidgets({ hero: LAB_SCRUB_COVER });
  assert.equal(hubCoverLeaves(widgets, true, true), true, 'anti-vacuity: the variant page’s cover stores no hand-over');
  /* BOTH of the stranger's mastheads — the text-only one (inside its first-screen wrapper, the door after it) and the
     photo cover (the last thing in the page's first group) — on a Pro event and a free one. */
  for (const [cover, pro] of [[{}, true], [{}, false], [PHOTO, true], [PHOTO, false]] as const) {
    const which = `${'heroPhotoUrl' in cover ? 'the photo cover' : 'the text-only cover'}, ${pro ? 'Pro' : 'free'} event`;
    const today = await renderSiteBodyFixture({ identity: fixtureStranger(), proWatermarkHidden: pro, ...cover });
    const stored = await renderSiteBodyFixtureFull({ identity: fixtureStranger(), proWatermarkHidden: pro, ...cover, widgets });
    assert.deepEqual(stored.complaints, []);
    assert.ok(stored.html.length > 15_000, 'an empty shell');
    if (SCRUB_OUT_OFFERED && pro) {
      /* ☀ OFFERED (a Pro event): the STRANGER's tree hands its cover over — the three boxes once, ONE page pair, the
         island mounted — and with the pair and the boxes taken off the page is today's page, byte for byte. */
      assert.equal(count(stored.html, 'class="hub-cover-cell"'), 1, `the cover’s cell, exactly once (${which})`);
      assert.ok(stored.mounts.HubScrub! > 0, `the island that arms the engine is mounted (${which})`);
      assert.equal(count(stored.html, 'class="hub-page-cell"'), 1, `the page wraps one pair for its cover — not two (${which})`);
      assert.equal(count(stored.html, 'data-hub-fx'), 1);
      let unwrapped = stored.html.replace('<div class="hub-page-cell"><div class="hub-page-stage"><article', '<article').replace('</article></div></div>', '</article>');
      if ('heroPhotoUrl' in cover) {
        /* THE PHOTO COVER — the last thing in the page's first group: its rest box holds nothing (and draws nothing),
           and the door is in the NEXT group, where the engine finds it. */
        const CELL = '<div data-pahina-first-screen="" class="hub-cover-cell"><div data-pahina-chapters="" class="hub-cover" data-hub-fx="">';
        const REST = '</header></div><div data-pahina-chapters="" class="hub-cover-after empty:hidden"></div></div>';
        assert.ok(stored.html.includes(`<div id="site-home" aria-hidden="true" class="scroll-mt-6"></div>${CELL}<header data-pahina-first-screen=""`), 'the photo masthead is not in the cover’s box, in the first group');
        assert.ok(stored.html.includes(`${REST}</div><div data-hub-tab="home" data-pahina-first-screen="" data-pahina-chapters="" class="empty:hidden"><div data-pahina-first-screen="" class="space-y-6 text-center"><div class="sn-door-row">`), 'the rest box is not empty, or the door is not the next group’s');
        unwrapped = unwrapped.replace(CELL, '').replace(REST, '</header>');
      } else {
        /* THE TEXT-ONLY COVER — inside its marked first-screen wrapper, the door in the rest box with the wrapper's
           own 1.5rem said on it. */
        const CELL = '<div class="hub-cover-cell"><div class="hub-cover" data-hub-fx="">';
        /* (The door is the first thing after the cover here — no "Get tickets" — so the rest box says the door's own
           top margin, the one the first-screen fit closes up: `STRANGER_TEXT_COVER_BOXES_DOOR_FIRST`.) */
        const REST = '</header></div><div class="hub-cover-after mt-[calc(0.75rem+0.75rem*var(--fs-air,1))] space-y-6 empty:hidden">';
        assert.ok(stored.html.includes(`<div data-pahina-first-screen="" class="space-y-6 text-center">${CELL}<header data-pahina-first-screen=""`), 'the text-only masthead is not in the cover’s box, in its wrapper');
        assert.ok(stored.html.includes(`${REST}<div class="sn-door-row">`) && stored.html.slice(stored.html.indexOf(REST), stored.html.indexOf(REST) + 700).includes('data-get-inside="'), 'the door is not what follows the cover in its box');
        unwrapped = unwrapped.replace(CELL, '').replace(REST, '</header>');
        /* (The rest box and the cell close right after the door, before the wrapper and the group do: two closing
           tags out of a run of them, just before the next group.) */
        const next = unwrapped.indexOf('<div data-hub-tab=', unwrapped.indexOf('data-get-inside='));
        assert.ok(unwrapped.slice(next - 12, next) === '</div></div>', 'the page after the door is not shaped as expected');
        unwrapped = unwrapped.slice(0, next - 12) + unwrapped.slice(next);
      }
      assert.ok(unwrapped === today, `with its boxes taken off the stranger’s page is not today’s page (${which}) — ${firstDifference(unwrapped, today)}`);
      continue;
    }
    assert.ok(stored.html === today, `a cover stored to leave by Scrub changed the stranger’s page (${which}) — ${firstDifference(stored.html, today)}`);
    assert.equal(stored.mounts.HubScrub, 0, `a stranger’s page whose cover does not leave mounts the Scrub island (${which})`);
  }
});

/* 💌 (9) — 2026-10-13, written the day "Scrub out" was turned on (owner: "Turn on scrub"). SAVE THE DATE IS NOT WIRED
   FOR SCRUB (its cover is the film, with a walker of its own — a separate design). So a Save the Date page whose cover
   AND scenes store Scrub must still draw plainly: no hand-over box, no mark for the engine, no cover cell, no island —
   and the ONLY difference from the same canvases without the stored Scrub is the page's own hold, which nothing arms
   there (every rule of it needs `[data-hub-page-on]`, set by the island alone). With those wrappers taken off, the
   page is the plain one byte for byte. Its look in a browser: `scripts/scrub-browser-check.mjs` is not needed — the
   bytes are the plain page's, and an unarmed wrapper draws no box of its own (measured box for box 2026-10-13 in
   Chromium and WebKit, `controller-2026-10-12/scrub-on/`). */
test('(9) Save the Date is not wired for Scrub: a cover and scenes stored to leave by Scrub draw the plain page, and mount no island', async () => {
  const noScrub = (c: unknown) => {
    const { transition: _t, ...rest } = c as Record<string, unknown>;
    return rest;
  };
  const scene = fixtureWidgetsWithAScrubScene().find((w) => w.widget_type === FIXTURE_SCRUB_SCENE)!.config_json as { canvas: unknown };
  const stored = fixtureWidgets({ hero: LAB_SCRUB_COVER, [FIXTURE_SCRUB_SCENE]: scene.canvas, countdown: scene.canvas });
  const plainRows = fixtureWidgets({ hero: noScrub(LAB_SCRUB_COVER), [FIXTURE_SCRUB_SCENE]: noScrub(scene.canvas), countdown: noScrub(scene.canvas) });
  /* Anti-vacuity: on the Invitation the same rows ARE the hand-over (so (9) is not green because nothing is stored). */
  const invitation = await renderSiteBodyFixtureFull({ proWatermarkHidden: true, widgets: stored });
  assert.ok(hubScrubHoldsAtMost(stored, true, true) > 0 && hubCoverLeaves(stored, true, true), 'the stored rows ask for no hand-over (asked through the lab’s door, so (9) holds with the switch either way)');
  assert.equal(count(invitation.html, 'class="hub-cover-cell'), SCRUB_OUT_OFFERED ? 1 : 0, 'anti-vacuity: on the Invitation the cover’s hand-over is not drawn');
  for (const pro of [true, false]) {
    const std = await renderSiteBodyFixtureFull({ proWatermarkHidden: pro, lifecyclePhase: 'save_the_date', widgets: stored });
    const plain = await renderSiteBodyFixtureFull({ proWatermarkHidden: pro, lifecyclePhase: 'save_the_date', widgets: plainRows });
    assert.deepEqual(std.complaints, []);
    assert.ok(std.html.includes('Save the Date'), 'anti-vacuity: this is not the Save the Date page');
    for (const m of scrubMarkers().filter((x) => !/^hub-page-(cell|stage)$/.test(x))) {
      const hit = m.startsWith('data-') ? std.html.includes(m) : new RegExp(`class="(?:[^"]* )?${m}(?: [^"]*)?"`).test(std.html);
      assert.equal(hit, false, `a Save the Date with a stored Scrub draws ${m} (${pro ? 'Pro' : 'free'})`);
    }
    assert.equal(std.mounts.HubScrub, 0, `a Save the Date with a stored Scrub mounts the Scrub island (${pro ? 'Pro' : 'free'})`);
    const holds = count(std.html, '<div class="hub-page-cell"><div class="hub-page-stage">');
    assert.ok(holds <= hubScrubHoldsAtMost(stored, pro), 'more page pairs than the page asks for');
    let unwrapped = std.html.split('<div class="hub-page-cell"><div class="hub-page-stage">').join('');
    if (holds > 0) {
      const close = '</div></div>'.repeat(holds);
      const at = unwrapped.indexOf('</article>' + close);
      assert.ok(at >= 0, 'the page’s hold does not close right after the page’s article');
      unwrapped = unwrapped.slice(0, at + '</article>'.length) + unwrapped.slice(at + '</article>'.length + close.length);
    }
    assert.ok(unwrapped === plain.html, `with its unarmed hold taken off, a Save the Date with a stored Scrub is not the plain page (${pro ? 'Pro' : 'free'}) — ${firstDifference(unwrapped, plain.html)}`);
  }
});

test('(5) it is tooling: no file of the app imports the fixture, the helper or the golden', () => {
  const WEB = join(__dirname, '..');
  /* 🔁 RE-AIMED 2026-10-10: one more guard draws the real page with the helper — `a-sample-block-look-reaches-the-real-
     page.test.ts` (a look kept for Your seat lands on the guest's own block, and costs a guest nothing until then).
     It is a test, shipped to nobody; the claim is the same — no file of the APP imports the fixture. */
  /* 🔁 AND 2026-10-11: `the-link-down-names-what-it-opens.test.ts` draws the real page for six viewers (a stranger
     among them) to read the cover's link off it. A test again; the claim is unchanged. */
  /* 🔁 RE-AIMED 2026-10-10 (again): "WHAT GUESTS SEE" draws the real page on every stage with the same helper —
     `stage-pages-fixture.ts` (tooling: the same couple with every scene filled) and the tests that read it. Tests and
     tooling, shipped to nobody; the claim is unchanged. */
  const OURS = new Set([
    'lib/site-body-fixture.ts',
    'lib/site-body-fixture-render.ts',
    'lib/site-body-fixture-render.test.ts',
    'lib/a-sample-block-look-reaches-the-real-page.test.ts',
    'lib/the-link-down-names-what-it-opens.test.ts',
    'lib/a-dark-look-keeps-its-words.test.ts',
    'lib/stage-pages-fixture.ts',
    'lib/every-stage-is-todays-page.test.ts',
    'lib/a-stage-choice-decides-the-stage-list.test.ts',
    'lib/what-guests-see.test.ts',
    /* 🔁 AND 2026-10-11: the same page drawn for an event with NO date, to read its lines for a hole. A test. */
    'lib/a-dateless-event-prints-no-hole.test.ts',
    /* …and the page's ONE sign-out, read off the real page for its size, its contrast and its one control. A test. */
    'app/[slug]/_components/the-sign-out-asks-first.test.ts',
    /* …and the same page for "one reply form": no sheet on a guest's page, the sheet on the Maker's canvas. A test. */
    'app/[slug]/_components/one-reply-form.test.ts',
    /* …and the guest's foot (the record note, the sign-out) read off it for the page's gutter. A test. */
    'app/[slug]/_components/me-has-the-pages-gutter.test.ts',
    /* …and (2026-10-14, Width) a stored width read off the real page — the cover's names inline, a scene's words scoped. A test. */
    'lib/element-width.test.ts',
    /* …and (2026-10-15) the same page drawn for a signed-in HOST, to read that no host strip rides it. A test. */
    'app/[slug]/_lib/the-host-page-has-no-host-strip.test.ts',
    /* …and (2026-10-10, the cover's hand-over) the script that writes the fixture page out for a real browser —
       `scripts/scrub-browser-check.mjs` (16). Run by hand, bundled into nothing; the claim is unchanged. */
    'scripts/scrub-fixture-page.tsx',
  ]);
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

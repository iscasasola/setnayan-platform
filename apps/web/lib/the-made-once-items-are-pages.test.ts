/**
 * THE MADE-ONCE ITEMS ARE PAGES, NOT POP-UPS.
 *
 * Owner 2026-09-25, verbatim: *"on event hub maker, we do not want a pop up for
 * details, logo, hero, reveal and love story. we want their actual page to be
 * on the body of the editor similar to the different stages."*
 *
 * Asserted on the RENDERED Maker, not only the source: for each of the five,
 * picking it in the bar draws that item's page in the body (where a stage's
 * canvas sits), its controls where a stage's controls sit, and NOTHING that is a
 * dialog, a sheet or a portal. Picking a stage afterwards draws the stage again.
 *
 * Also held by source, per file (a render cannot see a portal that is only
 * opened by a later click): no made-once file mounts `role="dialog"`,
 * `aria-modal`, `createPortal`, `useModalA11y` or a `fixed inset-0` layer.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 * Run: pnpm --filter @setnayan/web test:unit
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { MAKER_PAGE_KEYS, makerPageCanvasSrc, makerPageStage } from './maker-made-once-pages';
import { movedPageItem } from './maker-details-items';

/* tsx compiles the components to the CLASSIC runtime, so React must be global
   before they are imported (the set-up `hub-stage-renders.test.ts` documents). */
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const SHELL = 'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx';

/* 🎨 Details part 3 — the Look pages' Details side. */
const LOOK_FILES = [`${L}/details-look-pages.tsx`, `${L}/details-go.tsx`, `${L}/details-workspace.tsx`];

const POP_UP = [
  ['role="dialog"', /role=["']dialog["']/],
  ['aria-modal', /aria-modal/],
  ['createPortal', /\bcreatePortal\b/],
  ['useModalA11y', /\buseModalA11y\b/],
  ['a fixed full-screen layer', /\bfixed inset-0\b/],
] as const;

test('Details is the bar’s one made-once item; Logo, Hero and Reveal are items of it; the pure rule draws each where it should', async () => {
  // 🗂 OPTION B (owner 2026-09-28; DECISION_LOG "OPTION B — EVERYTHING MADE ONCE
  // LIVES IN DETAILS; THE TOP MENU IS THE FOUR STAGES + DETAILS"): the bar's
  // made-once group is Details alone, and the pages moved into it.
  // ✂ THE MAKER IN 4 (2026-10-02): the bar's doors into Details are Look and Details (Prints is ⋯'s) —
  // each a DOOR into the one Details page, never a page of its own; Logo/Hero/Reveal are not on the bar.
  const { MAKER_TOOLBAR, makerPressDoor } = await import(`../${L}/maker-bar`);
  assert.deepEqual(
    (MAKER_TOOLBAR as readonly string[]).filter((k) => !['exit', 'page', 'undo', 'view', 'apply', 'more'].includes(k)),
    ['look', 'details'],
    'the bar holds a made-once door besides Look and Details again',
  );
  for (const door of ['look', 'details', 'prints'] as const) {
    assert.equal(makerPressDoor({ detailsItem: null }, door).selectedTool, 'details', `${door} opens a page of its own`);
  }
  for (const key of ['logo', 'hero', 'reveal'] as const) {
    assert.ok(MAKER_PAGE_KEYS.includes(key), `${key} is no longer a made-once page`);
    assert.equal(movedPageItem(key), key, `${key} does not land on its Details item`);
  }
  // 📦 Part 2b: Love Story and RSVP are Details items too — Story & plans.
  assert.equal(movedPageItem('love-story'), 'love-story', 'Love Story does not land on its Details item');
  assert.equal(movedPageItem('rsvp-page'), 'rsvp', 'RSVP does not land on its Details item');

  // Hero: the Invitation or On the Day as edited; else the Invitation.
  assert.equal(makerPageStage('hero', 'save_the_date'), 'rsvp');
  assert.equal(makerPageStage('hero', 'event'), 'event');
  assert.equal(makerPageStage('hero', 'editorial'), 'rsvp');
  // Reveal: the chosen stage it plays on (the Save the Date when none).
  assert.equal(makerPageStage('reveal', 'rsvp'), 'save_the_date');
  assert.equal(makerPageStage('reveal', 'rsvp', { revealStage: 'event' }), 'event');
  assert.equal(makerPageStage('reveal', 'rsvp', { revealStage: 'editorial' }), 'save_the_date');
  // Love Story: its own page (the scrapbook) unless asked for the guests' view.
  assert.equal(makerPageStage('love-story', 'rsvp'), null);
  assert.equal(makerPageCanvasSrc('/ana-ben', 'love-story', 'event', { guestView: true }), '/ana-ben?phase=rsvp&editor=1#site-story');
  // Logo and Details are their own pages; no address, no guest canvas.
  assert.equal(makerPageStage('logo', 'rsvp'), null);
  assert.equal(makerPageStage('details', 'rsvp'), null);
  assert.equal(makerPageCanvasSrc(null, 'hero', 'rsvp'), null);
  // The canvas door is the host-only `?editor=1` one a stage uses.
  assert.equal(makerPageCanvasSrc('/ana-ben', 'hero', 'rsvp'), '/ana-ben?phase=rsvp&editor=1&only=hero');
  // …except the Reveal, whose page must play the opening: only the stage preview does.
  assert.equal(makerPageCanvasSrc('/ana-ben', 'reveal', 'rsvp'), '/ana-ben?phase=save_the_date&preview=draft');
  // RSVP (owner 2026-09-27): the Invitation, on the SAMPLE seat-holder, reply
  // open — whichever stage is being edited, and never on a real guest.
  for (const stage of ['save_the_date', 'rsvp', 'event', 'editorial'] as const) {
    assert.equal(makerPageStage('rsvp-page', stage), 'rsvp');
  }
  assert.equal(
    makerPageCanvasSrc('/ana-ben', 'rsvp-page', 'event', { rsvpView: 'replied' }),
    '/ana-ben?phase=rsvp&editor=1&as=replied#your-details',
  );
  assert.equal(makerPageCanvasSrc(null, 'rsvp-page', 'rsvp'), null);
  // "The questions" is the default (owner 2026-09-27): the RSVP page itself,
  // for a sample guest who has not replied, wearing the draft.
  assert.equal(makerPageCanvasSrc('/ana-ben', 'rsvp-page', 'rsvp'), '/ana-ben/invite/reply?editor=1');
});

test('no made-once file mounts a dialog, a sheet or a portal', () => {
  const FILES = [
    `${L}/maker-page.tsx`,
    `${L}/maker-logo.tsx`,
    `${L}/maker-reveal.tsx`,
    `${L}/maker-made-once.tsx`,
    `${L}/maker-details.tsx`,
    `${L}/maker-rsvp-ask.tsx`,
    ...LOOK_FILES,
  ];
  for (const rel of FILES) {
    const src = read(rel);
    for (const [what, re] of POP_UP) assert.doesNotMatch(src, re, `${rel} mounts ${what}`);
  }
  console.log(`[made-once pages] files free of pop-ups: ${FILES.length}`);
});

/* ── the rendered work area ─────────────────────────────────────────────── */

const STAGES = ['save_the_date', 'rsvp', 'event', 'editorial'] as const;
const emptyList = (stage: (typeof STAGES)[number]) => ({ stage, shown: [], folded: [] });

async function paintWork(selection: unknown, opts: { revealStages?: string[] } = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerWork } = await import(`../${SHELL.replace(/\.tsx$/, '')}`);
  const { MakerContext } = await import(`../${L}/maker-context`);
  const noop = () => {};
  const value = {
    eventId: 'ev-1',
    stage: 'rsvp',
    setStage: noop,
    device: 'phone',
    navOpen: true,
    selection,
    select: noop,
    moreOpen: false,
    renderStamp: '1',
    storeShell: false,
    viewAsHref: null,
  };
  return renderToStaticMarkup(
    React.createElement(
      MakerContext.Provider,
      { value },
      React.createElement(MakerWork, {
        eventId: 'ev-1',
        publicLandingUrl: '/ana-ben',
        scenes: [],
        navigator: {
          stageLists: Object.fromEntries(STAGES.map((s) => [s, emptyList(s)])),
          fullOrders: Object.fromEntries(STAGES.map((s) => [s, []])),
          stdLead: null,
          minis: {},
          tint: { canvas: '#fff', ink: '#111', accent: '#a55' },
        },
        scenePanels: {},
        rows: {
          story: { label: 'Our story', node: React.createElement('div', { 'data-stub': 'story-words' }) },
        },
        themes: [],
        themeHref: '/x',
        ownsPro: true,
        toggleAction: noop,
        setModeAction: noop,
        moveUpAction: noop,
        moveDownAction: noop,
        proUnlockHref: '/pro',
        proPriceLabel: null,
        showProCta: false,
        revealStages: opts.revealStages ?? ['save_the_date'],
        madeOnce: {
          hero: React.createElement('div', { 'data-stub': 'hero-controls' }),
          reveal: React.createElement('div', { 'data-stub': 'reveal-controls' }),
          logo: React.createElement('div', { 'data-stub': 'logo-studio' }),
          'love-story': React.createElement('div', { 'data-stub': 'love-story-book' }),
        },
      }),
    ),
  );
}

function assertIsAPage(html: string, key: string) {
  assert.match(html, new RegExp(`data-maker-page="${key}"`), `${key}: no page in the body`);
  assert.match(html, /data-maker-page-body=""/, `${key}: the page must fill the body`);
  for (const [what, re] of POP_UP) assert.doesNotMatch(html, re, `${key} rendered ${what}`);
  assert.doesNotMatch(html, /aria-label="Inspector"/, `${key}: the inspector (a sheet on a phone) must not open`);
  assert.doesNotMatch(html, /aria-label="Scenes"/, `${key}: the page replaces the stage’s navigator`);
}

test('no made-once page renders in the work area — every one is an item of Details', async () => {
  // 🎨 Part 3 (Hero · Reveal · Logo) and 📦 part 2b (Love Story): each is an
  // item of Details, drawn by the shell over this area; the shell turns a
  // selection of one into Details (`movedSelection`) before it reaches here, and
  // the work area draws no page — nor any stub — of its own for it.
  for (const key of ['hero', 'reveal', 'logo', 'love-story'] as const) {
    const html = await paintWork({ kind: 'tool', key });
    assert.doesNotMatch(html, /data-maker-page="/, `${key}: the work area still draws a page for it`);
    const stub = { logo: 'logo-studio', hero: 'hero-controls', reveal: 'reveal-controls', 'love-story': 'love-story-book' }[key];
    assert.doesNotMatch(html, new RegExp(`data-stub="${stub}"`), `${key}: drawn in the work area`);
  }
});

test('no navigator renders while a page is picked — it belongs to the four stages', async () => {
  // Owner 2026-09-25: "logo and hero and reveal and love story has no navigation
  // since it is just full create your logo". Details is drawn by the shell over
  // this area (every made-once page is one of its items), and the navigator is
  // not mounted under it either.
  for (const key of ['details'] as const) {
    const html = await paintWork({ kind: 'tool', key });
    assert.doesNotMatch(html, /aria-label="Scenes"/, `${key}: the scene navigator rendered`);
    /* 🔥 2026-09-28 (owner: *"load everything so it runs smoothly"*): the stage
       CANVAS stays loaded under a page, so coming back is instant — but hidden
       (display: none), never shown beside the page. */
    const stage = html.indexOf('data-maker-stage="');
    if (stage >= 0) {
      const area = html.lastIndexOf('data-maker-work-area=""', stage);
      assert.ok(area >= 0 && /<div class="hidden" $/.test(html.slice(0, area)), `${key}: the stage canvas is SHOWN under the page`);
    }
  }
  // …and with a stage picked, it is back.
  assert.match(await paintWork(null), /aria-label="Scenes"/, 'the navigator is missing on a stage');
});

test('picking a stage draws the stage again — navigator and canvas, no page', async () => {
  const html = await paintWork(null);
  assert.doesNotMatch(html, /data-maker-page="/);
  assert.match(html, /aria-label="Scenes"/);
  assert.match(html, /data-maker-stage="rsvp"/);
  // Post Event's tool is a stage tool, not a made-once page: it stays in the inspector.
  const post = await paintWork({ kind: 'tool', key: 'post-event' });
  assert.doesNotMatch(post, /data-maker-page="/);
});

test('Details renders as a page in the Maker’s body, not a layer of its own', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerShell } = await import(`../${L}/maker-shell`);
  const html = renderToStaticMarkup(
    React.createElement(MakerShell, {
      eventId: 'ev-1',
      slug: 'ana-ben',
      liveStage: 'rsvp',
      initialStage: 'rsvp',
      initialSelection: { kind: 'tool', key: 'details' },
      storeShell: false,
      priceLabel: null,
      firstVisit: false,
      completeTourAction: async () => {},
      renderStamp: '1',
      more: null,
      hasWork: true,
      details: {
        page: React.createElement('div', { 'data-stub': 'details-page' }),
        controls: React.createElement('div', { 'data-stub': 'details-fields' }),
      },
    },
    React.createElement('div', { 'data-stub': 'work' }),
    ),
  );
  assert.match(html, /data-maker-page="details"/);
  assert.match(html, /data-maker-page-body=""[\s\S]*data-stub="details-page"/, 'what the details feed is the body');
  assert.match(html, /data-maker-page-controls=""[\s\S]*data-stub="details-fields"/, 'the fields sit beside it');
  // The ⋯ sheet is the only dialog in the shell, and it is shut.
  const dialogs = html.match(/role="dialog"/g) ?? [];
  assert.equal(dialogs.length, 1, 'only the ⋯ sheet is a dialog');
  assert.match(html, /<div hidden="" class="absolute inset-0 z-40">/, 'and the ⋯ sheet is shut');
});

test('Love Story: Our Love Story is the body, and a moment is added and edited IN PLACE', () => {
  const S = 'app/dashboard/[eventId]/website/our-story';
  // 📦 Part 2b: the scrapbook is Details › Love Story's picture, drawn by the launch page.
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /<OurStoryEditorPage[\s\S]{0,200}maker: '1'/, 'Details draws the scrapbook page');
  assert.match(read(`${L}/maker-details.tsx`), /<div key="love-story" data-details-love-story-book="" data-maker-love-story-book="">\s*<LoveStoryPieceFocus \/>\s*\{loveStory\.book\}\s*<\/div>/, 'the scrapbook is the item’s picture');
  assert.doesNotMatch(read('app/dashboard/[eventId]/website/editor/page.tsx'), /<OurStoryEditorPage\b/, 'the scrapbook is drawn twice');
  const page = read(`${S}/page.tsx`);
  assert.match(page, /inMaker \? null : <MiniTour/, 'no second tour pops up inside the Maker');
  // Inside the Maker the moment opens in the page — the sheet, its portal and its trap are the standalone page's only.
  const sheet = read(`${S}/_components/moment-sheet.tsx`);
  const inPlace = sheet.indexOf('{open && inMaker ? (');
  const portal = sheet.indexOf('createPortal(', inPlace);
  assert.ok(inPlace > 0 && portal > inPlace, 'the in-place branch must come before the portal');
  assert.match(sheet.slice(inPlace, portal), /data-moment-in-place=""/);
  assert.doesNotMatch(sheet.slice(inPlace, portal), /aria-modal|role="dialog"/, 'in place is not a dialog');
  assert.match(sheet, /useModalA11y\(\{ open: open && !inMaker,/, 'no focus trap in place');
  // Every scrapbook save lands back on Love Story's page in the Maker.
  let forms = 0;
  for (const f of ['_components/love-story-book.tsx', '_components/moment-sheet.tsx', '_components/pick-from-our-events.tsx']) {
    const src = read(`${S}/${f}`);
    for (const body of src.split(/<form\b/).slice(1)) {
      assert.match(body.slice(0, body.indexOf('</form>')), /<InMakerReturnTo \/>/, `${f}: a form does not return to the Maker`);
      forms += 1;
    }
  }
  assert.ok(forms >= 4, `only ${forms} scrapbook forms seen`);
  assert.match(read(`${S}/_components/in-maker-return-to.tsx`), /launch\?tool=love-story/);
});

test('the Details page shows what the details feed — the address and its QR, and every print', () => {
  // Since 2026-09-28 Details is the Maker's three columns (navigator · picture ·
  // editor) with Prints & Tickets folded in: ONE component is the whole page.
  const src = read(`${L}/maker-details.tsx`);
  assert.match(src, /export function MakerDetails\(/);
  assert.match(src, /\/api\/website\/qr\/\$\{encodeURIComponent\(slug\)\}/, 'the address QR every print carries');
  assert.match(src, /<PrintPieceBody input=\{prints\} piece=\{k\}/, 'every piece of the set, drawn as Prints & Tickets drew it');
  assert.match(src, /for \(const k of PRINT_SET_KEYS\)/);
  const prints = read(`${L}/maker-prints.tsx`);
  assert.match(prints, /`\/api\/hub-print\/\$\{piece\}\?event=\$\{eventId\}&mode=\$\{mode\}/, 'the cards, from the one print route');
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /page: \(\s*<MakerDetails\b/, 'the launch page hands Details its page');
  assert.match(launch, /controls: null,/, 'the editor is the page’s own right column, not the shared strip');
});

test('RSVP is Details › RSVP — the guest’s RSVP as its picture, its settings as its editor', async () => {
  // Guest pathway, owner 2026-09-27: "RSVP is its own made-once page". Details
  // part 2b moved it WHOLE into Details › Story & plans: an old
  // `?tool=rsvp-page` (and a scene's "Open RSVP editor") lands on the item.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerShell } = await import(`../${L}/maker-shell`);
  const html = renderToStaticMarkup(
    React.createElement(MakerShell, {
      eventId: 'ev-1',
      slug: 'ana-ben',
      liveStage: 'rsvp',
      initialStage: 'rsvp',
      initialSelection: { kind: 'tool', key: 'rsvp-page' },
      storeShell: false,
      priceLabel: null,
      firstVisit: false,
      completeTourAction: async () => {},
      renderStamp: '1',
      more: null,
      hasWork: true,
      details: {
        page: React.createElement('div', { 'data-stub': 'details-page' }),
        controls: null,
      },
    },
    React.createElement('div', { 'data-stub': 'work' }),
    ),
  );
  assert.match(html, /data-maker-page="details"[\s\S]*data-stub="details-page"/, 'an RSVP ask opens Details');
  assert.doesNotMatch(html, /data-maker-page="rsvp-page"/, 'RSVP is still a page of its own');
  assert.equal((html.match(/role="dialog"/g) ?? []).length, 1, 'only the ⋯ sheet is a dialog');

  // The launch page hands Details the RSVP item — the guest's RSVP (framed) and
  // the shipped settings — and "What do you ask your guests?" is not typed twice.
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /makerPageCanvasSrc\([^)]*'rsvp-page'/, 'the RSVP picture is the guest’s RSVP');
  assert.match(launch, /settings: \(\s*<MakerRsvpSettings\b/, 'the RSVP settings are its editor');
  assert.match(launch, /rsvp=\{rsvpItem\}/, 'Details is handed the RSVP item');
  assert.doesNotMatch(launch, /rsvp=\{rsvp\}/, 'the shell is still handed an RSVP page');
  const details = read(`${L}/maker-details.tsx`);
  assert.doesNotMatch(details, /MakerRsvp/, '"What do you ask your guests?" is typed a second time in Details');
  assert.match(details, /rsvp: <div key="rsvp" data-details-rsvp-page=""[^>]*>\{rsvp\.page\}<\/div>/);
  assert.match(details, /\.\.\.\(rsvp \? \{ rsvp: rsvp\.settings \} : \{\}\)/);
  const settings = read(`${L}/maker-rsvp-ask.tsx`);
  for (const section of ['one-at-a-time', 'who-can-rsvp', 'reply-by', 'requests']) {
    assert.match(settings, new RegExp(`data-rsvp-setting="${section}"`), `the RSVP page lost "${section}"`);
  }
  assert.match(settings, /data-made-once="rsvp-ask"/, 'the six questions are on the RSVP page');
});

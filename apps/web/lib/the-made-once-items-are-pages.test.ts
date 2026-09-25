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

/* tsx compiles the components to the CLASSIC runtime, so React must be global
   before they are imported (the set-up `hub-stage-renders.test.ts` documents). */
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const SHELL = 'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx';

const POP_UP = [
  ['role="dialog"', /role=["']dialog["']/],
  ['aria-modal', /aria-modal/],
  ['createPortal', /\bcreatePortal\b/],
  ['useModalA11y', /\buseModalA11y\b/],
  ['a fixed full-screen layer', /\bfixed inset-0\b/],
] as const;

test('the five are the bar’s made-once group, and the pure rule draws each where it should', async () => {
  const { MAKER_BAR } = await import(`../${L}/maker-bar`);
  const madeOnce = (MAKER_BAR as Array<{ key: string; group: string }>).filter((i) => i.group === 'made-once').map((i) => i.key);
  assert.deepEqual([...MAKER_PAGE_KEYS].sort(), [...madeOnce].sort(), 'every made-once bar item is a page');

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
  assert.equal(makerPageCanvasSrc('/ana-ben', 'hero', 'rsvp'), '/ana-ben?phase=rsvp&editor=1');
});

test('no made-once file mounts a dialog, a sheet or a portal', () => {
  const FILES = [
    `${L}/maker-page.tsx`,
    `${L}/maker-logo.tsx`,
    `${L}/maker-reveal.tsx`,
    `${L}/maker-made-once.tsx`,
    `${L}/maker-details.tsx`,
  ];
  for (const rel of FILES) {
    const src = read(rel);
    for (const [what, re] of POP_UP) assert.doesNotMatch(src, re, `${rel} mounts ${what}`);
  }
  console.log(`[made-once pages] files free of pop-ups: ${FILES.length}`);
});

/* ── the rendered work area ─────────────────────────────────────────────── */

const STAGES = ['save_the_date', 'rsvp', 'event', 'editorial'] as const;
const emptyList = (stage: (typeof STAGES)[number]) => ({ stage, shown: [], folded: [], orderIsAutomatic: false });

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
          fullOrder: [],
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

test('Hero · Reveal · Logo · Love Story each render as a page in the body, with their controls beside it', async () => {
  const hero = await paintWork({ kind: 'tool', key: 'hero' });
  assertIsAPage(hero, 'hero');
  assert.match(hero, /data-maker-page-frame=""[^>]*src="\/ana-ben\?phase=rsvp&amp;editor=1"|src="\/ana-ben\?phase=rsvp&amp;editor=1"[^>]*data-maker-page-frame/, 'the hero page is the guest page');
  assert.match(hero, /data-maker-page-controls=""[\s\S]*data-stub="hero-controls"/, 'the hero controls sit beside it');

  const reveal = await paintWork({ kind: 'tool', key: 'reveal' }, { revealStages: ['rsvp', 'event'] });
  assertIsAPage(reveal, 'reveal');
  assert.match(reveal, /src="\/ana-ben\?phase=rsvp&amp;editor=1"/, 'the reveal plays on the first chosen stage');
  assert.match(reveal, /data-maker-page-switch=""/, 'with two chosen stages the page offers both');
  assert.match(reveal, /data-maker-page-controls=""[\s\S]*data-stub="reveal-controls"/);

  const logo = await paintWork({ kind: 'tool', key: 'logo' });
  assertIsAPage(logo, 'logo');
  assert.match(logo, /data-maker-page-body=""[\s\S]*data-stub="logo-studio"/, 'the studio IS the body');
  assert.doesNotMatch(logo, /data-maker-page-controls=""/, 'the studio lays its own panel beside its canvas');

  const story = await paintWork({ kind: 'tool', key: 'love-story' });
  assertIsAPage(story, 'love-story');
  assert.match(story, /data-maker-page-body=""[\s\S]*data-stub="love-story-book"/, 'Our Love Story is the body');
  assert.match(story, /data-maker-page-controls=""[\s\S]*data-stub="story-words"/, 'the story words sit beside it');
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
      children: React.createElement('div', { 'data-stub': 'work' }),
    }),
  );
  assert.match(html, /data-maker-page="details"/);
  assert.match(html, /data-maker-page-body=""[\s\S]*data-stub="details-page"/, 'what the details feed is the body');
  assert.match(html, /data-maker-page-controls=""[\s\S]*data-stub="details-fields"/, 'the fields sit beside it');
  // The ⋯ sheet is the only dialog in the shell, and it is shut.
  const dialogs = html.match(/role="dialog"/g) ?? [];
  assert.equal(dialogs.length, 1, 'only the ⋯ sheet is a dialog');
  assert.match(html, /<div hidden="" class="absolute inset-0 z-40">/, 'and the ⋯ sheet is shut');
});

test('the Details page shows what the details feed — the address and its QR, and the cards', () => {
  const src = read(`${L}/maker-details.tsx`);
  assert.match(src, /export function MakerDetailsPage\(/);
  assert.match(src, /\/api\/website\/qr\/\$\{encodeURIComponent\(slug\)\}/, 'the address QR every print carries');
  assert.match(src, /\/api\/hub-print\/\$\{piece\}\?event=/, 'the cards, from the route Prints & Tickets uses');
  assert.match(src, /piece: 'invitation'/);
  assert.match(src, /piece: 'details'/);
  const launch = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /page: <MakerDetailsPage /, 'the launch page hands Details its page');
});

/**
 * the-toolbar-is-the-maker-in-four.test.ts — THE MAKER'S TOOLBAR IS EXACTLY
 * THE APPROVED ITEMS, AS RENDERED.
 *
 * Owner-approved design `prototypes/maker_in_four_2026-09-30_fable.html`;
 * DECISION_LOG "THE MAKER IN 4 IS A DIRECTION, NOT A COUNT" (the test: a
 * first-time host understands what to do), "✂ THE MAKER RE-PLAN IS CUT TO ITS
 * CORE", "SIMPLIFY FIRST, THEN TOUR" (2026-10-02) and tracker answer d15
 * ("Event Details" everywhere); FIRST_TIMER_TEST_2026-10-02 task H2 scored
 * "Make the invitation" HARD — fixes 4, 5 and 6:
 *
 *     Exit · Page ▾ · Look · Details · Undo · Phone · Apply · ⋯
 *
 * Replaces the three guards of the bar it retired (the stage row — "the top
 * menu is Details · stages · Prints", "the final bar", "the compact bar is one
 * picker"): their intent is held here on the new bar — nothing joins the top
 * level unseen, the places are ONE dropdown, Prints is a door and not a page,
 * and exactly one door wears the highlight.
 *
 * Held on the RENDER (`renderToStaticMarkup` of the real `MakerShell`), in
 * order, so a control that creeps back onto the bar — or one that drops off —
 * goes red here, not in a screenshot.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { TOURS } from '@/lib/tours';
import { MAKER_PAGE_TITLE } from '@/lib/maker-made-once-pages';
import { DETAILS_FIRST_PRINT, PRINTS_ITEM_KEYS, isPrintsItem, type DetailsItemKey } from '@/lib/maker-details-items';
import { makerGuestPages } from '@/lib/maker-guest-pages';
import {
  DETAILS_FACTS_FIRST,
  MAKER_DETAILS_LABEL,
  MAKER_TOOLBAR,
  makerDoorOf,
  makerOpenTool,
  makerPageMenu,
  makerPagePick,
  makerPressDoor,
  makerViewToggle,
} from './maker-bar';

/* tsx compiles these components to the CLASSIC runtime (bare
   `React.createElement`), so React must be global BEFORE they are imported,
   and the imports are dynamic — `hub-stage-renders.test.ts` documents why. */
(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));

/**
 * The real draft bar (`HubDraftToolbar`) cannot mount here — it reaches
 * `'server-only'` through its action — so the slot is a stand-in that draws
 * what the real one draws, in its order: Undo, the shell's Phone button (read
 * from the Maker's context, exactly as the real one reads it), Apply. The real
 * bar's order is held by SOURCE below.
 */
async function paint(opts: { hasWork?: boolean; firstVisit?: boolean; selection?: unknown; slot?: boolean } = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerShell } = await import('./maker-shell');
  const { useMaker } = await import('./maker-context');
  function DraftStandIn() {
    const maker = useMaker();
    return React.createElement(
      'div',
      { className: 'contents' },
      React.createElement('button', { 'data-maker-tool': 'undo' }, 'Undo'),
      maker?.viewToggle ?? null,
      React.createElement('button', { 'data-maker-tool': 'apply' }, 'Apply'),
    );
  }
  const hasWork = opts.hasWork ?? true;
  return renderToStaticMarkup(
    React.createElement(
      MakerShell as unknown as React.ComponentType<Record<string, unknown>>,
      {
        eventId: 'ev-1',
        slug: 'ana-miguel',
        liveStage: 'rsvp',
        initialStage: 'rsvp',
        initialSelection: (opts.selection ?? null) as never,
        storeShell: false,
        tourSlides: [],
        firstVisit: opts.firstVisit ?? false,
        completeTourAction: async () => {},
        renderStamp: '1',
        more: null,
        hasWork,
        applySlot: hasWork && opts.slot !== false ? React.createElement(DraftStandIn) : null,
        details: { page: React.createElement('div', { 'data-stub': 'details-page' }), controls: null },
      },
      React.createElement('div', { 'data-stub': 'work' }),
    ),
  );
}

const headerOf = (html: string) => {
  const start = html.indexOf('<header data-maker-toolbar=""');
  assert.ok(start >= 0, 'the toolbar was not rendered');
  return html.slice(start, html.indexOf('</header>', start));
};
const toolsOf = (html: string) => [...headerOf(html).matchAll(/data-maker-tool="([^"]+)"/g)].map((m) => m[1]);

/* ── 1 · the bar is exactly the approved items, in order ─────────────────── */

test('the rendered toolbar is EXACTLY Exit · Page ▾ · Look · Details · Undo · Phone · Apply · ⋯ — nothing else', async () => {
  assert.deepEqual([...MAKER_TOOLBAR], ['exit', 'page', 'look', 'details', 'undo', 'view', 'apply', 'more']);
  const html = await paint();
  assert.deepEqual(toolsOf(html), [...MAKER_TOOLBAR], 'a control joined or left the top level of the Maker');
  // ONE dropdown in the bar, and it is Page ▾.
  const header = headerOf(html);
  assert.equal((header.match(/aria-haspopup="listbox"/g) ?? []).length, 1, 'the bar holds one dropdown');
  assert.match(header, /data-maker-page-menu=""/);
  // The words a first-timer reads.
  assert.match(header, />Look</);
  assert.match(header, new RegExp(`>${MAKER_DETAILS_LABEL}<`));
  assert.match(header, /aria-label="Page: Invitation › Welcome"/, 'Page ▾ says the stage › the page');
});

test('the four stage names are not a top-level row — they live inside Page ▾', async () => {
  const header = headerOf(await paint());
  for (const word of ['Save the Date', 'The Day', 'Post Event', 'RSVP', 'Prints', 'Scenes', 'Restore', 'Your info']) {
    assert.ok(!header.includes(`>${word}<`), `"${word}" is on the bar again — it belongs to Page ▾ or ⋯`);
  }
  assert.doesNotMatch(header, /data-maker-bar-item|data-maker-place-pick|data-maker-divider/, 'the stage row is back');
});

test('a viewer with no work (a coordinator): the same bar without the draft, Look and Details saying why they are shut', async () => {
  const html = await paint({ hasWork: false });
  assert.deepEqual(toolsOf(html), ['exit', 'page', 'look', 'details', 'view', 'more']);
  const header = headerOf(html);
  assert.equal((header.match(/Only the host can open this part of the Event Hub Maker\./g) ?? []).length, 2);
  assert.doesNotMatch(header, /data-maker-tool="(look|details)"[^>]*aria-pressed/, 'a shut door is drawn as a working one');
});

test('by SOURCE: the real draft bar draws Undo · Phone · Apply in that order, and no Restore button', () => {
  const bar = stripComments(readFileSync(join(HERE, '../../website/_components/hub-draft-bar.tsx'), 'utf8'));
  const undo = bar.indexOf('label="Undo"');
  const view = bar.indexOf('{maker?.viewToggle ?? null}');
  const apply = bar.indexOf('label={applyLabel}');
  assert.ok(undo > 0 && view > undo && apply > view, 'the draft bar is not Undo · Phone · Apply');
  assert.doesNotMatch(bar, /label="Restore"/, 'Restore is back on the bar — it is ⋯’s');
  assert.doesNotMatch(bar, /<summary\b/, 'the draft bar grew a second ⋯');
  // …and the shell hands it the Phone button through the context, and draws ⋯ last.
  const shell = src('maker-shell.tsx');
  assert.match(shell, /viewToggle,\n/);
  const header = shell.slice(shell.indexOf('data-maker-toolbar=""'), shell.indexOf('</header>'));
  assert.ok(header.indexOf('{applySlot}') < header.indexOf('<ToolMenu label="More"'), '⋯ is not the last item');
});

/* ── 2 · ⋯ holds everything else ─────────────────────────────────────────── */

test('⋯ holds the rest: Add a scene · Play · Scenes · Both · See it as · Prints · Restore · Reset · the address · who can view', () => {
  const shell = src('maker-shell.tsx');
  const menu = shell.slice(shell.indexOf('<ToolMenu label="More"'), shell.indexOf('</ToolMenu>'));
  for (const row of [
    'Add a scene',
    'Play this scene',
    '<PreviewStageLink',
    '>Scenes<',
    'Phone and desktop',
    'See it as…',
    '{MAKER_PRINTS_LABEL}',
    'Restore',
    'Reset this stage…',
    'Your Event Hub address',
    'Who can view',
    'About the Maker',
  ]) {
    assert.ok(menu.includes(row), `⋯ lost "${row}"`);
  }
  // A choice among views is never a pill row: Both is ONE row that toggles.
  assert.doesNotMatch(menu, /Snap grid/, 'an explainer row is back in ⋯');
});

/* ── 3 · Page ▾ — the stages, each with its guest pages ──────────────────── */

const pagesOf = (s: Parameters<typeof makerGuestPages>[0]) => makerGuestPages(s, []).map((p) => ({ key: p.key, label: p.label }));

test('Page ▾ lists the five stages as groups, each with the guest bar’s own pages; RSVP holds its reply', () => {
  const m = makerPageMenu({ stage: 'rsvp', rsvpOpen: false, liveStage: 'rsvp', pagesOf, shownPage: null, hasWork: true });
  assert.deepEqual([...new Set(m.options.map((o) => o.group))], ['Save the Date', 'RSVP', 'Invitation', 'The Day', 'Post Event']);
  for (const stage of ['save_the_date', 'rsvp', 'event', 'editorial'] as const) {
    const own = m.options.filter((o) => o.key.startsWith(`${stage}:`)).map((o) => o.label);
    assert.deepEqual(own, pagesOf(stage).map((p) => p.label), `${stage}: not the guest bar's pages`);
  }
  assert.deepEqual(
    m.options.filter((o) => o.group === 'RSVP').map((o) => [o.key, o.label]),
    [['rsvp-stage', 'Reply']],
  );
  // One live dot, on the live stage's first page.
  assert.deepEqual(m.options.filter((o) => o.dot).map((o) => o.key), [m.options.find((o) => o.key.startsWith('rsvp:'))!.key]);
  // The button names where the couple is.
  assert.equal(m.buttonText, 'Invitation › Welcome');
  const onDay = makerPageMenu({ stage: 'event', rsvpOpen: false, liveStage: null, pagesOf, shownPage: 'gallery', hasWork: true });
  assert.equal(onDay.value, 'event:gallery');
  assert.match(onDay.buttonText, /^The Day › /);
  const rsvp = makerPageMenu({ stage: 'rsvp', rsvpOpen: true, liveStage: null, pagesOf, shownPage: null, hasWork: true });
  assert.equal(rsvp.value, 'rsvp-stage');
  assert.equal(rsvp.buttonText, 'RSVP › Reply');
});

test('a pick names one place; a page with nothing to arrange says so; the RSVP stage is the host’s alone', () => {
  assert.deepEqual(makerPagePick('event:gallery'), { kind: 'page', stage: 'event', page: 'gallery' });
  assert.deepEqual(makerPagePick('rsvp-stage'), { kind: 'rsvp' });
  assert.equal(makerPagePick('nope'), null);
  assert.equal(makerPagePick('details'), null, 'a door is not a place');
  const m = makerPageMenu({
    stage: 'rsvp',
    rsvpOpen: false,
    liveStage: null,
    pagesOf: (s) => (s === 'rsvp' ? [{ key: 'home', label: 'Welcome' }, { key: 'story', label: 'Our Love Story', empty: true }] : []),
    shownPage: 'home',
    hasWork: false,
    theHost: 'the couple',
  });
  assert.equal(m.options.find((o) => o.key === 'rsvp:story')?.disabledNote, 'nothing to arrange yet');
  assert.equal(m.options.find((o) => o.key === 'rsvp-stage')?.disabledNote, 'only the couple can open this');
  // The shell runs the pick through `makerPagePick` and a page JUMPS (the work area answers `pageJump`).
  const shell = src('maker-shell.tsx');
  assert.match(shell, /const pick = makerPagePick\(key\);/);
  assert.match(shell, /setPageJump\(\(j\) => \(\{ stage: pick\.stage, key: pick\.page,/);
});

/* ── 4 · Look · Details · Prints — three doors, one page, one highlight ─── */

test('Look, Details and ⋯ › Prints each open the ONE Details page on their part; exactly one is highlighted', () => {
  assert.equal(makerDoorOf('theme'), 'look');
  for (const k of ['mood-board', 'logo', 'hero', 'reveal']) assert.equal(makerDoorOf(k), 'look', k);
  for (const k of PRINTS_ITEM_KEYS) assert.equal(makerDoorOf(k), 'prints', k);
  for (const k of ['names', 'date', 'venues', 'love-story', 'address']) assert.equal(makerDoorOf(k), 'details', k);
  assert.equal(makerOpenTool('details', 'logo'), 'look');
  assert.equal(makerOpenTool('details', 'invitation'), 'prints');
  assert.equal(makerOpenTool('details', 'names'), 'details');
  assert.equal(makerOpenTool(null, 'names'), null, 'a stage is open — no door is');
  // Pressing through the doors lands each on its own part — never another's.
  let state: { detailsItem: DetailsItemKey | null } = { detailsItem: null };
  const press = (door: 'look' | 'details' | 'prints') => {
    const next = makerPressDoor(state, door);
    assert.equal(next.selectedTool, 'details', `${door}: a page of its own`);
    state = next;
    assert.equal(makerOpenTool('details', state.detailsItem), door, `${door} pressed, another door lit`);
  };
  press('details');
  assert.equal(state.detailsItem, DETAILS_FACTS_FIRST, 'Details opens on the facts');
  press('look');
  assert.equal(state.detailsItem, 'theme', 'Look opens on the Theme');
  press('prints');
  assert.equal(state.detailsItem, DETAILS_FIRST_PRINT);
  assert.ok(isPrintsItem(state.detailsItem));
  press('details');
  assert.equal(state.detailsItem, DETAILS_FACTS_FIRST, 'Details after Prints stayed on a print');
  // A Details item the couple was on is kept.
  assert.equal(makerPressDoor({ detailsItem: 'love-story' }, 'details').detailsItem, 'love-story');
  assert.equal(makerPressDoor({ detailsItem: 'hero' }, 'look').detailsItem, 'hero');
});

test('on the render: Look lit on a Look item, Details lit on a fact — never both', async () => {
  const pressed = (html: string) =>
    [...headerOf(html).matchAll(/data-maker-tool="(look|details)" aria-pressed="(true|false)"/g)].map((m) => `${m[1]}=${m[2]}`);
  assert.deepEqual(pressed(await paint()), ['look=false', 'details=false'], 'a door is lit with nothing open');
  assert.deepEqual(pressed(await paint({ selection: { kind: 'tool', key: 'logo' } })), ['look=true', 'details=false']);
  const det = await paint({ selection: { kind: 'tool', key: 'details' } });
  assert.match(det, /data-maker-page="details"/, 'Details did not open its page');
  // The shell presses a door through the same reducer, and the open door closes on a second press.
  const shell = src('maker-shell.tsx');
  assert.match(shell, /setDetailsItem\(makerPressDoor\(\{ detailsItem \}, key\)\.detailsItem\);/);
  assert.match(shell, /if \(openDoor === key\) \{\s*select\(null\);/);
});

test('"Your info" is retired as a name: the Maker says Event Details', () => {
  assert.equal(MAKER_DETAILS_LABEL, 'Event Details');
  assert.equal(MAKER_PAGE_TITLE.details, 'Event Details');
  for (const f of ['maker-shell.tsx', 'maker-bar.ts', 'maker-rsvp-stage.tsx', 'maker-details.tsx', '../page.tsx', '../../website/editor/_components/editor-shell.tsx', '../../website/editor/_components/details-bound-field.tsx']) {
    assert.doesNotMatch(src(f), /Your info/, `${f} still shows "Your info"`);
  }
});

/* ── 5 · the first open is the page itself ───────────────────────────────── */

test('first open: no tour and no Pro — ONE quiet line on the canvas, and only on the first open', async () => {
  const first = await paint({ firstVisit: true });
  assert.match(first, /data-maker-first-hint=""[^>]*>Tap anything to change it</);
  assert.equal((first.match(/role="dialog"/g) ?? []).length, 1, 'a dialog besides the shut ⋯ sheet opened on the first visit');
  assert.doesNotMatch(first, /Event Hub Pro|maker-tour-title/, 'a tour or a Pro pitch opens before the first tap');
  assert.doesNotMatch(await paint({ firstVisit: false }), /data-maker-first-hint/, 'the line shows after the first visit');
  // The first touch records it; the tour itself only plays from ⋯ › About the Maker, never recording.
  const shell = src('maker-shell.tsx');
  assert.match(shell, /completeTourAction\(MAKER_TOUR_KEY\)/);
  assert.match(shell, /const \[tour, setTour\] = useState\(false\);/);
  assert.match(shell, /record=\{false\}/);
  // Post Event's own hint waits for Post Event.
  assert.match(shell, /\{stage === 'editorial' && !hint \? postEventTour : null\}/);
});

test('the Maker tour is short and sells nothing', () => {
  const slides = TOURS.customer_event_hub_maker_v1.slides;
  assert.ok(slides.length >= 1 && slides.length <= 3, `the Maker tour is ${slides.length} slides`);
  assert.ok(slides.every((s) => !s.sells), 'a Maker tour slide sells');
  assert.ok(slides.every((s) => !/Pro|\{price\}|₱/.test(`${s.title} ${s.body}`)), 'a Maker tour slide names Pro or a price');
  assert.ok(slides.every((s) => !/website|\bsite\b/i.test(`${s.title} ${s.body}`)), 'Event Hub, never website');
});

test('the Phone button flips the canvas between the phone and the desktop', () => {
  assert.equal(makerViewToggle('desktop'), 'phone');
  assert.equal(makerViewToggle('phone'), 'desktop');
  assert.equal(makerViewToggle('both'), 'phone');
});

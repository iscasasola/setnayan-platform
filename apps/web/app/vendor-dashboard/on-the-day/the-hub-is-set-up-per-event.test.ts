/**
 * the-hub-is-set-up-per-event.test.ts — 🗓 the supplier's Hub, as approved in v13 (owner "Approved." 2026-10-29;
 * prototype `renderHub`, build notes S6; DECISION_LOG 2026-10-29 "'EVENTS' FOLDS INTO HUB"). It carries forward the
 * properties of the old `the-empty-hub-lists-the-next-events.test.ts` (owner "Yes to all" 2026-10-21, item 5):
 *
 *   1. ONE LIST — every day this shop is booked on AND every event this person runs, one row per event, today first,
 *      then the days ahead (soonest first), then events with no date yet, then past ones (latest first). An event in
 *      both is ONE row that says "You run it".
 *   2. A LOCKED EVENT IS ITS LOCK — the gate's own sentence and the bill's pay link, no tools; a past day is never
 *      shown locked; with nothing to pay (no bill yet) there is no pay button. Rendered, not grepped.
 *   3. NO PRICE IN CODE — the words and the amount are the shipped gate's (`resolveEventFeeGates` → `feeLockCopy`).
 *   4. THE EVENT OPENS on `?event=` when it is theirs, else today's, else the next — an id that is not theirs falls
 *      back, never an error.
 *   5. "Open the Event Hub" is drawn only on the day, for a booked and unlocked event.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { hubEvents, hubHref, hubMenuGroup, hubSegmentOf, pickHubEvent, type HubEvent } from '@/lib/hub-events';
import { stripComments } from '@/lib/strip-comments';
import { HubEventCard, HubLockRow } from './_components/hub-screen';

(globalThis as { React?: typeof React }).React = React;

const TODAY = '2026-11-01';
const DAYS = [
  { eventId: 'e-past', eventName: 'Ella & Felix', bookedDate: '2026-09-01' },
  { eventId: 'e-far', eventName: 'Gia & Hal', bookedDate: '2026-12-20' },
  { eventId: 'e-locked', eventName: 'Ana & Ben', bookedDate: '2026-11-08' },
  { eventId: 'e-today', eventName: 'Carla & Dino', bookedDate: TODAY },
];
const LOCK = { headline: 'GATE-HEADLINE', cta: 'GATE-CTA', payHref: '/vendor-dashboard/booking-fees/pay/o-1' };
const RUNS = [
  { eventId: 'e-far', name: 'Gia & Hal', date: '2026-12-20', href: '/dashboard/e-far', canAnnounce: true, rank: 0 as const },
  { eventId: 'e-run', name: 'Ivy & Jon', date: null, href: '/dashboard/e-run', canAnnounce: false, rank: 1 as const },
];

const list = () => hubEvents({ days: DAYS, runs: RUNS, locks: { 'e-locked': LOCK, 'e-past': LOCK }, today: TODAY });

test('1 · one list: today, the days ahead soonest first, no date yet, then past — and a run + booked event is one row', () => {
  const l = list();
  assert.deepEqual(l.map((e) => e.eventId), ['e-today', 'e-locked', 'e-far', 'e-run', 'e-past']);
  const far = l.find((e) => e.eventId === 'e-far')!;
  assert.equal(far.runs, true);
  assert.equal(far.booked, true);
  assert.equal(far.runHref, '/dashboard/e-far');
  const run = l.find((e) => e.eventId === 'e-run')!;
  assert.equal(run.booked, false, 'an event only run is not a booked day of the shop');
  assert.equal(run.when, 'undated');
  assert.deepEqual(
    l.map((e) => hubMenuGroup(e, TODAY)),
    ['Today', 'Next 7 days', 'Coming up', 'Date not set yet', 'Earlier'],
  );
});

test('2 · a locked event is its lock — the gate’s words and the bill’s link; a past day never locked', () => {
  const l = list();
  assert.equal(l.find((e) => e.eventId === 'e-past')!.lock, null, 'a past day is shown locked');
  const locked = l.find((e) => e.eventId === 'e-locked')!;
  const html = renderToStaticMarkup(React.createElement(HubLockRow, { lock: locked.lock! }));
  assert.match(html, /data-hub-day-locked/);
  assert.match(html, /GATE-HEADLINE/, 'the row lost the gate’s sentence');
  assert.match(html, /<a [^>]*href="\/vendor-dashboard\/booking-fees\/pay\/o-1"[^>]*>(?:(?!<\/a>)[\s\S])*GATE-CTA/, 'the row lost the way to pay');
  const noBill = renderToStaticMarkup(React.createElement(HubLockRow, { lock: { ...LOCK, cta: null } }));
  assert.doesNotMatch(noBill, /booking-fees\/pay/, 'a lock with nothing to pay offers a pay button');
  // The page draws nothing BUT the lock for a locked event's Set up and Crew.
  const page = stripComments(readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8'));
  assert.equal([...page.matchAll(/if \(event\.lock\) return <HubLockRow lock=\{event\.lock\} \/>;/g)].length, 2);
});

test('3 · no price is written in code — the words and the amount are the gate’s', () => {
  for (const f of ['_components/hub-screen.tsx', '_components/hub-event-menu.tsx']) {
    const src = stripComments(readFileSync(join(import.meta.dirname, f), 'utf8'));
    assert.doesNotMatch(src, /₱|PHP|amountPhp/, `${f} formats a price of its own`);
  }
  assert.doesNotMatch(stripComments(readFileSync(join(import.meta.dirname, '..', '..', '..', 'lib', 'hub-events.ts'), 'utf8')), /₱|PHP|amountPhp/);
  const page = stripComments(readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8'));
  assert.match(page, /await resolveEventFeeGates\(profile\.vendor_profile_id, ahead\)/, 'the Hub no longer asks the shipped gate');
  assert.match(page, /feeLockCopy\(\{ stage: gate\.stage, owed: gate\.access\.owed/, 'the lock’s words no longer come from feeLockCopy');
  assert.match(page, /locks: dayLocks,/, 'the page does not hand the locks to the list');
});

test('4 · the event opens on ?event= when it is theirs, else today’s — a stranger’s id falls back', () => {
  const l = list();
  assert.equal(pickHubEvent(l, 'e-far')?.eventId, 'e-far');
  assert.equal(pickHubEvent(l, 'not-mine')?.eventId, 'e-today');
  assert.equal(pickHubEvent(l, null)?.eventId, 'e-today');
  assert.equal(pickHubEvent([], 'e-far'), null);
  assert.equal(hubSegmentOf('crew'), 'crew');
  assert.equal(hubSegmentOf('../x'), 'setup');
  assert.equal(hubHref('e1', 'pages'), '/vendor-dashboard/on-the-day?event=e1&seg=pages');
  assert.equal(hubHref('e1'), '/vendor-dashboard/on-the-day?event=e1');
});

test('5 · "Open the Event Hub" only on the day, for a booked and unlocked event', () => {
  const l = list();
  const card = (e: HubEvent) => renderToStaticMarkup(React.createElement(HubEventCard, { event: e, title: e.name, place: null }));
  assert.match(card(l.find((e) => e.eventId === 'e-today')!), /href="\/vendor-dashboard\/on-the-day\/live\/e-today"[^>]*>[\s\S]*Open the Event Hub/);
  for (const id of ['e-locked', 'e-far', 'e-run', 'e-past']) {
    assert.doesNotMatch(card(l.find((e) => e.eventId === id)!), /data-hub-open=""/, `${id} offers the Event Hub before (or after) its day`);
  }
});

/*
 * 6–9 · THE PROTOTYPE'S SHAPE AT 390 (reviewer, 2026-10-30, against `renderHub` · `renderViewrow` · `renderThumb` ·
 * `hubPages`): the segments sit directly under the pinned row, ABOVE the event card; the pinned row carries the event's
 * ⓘ; Set up and The event's pages each have their thumb row; the event's pages are icon rows that open in place, with a
 * live count only where the page already read one.
 */
const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };
async function withRouter(el: React.ReactElement) {
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, el));
}

test('6 · on a phone the segments come first — Set up · Crew · The event’s pages ABOVE the event card', async () => {
  const { HubScreen } = await import('./_components/hub-screen');
  const today = list().find((e) => e.eventId === 'e-today')!;
  const props: React.ComponentProps<typeof HubScreen> = {
    menu: React.createElement('span', { 'data-probe-menu': '' }),
    event: today,
    seg: 'setup',
    pane: React.createElement('span', { 'data-probe-card': '' }),
    thumb: React.createElement('span', { 'data-probe-thumb': '' }),
    children: React.createElement('span', { 'data-probe-body': '' }),
  };
  const html = await withRouter(React.createElement(HubScreen, props));
  const at = (mark: string) => {
    const i = html.indexOf(mark);
    assert.notEqual(i, -1, `${mark} is not drawn`);
    return i;
  };
  // The list column (the phone's page): menu → segments → the card's phone copy → the body.
  const menu = at('data-probe-menu');
  const segs = at('data-hub-segmented');
  const phoneCard = at('data-hub-card-phone');
  const body = at('data-probe-body');
  assert.ok(menu < segs, 'the segments are drawn above the pinned row');
  assert.ok(segs < phoneCard, 'the event card is drawn ABOVE the segments on a phone — the prototype puts the segments first');
  assert.ok(phoneCard < body, 'the segment’s body is drawn above the card');
  assert.ok(html.includes('data-probe-thumb'), 'HubScreen dropped its thumb row');
});

test('7 · the pinned row carries the event’s ⓘ beside the Hub ▾ — the house ⓘ, holding only what was read', async () => {
  const { HubEventInfo } = await import('./_components/hub-screen');
  const { HubEventMenu } = await import('./_components/hub-event-menu');
  const l = list();
  const today = l.find((e) => e.eventId === 'e-today')!;
  const info = React.createElement(HubEventInfo, { event: today, title: 'Carla & Dino · Wedding', place: 'Taal Vista' });
  const html = await withRouter(React.createElement(HubEventMenu, { events: l, selectedId: 'e-today', seg: 'setup', today: TODAY, info }));
  const box = /<span[^>]*data-hub-event-menu=""[^>]*>([\s\S]*)$/.exec(html)?.[1] ?? '';
  assert.match(box, /data-explain="hub-event"/, 'the Hub ▾ lost its ⓘ (or the ⓘ is drawn outside the box that moves up into the pinned row)');
  assert.match(box, /aria-label="Event details"/);
  // The ⓘ sits AFTER the ▾ (prototype "Hub ▾ · ⓘ").
  assert.ok(box.indexOf('data-hub-event-pick') < box.indexOf('data-explain="hub-event"'), 'the ⓘ is drawn before the ▾');
  // Both screens hand it in — the live page and the lab.
  for (const f of ['page.tsx', join('..', '..', 'dev', 'supplier-lab', 'hub-lab.tsx')]) {
    const src = stripComments(readFileSync(join(import.meta.dirname, f), 'utf8'));
    assert.match(src, /<HubEventMenu[\s\S]{0,400}?info=\{\s*<HubEventInfo/, `${f} draws the Hub ▾ without its ⓘ`);
  }
});

test('8 · the thumb row — "Find an event to set up" + ＋ on Set up, "Find a guest or a table" on The event’s pages', async () => {
  const src = stripComments(readFileSync(join(import.meta.dirname, '_components', 'hub-thumb-row.tsx'), 'utf8'));
  const pages = src.slice(src.indexOf("if (seg === 'pages')"), src.indexOf('return (', src.indexOf("if (seg === 'pages')") + 30));
  const setup = src.slice(src.indexOf('return (', src.indexOf("if (seg === 'pages')") + 30));
  assert.match(pages, /<ThumbRow[\s\S]*placeholder: 'Find a guest or a table'/, 'The event’s pages lost its thumb row');
  assert.match(setup, /<ThumbRow[\s\S]*placeholder: 'Find an event to set up'[\s\S]*action=/, 'Set up lost its thumb row or its ＋');
  assert.match(setup, /dispatchEvent\(new CustomEvent\(HUB_FIND_EVENT/, 'the Set up field no longer opens the Hub ▾ — a second finder of events');
  // The screen draws it, and both the live page and the lab hand it in.
  const screen = stripComments(readFileSync(join(import.meta.dirname, '_components', 'hub-screen.tsx'), 'utf8'));
  const hubScreen = screen.slice(screen.indexOf('export function HubScreen'), screen.indexOf('export function HubSegments'));
  assert.match(hubScreen, /\{thumb\}/, 'HubScreen no longer draws its thumb row');
  for (const f of ['page.tsx', join('..', '..', 'dev', 'supplier-lab', 'hub-lab.tsx')]) {
    const s = stripComments(readFileSync(join(import.meta.dirname, f), 'utf8'));
    assert.match(s, /thumb=\{<HubThumbRow seg=\{seg\} add=\{hubAddChoices\(/, `${f} draws the Hub without its thumb row`);
  }
  // ＋ offers only the doors this supplier may use there.
  const { hubAddChoices } = await import('@/lib/hub-events');
  const l = list();
  const keys = (id: string) => hubAddChoices(l.find((e) => e.eventId === id)!).map((c) => c.key);
  assert.deepEqual(keys('e-far'), ['moment', 'tool', 'helper'], 'run + booked');
  assert.deepEqual(keys('e-today'), ['tool', 'helper'], 'booked only — no moment (their schedule is view-only)');
  assert.deepEqual(keys('e-run'), ['moment'], 'run only — no shop tools, no crew');
  assert.deepEqual(keys('e-locked'), [], 'a locked event offers ＋');
});

test('9 · the event’s pages are icon rows that open in place, a count only where it was read', async () => {
  const { HubPageRow, HubPageRows } = await import('./_components/hub-screen');
  const { hubScheduleLine } = await import('@/lib/hub-events');
  const { Users } = await import('lucide-react');
  const row = React.createElement(HubPageRow, { pageKey: 'guests', icon: Users, label: 'Guests', line: '180 invited · 162 coming', href: '/dashboard/x/guests', access: 'View only' });
  const html = renderToStaticMarkup(React.createElement(HubPageRows, null, row));
  assert.match(html, /data-hub-page-row="guests"/);
  assert.match(html, /<svg/, 'the row lost its icon');
  assert.match(html, /data-fold-head=""/, 'the row is no longer the shared Fold (an accordion row)');
  assert.match(html, /data-hub-pages-none=""/, 'the search can empty the list with nothing said');
  assert.equal(hubScheduleLine(null), null, 'a refused read became a count');
  assert.equal(hubScheduleLine([]), 'No moments yet');
  assert.equal(
    hubScheduleLine([{ start_at: '2026-12-18T13:00:00Z' }, { start_at: '2026-12-18T21:30:00Z' }]),
    '2 moments · 1:00 PM – 9:30 PM',
  );
  const page = stripComments(readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8'));
  const body = page.slice(page.indexOf('function pagesBody'), page.indexOf('const BOOKED_PAGE_ICON'));
  assert.doesNotMatch(body, /HubDoorRow/, 'a page is a plain › link again');
  assert.doesNotMatch(body, /await|supabase|\.from\(/, 'the pages body reads on its own — a read per row');
  assert.match(page, /const blocks = selected\.lock == null \? await fetchRunOfShowBlocks\(selected\.eventId\) : null;/, 'the count read moved, or is made for a locked event');
});

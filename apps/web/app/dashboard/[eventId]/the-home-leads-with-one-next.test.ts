/**
 * the-home-leads-with-one-next.test.ts — 2026-10-01.
 *
 * Owner-APPROVED 2026-10-01 (DECISION_LOG "THE SIMPLE PHONE APP — APPROVED",
 * frame 1 "Home"): ONE "Next" card → an always-there **Edit your Event Hub**
 * button → three numbers + one Paid / Still owing line. Nothing else above the
 * fold on a 390 × 844 phone.
 *
 * Three properties, each RENDERED (not grepped) where it can be — the harness
 * is the neighbouring render tests' (`globalThis.React`, dynamic import):
 *   a · exactly one Next card, and it leads the Home's plan branch;
 *   b · the Edit your Event Hub button is drawn in every state;
 *   c · a read that did not happen prints "—", never 0;
 *   d · "Your services" (Papic · Setnayan AI, owner 2026-10-01): present, "—"
 *       on a failed read, never the service that is already the Next card,
 *       absent in the store shell.
 *   e · EACH THING ONCE, AND NOTHING ELSE (owner 2026-10-02, "HOME IS THE FIRST
 *       SCREEN ONLY"): the plan Home renders the first screen's blocks and no
 *       second section — on desktop too — and every old tile's content is
 *       reachable at its home (route check).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { nikahTrackedDone } from '@/lib/nikah-essentials';
import {
  HOME_NEXT_ORDER,
  aiStatus,
  homeServices,
  papicStatus,
  glanceCount,
  glanceDays,
  glanceMoney,
  nikahStatus,
  pickHomeNext,
  type HomeNextInput,
} from '@/lib/home-first-screen';
import type { HomeFirstScreenProps } from './_components/home-first-screen';

// 🪤 The repo's render harness: `"jsx": "preserve"` compiles to the classic
// runtime, so `React` must be global BEFORE the component is (dynamically) imported.
(globalThis as unknown as { React: unknown }).React = React;

// 🪤 `server-only` shim — the Nikah card imports `nikah-actions`, which imports `lib/auth`
// (`server-only`). Same shim as `home-numbers-move.test.ts`.
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_home_first__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}
let Screen: typeof import('./_components/home-first-screen').HomeFirstScreen | null = null;
test.before(async () => {
  Screen = (await import('./_components/home-first-screen')).HomeFirstScreen;
});

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
const FACTS = stripComments(readFileSync(join(HERE, '..', '..', '..', 'lib', 'home-facts.ts'), 'utf8'));
/** The plan branch — the last arm of the page's phase ternary, up to the closing wrapper. */
const PLAN = PAGE.slice(PAGE.lastIndexOf(') : ('), PAGE.indexOf('</LastSeenCapture>'));

const NOTHING: HomeNextInput = { guide: null, hasDate: true, guests: { total: 96, unsent: 0 }, noun: 'wedding', papicReady: false, aiOffer: false };
const GUIDE = { round: 2, roundTitle: 'Invitations', done: 3, total: 7, nextTitle: 'Schedule' };

/** One input per kind, so every branch of the picker is drawn. */
const EVERY_STATE: HomeNextInput[] = [
  { ...NOTHING, guide: GUIDE, hasDate: false, guests: { total: 0, unsent: 0 }, papicReady: true, aiOffer: true },
  { ...NOTHING, hasDate: false, guests: { total: 0, unsent: 0 }, papicReady: true, aiOffer: true },
  { ...NOTHING, guests: { total: 0, unsent: 0 }, papicReady: true, aiOffer: true },
  { ...NOTHING, guests: { total: 96, unsent: 58 }, papicReady: true, aiOffer: true },
  { ...NOTHING, papicReady: true, aiOffer: true },
  { ...NOTHING, aiOffer: true },
  NOTHING,
];

function draw(over: Partial<HomeFirstScreenProps> = {}, input: HomeNextInput = NOTHING): string {
  const props: HomeFirstScreenProps = {
    eventId: 'e1',
    cover: { eyebrow: 'Wedding · March 13, 2027', name: 'Ana & Miguel' },
    next: pickHomeNext(input),
    days: glanceDays(163),
    coming: glanceCount(96, true),
    noReply: glanceCount(35, true),
    noReplyWaiting: true,
    money: { paid: glanceMoney(120000), owing: glanceMoney(45000) },
    services: homeServices({
      next: pickHomeNext(input).kind,
      storeShell: false,
      papic: papicStatus({ permitted: true, tile: { photosGathered: 12, preCapture: false } }),
      ai: aiStatus(false),
    }),
    ...over,
  };
  return renderToStaticMarkup(React.createElement(Screen!, props));
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

test('the picker walks the order the Home already stacked its nudges in', () => {
  assert.deepEqual(
    EVERY_STATE.map((s) => pickHomeNext(s).kind),
    [...HOME_NEXT_ORDER],
    'each state must land on the next kind in HOME_NEXT_ORDER — the first that applies wins',
  );
});

test('a · exactly ONE Next card with ONE button, in every state', () => {
  for (const state of EVERY_STATE) {
    const html = draw({}, state);
    const kind = pickHomeNext(state).kind;
    assert.equal(count(html, 'data-home-next='), 1, `${kind}: the first screen must carry exactly one Next card`);
    const card = html.slice(html.indexOf('data-home-next='), html.lastIndexOf('<a', html.indexOf('data-home-edit-hub')));
    assert.equal(count(card, '<a '), 1, `${kind}: the Next card must hold exactly one button`);
  }
});

test('a · the plan branch IS the first screen — no dashboard under it', () => {
  assert.equal(count(PAGE, '<HomeFirstScreen'), 1, 'the first screen is drawn once, in one place');
  assert.equal(PLAN.replace(/\s+/g, ''), '):(homeFirstScreen)}', `the plan branch must be the first screen and nothing else, found: ${PLAN}`);
  assert.equal(count(PAGE, 'homeFirstScreen'), 2, 'the first screen is built once and mounted once');
  // The two receded views keep the dashboard — each behind its own disclosure.
  assert.equal(count(PAGE, '<EventDashboard'), 2, 'EventDashboard is mounted only by the day-of and after-the-day views');
  assert.equal(count(PAGE, 'firstScreenAbove'), 0, 'the "first screen is above" flag is dead — nothing mounts the dashboard under a first screen');
  assert.equal(count(PAGE, 'home-all'), 0, 'a "#home-all" anchor with nothing to land on');
});

test('b · Edit your Event Hub is drawn in every state — no data can hide it', () => {
  const states: Array<[string, string]> = [
    ...EVERY_STATE.map((s): [string, string] => [pickHomeNext(s).kind, draw({}, s)]),
    ['nothing measured', draw({ coming: glanceCount(0, false), noReply: glanceCount(0, false), money: { paid: glanceMoney(null), owing: glanceMoney(null) }, days: glanceDays(null) })],
    ['budget not shared', draw({ money: null })],
  ];
  for (const [label, html] of states) {
    assert.equal(count(html, 'data-home-edit-hub'), 1, `${label}: the Edit your Event Hub button is missing`);
    assert.match(html, /href="\/dashboard\/e1\/launch"[^>]*>Edit your Event Hub</, `${label}: it must open the Maker`);
    assert.doesNotMatch(html, /Recommended/i, `${label}: the owner dropped the Recommended badge (2026-10-01)`);
  }
});

test('c · an unread number prints "—", never 0', () => {
  assert.equal(glanceCount(0, false), '—');
  assert.equal(glanceCount(180, false), '—', 'unmeasured is unknown, whatever the rows say');
  assert.equal(glanceCount(0, true), '0', 'a MEASURED zero is a fact and may be stated');
  assert.equal(glanceMoney(null), '—');
  assert.equal(glanceDays(null).value, '—');

  const html = draw({
    coming: glanceCount(0, false),
    noReply: glanceCount(0, false),
    noReplyWaiting: false,
    money: { paid: glanceMoney(null), owing: glanceMoney(null) },
  });
  const numbers = html.slice(html.indexOf('data-home-numbers'));
  assert.doesNotMatch(numbers, />0</, 'an unread count rendered as 0');
  assert.doesNotMatch(numbers, /₱0/, 'an unread sum rendered as ₱0');
  assert.ok(count(numbers, '>—<') >= 4, 'coming · no reply · paid · still owing must each read "—"');
});

test('c · the page hands the measurement to the render, not only the rows', () => {
  assert.match(PAGE, /fetchGuestsByEventMeasured\(/, 'Home must take the measured guest read');
  // The page hands the measurement to `homeFacts`; `homeFacts` is the one place the numbers are printed.
  assert.match(PAGE, /guests:\s*\{\s*stats:\s*guestStats,\s*measured:\s*guestsMeasured\s*\}/, 'the page must pass the measured flag with the counts');
  assert.match(FACTS, /glanceCount\(guests\.stats\.attending,\s*guests\.measured\)/, '"coming" must know whether it was measured');
  assert.match(FACTS, /glanceCount\(guests\.stats\.pending,\s*guests\.measured\)/, '"no reply" must know whether it was measured');
  assert.match(FACTS, /glanceMoney\(money\?\.paid \?\? null\)/, 'Paid must print "—" when the money read failed');
  assert.match(FACTS, /glanceMoney\(money\?\.owing \?\? null\)/, 'Still owing must print "—" when the money read failed');
  assert.doesNotMatch(PAGE, /measured:\s*true[^}]*\}\s*as Awaited/, 'a failed guest read must never be recast as measured');
});

test('d · the services row is on the first screen, last, under the money line', () => {
  const html = draw();
  assert.equal(count(html, 'data-home-services'), 1, 'the Your services row is missing');
  const at = html.indexOf('data-home-services');
  assert.ok(at > html.indexOf('data-home-money'), 'the row sits under the money line');
  assert.equal(count(html, 'See all'), 0, 'there is nothing under the row to "see all" of');
  assert.match(html, /<a data-home-service="papic"[^>]*href="\/dashboard\/e1\/studio\/papic"[^>]*>[\s\S]*?On · 12 photos/, 'Papic opens its page with its status');
  assert.match(html, /<a data-home-service="ai"[^>]*href="\/dashboard\/e1\/studio\/setnayan-ai"[^>]*>[\s\S]*?Try it/, 'Setnayan AI opens its page with its status');
});

test('d · each status is the shipped reader\'s answer, and a failed read is "—"', () => {
  assert.equal(papicStatus({ permitted: true, tile: 'failed' }), '—', 'a thrown Papic read');
  assert.equal(papicStatus({ permitted: true, tile: { photosGathered: null, preCapture: false } }), '—', 'a refused count is not "nothing shot"');
  assert.equal(papicStatus({ permitted: true, tile: { photosGathered: 0, preCapture: true } }), 'Free camera ready');
  assert.equal(papicStatus({ permitted: true, tile: null }), 'Not added');
  assert.equal(papicStatus({ permitted: true, tile: { photosGathered: 1, preCapture: false } }), 'On · 1 photo');
  assert.equal(aiStatus(null), '—');
  assert.equal(aiStatus(true), 'On');
  assert.equal(aiStatus(false), 'Try it');
  const html = draw({ services: homeServices({ next: 'guide', storeShell: false, papic: papicStatus({ permitted: true, tile: 'failed' }), ai: aiStatus(null) }) });
  const row = html.slice(html.indexOf('data-home-services'));
  assert.equal(count(row, '>—<'), 2, 'both services must read "—" when their reads failed');
  assert.doesNotMatch(row, />0</);
});

test('d · never twice: the service that is Next is left out of the row', () => {
  for (const kind of HOME_NEXT_ORDER) {
    const keys = homeServices({ next: kind, storeShell: false, papic: 'x', ai: 'y' }).map((s) => s.key);
    if (kind === 'papic') assert.deepEqual(keys, ['ai'], 'Papic is Next — the row must show only Setnayan AI');
    else if (kind === 'ai') assert.deepEqual(keys, ['papic'], 'Setnayan AI is Next — the row must show only Papic');
    else assert.deepEqual(keys, ['papic', 'ai']);
  }
  const html = draw({}, { ...NOTHING, papicReady: true });
  assert.equal(count(html, '/studio/papic'), 1, 'Papic is linked twice on one screen');
});

test('d · the store shell draws no services row (both are STORE_SHELL_HIDDEN_ADDON_KEYS)', () => {
  assert.deepEqual(homeServices({ next: 'plan', storeShell: true, papic: 'x', ai: 'y' }), []);
  assert.equal(count(draw({ services: [] }), 'data-home-services'), 0);
  assert.match(PAGE, /homeServices\(\{[\s\S]*?storeShell,/, 'the page must hand the store-shell answer to the row');
  assert.match(PAGE, /papicReady: Boolean\([^)]*!storeShell\)/, 'the Papic Next card must not send a store-shell user to a web-only page');
});

/* ══ e · EACH THING ONCE ═════════════════════════════════════════════════════
   Owner 2026-10-01, on the TEST wedding's Home (desktop) after the first screen
   shipped: *"you updated the Home of that event but instead of changing it I
   see dupes on the event."* Measured: days to go ×2 · coming / no reply ×2
   (three numbers + Guests tile + "N guests haven't replied yet") · money ×2
   (Paid / Still owing + Budget tile) · Next card ≈ "Needs you this week".

   🪤 `EventDashboard` is `server-only` (async, reads the database) — no test can
   mount it, so the half of each count that lives in it is held by the GATE on
   each site, and the sites are COUNTED, so a fifth way to print "days to go"
   added without a gate is a red test, not a silent dupe. The first screen's
   half is RENDERED. */

test('e · the first screen states each of the four facts exactly once', () => {
  const html = draw();
  for (const [what, needle] of [
    ['the days-to-go number', '>163<'],
    ['"days to go"', 'days to go<'],
    ['"coming"', '>coming<'],
    ['"no reply"', '>no reply<'],
    ['Paid', 'Paid<'],
    ['Still owing', 'Still owing<'],
  ] as const) {
    assert.equal(count(html, needle), 1, `${what} is not stated exactly once on the first screen`);
  }
});

test('e · the Home draws exactly one h1 — the cover name — and it is the first screen\'s', () => {
  const html = draw();
  assert.equal(count(html, '<h1'), 1, 'the first screen must carry the page\'s one h1 (the Kumusta hero that held it is gone)');
  assert.match(html, /<h1[^>]*>Ana &amp; Miguel<\/h1>/, 'the h1 is the event name');
  assert.equal(count(html, 'Ana &amp; Miguel'), 2, 'the name is the h1 (read) plus one aria-hidden line (seen) — a third copy is a dupe');
  assert.match(html, /aria-hidden="true"[^>]*>Ana &amp; Miguel</, 'the seen copy must be hidden from a screen reader, or the name is read twice');
});

test('e · desktop is the same single column, only wider — no second section', () => {
  const html = draw();
  assert.equal(count(html, 'data-home-first-screen'), 1, 'one first screen');
  assert.match(html, /<section[^>]*data-home-first-screen[^>]*class="[^"]*\bmax-w-xl\b[^"]*\blg:max-w-3xl\b/, 'one centred column, with a wider max-width from lg up');
  assert.doesNotMatch(html, /grid-cols-(?:3|4)\b[^"]*lg:|lg:grid-cols|lg:flex-row/, 'the first screen must not turn into a wide multi-column layout on desktop');
  assert.equal(count(html, '#home-all'), 0, 'a "See all" / "#home-all" link with nothing under it');
  assert.equal(count(html, '>See all<'), 0);
  // The ONLY blocks: cover · Next · Edit your Event Hub · numbers · money · services.
  for (const marker of ['data-home-event-details', 'data-home-next=', 'data-home-edit-hub', 'data-home-numbers', 'data-home-money', 'data-home-services']) {
    assert.equal(count(html, marker), 1, `${marker} must be drawn exactly once`);
  }
  assert.equal(count(html, '<section'), 1, 'one section — a second one is a second block');
  assert.equal(count(html, '<h2'), 1, 'the Next card is the only heading below the cover');
});

/* The old tiles' content, each at its home. The route check: the Home links to the
   page, and the page exists on disk (a door to nowhere is the failure this guards). */
const page = (route: string) => join(HERE, ...route.split('/'), 'page.tsx');
const exists = (route: string) => {
  try {
    readFileSync(page(route), 'utf8');
    return true;
  } catch {
    return false;
  }
};
const read = (route: string) => stripComments(readFileSync(page(route), 'utf8'));

test('e · the "plan" Next card opens the checklist — the plan, step by step', () => {
  assert.ok(exists('checklist'), 'the checklist page exists');
  const html = draw({}, NOTHING);
  assert.match(html, /href="\/dashboard\/e1\/checklist"[^>]*>Open your checklist</, 'the plan card must open the checklist');
  assert.doesNotMatch(html, /just below|See your plan/i, 'the card still points at a section that no longer exists');
});

test('e · each removed tile\'s content is reachable at its home', () => {
  // [tile, the route it now lives at, a file under that route, what that file still states]
  const homes: Array<[string, string, string | null, RegExp | null]> = [
    ['Papic · N shots / photos → the Your services row, then its page', 'studio/papic', null, null],
    ['Sai · your briefing · % booked (was "locked in", simplicity-2 d19) → the Setnayan AI page (live state)', 'studio/setnayan-ai', 'studio/setnayan-ai/_components/setnayan-ai-value.tsx', /% booked/],
    ['Setnayan AI · The Watch → the Setnayan AI page (deadlines + payments it keeps; the alerts themselves are notifications)', 'studio/setnayan-ai', 'studio/setnayan-ai/_components/setnayan-ai-value.tsx', /every supplier, deadline and payment/],
    ['Schedule · next → the Schedule page', 'schedule', null, null],
    ['Messages · unread → the chat icon\'s page', 'messages', null, null],
    ['Needs you this week → the Next card, and the suppliers\' own book / pick / lock steps', 'vendors', 'vendors/_components/build-locked.tsx', /Locked in/],
    ['Budget · committed → the money line, whose page is the budget', 'budget', null, null],
    ['Guests · coming / no reply → the three numbers, whose page is the roster', 'guests', null, null],
  ];
  for (const [what, route, file, claim] of homes) {
    assert.ok(exists(route), `${what}: /${route} has no page`);
    if (file && claim) {
      assert.match(stripComments(readFileSync(join(HERE, ...file.split('/')), 'utf8')), claim, `${what}: ${file} no longer states it`);
    }
  }
  // The Home hands the way to the two services and the money line.
  const html = draw();
  for (const href of ['/dashboard/e1/studio/papic', '/dashboard/e1/studio/setnayan-ai', '/dashboard/e1/budget']) {
    assert.ok(html.includes(`href="${href}"`), `the first screen must link ${href}`);
  }
});

test('e · the Nikah essentials moved to their own page and the Home keeps one line of them', () => {
  assert.ok(exists('nikah'), 'the Nikah essentials page exists');
  const nikahPage = read('nikah');
  assert.match(nikahPage, /<NikahEssentialsCard/, 'the page draws the card');
  assert.match(nikahPage, /isMuslimWedding\(/, 'the page is for Muslim weddings only');
  assert.doesNotMatch(PAGE, /<NikahEssentialsCard/, 'the Home draws the card again');
  const html = draw({ services: homeServices({ next: 'plan', storeShell: false, papic: 'x', ai: 'y', nikah: nikahStatus(3) }) });
  assert.match(html, /<a data-home-service="nikah"[^>]*href="\/dashboard\/e1\/nikah"[^>]*>[\s\S]*?3 of 4 in place/, 'a Muslim wedding\'s row opens the page with its count');
  assert.equal(count(draw(), 'data-home-service="nikah"'), 0, 'every other wedding has no Nikah line');
  assert.equal(nikahStatus(null), '—', 'a refused guest read is "—", never "0 of 4"');
  // Free, so it is in the store shell too — the paid two are not.
  assert.deepEqual(homeServices({ next: 'plan', storeShell: true, papic: 'x', ai: 'y', nikah: nikahStatus(1) }).map((x) => x.key), ['nikah']);
  assert.match(PAGE, /nikah:\s*isNikahEvent\s*\?\s*nikahStatus\(\s*guestsMeasured\s*\?\s*nikahTrackedDone\(/, 'the Home must feed the row from the same count as the card, "—" when the guest read failed');
});

test('e · the count the Home states is the count the card ticks', async () => {
  const { NikahEssentialsCard } = await import('./_components/nikah-essentials-card');
  const g = (role: string) => ({ role, extra_roles: [] as string[] });
  const cases = [
    { guests: [], mahr: null, imam: false },
    { guests: [g('wali')], mahr: null, imam: false },
    { guests: [g('wali'), g('witness')], mahr: 'gold', imam: false },
    { guests: [g('wali'), g('witness'), g('witness'), g('imam')], mahr: 'gold', imam: false },
    { guests: [g('wali'), g('witness'), g('witness')], mahr: '  ', imam: true },
  ];
  for (const c of cases) {
    const html = renderToStaticMarkup(
      React.createElement(NikahEssentialsCard, { eventId: 'e1', eventDateSet: true, mahrDescription: c.mahr, genderSeparation: null, guests: c.guests, imamBooked: c.imam } as never),
    );
    const done = nikahTrackedDone({ guests: c.guests, mahrDescription: c.mahr, imamBooked: c.imam });
    assert.match(html, new RegExp(`${done} of 4 set\\.`), `the card ticks ${done}; the Home row must say the same`);
  }
});

test('e · the comeback offer keeps one line — on the Setnayan AI row, while the window is open', () => {
  assert.equal(aiStatus(false, 19), 'Comeback price · 19h left');
  assert.equal(aiStatus(false, 0), 'Try it', 'an expired window is not announced');
  assert.equal(aiStatus(false, null), 'Try it');
  assert.equal(aiStatus(true, 19), 'On', 'an owner is never pitched');
  assert.equal(aiStatus(null, 19), '—', 'an unresolved entitlement stays "—"');
  assert.match(PAGE, /aiOffer\?\.kind === 'comeback'\s*\?\s*Math\.ceil\(/, 'the page must hand the window to the row');
});

test('e · the nudges of the old second section are not on the plan Home', () => {
  const branch = PLAN;
  for (const gone of ['SetDateNudge', 'PapicReadyNudge', 'SetnayanAiComebackOffer', 'NikahEssentialsCard', 'planNextYearEvent', 'slotAfterBento']) {
    assert.doesNotMatch(branch, new RegExp(gone), `${gone} is drawn again under the first screen`);
  }
});

test('f · the guests cards: "Add your guests" on an empty list, "Send N invitations" from the real unsent count', async () => {
  // First-timer fix 9 (corpus FIRST_TIMER_TEST_2026-10-02.md, H3).
  const { homeGuestsRead } = await import('../../../lib/home-first-screen');
  const rows = [
    { role: 'bride', invitation_sent_at: null },
    { role: 'groom', invitation_sent_at: null },
    { role: 'guest', invitation_sent_at: null },
    { role: 'guest', invitation_sent_at: '2026-10-01T00:00:00Z' },
    { role: null, invitation_sent_at: '  ' },
  ];
  // The couple are not invited; a blank stamp is not a send.
  assert.deepEqual(homeGuestsRead(rows, true), { total: 3, unsent: 2 });
  // A refused read is null — never "Add your guests" to a couple with names.
  assert.equal(homeGuestsRead(rows, false), null);
  assert.equal(pickHomeNext({ ...NOTHING, guests: null }).kind, 'plan');

  const invite = pickHomeNext({ ...NOTHING, guests: homeGuestsRead(rows, true) });
  assert.equal(invite.kind, 'invite');
  assert.equal(invite.title, 'Send 2 invitations');
  assert.equal(pickHomeNext({ ...NOTHING, guests: { total: 1, unsent: 1 } }).title, 'Send 1 invitation');
  assert.equal(pickHomeNext({ ...NOTHING, guests: { total: 0, unsent: 0 } }).title, 'Add your guests');
  // The page feeds the picker from the SAME measured read the numbers use.
  assert.match(PAGE, /guests: homeGuestsRead\(guests, guestsMeasured\),/);
  // And each card goes where it says.
  const html = draw({}, { ...NOTHING, guests: { total: 96, unsent: 58 } });
  assert.match(html, /href="\/dashboard\/e1\/guests\/send"/);
});

/*
  🗣 THE CARD SAYS WHAT IT IS (owner, live phone test 2026-10-02, asking what the
  "Next card" was). Its eyebrow reads "Your next step" in plain words, and its
  button names the action — never a bare "Continue" or "Next". No caption
  explains it: the words do.
*/
test('the Next card reads "Your next step", and its button names the action — in every state', () => {
  for (const state of EVERY_STATE) {
    const html = draw({}, state);
    const kind = pickHomeNext(state).kind;
    const card = html.slice(html.indexOf('data-home-next='), html.lastIndexOf('<a', html.indexOf('data-home-edit-hub')));
    assert.match(card, />Your next step<\/p>/, `${kind}: the eyebrow does not say what the card is`);
    const button = /<a [^>]*>([^<]*)<\/a>/.exec(card)?.[1]?.trim() ?? '';
    assert.ok(!/^(Continue|Next|Go|Open)$/i.test(button), `${kind}: the button says "${button}" — it must name the action`);
  }
});

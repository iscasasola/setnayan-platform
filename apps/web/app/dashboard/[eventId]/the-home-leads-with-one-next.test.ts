/**
 * the-home-leads-with-one-next.test.ts — 2026-10-01, RE-AIMED 2026-10-24.
 *
 * Owner-APPROVED 2026-10-01 ("THE SIMPLE PHONE APP — APPROVED"): ONE next thing, said once. Owner-approved 2026-10-24
 * (`home_control_center_2026-10-24_fable.html`, "ok"): the "Your next step" card and the aggregate "What's next" are
 * REMOVED — the ONE next thing is now the Today line on top (the SAME picker, `pickHomeNext`), a POINTER to the widget
 * it is about, and the verb sits on that widget. What this guard held about the Next card it now holds about the line:
 *
 *   a · exactly ONE Today line, naming the picker's choice, pointing (never navigating) at a widget that IS drawn;
 *   b · Home draws no shortcut the event bar already has;
 *   c · a read that did not happen prints "—" / "couldn't load", never 0 — and the page hands the measurement on;
 *   d · "Your services" is on the first screen, last; the store shell draws none; no service stands down for Today;
 *   e · EACH THING ONCE (owner 2026-10-02, "HOME IS THE FIRST SCREEN ONLY") — per version; the old tiles' content
 *       is reachable at its home (route check);
 *   f · What's next is GONE (not hidden): no row, no dashboard mount, no `only="whatsnext"` mode.
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
import { homeToday } from './_components/home-control-faces';
import { fixtureControl, fixtureControlUnread } from '@/lib/home-control-fixture';
import { buildCustomerMenuTree } from '@/lib/customer-menu';

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
/** The plan branch — the last arm of the page's phase ternary, up to the closing wrapper. */
const DASH = stripComments(readFileSync(join(HERE, '_components', 'event-dashboard.tsx'), 'utf8'));
const PLAN = PAGE.slice(PAGE.lastIndexOf(') : ('), PAGE.indexOf('</LastSeenCapture>'));
const FACTS = stripComments(readFileSync(join(HERE, '..', '..', '..', 'lib', 'home-facts.ts'), 'utf8'));

const NOTHING: HomeNextInput = { guide: null, hasDate: true, guests: { total: 96, unsent: 0 }, noun: 'wedding', papicReady: false, aiOffer: false };
const GUIDE = { done: 9, total: 20, stageTitle: 'Invitation', stageDone: 4, stageTotal: 8 };

/** One input per kind, so every branch of the picker is drawn. */
const EVERY_STATE: HomeNextInput[] = [
  { ...NOTHING, guide: GUIDE, hasDate: false, guests: { total: 0, unsent: 0 }, papicReady: true, aiOffer: true },
  { ...NOTHING, hasDate: false, guests: { total: 0, unsent: 0 }, papicReady: true, aiOffer: true },
  // An unread guest list is its OWN step (H3, 2026-10-07) — never "on track".
  { ...NOTHING, guests: null, papicReady: true, aiOffer: true },
  // 🎨 Papic's moment ranks ABOVE the guest steps since 2026-10-14 (the approved
  // prototype's stopped/ready card stands where "Send 12 invitations" would).
  { ...NOTHING, guests: { total: 0, unsent: 0 }, papicReady: true, aiOffer: true },
  { ...NOTHING, guests: { total: 0, unsent: 0 }, aiOffer: true },
  { ...NOTHING, guests: { total: 96, unsent: 58 }, aiOffer: true },
  { ...NOTHING, aiOffer: true },
  NOTHING,
];

function draw(over: Partial<HomeFirstScreenProps> = {}, input: HomeNextInput = NOTHING): string {
  const next = pickHomeNext(input);
  const control = fixtureControl('e1', {
    next,
    guests: input.guests === null ? 'unread' : { coming: 96, noReply: 35, toInvite: input.guests.unsent, declined: 4, total: input.guests.total },
  });
  const props: HomeFirstScreenProps = {
    eventId: 'e1',
    cover: { eyebrow: 'Wedding · March 13, 2027', name: 'Ana & Miguel' },
    next,
    control,
    services: homeServices({
      next: 'plan',
      storeShell: false,
      papic: papicStatus({ permitted: true, tile: { photosGathered: 12, preCapture: false } }),
      ai: aiStatus(false),
    }),
    ...over,
  };
  return renderToStaticMarkup(React.createElement(Screen!, props));
}

const count = (html: string, needle: string) => html.split(needle).length - 1;
const norm = (t: string) => t.replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
/** The Today line's own markup. */
const todayLine = (html: string) => {
  const at = html.lastIndexOf('<', html.indexOf('data-home-today='));
  return html.slice(at, html.indexOf('</button>', at) + 9);
};

test('the picker walks the order the Home already stacked its nudges in', () => {
  assert.deepEqual(
    EVERY_STATE.map((s) => pickHomeNext(s).kind),
    [...HOME_NEXT_ORDER],
    'each state must land on the next kind in HOME_NEXT_ORDER — the first that applies wins',
  );
});

test('a · exactly ONE Today line, naming the picker’s choice, pointing at a widget that is drawn — never a door', () => {
  for (const state of EVERY_STATE) {
    const html = draw({}, state);
    const next = pickHomeNext(state);
    const t = homeToday(next, null);
    assert.equal(count(html, 'data-home-today='), 1, `${next.kind}: the first screen must carry exactly one Today line`);
    const line = todayLine(html);
    assert.match(line, /^<button type="button"/, `${next.kind}: the Today line is a pointer (a button), never a link`);
    assert.match(line, new RegExp(`data-home-today="${t.target}"`), `${next.kind}: the line points at ${t.target}`);
    assert.ok(
      html.includes(`data-home-tile="${t.target}"`) || html.includes(`data-home-service="${t.target}"`),
      `${next.kind}: the line points at ${t.target}, which Home does not draw`,
    );
    assert.equal(count(html, 'data-home-next='), 0, `${next.kind}: the Next card is back`);
  }
});

test('a · the plan branch IS the first screen — and mounts no dashboard', () => {
  assert.equal(count(PAGE, '<HomeFirstScreen'), 1, 'the first screen is drawn once, in one place');
  assert.equal(count(PAGE, 'homeFirstScreen'), 2, 'the first screen is built once and mounted once');
  assert.ok(PLAN.includes('{homeFirstScreen}'), 'the plan branch must render the first screen');
  assert.equal(count(PLAN, '<EventDashboard'), 0, 'the plan branch mounts a second dashboard');
  assert.doesNotMatch(PAGE, /only="whatsnext"|whatsNext=/, 'What’s next is mounted again');
  assert.doesNotMatch(PAGE, /sheet === 'next'|WhatsNextSheet/, 'the ?sheet=next portal is back');
  assert.doesNotMatch(PLAN, /slotAfterBento|firstScreenAbove|home-all/, 'a leftover of the stacked second section');
  // The two receded views keep the whole dashboard — each behind its own disclosure.
  assert.equal(count(PAGE, '<EventDashboard'), 2, 'EventDashboard: day-of and after the day');
  assert.equal(count(PAGE, 'firstScreenAbove'), 0, 'the "first screen is above" flag is dead');
  assert.equal(count(PAGE, 'home-all'), 0, 'a "#home-all" anchor with nothing to land on');
});

test('b · Home draws NO shortcut the event bar already has — in every state (owner 2026-10-23)', () => {
  // Owner, 23 Oct: "remove Home's three pills (Guests · Suppliers · Event Hub)" — *"we already have those menus on the
  // nav"*. A link on Home whose destination is a bar tab's AND whose NAME is that tab's name is a second door to the
  // same place — the bar's job. A widget that opens its page carries its own words ("96 coming — of 131 on the list").
  const tabs = buildCustomerMenuTree('e1', {})
    .filter((t) => t.key !== 'home')
    .map((t) => ({ href: t.href.split('?')[0]!, names: new Set([t.label, ...(t.key === 'launch' ? ['Event Hub', 'Hub'] : [])].map(norm)) }));
  assert.ok(tabs.length >= 3, 'premise: the bar has its tabs');
  const states: Array<[string, string]> = [
    ...EVERY_STATE.map((s): [string, string] => [pickHomeNext(s).kind, draw({}, s)]),
    ['nothing measured', draw({ control: fixtureControlUnread('e1') })],
    ['budget not shared', draw({ control: fixtureControl('e1', { budget: null }) })],
  ];
  for (const [label, html] of states) {
    const links = [...html.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
      href: (m[1]!.match(/href="([^"]*)"/)?.[1] ?? '').split(/[?#]/)[0]!,
      name: norm(m[1]!.match(/aria-label="([^"]*)"/)?.[1] ?? m[2]!.replace(/<[^>]+>/g, ' ')),
    }));
    assert.ok(links.length > 0, `${label}: premise — Home draws links`);
    for (const l of links) {
      const twin = tabs.find((t) => t.href === l.href && t.names.has(l.name));
      assert.ok(!twin, `${label}: Home draws "${l.name}" → ${l.href} — the event bar already has that door`);
    }
    assert.doesNotMatch(html, /Recommended/i, `${label}: the owner dropped the Recommended badge (2026-10-01)`);
  }
});

test('c · an unread number prints "—" or "couldn’t load", never 0', () => {
  assert.equal(glanceCount(0, false), '—');
  assert.equal(glanceCount(180, false), '—', 'unmeasured is unknown, whatever the rows say');
  assert.equal(glanceCount(0, true), '0', 'a MEASURED zero is a fact and may be stated');
  assert.equal(glanceMoney(null), '—');
  assert.equal(glanceDays(null).value, '—');
  // The widgets themselves: `home-control-reads-honestly.test.ts` renders every failed one (never 0, never ₱0).
  const html = draw({ control: fixtureControlUnread('e1') });
  const row = html.slice(html.indexOf('data-home-control="compact"'), html.indexOf('data-home-services'));
  assert.match(row, /Couldn’t load/, 'an unread guest list must say so on its widget');
  assert.match(row, /Money couldn’t load/, 'an unread money read must say so on the Budget widget');
  assert.doesNotMatch(row.replace(/not ₱0/g, ''), /₱0/, 'an unread sum rendered as ₱0');
});

test('c · the page hands the measurement to the render, not only the rows', () => {
  assert.match(PAGE, /fetchGuestsByEventMeasured\(/, 'Home must take the measured guest read');
  // The page hands the measurement to `homeFacts`; `homeFacts` is the one place the days and the money are worded.
  assert.match(PAGE, /guests:\s*\{\s*stats:\s*guestStats,\s*measured:\s*guestsMeasured,\s*noReply:\s*homeRoster\.none,\s*coming:\s*homeRoster\.yes\s*\}/, 'the page must pass the measured flag with the counts');
  assert.match(FACTS, /glanceCount\(comingN,\s*guests\.measured\)/, '"coming" must know whether it was measured');
  assert.match(FACTS, /glanceMoney\(money\?\.paid \?\? null\)/, 'Paid must print "—" when the money read failed');
  assert.match(PAGE, /roster: guestsMeasured \? homeRoster : null,/, 'the Guests widget must know whether the list was measured');
  assert.doesNotMatch(PAGE, /measured:\s*true[^}]*\}\s*as Awaited/, 'a failed guest read must never be recast as measured');
});

test('d · the services row is on the first screen, last, under the control row', () => {
  const html = draw();
  assert.equal(count(html, 'data-home-services'), 1, 'the Your services row is missing');
  const at = html.indexOf('data-home-services');
  assert.ok(at > html.indexOf('data-home-control="detail"'), 'the row sits under the control row');
  assert.equal(count(html, 'See all'), 0, 'there is nothing under the row to "see all" of');
  // 📷 Without the couple's card (the page was removed 2026-10-26), the Papic row opens Papic's photos, in Memories.
  assert.match(html, /<a data-home-service="papic"[^>]*href="\/dashboard\/e1\/memories"[^>]*>[\s\S]*?On · 12 photos/, 'Papic opens its photos with its status');
  assert.match(html, /<a data-home-service="ai"[^>]*href="\/dashboard\/e1\/studio\/setnayan-ai"[^>]*>[\s\S]*?Try it/, 'Setnayan AI opens its page with its status');
});

test('d · each status is the shipped reader\'s answer, and a failed read is "—"', () => {
  assert.equal(papicStatus({ permitted: true, tile: 'failed' }), '—', 'a thrown Papic read');
  assert.equal(papicStatus({ permitted: true, tile: { photosGathered: null, preCapture: false } }), '—', 'a refused count is not "nothing shot"');
  assert.equal(papicStatus({ permitted: true, tile: { photosGathered: 0, preCapture: true } }), 'Ready', 'no free camera is promised (owner 25 Oct: "unlimited camera but papic credits is used")');
  assert.equal(papicStatus({ permitted: true, tile: null }), 'Not added');
  assert.equal(papicStatus({ permitted: true, tile: { photosGathered: 1, preCapture: false } }), 'On · 1 photo');
  assert.equal(aiStatus(null), '—');
  assert.equal(aiStatus(true), 'On');
  assert.equal(aiStatus(false), 'Try it');
  const html = draw({ services: homeServices({ next: 'plan', storeShell: false, papic: papicStatus({ permitted: true, tile: 'failed' }), ai: aiStatus(null) }) });
  const row = html.slice(html.indexOf('data-home-services'));
  assert.equal(count(row, '>—<'), 2, 'both services must read "—" when their reads failed');
  assert.doesNotMatch(row, />0</);
});

test('d · no service stands down for Today — the line points at it, so it must be there', () => {
  // The old NEVER TWICE left the Next card's service out of the row. The Today line carries no button of its own, so
  // the page builds the row with `next: 'plan'` (names no service) — Papic and Setnayan AI stay when they are Today.
  assert.match(PAGE, /const homeServicesInput: Parameters<typeof homeServices>\[0\] = \{\s*next: 'plan',/, 'the plan Home leaves a service out for Today');
  for (const state of [{ ...NOTHING, papicReady: true }, { ...NOTHING, aiOffer: true }]) {
    const next = pickHomeNext(state);
    const html = draw({ control: fixtureControl('e1', { next }) }, state);
    const t = homeToday(next, null);
    assert.match(html, new RegExp(`data-home-service="${t.target}"`), `${next.kind}: Today points at ${t.target}, which is gone`);
  }
});

test('d · the store shell draws no services row (both are STORE_SHELL_HIDDEN_ADDON_KEYS)', () => {
  assert.deepEqual(homeServices({ next: 'plan', storeShell: true, papic: 'x', ai: 'y' }), []);
  assert.equal(count(draw({ services: [] }), 'data-home-services'), 0);
  assert.match(PAGE, /const homeServicesInput: Parameters<typeof homeServices>\[0\] = \{[\s\S]*?storeShell,/, 'the page must hand the store-shell answer to the row');
  assert.match(PAGE, /homeServices\(homeServicesInput\)/);
  assert.match(PAGE, /papicReady: Boolean\([^)]*!storeShell\)/, 'the Papic Today must not send a store-shell user to a web-only page');
});

/* ══ e · EACH THING ONCE ═════════════════════════════════════════════════════
   Owner 2026-10-01, on the TEST wedding's Home (desktop) after the first screen
   shipped: *"you updated the Home of that event but instead of changing it I
   see dupes on the event."* Since 2026-10-24 Home draws each widget TWICE in the
   markup — the phone's tile and the md+ card, one hidden at every width — so the
   rule is held PER VERSION: each fact once in the tiles, once in the cards. */

test('e · each version states each fact exactly once', () => {
  const html = draw();
  const compact = html.slice(html.indexOf('data-home-control="compact"'), html.indexOf('data-home-control="detail"'));
  const detail = html.slice(html.indexOf('data-home-control="detail"'), html.indexOf('data-home-services'));
  for (const [what, needle] of [
    ['"days to go"', '>days to go<'],
    ['"coming"', '> coming<'],
    ['"no reply"', 'no reply<'],
  ] as const) {
    assert.equal(count(compact, needle), 1, `phone: ${what} is not stated exactly once`);
  }
  assert.equal(count(detail, '>Paid<'), 1, 'cards: Paid is not stated exactly once');
  assert.equal(count(detail, '>Still owing<'), 1, 'cards: Still owing is not stated exactly once');
  assert.equal(count(detail, '</b> days to go'), 1, 'cards: "days to go" is not stated exactly once');
});

test('e · the Home draws exactly one h1 — the cover name — and it is the first screen\'s', () => {
  const html = draw();
  assert.equal(count(html, '<h1'), 1, 'the first screen must carry the page\'s one h1 (the Kumusta hero that held it is gone)');
  assert.match(html, /<h1[^>]*>Ana &amp; Miguel<\/h1>/, 'the h1 is the event name');
  // 📌 2026-10-27 (owner, Home A — "on home, we also want to pin the header on top" → "pinned approve"): the cover pins
  // as ONE line, `<names> · <date>`, drawn in place of the big words once stuck. That line is the third copy — and the
  // ONLY one allowed: aria-hidden, inside `data-home-cover-pin`. Any other copy is still a dupe.
  assert.equal(count(html, 'Ana &amp; Miguel'), 3, 'the name is the h1 (read) plus the big line and the pinned line (both seen, aria-hidden) — a fourth copy is a dupe');
  assert.match(html, /<span aria-hidden="true" data-home-cover-pin=""[^>]*>(?:(?!<\/span>).)*?>Ana &amp; Miguel</, 'the third copy is the pinned line, hidden from a screen reader');
  assert.equal(count(html.replace(/<span aria-hidden="true" data-home-cover-pin=""[\s\S]*?<\/span><\/span>/, ''), 'Ana &amp; Miguel'), 2, 'outside the pinned line the name is the h1 plus one aria-hidden line — a third copy is a dupe');
  assert.match(html, /aria-hidden="true"[^>]*>Ana &amp; Miguel</, 'the seen copy must be hidden from a screen reader, or the name is read twice');
});

test('e · compact on the phone, detail from md — one column, no second section, no toggle', () => {
  const html = draw();
  assert.equal(count(html, 'data-home-first-screen'), 1, 'one first screen');
  // One centred column on a phone; the whole body from md up (owner 2026-10-24: the split moves down from lg to md).
  assert.match(html, /<div data-home-column[^>]*class="[^"]*\bmax-w-xl\b[^"]*\bmd:max-w-none\b/, 'the column must fill the body from md');
  assert.match(html, /data-home-cover="[^"]*"[^>]*class="[^"]*-mx-4[^"]*sm:-mx-6[^"]*lg:-mx-8/, 'the cover cancels the layout gutter at every width — a full-width band');
  assert.doesNotMatch(html.slice(html.indexOf('data-home-cover'), html.indexOf('data-home-column')), /rounded/, 'the cover band is square-edged');
  // The two versions, each switched by width alone — no Compact/Detail toggle.
  assert.match(html, /class="hc-grid md:hidden" data-home-control="compact"/, 'the phone tiles must hide from md');
  assert.match(html, /class="hc-two hidden md:grid" data-home-control="detail"/, 'the cards must show from md');
  assert.doesNotMatch(html, /Compact|Detail view|aria-pressed="(true|false)"[^>]*>Detail/, 'a Compact/Detail toggle');
  assert.equal(count(html, '#home-all'), 0, 'a "See all" / "#home-all" link with nothing under it');
  assert.equal(count(html, '>See all<'), 0);
  // The blocks: cover · Today · the control row (two versions) · services. The cover's Settings pill is GONE — the
  // Countdown is Event Settings' one door (owner-approved 2026-10-24).
  for (const marker of ['data-home-today=', 'data-home-control="compact"', 'data-home-control="detail"', 'data-home-services']) {
    assert.equal(count(html, marker), 1, `${marker} must be drawn exactly once`);
  }
  assert.equal(count(html, 'data-home-event-details'), 0, 'the cover’s Settings pill is back — a second door to Event Settings');
  assert.equal(count(html, '<section'), 1, 'one section — a second one is a second block');
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

test('e · a calm Today points at the Checklist — the plan, step by step — and the Checklist opens it', () => {
  assert.ok(exists('checklist'), 'the checklist page exists');
  const html = draw({}, NOTHING);
  assert.match(todayLine(html), /data-home-today="plan"/, 'the calm Today does not point at the Checklist');
  assert.match(todayLine(html), /Nothing waits on you/);
  assert.match(html, /data-home-tile="plan"[\s\S]*?href="\/dashboard\/e1\/checklist"/, 'the Checklist widget does not open the checklist');
  assert.doesNotMatch(html, /just below|See your plan/i, 'Home still points at a section that no longer exists');
});

test('e · each removed tile\'s content is reachable at its home', () => {
  // [tile, the route it now lives at, a file under that route, what that file still states]
  const homes: Array<[string, string, string | null, RegExp | null]> = [
    // 📷 The Papic page was removed 2026-10-26 — the couple's card is on Today; the photos are Memories.
    ['Papic · N shots / photos → the Papic card on Today, then its photos', 'memories', null, null],
    // The share's word is "booked" since d19 (2026-10-02, "couples read book, never lock").
    ['Sai · your briefing · % booked → the Setnayan AI page (live state)', 'studio/setnayan-ai', 'studio/setnayan-ai/_components/setnayan-ai-value.tsx', /% booked/],
    ['Setnayan AI · The Watch → the Setnayan AI page (deadlines + payments it keeps; the alerts themselves are notifications)', 'studio/setnayan-ai', 'studio/setnayan-ai/_components/setnayan-ai-value.tsx', /every supplier, deadline and payment/],
    ['Schedule · next → the Schedule page', 'schedule', null, null],
    ['Messages · unread → the chat icon\'s page', 'messages', null, null],
    ['Needs you this week → the Next card, and the suppliers\' own book / pick steps', 'vendors', 'vendors/_components/build-locked.tsx', />Booked</],
    ['Hosts card · who holds access + what a helper did → the guest list\'s Access column and the helper\'s guest card', 'guests', 'guests/_components/guest-helper-access.tsx', /./],
    ['Meanwhile · a supplier delivered something → a notification (existing) opening the supplier\'s workspace', 'vendors/[vendorId]/workspace', null, null],
    ['Decisions list + Coming up → the What\'s next sheet on Home', 'checklist', null, null],
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
  // The money opens the budget where it lives now — Suppliers (owner 2026-10-07, H6).
  // 📷 Papic: without the couple's card, the row opens Papic's photos (Memories) — the Papic page is gone (2026-10-26).
  for (const href of ['/dashboard/e1/memories', '/dashboard/e1/studio/setnayan-ai', '/dashboard/e1/vendors?part=budget']) {
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

/* ══ f · "WHAT'S NEXT" IS GONE (owner-approved 2026-10-24) ═════════════════════
   It became the Checklist widget (the plan only); its decision rows went to the widgets they are about (book →
   Suppliers, pay → Budget, the AI's rows → Setnayan AI). Removed, not hidden. */

test('f · no What’s next row, no dashboard mode for it', () => {
  const html = draw();
  assert.equal(count(html, 'data-home-whats-next'), 0, 'the What’s next row is drawn again');
  assert.doesNotMatch(html, /sheet=next/, 'something on Home opens the ?sheet=next portal');
  assert.doesNotMatch(DASH, /only\?: 'whatsnext'|only === 'whatsnext'|HomeWhatsNext/, 'the dashboard still carries the What’s next mode');
  assert.throws(() => readFileSync(join(HERE, '_components', 'whats-next-sheet.tsx'), 'utf8'), 'the sheet shell is back');
  // The Checklist widget holds the plan: % done and the next dated tasks.
  assert.match(html, /data-home-card-key="plan"[\s\S]*?Your checklist · 62% done[\s\S]*?Confirm the caterer’s menu/, 'the Checklist card does not hold the plan');
});

test('f · replace means remove — the journey-rail stage line and the non-AI "% locked in" are gone, not hidden', () => {
  for (const gone of ['_components/journey-rail.tsx', '_components/the-rail-states-a-number-once.test.ts']) {
    assert.throws(() => readFileSync(join(HERE, 'progress', gone), 'utf8'), `${gone} is back`);
  }
  for (const lib of ['progress-stages.ts', 'stage-mark.ts']) {
    assert.throws(() => readFileSync(join(HERE, '..', '..', '..', 'lib', lib), 'utf8'), `lib/${lib} is back`);
  }
  assert.doesNotMatch(DASH, /JourneyRail|Read your progress|buildProgressStages|stageModel/, 'the rail is drawn again');
  assert.doesNotMatch(DASH, /lockedInPct|>\s*locked in\s*</, 'the "% locked in" line is back on the dashboard');
  // …but Setnayan AI still owns its own statement of the locked share.
  assert.match(readFileSync(join(HERE, 'studio', 'setnayan-ai', '_components', 'setnayan-ai-value.tsx'), 'utf8'), /% locked in/);
});

test('f · a supplier delivery reaches the couple as the ONE existing notification — none was added', () => {
  const actions = stripComments(readFileSync(join(HERE, '..', '..', 'vendor-dashboard', 'clients', '[eventId]', 'actions.ts'), 'utf8'));
  const at = actions.indexOf(".from('booking_handovers').insert(");
  assert.ok(at > 0, 'the handover insert exists');
  const after = actions.slice(at, actions.indexOf('export async function', at) > 0 ? actions.indexOf('export async function', at) : undefined);
  assert.match(after, /emitNotification\(\{[\s\S]*?type: 'schedule_suggestion'[\s\S]*?delivered your handover/, 'the delivery notification is emitted after the insert');
  assert.equal(count(after, 'emitNotification('), 1, 'a second notification for the same delivery');
  assert.ok(after.includes('/vendors/${eventVendorId}/workspace`'), 'it opens the supplier\'s workspace');
});

test('f · the guests: "Add your guests" on an empty list, "Send N invitations" from the real unsent count', async () => {
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
  assert.equal(pickHomeNext({ ...NOTHING, guests: null }).kind, 'unread', 'an unread list is said — never "on track"');

  const invite = pickHomeNext({ ...NOTHING, guests: homeGuestsRead(rows, true) });
  assert.equal(invite.kind, 'invite');
  assert.equal(invite.title, 'Send 2 invitations');
  assert.equal(pickHomeNext({ ...NOTHING, guests: { total: 1, unsent: 1 } }).title, 'Send 1 invitation');
  assert.equal(pickHomeNext({ ...NOTHING, guests: { total: 0, unsent: 0 } }).title, 'Add your guests');
  // The page feeds the picker from the SAME measured read the numbers use.
  assert.match(PAGE, /guests: homeGuestsRead\(guests, guestsMeasured\),/);
  // And the verb sits on the Guests widget, where it says.
  const html = draw({}, { ...NOTHING, guests: { total: 96, unsent: 58 } });
  assert.match(todayLine(html), /Send the invitations/);
  assert.match(html, /href="\/dashboard\/e1\/guests\/send"/);
});

/*
  🗣 THE LINE SAYS WHAT IT IS (owner, live phone test 2026-10-02, asking what the
  "Next card" was). It reads "Today", in plain words, and names the action —
  never a bare "Continue" or "Next". No caption explains it: the words do.
*/
test('the Today line reads "Today" and names the action — in every state', () => {
  for (const state of EVERY_STATE) {
    const html = draw({}, state);
    const kind = pickHomeNext(state).kind;
    const line = todayLine(html);
    assert.match(line, />Today<\/span>/, `${kind}: the line does not say what it is`);
    const words = norm(line.replace(/<[^>]+>/g, ' ')).replace(/^today\s*/, '');
    assert.ok(words.length > 0, `${kind}: the line names nothing`);
    assert.ok(!/^(continue|next|go|open)$/i.test(words), `${kind}: the line says "${words}" — it must name the action`);
  }
});

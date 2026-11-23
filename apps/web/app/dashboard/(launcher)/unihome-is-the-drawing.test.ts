/**
 * 🏠 UNIHOME v5 IS THE DRAWING (owner-approved 23 Nov 2026, DECISION_LOG "UNIHOME v5 APPROVED"; drawing
 * `prototypes/one_profile_page_2026-11-23/unihome-v5.html`). Holds the wiring the drawing's Notes list, so a later
 * edit cannot quietly bring back what was removed or cut a way in:
 *   1 · plain `/dashboard` is Unihome; a named `?seg=` is its full page, unchanged.
 *   2 · the jump icons: a nav named "Jump to", six in page order, `aria-current` on the lit one, marks only for > 0.
 *   3 · Home draws no pinned row, no bottom bar and no switcher pill (hidden while `[data-unihome]` is on screen).
 *   4 · event cards: organiser Dashboard · Event Hub · remove (the SHIPPED sheet), helper no remove, invited Hub only.
 *   5 · Create an event: one labelled terracotta button, right after the icon row, opening the shipped sheet.
 *   6 · every "See all" and every ☰ door lands on a real address.
 *   7 · failed reads draw "couldn't", never 0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { UNIHOME_JUMPS, UNIHOME_PARTS, unihomeHref, UNIHOME_EVENTS_ALL } from '@/lib/unihome';
import { resolveHomeSeg } from '@/lib/home-segments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const page = () => read('..', '..', '(hub)', 'dashboard', 'page.tsx');
const view = () => read('_components', 'unihome.tsx');
const jump = () => read('_components', 'unihome-jump.tsx');
const css = () => readFileSync(join(HERE, '_components', 'unihome.module.css'), 'utf8');

test('1 · plain /dashboard is Unihome; a section asked for by name is its full page', () => {
  assert.match(page(), /if \(one\('seg'\) !== seg\) \{\s*return \(\s*<UnihomeHome/, 'Home no longer branches to Unihome');
  // The branch fires exactly when the asked-for section is not one this account has: nothing, `hub=1`, or a stray value.
  assert.equal(resolveHomeSeg(undefined, { ownsShop: false }), 'events');
  assert.notEqual(resolveHomeSeg(undefined, { ownsShop: false }), undefined);
  assert.equal(resolveHomeSeg('people', { ownsShop: false }), 'people');
  assert.equal(UNIHOME_EVENTS_ALL, '/dashboard?seg=events', 'Events’ See all must open the full board');
  // The landing rules still run — from Home, once.
  assert.match(page(), /landHome\(\{ sp, boardEvents, active,/, 'Unihome stopped applying the landing rules');
});

test('2 · the jump icons: "Jump to", six in page order, aria-current, marks only for a real positive number', () => {
  assert.deepEqual([...UNIHOME_JUMPS], ['you', 'events', 'shop', 'people', 'memories', 'discover']);
  assert.deepEqual([...UNIHOME_PARTS], ['events', 'shop', 'people', 'memories', 'discover']);
  const src = jump();
  assert.match(src, /<nav aria-label="Jump to"/);
  assert.match(src, /aria-current=\{lit === key \? 'location' : undefined\}/);
  assert.match(src, /typeof n === 'number' && Number\.isFinite\(n\) && n > 0 \? n : null/, 'a mark must need a real positive number');
  // Every part the icons jump to exists on the page, by id.
  for (const part of UNIHOME_PARTS) assert.match(view(), new RegExp(`<section id="${part}"`), `no #${part} part on Home`);
});

test('3 · Home draws no pinned row, and hides the bottom bar and the switcher pill while it is on screen', () => {
  const src = view();
  assert.doesNotMatch(src, /HomePinnedRow|PinnedRow|PickMenu/, 'the Events ▾ pinned row is back on Home');
  assert.match(src, /data-unihome=""/);
  assert.match(css(), /:global\(html\):has\(\.page\) :global\(\[data-account-bar\]\),\s*:global\(html\):has\(\.page\) :global\(\.fd-topright \.fd-acct\) \{\s*display: none;/);
  // ⚙ beside the name opens the SHIPPED account sheet, account rows only.
  assert.match(src, /<AccountSwitcher data=\{switcher\} trigger="gear" \/>/);
});

test('4 · event cards: organiser Dashboard · Event Hub · remove (the shipped sheet); helper no remove; invited Hub only', () => {
  const src = view();
  assert.match(src, /card\.stance === 'organiser' \? \([\s\S]{0,200}<EventCardMenu trigger="remove"/, 'remove must be the organiser’s, through the shipped sheet');
  assert.match(src, /\{card\.hubUrl \? <UnihomeHubButton/, 'Event Hub must be drawn only when guests can open the hub');
  assert.match(page(), /r\.landing_page_visibility === 'public' \|\| r\.landing_page_visibility === 'unlisted'/, 'the hub rule changed');
  assert.match(page(), /dashboardHref: stance === 'invited' \? null : v\.href/, 'an invited card must not open a dashboard');
  const menu = read('_components', 'event-card-menu.tsx');
  assert.match(menu, /data-remove-put-away=""/, 'Put this away left the remove sheet');
});

test('5 · Create an event: one labelled terracotta button after the icon row, into the shipped New event sheet', () => {
  const src = view();
  const top = src.indexOf('<CollapsingTop');
  const create = src.indexOf('data-unihome-create=""');
  const parts = src.indexOf('<EventsPart');
  assert.ok(top >= 0 && create > top && parts > create, 'Create an event must follow the icon row and come before the parts');
  assert.match(src, /<ActionButton href="\/dashboard\/create-event" tone="brand" main icon=\{<Plus aria-hidden \/>\} label="Create an event"/);
  assert.equal((src.match(/tone="brand"/g) ?? []).length, 1, 'there is exactly one terracotta button on Home');
});

test('6 · every ☰ door lands on its part of Home, and every See all on a real page', () => {
  for (const part of UNIHOME_PARTS) assert.equal(unihomeHref(part), `/dashboard#${part}`);
  const shell = read('..', '..', '_components', 'frontdoor', 'front-door-shell.tsx');
  for (const part of UNIHOME_PARTS) {
    assert.match(shell, new RegExp(`href=\\{unihomeHref\\('${part}'\\)\\} className="fd-row fd-hsub" data-home-door="${part}"`), `the ☰ lost its ${part} door`);
  }
  const src = view();
  for (const see of ['see={PEOPLE_HOME}', 'see={MEMORIES_HOME}', 'UNIHOME_EVENTS_ALL : null', 'discoverFollowingHref(true)', 'discoverSupplierHref(']) {
    assert.ok(src.includes(see), `a See all lost its door: ${see}`);
  }
  assert.match(src, /href="\/open-shop"/, 'Create your own shop must open the shipped sign-up');
  assert.match(src, /href="\/vendor-dashboard" className=\{u\.supbtn\}/, 'Open shop dashboard must open the dashboard');
});

test('7 · a failed read says so — never 0, never an empty that reads as "none"', () => {
  const src = view();
  assert.match(src, /'Couldn’t count your events'/);
  assert.match(src, /shop\.newCount === null \? '—'/);
  assert.match(src, /shop\.cards \? 'service cards online' : 'Couldn’t count your cards'/);
  assert.match(src, /memories === null \?/);
  assert.match(src, /upcoming\.status === 'unavailable'/);
  assert.match(src, /suppliers === null \?/);
  assert.match(page(), /counts: refusedAny \? null :/, 'refused membership reads must not be counted');
});

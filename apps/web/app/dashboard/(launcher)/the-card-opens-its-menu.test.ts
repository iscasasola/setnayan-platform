/**
 * 📋 THE EVENT CARD'S TAP MENU IS THE DRAWING (owner-approved 25 Nov 2026, final-check brief Add 40; drawing
 * `build-sessions/final-check/drawings/event-card-menu.html` on `final-check/brief`). Holds:
 *   1 · the rows and their order: Open Dashboard · Open your Event Hub · Open Chat · Open your Memories · Publish Story
 *       · Delete Event (last, under a divider, in the danger colour); Open Dashboard is the one filled row;
 *   2 · Open your Event Hub opens the hub ITSELF (`/{slug}`), in the app's own view so the session rides along — never
 *       the Maker, never `openEventHub` — with no Public/Unlisted gate for the people who run the event; no address
 *       yet draws the row disabled with "Set up your Event Hub first";
 *   3 · who sees what: invited none; helper Dashboard · Hub · Chat, Memories only with Photos (the Memories page's own
 *       rule), no Story, no Delete; Publish Story waits for the app's story gate and says when it opens;
 *   4 · Delete is the SHIPPED flow inside the same menu — one body, the same server actions, put-away first;
 *   5 · no new server action, and the phone uses the house Sheet over one scrim on the computer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { routes } from '@/lib/routes';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const MENU = read('_components', 'event-card-menu.tsx');
const PAGE = read('..', '..', '(hub)', 'dashboard', 'page.tsx');
const ROWS = MENU.slice(MENU.indexOf('function CardMenuRows'));
const FRAME = MENU.slice(MENU.indexOf('function CardMenuFrame'), MENU.indexOf('function CardMenuRows'));

test('1 · six rows in the drawing’s order; Dashboard is the one filled row; Delete is last, under a divider', () => {
  const order = ['dashboard', 'hub', 'chat', 'memories', 'story', 'delete'].map((m) => {
    const at = ROWS.search(new RegExp(`mark: '${m}'|data-ecm-row="${m}"`));
    assert.ok(at > 0, `the ${m} row is missing`);
    return at;
  });
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the rows are out of the drawing’s order');
  for (const label of ['Open Dashboard', 'Open your Event Hub', 'Open Chat', 'Open your Memories', 'Publish Story', 'Delete Event']) {
    assert.ok(ROWS.includes(`'${label}'`) || ROWS.includes(`>${label}<`), `the row “${label}” lost its words`);
  }
  assert.equal((ROWS.match(/main: true/g) ?? []).length, 1, 'there must be exactly one filled row');
  assert.match(ROWS, /label: 'Open Dashboard'[^}]*main: true/, 'Open Dashboard must be the filled row');
  const del = ROWS.indexOf('data-ecm-row="delete"');
  assert.ok(ROWS.lastIndexOf('className={ecm.divider}', del) > ROWS.indexOf("mark: 'story'"), 'Delete must sit under a divider');
  assert.match(ROWS, /className=\{`\$\{ecm\.row\} \$\{ecm\.danger\}`\}[\s\S]{0,120}data-ecm-row="delete"/, 'Delete must wear the danger colour');
});

test('2 · Open your Event Hub is the hub itself, in the app’s view, for every organiser and helper', () => {
  assert.doesNotMatch(ROWS, /openEventHub|target="_blank"|\/launch|maker/i, 'the hub row must not leave the app’s view or open the Maker');
  assert.match(ROWS, /href: menu\.hubHref,[\s\S]{0,200}'Set up your Event Hub first\.'/, 'no address must say why');
  assert.match(ROWS, /props\.href && !props\.locked \? \(\s*<Link/, 'an open row must be an in-app link');
  assert.match(PAGE, /hubHref: e\.slug \? publicEventPath\(e\.slug\) : null/, 'the hub row must not be gated on Public/Unlisted');
});

test('3 · who sees what: helper without Photos gets no Memories; Story waits for the story gate; Delete is the organiser’s', () => {
  const fn = PAGE.slice(PAGE.indexOf('const cardMenu = '), PAGE.indexOf('const toCard = '));
  assert.match(fn, /memoriesKeptFromViewer\(/, 'Memories must follow the Memories page’s own rule');
  assert.match(fn, /permissionsWithinWindow\(/, 'a helper’s grant ends with their access window');
  assert.match(fn, /story: organiser\s*\?/, 'only an organiser publishes the Story');
  assert.match(fn, /storyGate\(\{/, 'Publish Story must wait for the app’s story gate');
  assert.match(fn, /canDelete: organiser/, 'only an organiser may delete');
  assert.match(ROWS, /menu\.memoriesHref\s*\?/, 'the Memories row must be absent without the grant');
  assert.match(ROWS, /menu\.story\s*\?/, 'the Story row must be absent for a helper');
  assert.match(ROWS, /'Opens the day after your event\.'/);
  assert.match(ROWS, /locked: !menu\.story\.open/, 'a closed Story must be drawn waiting, not as a door');
  assert.match(ROWS, /menu\.canDelete \? \(/, 'Delete must be the organiser’s alone');
  assert.equal(routes.dashboard.story('E', 'publish'), '/dashboard/E/story#publish', 'the Story row must land on the publish step');
  assert.equal(routes.dashboard.memories('E'), '/dashboard/E/memories');
  assert.equal(routes.dashboard.messages.index('E'), '/dashboard/E/messages');
});

test('4 · Delete is the shipped flow inside the same menu: one body, the same actions, put-away first', () => {
  assert.match(MENU, /<RemoveDialog[^>]*>\s*\{deleteBody\}/, 'the dialog must draw the one delete body');
  assert.match(MENU, /deleteBody=\{deleteBody\}/, 'the card menu must draw the same delete body');
  assert.match(FRAME, /<div data-ecm-delete="">\{deleteBody\}<\/div>/, 'the card menu must draw it in place of the rows');
  assert.match(MENU, /trigger !== 'card' \? \(\s*<RemoveDialog/, 'the card menu must not open a second layer for delete');
  assert.match(MENU, /await deleteOwnEvent\(fd\)/, 'Delete must still go through deleteOwnEvent');
  assert.match(MENU, /trigger === 'remove' \|\| trigger === 'card' \? \(\s*<button[\s\S]{0,300}data-remove-put-away=""/, 'Put this away must come first in the card’s delete');
  assert.match(FRAME, /onDelete=\{onDelete\}/);
});

test('5 · no new server action; the phone is the house Sheet; the computer an anchored menu over the one scrim', () => {
  assert.doesNotMatch(MENU, /^'use server'/m);
  assert.match(FRAME, /<Sheet open=\{open\}/, 'the phone must use the house Sheet');
  assert.match(FRAME, /<OverlayBackdrop onClose=\{onClose\}/, 'the computer menu must sit over the one scrim');
  assert.match(FRAME, /onContextMenu=/, 'a right-click must open the menu');
  assert.match(FRAME, /HOLD_MS/, 'a long-press must open the menu, at the house hold time');
  assert.match(FRAME, /e\.key === 'Escape'/, 'Esc must close the computer menu');
  assert.match(FRAME, /hitRef\.current\?\.focus\(\)/, 'focus must return to the card on close');
});

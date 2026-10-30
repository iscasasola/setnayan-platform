/**
 * 🪪 THE NAME IN GUESTS IS THE FULL NAME, WITH THE NICKNAME BESIDE IT (owner, Guests prototype v24–v26, 2026-10-29:
 * "the FULL name (name_prefix + first + last, from the shipped name helper) with the nickname (`guests.display_name`, no
 * new column) beside it in muted quotes; search matches the nickname too … wrap to 3 lines, never ellipsize").
 *
 * The PROPERTIES:
 *   1. `guestNameWithNick` — the full name (title · parts), the nickname only when it says something the full name does
 *      not; a row with no name parts keeps its compact name and no nickname; an unnamed +1 seat reads "+1 · TBA".
 *   2. `<GuestNick>` draws the nickname muted, in quotes, never cut; nothing when there is none.
 *   3. Every Guests surface that names a person reads it: the List row, the guest card's head (page and panel), and a
 *      March chip in Guests (not the Maker's march, not a print — `EntouragePerson.nick` is ignored there).
 *   4. Search already matches the nickname (`guestMatchesSearch` reads `display_name`).
 *
 * SABOTAGE (each seen RED, then restored): the row back on `guestNameAsGiven` · `<GuestNick>` dropped from the card
 * head · the March chip's `<GuestNick>` dropped · `guestNickBeside` without the "already says it" check.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { guestNameWithNick, guestNickBeside, guestPrintName } from '@/lib/guests';
import { guestMatchesSearch } from '@/lib/guest-search';
import { GuestNick } from '@/app/_components/guest-nick';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const RAMON = {
  display_name: 'Monching',
  name_prefix: 'Atty.',
  first_name: 'Ramon',
  middle_name: null,
  last_name: 'Dela Cruz',
  name_suffix: null,
};

test('1 · the full name, with the nickname beside it only when it adds something', () => {
  assert.deepEqual(guestNameWithNick(RAMON), { name: 'Atty. Ramon Dela Cruz', nick: 'Monching' });
  assert.deepEqual(guestNameWithNick({ ...RAMON, display_name: null }), { name: 'Atty. Ramon Dela Cruz', nick: null });
  assert.deepEqual(guestNameWithNick({ ...RAMON, display_name: '  ramon  ' }), { name: 'Atty. Ramon Dela Cruz', nick: null }, 'the nickname repeats the name');
  assert.equal(guestNickBeside({ display_name: 'Jun-Jun' }, null), null);
  // Whole words only: "Dan" is a nickname beside "Daniel Ramos", never "already said" by it.
  assert.equal(guestNickBeside({ display_name: 'Dan' }, 'Daniel Ramos'), 'Dan');
  assert.equal(guestNickBeside({ display_name: 'dela cruz' }, 'Atty. Ramon Dela Cruz'), null);
  assert.equal(guestNickBeside({ display_name: 'Boss (Rey)' }, 'Rey Santos'), 'Boss (Rey)');
  // A row with no parts: "Shown as" IS the name, not a nickname beside nothing.
  assert.deepEqual(
    guestNameWithNick({ display_name: 'Tito Boy & Tita Cora', first_name: '', last_name: '' }),
    { name: 'Tito Boy & Tita Cora', nick: null },
  );
  // An unnamed +1 seat reads as the list reads it.
  assert.equal(guestNameWithNick({ display_name: null, first_name: 'TBA', last_name: '+1' }).nick, null);
  // The printouts and Guests agree: one rule.
  assert.equal(guestPrintName({ ...RAMON }), 'Atty. Ramon Dela Cruz “Monching”');
});

test('2 · <GuestNick> is muted, in quotes, never cut — and nothing without a nickname', () => {
  const html = renderToStaticMarkup(React.createElement(GuestNick, { nick: 'Boss Rey' }));
  assert.match(html, /data-guest-nick=""[^>]*>“Boss Rey”<\/span>/);
  assert.match(html, /text-ink\/55/);
  assert.doesNotMatch(html, /truncate|ellipsis|line-clamp-1/);
  assert.equal(renderToStaticMarkup(React.createElement(GuestNick, { nick: null })), '');
});

test('3 · the List row, the guest card head and the March chip in Guests draw the full name + nickname', () => {
  const screen = src('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /const named = plusWords\?\.name \? null : guestNameWithNick\(g\);/, 'the List row does not read the full name + nickname');
  assert.match(screen, /\{name\}\s*<GuestNick nick=\{nick\} \/>/, 'the List row does not draw the nickname beside the name');

  const body = src('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx');
  assert.match(body, /export function guestCardTitle[\s\S]{0,260}guestNameWithNick\(guest\)\.name/, 'the card title is not the full name');
  assert.match(body, /\{guestCardTitle\(guest, data\.plusOneOf\)\}<GuestNick nick=\{guestCardNick\(guest, data\.plusOneOf\)\} \/><\/h1>/);
  const card = src('app/dashboard/[eventId]/guests/_components/guest-card.tsx');
  assert.match(card, /\{title\}\s*<GuestNick nick=\{guestCardNick\(guest, data\.plusOneOf\)\} \/>/, 'the card panel head drops the nickname');

  const march = src('app/dashboard/[eventId]/launch/_components/details-march.tsx');
  assert.match(march, /\{p\.name\}\s*\{guests \? <GuestNick nick=\{p\.nick\} \/> : null\}/, 'a March chip in Guests drops the nickname');
  assert.match(src('lib/march-sections.ts'), /\.\.\.\(p\.nick \? \{ nick: p\.nick \} : \{\}\)/, 'the march sections drop the nickname');
  assert.match(src('lib/entourage.ts'), /guestNickBeside\(row, name\)/, 'the entourage people carry no nickname');
});

test('4 · search finds a guest by their nickname', () => {
  assert.equal(guestMatchesSearch('monch', { ...RAMON, role: 'guest', side: 'bride', group_category: 'friends', rsvp_status: 'attending', custom_tags: [] } as never), true);
});

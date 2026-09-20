/**
 * THE VENUE OPENS AFTER THE REPLY — owner ruling, 2026-09-20.
 *
 * The rule is executed here, not described. The source checks at the bottom
 * exist because two of the three ways this leaks are not in the rule at all:
 * a render branch that never asks, and a directions row that falls back to
 * searching for the venue BY NAME.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  VENUE_WITHHELD_LINE,
  eventDayHasArrived,
  hasReplied,
  venueIsOpen,
  withheldVenue,
} from './venue-disclosure';

const EVENT: {
  venue_name: string;
  venue_address: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
  venue_withheld?: boolean;
} = {
  venue_name: 'The venue',
  venue_address: '12 Real Street, Manila',
  venue_latitude: 14.6,
  venue_longitude: 120.98,
};
const FAR_OFF = new Date('2026-09-20T12:00:00+08:00');

test('a guest who has not answered does not get the address', () => {
  assert.equal(venueIsOpen({ rsvpStatus: 'pending', eventDate: '2026-12-18', now: FAR_OFF }), false);
  assert.equal(venueIsOpen({ rsvpStatus: null, eventDate: '2026-12-18', now: FAR_OFF }), false);
  assert.equal(venueIsOpen({ eventDate: '2026-12-18', now: FAR_OFF }), false, 'a stranger, who has no reply at all');
});

test('any real answer opens it — including a decline', () => {
  for (const status of ['attending', 'declined', 'maybe'] as const) {
    assert.equal(venueIsOpen({ rsvpStatus: status, eventDate: '2026-12-18', now: FAR_OFF }), true, status);
  }
  assert.equal(hasReplied('pending'), false);
  assert.equal(hasReplied(null), false);
});

test('a host always sees it', () => {
  assert.equal(venueIsOpen({ isHost: true, rsvpStatus: 'pending', eventDate: '2026-12-18', now: FAR_OFF }), true);
});

test('NOBODY IS LOCKED OUT ON THE DAY, replied or not', () => {
  const morning = new Date('2026-12-18T07:00:00+08:00');
  assert.equal(venueIsOpen({ rsvpStatus: 'pending', eventDate: '2026-12-18', now: morning }), true);
  const dayBefore = new Date('2026-12-17T23:00:00+08:00');
  assert.equal(venueIsOpen({ rsvpStatus: 'pending', eventDate: '2026-12-18', now: dayBefore }), false);
  const after = new Date('2026-12-25T10:00:00+08:00');
  assert.equal(venueIsOpen({ rsvpStatus: 'pending', eventDate: '2026-12-18', now: after }), true);
  assert.equal(eventDayHasArrived(null, morning), false, 'no date = nothing to compare');
  assert.equal(eventDayHasArrived('not-a-date', morning), false);
});

test('withholding closes the address AND both coordinates, and says so', () => {
  const closed = withheldVenue(EVENT);
  assert.equal(closed.venue_address, null);
  assert.equal(closed.venue_latitude, null);
  assert.equal(closed.venue_longitude, null);
  assert.equal(closed.venue_withheld, true);
  assert.equal(closed.venue_name, 'The venue', 'the NAME stays — an invitation must still say where it is');
  assert.equal(EVENT.venue_address, '12 Real Street, Manila', 'never mutates the row the host may still need');
});

test('the invitation page withholds by DEFAULT and opens in exactly one place', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', 'page.tsx'), 'utf8');
  assert.match(src, /event: withheldVenue\(event\)/, 'the shared props carry the closed row');
  const opens = src.match(/event=\{venueOpen \? event : withheldVenue\(event\)\}/g) ?? [];
  assert.equal(opens.length, 1, `exactly one branch opens the venue (found ${opens.length})`);
  assert.match(src, /venueIsOpen\(\{[\s\S]{0,160}rsvpStatus: guest\.rsvp_status/, 'and it opens on the guest’s own reply');
});

test('the widget drops the directions row when withheld — it searches BY NAME otherwise', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', '_components', 'venue-widget.tsx'), 'utf8');
  const branch = src.slice(src.indexOf('event.venue_withheld'));
  assert.ok(branch.length > 0, 'precondition: the widget asks whether the venue is withheld');
  const withheldArm = branch.slice(0, branch.indexOf(') : ('));
  assert.doesNotMatch(withheldArm, /NavLinksRow/, 'no directions row on the withheld arm');
  assert.match(branch, /VENUE_WITHHELD_LINE/, 'the gap explains itself');
  assert.match(VENUE_WITHHELD_LINE, /repl(y|ied)/i, 'and the line says what opens it');
});

test('the day-of hub asks the same rule, and its address branch cannot bypass it', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', 'hub', 'page.tsx'), 'utf8');
  assert.match(src, /import \{ venueIsOpen \}/, 'one rule, imported — never a second copy');
  const line = src.match(/const hasDirections =.*/)?.[0] ?? '';
  assert.match(line, /venueOpen && \(/, `the gate wraps BOTH branches, not just the pin: ${line}`);
});

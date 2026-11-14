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
import { stripComments } from '@/lib/strip-comments';
import { join } from 'node:path';
import {
  VENUE_WITHHELD_LINE,
  eventDayHasArrived,
  hasReplied,
  venueForViewer,
  venueIsOpen,
  withheldVenue,
} from './venue-disclosure';
import type { EventVenue } from './event-venues';

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
const TZ = 'Asia/Manila';

test('a guest who has not answered does not get the address', () => {
  assert.equal(venueIsOpen({ rsvpStatus: 'pending', eventDate: '2026-12-18', now: FAR_OFF, timeZone: TZ }), false);
  assert.equal(venueIsOpen({ rsvpStatus: null, eventDate: '2026-12-18', now: FAR_OFF, timeZone: TZ }), false);
  assert.equal(venueIsOpen({ eventDate: '2026-12-18', now: FAR_OFF, timeZone: TZ }), false, 'a stranger, who has no reply at all');
});

test('any real answer opens it — including a decline', () => {
  for (const status of ['attending', 'declined', 'maybe'] as const) {
    assert.equal(venueIsOpen({ rsvpStatus: status, eventDate: '2026-12-18', now: FAR_OFF, timeZone: TZ }), true, status);
  }
  assert.equal(hasReplied('pending'), false);
  assert.equal(hasReplied(null), false);
});

test('a host always sees it', () => {
  assert.equal(venueIsOpen({ isHost: true, rsvpStatus: 'pending', eventDate: '2026-12-18', now: FAR_OFF, timeZone: TZ }), true);
});

test('the day is the VENUE’s day, not the server’s — CI caught this on a UTC runner', () => {
  // 07:00 in Manila on the wedding day is still 17 December in UTC. Reading the
  // server's calendar opened the address eight hours late, during the ceremony.
  const manilaMorning = new Date('2026-12-18T07:00:00+08:00');
  assert.equal(eventDayHasArrived('2026-12-18', manilaMorning, 'Asia/Manila'), true);
  assert.equal(eventDayHasArrived('2026-12-18', manilaMorning, 'UTC'), false, 'the bug, stated');
  assert.equal(
    venueIsOpen({ rsvpStatus: 'pending', eventDate: '2026-12-18', now: manilaMorning, timeZone: 'Asia/Manila' }),
    true,
  );
  // A wedding in another zone uses ITS zone.
  const nyMorning = new Date('2026-12-18T08:00:00-05:00');
  assert.equal(eventDayHasArrived('2026-12-18', nyMorning, 'America/New_York'), true);
  assert.equal(eventDayHasArrived('2026-12-19', nyMorning, 'America/New_York'), false);
  // A nonsense zone falls back to Manila rather than throwing at a guest.
  assert.equal(eventDayHasArrived('2026-12-18', manilaMorning, 'Not/AZone'), true);
});

test('NOBODY IS LOCKED OUT ON THE DAY, replied or not', () => {
  const tz = 'Asia/Manila';
  const morning = new Date('2026-12-18T07:00:00+08:00');
  assert.equal(venueIsOpen({ rsvpStatus: 'pending', eventDate: '2026-12-18', now: morning, timeZone: tz }), true);
  const dayBefore = new Date('2026-12-17T23:00:00+08:00');
  assert.equal(venueIsOpen({ rsvpStatus: 'pending', eventDate: '2026-12-18', now: dayBefore, timeZone: tz }), false);
  const after = new Date('2026-12-25T10:00:00+08:00');
  assert.equal(venueIsOpen({ rsvpStatus: 'pending', eventDate: '2026-12-18', now: after, timeZone: tz }), true);
  assert.equal(eventDayHasArrived(null, morning, tz), false, 'no date = nothing to compare');
  assert.equal(eventDayHasArrived('not-a-date', morning, tz), false);
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

test('the invitation page withholds by DEFAULT, opens for the HOST and on a guest’s reply, and nowhere else', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', 'page.tsx'), 'utf8');
  // 🏛💒 Since 2026-09-27 the row handed to SiteBody is `venuedEvent` — the event
  // WITH its ceremony + reception venues (lib/event-venues.ts). `venuedEvent` may
  // appear NOWHERE ungated, or an un-withheld copy of both addresses could reach a
  // render without passing the gate.
  // 🏠 UPDATED 2026-11-14 (map card re-walk): the shared props no longer close the row for EVERY viewer — they go
  // through `venueForViewer` with the host's own server-verified capability, because the host's own hub was telling
  // the host "The address and directions open as soon as you reply." The claim this guard holds is unchanged for
  // everyone else: no host → the closed row; a See as sample → the closed row; a guest → only on their reply.
  assert.match(
    src,
    /event: venueForViewer\(venuedEvent, \{ isHost: hostSeesOwnVenue \}\)/,
    'the shared props carry the row closed unless the viewer is the host',
  );
  assert.match(
    src,
    /const hostSeesOwnVenue = Boolean\(ownerCapability\) && !isEditorCanvas && search\.as === undefined;/,
    'the host is the page’s own verified capability, never the Maker canvas or a See as sample',
  );
  assert.match(src, /sampleViewer: seeAs,\s*(?:\/\/[^\n]*\n\s*)*event: withheldVenue\(venuedEvent\),/, 'a See as sample is drawn as a guest: closed');
  const opens = src.match(/event=\{venueOpen \? venuedEvent : withheldVenue\(venuedEvent\)\}/g) ?? [];
  assert.equal(opens.length, 1, `exactly one guest branch opens the venue (found ${opens.length})`);
  const code = stripComments(src);
  const uses = code.match(/\bvenuedEvent\b/g) ?? [];
  assert.equal(uses.length, 5, `venuedEvent: 1 definition + 4 gated uses, found ${uses.length}`);
  assert.match(src, /venueIsOpen\(\{[\s\S]{0,260}rsvpStatus: guest\.rsvp_status/, 'and it opens on the guest’s own reply');
  assert.match(src, /isHost: hostSeesOwnVenue && passStandingNow\.standing !== 'host_preview'/, 'a host who opened a guest’s pass sees that guest’s view');
});

test('the host sees the address, the map and Get directions; an unreplied guest still sees none of it (2026-11-14)', () => {
  const venues: EventVenue[] = [
    { role: 'ceremony', name: 'San Agustin Church', address: 'General Luna St, Intramuros', latitude: 14.589, longitude: 120.975 },
  ];
  const VENUED = { ...EVENT, venues };
  // The host — whatever their own RSVP and however far off the day.
  const host = venueForViewer(VENUED, { isHost: true });
  assert.equal(host.venue_address, '12 Real Street, Manila');
  assert.equal(host.venue_latitude, 14.6);
  assert.equal(host.venue_withheld, undefined, 'no "opens as soon as you reply" line for the host');
  assert.equal(host.venues[0]!.address, 'General Luna St, Intramuros');
  assert.equal(host.venues[0]!.latitude, 14.589, 'the pin that draws the map and Get directions');
  // The shared props' default viewer (not the host) and an unreplied guest: closed, exactly as before.
  for (const viewer of [
    { isHost: false },
    { rsvpStatus: 'pending' as const, eventDate: '2026-12-18', now: FAR_OFF, timeZone: TZ },
  ]) {
    const guest = venueForViewer(VENUED, viewer);
    assert.equal(guest.venue_address, null);
    assert.equal(guest.venue_latitude, null);
    assert.equal(guest.venue_longitude, null);
    assert.equal(guest.venue_withheld, true, 'the withheld line speaks for the gap — and the widget then draws no Get directions');
    assert.equal(guest.venues[0]!.address, null);
    assert.equal(guest.venues[0]!.latitude, null);
    assert.equal(guest.venues[0]!.longitude, null);
  }
});

test('the widget drops the directions row when withheld — it searches BY NAME otherwise', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', '_components', 'venue-widget.tsx'), 'utf8');
  // 🏛💒 Since 2026-09-27 each venue (ceremony · reception) is its own plate, and
  // the withheld line is said ONCE under them. So: every directions control (the
  // `DirectionsMenu` dropdown since 2026-10-21; `NavLinksRow`'s chips before) must sit
  // on the OPEN arm of a `venue_withheld ? null :` ternary, and the line must
  // be on the withheld arm of its own.
  const rows = [...src.matchAll(/<(?:NavLinksRow|DirectionsMenu)(?![A-Za-z0-9_])/g)].map((m) => m.index ?? 0);
  assert.ok(rows.length >= 1, 'precondition: the widget draws directions');
  for (const at of rows) {
    const before = src.slice(Math.max(0, at - 80), at);
    assert.match(before, /event\.venue_withheld \? null : \(?\s*$/, 'a directions row outside the open arm');
  }
  const line = src.slice(src.indexOf('{event.venue_withheld ? ('));
  assert.match(line.slice(0, line.indexOf(') : null')), /VENUE_WITHHELD_LINE/, 'the gap explains itself');
  assert.match(VENUE_WITHHELD_LINE, /repl(y|ied)/i, 'and the line says what opens it');
});

test('every caller passes the VENUE’s timezone — forgetting it IS the bug', () => {
  for (const rel of [['app', '[slug]', 'page.tsx'], ['app', '[slug]', 'hub', 'page.tsx']]) {
    const src = readFileSync(join(__dirname, '..', ...rel), 'utf8');
    const call = src.slice(src.indexOf('venueIsOpen({'));
    const head = call.slice(0, call.indexOf('});') + 3);
    assert.match(head, /timeZone:/, `${rel.join('/')} passes a timezone`);
  }
});

test('the day-of hub asks the same rule, and its address branch cannot bypass it', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '[slug]', 'hub', 'page.tsx'), 'utf8');
  assert.match(src, /import \{ venueIsOpen \}/, 'one rule, imported — never a second copy');
  const line = src.match(/const hasDirections =.*/)?.[0] ?? '';
  assert.match(line, /venueOpen && \(/, `the gate wraps BOTH branches, not just the pin: ${line}`);
});

// ── A withheld venue never says "to be confirmed" (owner 2026-09-26, cale-ice) ──
import { readFileSync as __readVenueWidget } from 'node:fs';
import { join as __joinVenue } from 'node:path';
test('a withheld venue never renders "Venue to be confirmed" — the withheld line speaks instead', () => {
  const src = __readVenueWidget(__joinVenue(__dirname, '..', 'app', '[slug]', '_components', 'venue-widget.tsx'), 'utf8');
  assert.match(
    src,
    /hasCoords \|\| event\.venue_withheld \? null : \(/,
    'the "to be confirmed" heading must step aside when the venue is withheld (withheldVenue clears the pin)',
  );
});

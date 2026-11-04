/**
 * a-crew-is-flagged-across-events.test.ts — 🚗 event chapters slice 5, ONE CREW, TWO EVENTS (owner 2026-11-04).
 *
 *   1 · the same crew NAME (same shop) on two same-day events is flagged when the times overlap;
 *   2 · …and when the gap is shorter than the drive between the two venue pins at the owner's speed;
 *   3 · no speed set (or a pin missing) = no drive is estimated — only overlaps are flagged (no default: rule 9);
 *   4 · a different crew, a crew with no name, the same venue, or enough time are never flagged;
 *   5 · the wiring: the supplier page reads it, the supplier schedule says it (and says when it couldn't check), the
 *       host's side never imports it, and the admin speed field cannot clear a value it never read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { stripComments } from '@/lib/strip-comments';
import { crewElsewhere, driveMinutes, type CrewStint } from '@/lib/crew-elsewhere';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));

// Makati and Tagaytay — about 45 km apart as the crow flies.
const MAKATI = { lat: 14.5547, lon: 121.0244 };
const TAGAYTAY = { lat: 14.1153, lon: 120.9621 };
const at = (hhmm: string) => `2099-12-18T${hhmm}:00.000Z`;
const stint = (o: Partial<CrewStint>): CrewStint => ({
  eventId: 'here',
  blockId: 'm-here',
  crew: 'Team A',
  startIso: at('13:00'),
  endIso: at('15:00'),
  pin: MAKATI,
  eventName: 'This event',
  ...o,
});

test('1 · the same crew on two events at once is flagged', () => {
  const found = crewElsewhere([stint({})], [stint({ eventId: 'there', blockId: 'm-there', crew: ' team a ', startIso: at('14:00'), endIso: at('16:00'), eventName: 'Ana & Ben' })], null);
  const [c] = found.get('m-here') ?? [];
  assert.equal(c?.kind, 'overlap');
  assert.equal(c?.words, 'Team A is also at Ana & Ben at 2:00 PM. The times overlap.');
});

test('2 · too little time for the drive is flagged, at the owner’s speed', () => {
  const there = stint({ eventId: 'there', blockId: 'm-there', startIso: at('16:00'), endIso: at('18:00'), pin: TAGAYTAY, eventName: 'Ana & Ben' });
  const drive = driveMinutes(MAKATI, TAGAYTAY, 30);
  assert.equal(drive, 100, 'about 50 km at 30 km/h, rounded up to 5 minutes');
  const [c] = crewElsewhere([stint({})], [there], 30).get('m-here') ?? [];
  assert.equal(c?.kind, 'drive');
  assert.equal(c?.words, 'Team A is due at Ana & Ben at 4:00 PM, 1 h after this. The drive there is about 1 h 40 min.');
  // The other way round: they come FROM there.
  const before = stint({ eventId: 'there', blockId: 'm-there', startIso: at('09:00'), endIso: at('12:00'), pin: TAGAYTAY, eventName: 'Ana & Ben' });
  const [b] = crewElsewhere([stint({})], [before], 30).get('m-here') ?? [];
  assert.equal(b?.words, 'Team A is at Ana & Ben until 12:00 PM, 1 h before this. The drive from there is about 1 h 40 min.');
});

test('3 · no speed, or no pin, estimates no drive — only overlaps are flagged', () => {
  const there = stint({ eventId: 'there', blockId: 'm-there', startIso: at('16:00'), endIso: at('18:00'), pin: TAGAYTAY });
  assert.equal(crewElsewhere([stint({})], [there], null).size, 0, 'a drive was estimated with no speed set');
  assert.equal(crewElsewhere([stint({ pin: null })], [there], 30).size, 0, 'a drive was estimated with no pin');
  assert.equal(driveMinutes(MAKATI, null, 30), null);
});

test('4 · never flagged: another crew, a blank crew, the same venue, or time to spare', () => {
  const close = { eventId: 'there', blockId: 'm-there', startIso: at('15:30'), endIso: at('17:00') } as const;
  assert.equal(crewElsewhere([stint({})], [stint({ ...close, crew: 'Team B', pin: TAGAYTAY })], 30).size, 0, 'another crew was flagged');
  assert.equal(crewElsewhere([stint({ crew: ' ' })], [stint({ ...close, crew: ' ', pin: TAGAYTAY })], 30).size, 0, 'a blank crew was flagged');
  assert.equal(crewElsewhere([stint({})], [stint({ ...close, pin: MAKATI })], 30).size, 0, 'the same venue needs no drive');
  assert.equal(crewElsewhere([stint({})], [stint({ ...close, startIso: at('19:00'), endIso: at('20:00'), pin: TAGAYTAY })], 30).size, 0, 'four hours is enough');
  assert.equal(crewElsewhere([stint({})], [stint({ ...close, eventId: 'here', startIso: at('14:00') })], 30).size, 0, 'the same event is not "another event"');
});

test('5 · the wiring', () => {
  const page = code('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.match(page, /await readCrewElsewhere\(\{/, 'the supplier page does not read the other events');
  assert.match(page, /const crewElsewhere = myTasksRes\.error \|\| factsEvent\.error\s*\?\s*null/, 'an unread crew list reads as "no clash"');
  assert.match(page, /elsewhere: crewElsewhere,/);

  const view = code('app/vendor-dashboard/clients/[eventId]/_components/supplier-schedule.tsx');
  assert.match(view, /elsewhere === null \? \(\s*<p data-crew-elsewhere="unread"/, 'a failed check is drawn as clear');
  assert.match(view, /clashes=\{elsewhere\?\.\[m\.block_id\] \?\? \[\]\}/, 'a moment does not carry its clashes');
  assert.match(view, /data-crew-clash=\{c\.kind\}/);

  const reader = code('lib/crew-elsewhere.server.ts');
  assert.match(reader, /\.eq\('marketplace_vendor_id', vendorProfileId\)/, 'the other events are not this shop’s');
  assert.match(reader, /\.in\('vendor_id', myBookingIds\)/, 'another supplier’s crew is read');
  assert.match(reader, /blocksWithAClock\(/, 'a Time-TBA chapter’s midnight is read as a time');
  assert.match(reader, /fetchDriveSpeed\(admin\)/, 'the speed comes from somewhere other than the owner’s setting');
  assert.doesNotMatch(reader, /\?\? \d+|kmh: \d+|speed = \d+/, 'a speed is defaulted in code');

  // 🔒 The host never sees a supplier's other client: nothing under the host's dashboard imports it.
  const hostHits = spawnSync('git', ['grep', '-l', 'crew-elsewhere', '--', 'app/dashboard', 'app/[[]slug]'], { cwd: WEB, encoding: 'utf8' }).stdout.trim();
  assert.equal(hostHits, '', `the host side reads a supplier's other events: ${hostHits}`);

  const surface = code('app/admin/settings/_surfaces/settings-surface.tsx');
  assert.match(surface, /name="drive_speed_kmh"[\s\S]{0,200}disabled=\{!driveSpeed\.read\}/, 'an unread speed can be saved over');
  const actions = code('app/admin/settings/actions.ts');
  assert.match(actions, /if \(formData\.has\('drive_speed_kmh'\)\) \{/, 'a locked field clears the speed on save');
});

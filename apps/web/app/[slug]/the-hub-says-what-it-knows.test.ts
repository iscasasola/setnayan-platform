/**
 * THE HUB SAYS WHAT IT KNOWS (final check, area 4, fixer batch 4 · 25 Nov 2026).
 *
 * Event Hub readers and offline words. Each claim is one finding in `build-sessions/final-check/area-4.md`.
 *
 * Red if:
 *   offline.html promises every opened page is kept ................................ A4-01
 *   the day-of banner promises the QR and venue info work offline ................ A4-23
 *   the supplier desk calls an unread running order "not written yet" ............. A4-22
 *   "Also coming" lists someone who does not count toward the event ............... A4-30
 *   /find-my-table draws its own entrance instead of the one reader ................ A4-33
 *   /find-seat's door says "Confirm your Booking" ................................. A4-35
 *   a seat page reads event_tables itself instead of the one seat-plan reader ...... A4-34
 *   the alerts ask vanishes silently when the subscribe failed .................... A4-52 (half)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { guestsWhoSaidYes } from '@/lib/entourage';

const WEB = join(__dirname, '..', '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(raw(rel));

test('A4-01 · offline.html promises only what the phone keeps', () => {
  const html = raw('public/offline.html');
  assert.doesNotMatch(html, /Any pages and event details you've\s+already opened are still available/);
  assert.match(html, /Find my table open without signal/);
});

test('A4-23 · the day-of banner does not promise the QR works offline', () => {
  const src = code('app/[slug]/_components/day-of-banner.tsx');
  assert.doesNotMatch(src, /they work offline if WiFi cuts out/);
  assert.doesNotMatch(src, /Your schedule, QR, and venue info/);
});

test('A4-22 · the supplier desk says an unread running order could not be read', () => {
  assert.match(code('app/[slug]/_lib/supplier-desk.server.ts'), /blocksUnread: blocks === null,/);
  const desk = code('app/[slug]/_components/supplier-desk.tsx');
  assert.ok(desk.indexOf('desk.blocksUnread ?') > -1 && desk.indexOf('desk.blocksUnread ?') < desk.indexOf('never wrote a timeline'), 'the unread branch comes before "never wrote"');
});

test('A4-30 · "Also coming" is a Yes from someone who counts toward the event', () => {
  const rows = [
    { id: 'kept', rsvp_status: 'attending', entry_source: 'host_seeded' },
    { id: 'request', rsvp_status: 'attending', entry_source: 'self_added_unlisted' },
    { id: 'passed', rsvp_status: 'attending', entry_source: 'host_seeded', passed_away: true },
    { id: 'represented', rsvp_status: 'attending', entry_source: 'host_seeded', represented_by_guest_id: 'x' },
    { id: 'pending', rsvp_status: 'pending', entry_source: 'host_seeded' },
  ];
  assert.deepEqual(guestsWhoSaidYes(rows).map((r) => r.id), ['kept']);
  assert.match(code('app/[slug]/everyone/page.tsx'), /rsvp_status, entry_source, passed_away, represented_by_guest_id/);
});

test('A4-33 · /find-my-table draws the door through the one entrance reader', () => {
  const src = code('app/[slug]/find-my-table/page.tsx');
  assert.match(src, /await fetchEntrance\(admin, event\.event_id\)/);
  assert.doesNotMatch(src, /function resolveEntrance\(/);
});

test('A4-35 · /find-seat’s door reads "Open your invitation"', () => {
  const src = code('app/[slug]/find-seat/_components/seat-frame.tsx');
  assert.doesNotMatch(src, /Confirm your Booking/);
  assert.match(src, /Open your invitation/);
});

test('A4-52 · a failed alerts subscribe keeps the ask and says so', () => {
  const src = code('app/[slug]/seat/_components/guest-push-prompt.tsx');
  assert.match(src, /saved = await subscribeAndSave\(\);/);
  assert.match(src, /\} catch \{\s*saved = false;\s*\}/);
  assert.match(src, /if \(saved\) setVisible\(false\);\s*else setFailed\(true\);/);
  assert.match(src, /Alerts didn’t turn on/);
});

test('A4-34 · the three seat pages read tables through lib/seating.ts fetchTables, never their own copy', () => {
  for (const rel of ['app/[slug]/seat/page.tsx', 'app/[slug]/find-seat/page.tsx', 'app/[slug]/find-my-table/page.tsx']) {
    const src = code(rel);
    // A list read of the event's tables (the seat plan) — `/seat`'s one-table lookup by a QR token is not one.
    assert.doesNotMatch(src, /\.from\('event_tables'\)[^;]{0,300}?\.order\(/, `${rel} reads the event's tables in its own order`);
    assert.doesNotMatch(src, /async function fetchTables\(/, `${rel} shadows the shared reader`);
    assert.match(src, /fetchTables\(admin, (?:event\.event_id|eventId)\)/, `${rel} does not use the shared reader`);
  }
});

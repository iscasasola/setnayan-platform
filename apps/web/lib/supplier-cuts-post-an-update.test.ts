/**
 * supplier-cuts-post-an-update.test.ts — 📣 CUT 6, "POST AN UPDATE" (owner-approved 2026-11-14 — DECISION_LOG "THE SEVEN
 * SUPPLIER CUTS ARE APPROVED"; prototype `prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html` § 6).
 *
 *   (1) one post is one row: a status keeps its KIND from the server catalogue whatever note rides with it, and the
 *       note (when there is one) is the body;
 *   (2) the button sits on TOP of every booked event's page, every day — not only on the day, under the tools;
 *   (3) the couple reads the vendor lane on their day, through their OWN session, and a refused read is not "none yet";
 *   (4) the sheet says who reads a post, and "Need help" stays work for the coordinator.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { buildVendorStatusDraft, supplierUpdatesForCouple, updateTimeLabel, VENDOR_STATUS_PRESETS, type DayRequestRow } from './day-requests';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('(1) a status with a note is one row: the note is the body, the kind stays the catalogue’s', () => {
  const help = buildVendorStatusDraft('need_help', '  The cake is   melting near the lights  ');
  assert.ok(help);
  assert.equal(help.kind, 'issue', 'a note changed Need help into something the coordinator need not act on');
  assert.equal(help.body, 'The cake is melting near the lights');
  assert.equal(help.preset_key, 'need_help');
  const bare = buildVendorStatusDraft('setup_done', '   ');
  assert.equal(bare?.body, VENDOR_STATUS_PRESETS.find((p) => p.key === 'setup_done')?.body, 'an empty note replaced the status sentence');
  assert.equal(bare?.kind, 'status_update');
  assert.equal(buildVendorStatusDraft('made_up', 'hi'), null, 'a note let an unknown status through');
});

test('(2) Post an update is on top of every booked event’s page, every day', () => {
  const page = read('app/vendor-dashboard/on-the-day/page.tsx');
  const setup = page.slice(page.indexOf('async function setupBody'), page.indexOf('async function readEventTools'));
  const at = setup.indexOf('<VendorStatusUpdates');
  assert.ok(at > 0, 'the button left the event’s page');
  assert.ok(at < setup.indexOf('<ModuleConfigurator'), 'Post an update is no longer on top of the tools');
  assert.ok(at < setup.indexOf('isToday ?'), 'Post an update is drawn only on the day again');
  assert.equal((page.match(/<VendorStatusUpdates/g) ?? []).length, 1, 'two update boxes on one page');
  const comp = read('app/vendor-dashboard/on-the-day/_components/vendor-status-updates.tsx');
  assert.match(comp, />\s*Post an update\s*</);
  assert.match(comp, /submitVendorStatusPreset\(eventId, picked, body \|\| null\)/, 'the note does not ride with the status');
  assert.match(comp, /<Sheet open=\{open\}/, 'the statuses are not in a sheet');
  assert.match(comp, /data-tour="hub-post-update"/);
});

test('(3) the couple reads the vendor lane on their day, through their own session; refused is not empty', () => {
  const home = read('app/dashboard/[eventId]/page.tsx');
  const part = home.slice(home.indexOf('const supplierUpdatesRead'), home.indexOf('const [blocksRes'));
  assert.ok(part.length > 200, 'anti-vacuity: the couple’s read was not found');
  assert.match(part, /supabase\s*\.from\('event_day_requests'\)/, 'the couple’s read left their own session');
  assert.doesNotMatch(part, /createAdminClient|adminClient/, 'the couple’s read uses the service role');
  assert.match(part, /\.eq\('origin', 'vendor'\)/);
  assert.match(part, /if \(rowsRes\.error\) \{[\s\S]*?return null;/, 'a refused read would read as "No updates yet"');
  assert.match(read('app/dashboard/[eventId]/_components/day-of-mode/grid.tsx'), /<SupplierUpdatesCard lines=\{supplierUpdates\} \/>/);
  const card = read('app/dashboard/[eventId]/_components/day-of-mode/supplier-updates-card.tsx');
  assert.match(card, /lines === null \?/);
  assert.match(card, /Couldn’t load/);

  const rows: DayRequestRow[] = [
    { request_id: 'a', origin: 'vendor', kind: 'status_update', status: 'open', body: 'We have arrived on site.', preset_key: 'on_site', author_user_id: 'u', author_vendor_profile_id: 'v1', created_at: '2026-12-12T05:10:00Z' },
    { request_id: 'b', origin: 'vendor', kind: 'issue', status: 'open', body: 'Need a hand with the arch', preset_key: 'need_help', author_user_id: 'u', author_vendor_profile_id: 'v1', created_at: '2026-12-12T07:42:00Z' },
    { request_id: 'c', origin: 'couple', kind: 'request', status: 'open', body: 'our own note', preset_key: null, author_user_id: 'x', author_vendor_profile_id: null, created_at: '2026-12-12T08:00:00Z' },
    { request_id: 'd', origin: 'vendor', kind: 'request', status: 'open', body: 'Free text', preset_key: null, author_user_id: 'u', author_vendor_profile_id: 'v9', created_at: '2026-12-12T06:00:00Z' },
  ];
  const lines = supplierUpdatesForCouple(rows, new Map([['v1', 'Liwanag Florals']]));
  assert.deepEqual(lines.map((l) => l.id), ['b', 'd', 'a'], 'not newest first, or the couple’s own note leaked in');
  assert.deepEqual([lines[0]!.status, lines[0]!.note, lines[0]!.urgent], ['Need help', 'Need a hand with the arch', true]);
  assert.deepEqual([lines[2]!.status, lines[2]!.note, lines[2]!.supplier], ['On site', null, 'Liwanag Florals']);
  assert.equal(lines[1]!.supplier, 'A supplier', 'an unnamed supplier reads blank');
  assert.equal(updateTimeLabel('2026-12-12T07:42:00Z', 'Asia/Manila').replace(/\s/g, ' '), '3:42 PM', 'not the event’s own clock');
});

test('(4) the sheet says who reads it, and the help answer exists', () => {
  const comp = read('app/vendor-dashboard/on-the-day/_components/vendor-status-updates.tsx');
  assert.match(comp, /POST_AN_UPDATE_READERS = 'The couple sees it on their phone on the day\. Need help also goes to their coordinator\.'/);
  const help = read('lib/help/supplier-cuts.ts');
  assert.match(help, /slug: 'post-an-update'/);
  assert.match(help, /slug: 'supplier-updates-on-the-day'/);
});

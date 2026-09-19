/**
 * the-desk-reads-a-guest-tag.test.ts — the check-in desk reads a guest's NFC
 * tag, resolves them by the SAME parser as the QR, and records HOW they were
 * found truthfully.
 *
 * 🛡 Mutation-checked: removing 'nfc_tap' from the migration, re-inferring the
 * method from the camera, and bypassing the shared parser each went red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESK = join(WEB, 'app/dashboard/[eventId]/guests/checkin/_components/checkin-desk.tsx');
const ACTIONS = join(WEB, 'app/dashboard/[eventId]/guests/checkin/actions.ts');
const MIGRATIONS = join(WEB, '..', '..', 'supabase/migrations');

test('the desk mounts the tag reader behind the NFC switch, once', () => {
  const src = readFileSync(DESK, 'utf8');
  assert.equal(src.split('useNfcTagReader(').length - 1, 1, 'one reader');
  assert.match(src, /const nfcDesk = useNfcEnabled\(\)/);
  assert.match(src, /\{nfcDesk && nfc\.supported \? \(/, 'shown only where it can read, and only when on');
  assert.match(src, /Read a guest&rsquo;s tag/);
});

test('a tag is resolved by the same parser the QR camera uses', () => {
  const src = readFileSync(DESK, 'utf8');
  assert.match(src, /guestTokenFromTag\(urls, parseGuestQrPayload\)/);
  assert.match(src, /onToken\(hit\.token, 'nfc_tap'\)/);
});

test('the method comes from HOW the guest was found, never from the camera state', () => {
  const src = readFileSync(DESK, 'utf8');
  assert.match(src, /doCheckIn\(selected\.guestId, selectedVia\)/);
  assert.doesNotMatch(src, /scanning \? 'qr_scan' : 'manual_search'/);
  // Each path that selects a guest sets how: the scanner/tag path and search.
  assert.match(src, /setSelectedVia\(via\)/);
  assert.match(src, /setSelectedVia\('manual_search'\)/);
});

test("the database accepts every method the desk can send", () => {
  const actions = readFileSync(ACTIONS, 'utf8');
  const m = actions.match(/export type CheckinMethod = ([^;]+);/);
  assert.ok(m, 'CheckinMethod is declared');
  const methods = [...(m[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  assert.deepEqual([...methods].sort(), ['manual_search', 'nfc_tap', 'qr_scan']);
  // The LAST migration to define guest_checkins_method_check must list them all.
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  let last: string | null = null;
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    if (/ADD CONSTRAINT guest_checkins_method_check/.test(sql)) last = sql;
  }
  assert.ok(last, 'a migration re-defines the constraint');
  const listed = (last.match(/CHECK \(method IN \(([^)]+)\)\)/)?.[1] ?? '')
    .split(',')
    .map((s) => s.trim().replace(/'/g, ''));
  for (const method of methods) assert.ok(listed.includes(method ?? ''), `${method} missing from the CHECK`);
});

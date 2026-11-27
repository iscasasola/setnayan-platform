/**
 * 🧮 A SUPPLIER'S NUMBERS SAY ONE THING (L6, walk 27 Nov 2026) — the rows of the lane that are not a reader of their own:
 *   S3 · storage: the Shop cover said "1 MB" where the Plans meter said "62 KB" for the same bytes (`storageWords`
 *        rounds up; the meter's `meterWords` says real usage). One set of words now.
 *   A4 · "Handled by": said once, and only with a name (it read "Handled by  Handled by ▾" over nobody).
 *   S10 · "Hosted by": the shop's own owner and team are never listed as the client's hosts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { storageMeter } from './supplier-store';
import { meterWords } from './supplier-storage';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('S3 · the Shop cover and the Plans meter say the same stored bytes the same way', () => {
  for (const bytes of [0, 62_000, 999_999, 1_000_000, 1_250_000_000]) {
    const m = storageMeter('verified', { status: 'ok', bytes });
    assert.equal(m.kind, 'meter');
    assert.equal(m.kind === 'meter' ? m.used : null, meterWords(bytes), `the cover says ${bytes} bytes differently from the meter`);
  }
  const small = storageMeter('verified', { status: 'ok', bytes: 62_000 });
  assert.equal(small.kind === 'meter' ? small.used : null, '62 KB', 'a 62 KB shop reads "1 MB" again');
  assert.deepEqual(storageMeter('verified', { status: 'unread' }), { kind: 'unread' }, 'an unread store is never a size');
});

test('A4 · "Handled by" is said once, and never over nobody', () => {
  const c = read('app/vendor-dashboard/customers/_components/client-handling.tsx');
  assert.match(c, /if \(!view\.handOver && !movingName\) return null;/, 'a row with nobody to name is drawn again');
  assert.match(c, /view\.moveTo && view\.moveTo\.options\.length > 0 && movingName \?/, 'the picker is drawn over nobody again');
  assert.match(c, /buttonText=\{movingName\}/, 'the picker’s button falls back to its own label ("Handled by") again');
  assert.equal([...c.matchAll(/>\s*Handled by\s*</g)].length, 1, '"Handled by" is printed more than once in the row');
  const page = read('app/vendor-dashboard/customers/page.tsx');
  assert.match(page, /if \(!current && !h\?\.handOver\) continue;/, 'a client nobody handles gets a Handled by row again');
});

test('S10 · "Hosted by" never lists the shop’s own people', () => {
  const s = read('lib/supplier-event-lines.server.ts');
  assert.match(s, /input\.shopPeople \? Promise\.resolve\(shopPeopleIdsOf\(input\.shopPeople\)\) : readShopPeopleIds\(admin, me\),/, 'the shop’s people are no longer read beside the hosts');
  assert.match(s, /from\('vendor_profiles'\)\.select\('user_id'\)\.eq\('vendor_profile_id', vendorProfileId\)/);
  assert.match(
    s,
    /from\('vendor_team_members'\)\.select\('user_id, deactivated_at'\)\.eq\('vendor_profile_id', vendorProfileId\)\.is\('deactivated_at', null\)/,
    'a deactivated (former) team member is left out of "Hosted by" again',
  );
  const clients = read('app/vendor-dashboard/customers/page.tsx');
  assert.match(clients, /shopPeople: teamRead \? \{ ownerUserId: profile\.user_id, team: teamRead \} : undefined/, 'Clients reads its own team a second time');
  assert.match(s, /if \(m\.user_id && !isShopPerson\(m\.user_id\)\)/, 'a shop person is listed as a host again');
  assert.match(s, /isShopPerson\(t\?\.created_by_user_id\) \? null/, 'a shop person is marked "Asked you" again');
});

/**
 * "This number is also on another shop" (owner 2026-11-06, DECISION_LOG "A
 * CONTACT NUMBER ON TWO ACCOUNTS — LENIENT NOW, FLAGGED TO ADMIN").
 *
 * The matcher's behaviour, and the three promises the admin page keeps:
 *   1. it renders the flag + a link to the other shop;
 *   2. a refused read says "couldn't check" — never silence (silence reads as unique);
 *   3. READ-ONLY: sign-up is never refused for a shared number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { phoneKey, phoneLookupVariants, shopsSharingPhone, type PhoneShop } from './shared-contact-phone';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

const shop = (id: string, owner: string | null, phone: string | null, name = `Shop ${id}`): PhoneShop => ({
  vendor_profile_id: id,
  user_id: owner,
  business_name: name,
  business_slug: id.toLowerCase(),
  contact_phone: phone,
});

test('every way a Filipino writes one number is the same number', () => {
  const k = phoneKey('+639171234567');
  assert.equal(k, '+639171234567');
  for (const raw of ['09171234567', '0917 123 4567', '639171234567', '+63 917 123 4567', '917-123-4567']) {
    assert.equal(phoneKey(raw), k, raw);
  }
  assert.equal(phoneKey(''), null);
  assert.equal(phoneKey(null), null);
  assert.equal(phoneKey('12'), null, 'too short to be anybody\'s number');
});

test('the database is asked for each stored spelling (an exact in-list, not a scan)', () => {
  const v = phoneLookupVariants('0917 123 4567');
  for (const want of ['0917 123 4567', '+639171234567', '09171234567', '639171234567']) {
    assert.ok(v.includes(want), `missing ${want}: ${v.join(' | ')}`);
  }
  assert.deepEqual(phoneLookupVariants(null), []);
});

test('a DIFFERENT owner\'s shop with the same number is flagged, with its name for the link', () => {
  const reviewed = [shop('A', 'u1', '+639171234567', 'Lens & Light')];
  const candidates = [...reviewed, shop('B', 'u2', '0917 123 4567', 'Mirror Booth Co')];
  assert.deepEqual(shopsSharingPhone(reviewed, candidates), {
    A: [{ vendorProfileId: 'B', businessName: 'Mirror Booth Co', businessSlug: 'b' }],
  });
});

test('one person\'s own shops may share a number — never flagged', () => {
  const reviewed = [shop('A', 'u1', '+639171234567')];
  const candidates = [...reviewed, shop('A2', 'u1', '09171234567')];
  assert.deepEqual(shopsSharingPhone(reviewed, candidates), {});
});

test('the shop never matches itself; no number → no flag; an unknown owner is shown, not assumed the same', () => {
  assert.deepEqual(shopsSharingPhone([shop('A', 'u1', '+639171234567')], [shop('A', 'u1', '+639171234567')]), {});
  assert.deepEqual(shopsSharingPhone([shop('A', 'u1', null)], [shop('B', 'u2', null)]), {});
  const r = shopsSharingPhone([shop('A', 'u1', '+639171234567')], [shop('B', null, '+639171234567')]);
  assert.equal(r.A?.length, 1);
});

test('a different number is not a match', () => {
  const r = shopsSharingPhone([shop('A', 'u1', '+639171234567')], [shop('B', 'u2', '+639171234568')]);
  assert.deepEqual(r, {});
});

test('the admin verification queue shows it, says when it could not check, and never writes', () => {
  const page = stripComments(readFileSync(join(WEB, 'app/admin/verify/page.tsx'), 'utf8'));
  const note = stripComments(readFileSync(join(WEB, 'app/admin/verify/_components/shared-phone-note.tsx'), 'utf8'));
  assert.match(page, /shopsSharingPhone\(/, 'the queue reads the one matcher');
  assert.match(note, /This number is also on \{shops\.length === 1 \? 'another shop'/, 'the words the owner ruled');
  assert.match(note, /href=\{`\/admin\/vendors\/\$\{o\.vendorProfileId\}`\}/, 'a link to the other shop');
  assert.match(page, /<SharedPhoneNote shops=\{application\.vendor\.sharedPhoneShops\} \/>/, 'rendered on the row');
  assert.match(page, /sharedPhoneMap = null/, 'a refused read becomes "could not check"');
  assert.match(note, /Couldn&rsquo;t check this number against other shops/, '…and the card says so');
  const lib = stripComments(readFileSync(join(WEB, 'lib/shared-contact-phone.ts'), 'utf8'));
  assert.doesNotMatch(lib, /\.(insert|update|upsert|delete|rpc)\(/, 'the matcher is read-only');
});

test('sign-up never refuses a shared number (lenient — DECISION_LOG 2026-11-06)', () => {
  for (const rel of ['app/open-shop/actions.ts', 'lib/open-shop-account.server.ts', 'app/vendor-dashboard/actions.ts']) {
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    assert.doesNotMatch(src, /shared-contact-phone|shopsSharingPhone/, `${rel}: the shared-number check is admin-only information, never a sign-up gate`);
  }
});

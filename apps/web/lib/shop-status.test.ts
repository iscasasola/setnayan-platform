/**
 * ⏸ SHOP STATUS — the app's reading of the database door (migration 20271350091032). The rules themselves are held
 * in the database by tests/db/a-shop-can-be-paused-or-closed.db.test.ts; this holds the reader and the refusal words.
 *
 * Fails if: a closed (archived) shop reads as anything but closed · a short select reads as "open" · a refusal from
 * `set_shop_status()` is not read back (or an unknown one is invented) · the action writes the pause columns itself
 * instead of calling the door.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { isShopPaused, parseShopStatusRefusal, shopPausedBy, shopStatusOf } from './shop-status';
import { isShopFindable } from './findable-shop';

const WEB = join(__dirname, '..');

test('shopStatusOf: closed · paused · open, and a short select is not guessed', () => {
  assert.equal(shopStatusOf({ public_visibility: 'archived', paused_at: null }), 'closed');
  assert.equal(shopStatusOf({ public_visibility: 'verified', paused_at: '2026-11-16T00:00:00Z', paused_by: 'admin' }), 'paused');
  assert.equal(shopStatusOf({ public_visibility: 'hidden', paused_at: null }), 'open');
  assert.equal(shopStatusOf({ public_visibility: 'verified' }), null, 'an unread pause read as open');
  assert.equal(shopStatusOf(null), null);
  assert.equal(shopPausedBy({ paused_at: 'x', paused_by: 'admin' }), 'admin');
  assert.equal(shopPausedBy({ paused_at: null, paused_by: null }), null);
  assert.equal(isShopPaused({ paused_at: '2026-11-16T00:00:00Z' }), true);
});

test('a paused verified shop is not findable (the TypeScript twin of is_findable)', () => {
  const live = { public_visibility: 'verified', verification_state: 'verified', papers_current: true };
  assert.equal(isShopFindable({ ...live, paused_at: null }), true);
  assert.equal(isShopFindable({ ...live, paused_at: '2026-11-16T00:00:00Z' }), false);
});

test('parseShopStatusRefusal reads the door back, and invents nothing', () => {
  assert.deepEqual(parseShopStatusRefusal('shop_status:open_bookings:2'), { reason: 'open_bookings', openBookings: 2 });
  assert.deepEqual(parseShopStatusRefusal('ERROR: shop_status:paused_by_setnayan'), { reason: 'paused_by_setnayan' });
  assert.deepEqual(parseShopStatusRefusal('shop_status:owner_only'), { reason: 'owner_only' });
  assert.deepEqual(parseShopStatusRefusal('shop_status:made_up'), { reason: 'unreadable' });
  assert.deepEqual(parseShopStatusRefusal('connection reset'), { reason: 'unreadable' });
});

test('the shop-status path calls the door and never writes the pause or the close itself', () => {
  const src = stripComments(readFileSync(join(WEB, 'lib/shop-status.server.ts'), 'utf8'));
  assert.match(src, /\.rpc\(\s*'set_shop_status'/);
  assert.doesNotMatch(src, /\.(update|upsert)\(/, 'the path writes vendor_profiles directly');
  assert.doesNotMatch(src, /public_visibility\s*:\s*'archived'/, 'the path archives the shop itself');
});

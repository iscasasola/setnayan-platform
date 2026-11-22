/**
 * 🔒 THE EDIT LOCK'S READ IS HONEST (house pattern: reads-are-honest.test.ts · guests-read-is-honest.test.ts).
 *
 * A refused bookings read must never render as "nobody is booked" — that would OPEN a card a booked client is using.
 * Fails if:
 *   • a refused read (ownership or bookings) lets the save through, or says anything but `CARD_EDIT_UNREAD`;
 *   • `cardEditLockOf(null)` stops being `unread`, or `unread` stops being read-only in the maker;
 *   • the maker stops drawing the 🔒 row (tap → the shared `LockExplainer`: Problem, Solution), stops making the card
 *     read-only (`inert`), or keeps a live Save while locked;
 *   • the edit page stops passing the lock from its one bookings read.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import { CARD_EDIT_UNREAD, cardEditLockOf, cardEditLockRefusal, refuseEditOfBookedCard } from '@/lib/service-open-bookings';

const read = (...p: string[]) => stripComments(readFileSync(join(__dirname, ...p), 'utf8'));
const MAKER = read('_components', 'canvas-maker.tsx');
const PAGE = read('[serviceId]', 'page.tsx');

const refusing = (table: string | 'own') =>
  ({
    from: (t: string) => {
      const refused = table === 'own' || t === table;
      const result = refused ? { data: null, error: { message: 'permission denied' } } : { data: { vendor_service_id: 's1' }, error: null };
      const q: Record<string, unknown> = {};
      for (const k of ['select', 'eq']) q[k] = () => q;
      q.maybeSingle = () => Promise.resolve(result);
      q.in = () => Promise.resolve(refused ? result : { data: [], error: null });
      return q;
    },
  }) as unknown as SupabaseClient;

test('a refused read refuses the save and says it could not check — never "free to edit"', async () => {
  const ok = refusing('none');
  assert.equal(await refuseEditOfBookedCard(refusing('own'), ok, 'shop', 's1'), CARD_EDIT_UNREAD, 'a refused ownership read let the save through');
  assert.equal(await refuseEditOfBookedCard(ok, refusing('event_vendors'), 'shop', 's1'), CARD_EDIT_UNREAD, 'a refused bookings read let the save through');
  assert.deepEqual(cardEditLockOf(null), { state: 'unread' });
  assert.equal(cardEditLockRefusal({ state: 'unread' }), CARD_EDIT_UNREAD);
  assert.match(CARD_EDIT_UNREAD, /couldn’t check/i);
  assert.match(CARD_EDIT_UNREAD, /nothing was saved/i);
});

test('the maker: a 🔒 row that explains, the card read-only, and Save becomes the lock — for unread too', () => {
  assert.match(MAKER, /const editLocked = !!editLock && editLock\.state !== 'free';/, 'unread must lock exactly like locked');
  assert.match(MAKER, /if \(editLocked\) \{\s*e\.preventDefault\(\);\s*setLockOpen\(true\);/, 'a locked card can still be submitted');
  assert.match(MAKER, /data="edit-lock"/, 'the 🔒 row is gone');
  assert.match(MAKER, /editLock\.state === 'unread' \? CARD_EDIT_UNREAD : CARD_IN_USE_LOCK\.problem/, 'the row stops saying why (or that it could not check)');
  assert.match(MAKER, /<LockExplainer\s+lock=\{CARD_IN_USE_LOCK\}/, 'the tap no longer opens the shared Problem / Solution explainer');
  assert.match(MAKER, /inert=\{editLocked \|\| undefined\}/, 'the locked card is editable');
  assert.match(MAKER, /\{editLocked \? \([\s\S]{0,200}label="Locked" onClick=\{\(\) => setLockOpen\(true\)\}/, 'Save is still drawn while locked');
});

test('the edit page passes the lock from its one bookings read (null → unread)', () => {
  assert.match(PAGE, /editLock=\{cardEditLockOf\(thisCardBookings\)\}/);
  assert.match(PAGE, /const thisCardBookings = cardBookings\?\.get\(serviceId\) \?\? null;/);
});

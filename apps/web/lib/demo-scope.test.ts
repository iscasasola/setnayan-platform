/**
 * The demo-scope rule (owner 2026-11-06): an event and a shop meet only when `events.is_sample` equals
 * `vendor_profiles.is_demo`. Every corner, including the fail-closed ones.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bookingScopeRefusal,
  demoRefusalFromDbError,
  demoScopeOfEvent,
  eventMayMeetShop,
  DEMO_CROSS_BOOKING_DB_MARKER,
  DEMO_EVENT_BOOKS_DEMO_SHOPS_ONLY,
  DEMO_SHOP_CANNOT_BE_BOOKED,
} from './demo-scope';

const REAL_EVENT = { is_sample: false };
const DEMO_EVENT = { is_sample: true };
const REAL_SHOP = { is_demo: false };
const DEMO_SHOP = { is_demo: true };

test('a real event searches real shops; a demo event searches demo shops; anything unread is real', () => {
  assert.deepEqual(demoScopeOfEvent(REAL_EVENT), { is_demo: false });
  assert.deepEqual(demoScopeOfEvent(DEMO_EVENT), { is_demo: true });
  assert.deepEqual(demoScopeOfEvent(null), { is_demo: false });
  assert.deepEqual(demoScopeOfEvent({ is_sample: 'true' }), { is_demo: false }, 'only a literal true is a demo event');
});

test('the pairing is an equality', () => {
  assert.equal(eventMayMeetShop(REAL_EVENT, REAL_SHOP), true);
  assert.equal(eventMayMeetShop(DEMO_EVENT, DEMO_SHOP), true);
  assert.equal(eventMayMeetShop(REAL_EVENT, DEMO_SHOP), false);
  assert.equal(eventMayMeetShop(DEMO_EVENT, REAL_SHOP), false);
});

test('a write is refused with the couple-facing line, and refused when either side is unread', () => {
  assert.equal(bookingScopeRefusal(REAL_EVENT, REAL_SHOP), null);
  assert.equal(bookingScopeRefusal(DEMO_EVENT, DEMO_SHOP), null);
  assert.equal(bookingScopeRefusal(REAL_EVENT, DEMO_SHOP), DEMO_SHOP_CANNOT_BE_BOOKED);
  assert.equal(bookingScopeRefusal(DEMO_EVENT, REAL_SHOP), DEMO_EVENT_BOOKS_DEMO_SHOPS_ONLY);
  assert.equal(bookingScopeRefusal(null, REAL_SHOP), DEMO_SHOP_CANNOT_BE_BOOKED, 'an unread event is refused');
  assert.equal(bookingScopeRefusal(REAL_EVENT, null), DEMO_SHOP_CANNOT_BE_BOOKED, 'an unread shop is refused');
  assert.equal(DEMO_SHOP_CANNOT_BE_BOOKED, "This is a demo shop — it can't be booked.");
});

test("the database trigger's refusal is translated into the same line", () => {
  assert.equal(demoRefusalFromDbError({ message: `${DEMO_CROSS_BOOKING_DB_MARKER}: demo shop on a real event` }), DEMO_SHOP_CANNOT_BE_BOOKED);
  assert.equal(
    demoRefusalFromDbError({ message: `${DEMO_CROSS_BOOKING_DB_MARKER}: real shop on a demo event` }),
    DEMO_EVENT_BOOKS_DEMO_SHOPS_ONLY,
  );
  assert.equal(demoRefusalFromDbError({ message: 'duplicate key value' }), null);
  assert.equal(demoRefusalFromDbError(null), null);
});

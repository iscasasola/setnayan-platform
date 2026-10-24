import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOOKED_BY_PAYMENT_EMBED } from './booked-by-payment';

// event_vendor_payments has two foreign keys to event_vendors; an unnamed embed is PGRST201 and the read fails.
test('the booked-by-payment embed names the event-scoped foreign key', () => {
  assert.match(BOOKED_BY_PAYMENT_EMBED, /event_vendor_payments!event_vendor_payments_event_vendor_fk\(/);
});

/**
 * 🔒 The Shop ⚙'s "Business permit" line follows the ONE deadline rule (`badgeDeadline`) and says an unread row so.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { shopPermitLine } from './shop-permit-line';

const NOW = new Date('2026-11-08T02:00:00Z');

test('ahead, inside the 60-day window, lapsed', () => {
  const ahead = shopPermitLine({ verification_state: 'verified', next_renewal_due_at: '2027-06-30T15:59:59Z' }, NOW);
  assert.match(ahead.line, /^Renews .* · in \d+ days$/);
  assert.equal(ahead.badge?.word, 'Current');
  const soon = shopPermitLine({ verification_state: 'verified', next_renewal_due_at: '2026-11-29T15:59:59Z' }, NOW);
  assert.match(soon.line, /in 22 days — send the renewed one$/);
  assert.equal(soon.badge?.tone, 'wait');
  const over = shopPermitLine({ verification_state: 'verified', next_renewal_due_at: '2026-10-01T15:59:59Z' }, NOW);
  assert.match(over.line, /^Ran out on /);
});

test('no date, not verified, and unread each say their own thing', () => {
  assert.equal(shopPermitLine({ verification_state: 'verified', next_renewal_due_at: null }, NOW).line, 'No renewal date on file');
  assert.match(shopPermitLine({ verification_state: 'pending', next_renewal_due_at: null }, NOW).line, /when it checks your papers/);
  assert.equal(shopPermitLine(null, NOW).line, 'Couldn’t read your permit date just now');
});

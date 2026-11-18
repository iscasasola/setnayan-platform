/**
 * R10 (walk 18 Nov 2026) · AN ACCEPTED QUOTE IS NOT A BOOKING, AND THE WORKSPACE NOW SAYS SO.
 *
 * TEST W1 · Eleven Florals: the workspace drew the accepted quote's schedule — "Final balance ₱6,750 · that day has
 * already passed" — while the Budget said Agreed ₱0 · Owed ₱0 · Booked 0. By the code's own definitions the Budget is
 * right: accepting a quote (`respond_vendor_proposal`) writes the price and moves the row to `shortlisted`; the booking
 * is made when the supplier agrees to lock (`contracted`, CONFIRMED_VENDOR_STATUSES); the Budget counts only booked
 * suppliers (BA2, owner 2026-09-02); and `moneyStep` already answers `not_booked` for such a row. The Schedule section
 * was the one place that drew it as owed. It now frames an unbooked schedule as the quote's terms, nothing owed yet.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { quoteScheduleFrame, moneyStep } from '@/lib/accepted-quote-terms';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(
  readFileSync(
    path.join(HERE, '..', 'app', 'dashboard', '[eventId]', 'vendors', '[vendorId]', 'workspace', 'page.tsx'),
    'utf8',
  ),
);

describe('an accepted quote is not yet owed', () => {
  it('unbooked: the schedule says not booked and nothing owed — the Budget’s answer', () => {
    const f = quoteScheduleFrame(false, 'Eleven Florals');
    assert.match(f.label, /not booked yet/i);
    assert.match(f.tip, /Nothing is owed yet/);
    assert.match(f.tip, /Eleven Florals/);
    assert.doesNotMatch(f.tip, /Pay Eleven Florals directly/);
  });

  it('booked: the schedule is the plain one it always was', () => {
    const f = quoteScheduleFrame(true, 'Eleven Florals');
    assert.equal(f.label, 'Schedule');
    assert.match(f.tip, /Pay Eleven Florals directly/);
  });

  it('agrees with moneyStep: an unbooked row has no money step', () => {
    assert.equal(moneyStep({ booked: false } as Parameters<typeof moneyStep>[0]).kind, 'not_booked');
  });

  it('the workspace frames its quote schedule by the booked rule, not a fixed label', () => {
    assert.match(PAGE, /quoteScheduleFrame\(stage !== null, displayName\)/);
    assert.doesNotMatch(PAGE, /label="Schedule"/);
  });
});

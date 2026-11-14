import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { PAPERS_LAPSED_NOTICE, papersLapseDue } from './papers-lapse';
import { papersDueIn } from './papers-due';

/**
 * AFTER 30 MARCH — out of search and Discover, everything else kept (owner 2026-11-14, answer B, corrected by
 * DECISION_LOG 481b9b6b). The database half is tests/db/unrenewed-papers-pause-new-bookings.db.test.ts.
 */

const WEB = join(new URL('.', import.meta.url).pathname, '..');
const DUE = papersDueIn(2027); // the END of 30 March 2027, Manila
const shop = (over: Partial<Parameters<typeof papersLapseDue>[0]> = {}) => ({
  verification_state: 'verified',
  next_renewal_due_at: DUE,
  papers_lapsed_at: null,
  ...over,
});

test('the lapse fires only AFTER the end of 30 March, Manila', () => {
  assert.equal(papersLapseDue(shop(), new Date('2027-03-30T12:00:00+08:00')), false, 'noon on the 30th');
  assert.equal(papersLapseDue(shop(), new Date('2027-03-30T23:59:00+08:00')), false, 'the last minute of the 30th');
  assert.equal(papersLapseDue(shop(), new Date('2027-03-31T00:00:01+08:00')), true, 'the 31st has begun');
});

test('a never-verified shop is untouched; so is a shop with no deadline', () => {
  const after = new Date('2027-04-15T00:00:00Z');
  for (const state of ['unverified', 'pending_review', 'rejected', 'demoted', null]) {
    assert.equal(papersLapseDue(shop({ verification_state: state }), after), false, String(state));
  }
  assert.equal(papersLapseDue(shop({ next_renewal_due_at: null }), after), false);
});

test('IDEMPOTENT — a stamped shop is not due again; the write is conditional and only a changed row is told', () => {
  assert.equal(papersLapseDue(shop({ papers_lapsed_at: '2027-03-31T00:00:00Z' }), new Date('2027-05-01T00:00:00Z')), false);
  const src = stripComments(readFileSync(join(WEB, 'lib', 'papers-lapse.server.ts'), 'utf8'));
  const write = src.indexOf('papers_lapsed_at: stampedAt');
  const conditional = src.indexOf(".is('papers_lapsed_at', null)", write);
  const changedCheck = src.indexOf('changed.length !== 1', write);
  const notify = src.indexOf('emitNotification(', write);
  assert.ok(write > 0 && conditional > write, 'the stamp must be a conditional write');
  assert.ok(changedCheck > conditional && notify > changedCheck, 'only a row the write changed may be told');
  assert.ok(!/verification_state:|public_visibility:/.test(src), 'the lapse writes verification_state or public_visibility');
});

test('renewing restores the shop: an approval clears the stamp (and the free plan the lapse took)', () => {
  const engine = stripComments(readFileSync(join(WEB, 'lib', 'verification-decision.server.ts'), 'utf8'));
  const approve = engine.slice(engine.indexOf("case 'approved':"), engine.indexOf("case 'rejected':"));
  assert.match(approve, /papers_lapsed_at: null/);
  assert.match(approve, /tier_state: 'verified' as const/);
});

test('the supplier is told what really happens (481b9b6b: out of search; bookings and clients kept)', () => {
  assert.equal(
    PAPERS_LAPSED_NOTICE.body,
    'Your papers weren’t renewed by 30 March, so your shop is out of search and Discover. You keep your current bookings and clients, and you can keep working with couples who already asked. Upload your renewed papers to be found again.',
  );
  const sweep = stripComments(readFileSync(join(WEB, 'lib', 'verified-badge-sweep.ts'), 'utf8'));
  assert.match(sweep, /await stampLapsedPapers\(admin, now\)/, 'the daily pass does not run the lapse');
});

/* ── THE BADGE STAYS UNTIL THE END OF 30 MARCH (owner, "seven open questions ruled") ── */

import { hasVerifiedBadge } from './verified-badge';

test('a permit printed "valid until 31 Dec" never takes the badge off on 1 January', () => {
  // Every approval writes the 30 March day — never the permit's printed date.
  const engine = stripComments(readFileSync(join(WEB, 'lib', 'verification-decision.server.ts'), 'utf8'));
  const approve = engine.slice(engine.indexOf("case 'approved':"), engine.indexOf("case 'rejected':"));
  assert.match(approve, /next_renewal_due_at: deadlineAtApproval\(new Date\(now\)\)/);
  assert.ok(!/next_renewal_due_at:[^,\n]*permit/i.test(engine), 'the badge day was tied to the permit date');
  // So on 1 January the badge (which reads next_renewal_due_at alone) is still on…
  const facts = { verification_state: 'verified', next_renewal_due_at: DUE };
  assert.equal(hasVerifiedBadge(facts, new Date('2027-01-01T00:00:01+08:00')), true);
  assert.equal(hasVerifiedBadge(facts, new Date('2027-03-30T23:59:00+08:00')), true);
  // …and it comes off only once 30 March has ended.
  assert.equal(hasVerifiedBadge(facts, new Date('2027-03-31T00:00:01+08:00')), false);
  // The paper's own expiry is read only for papers being submitted now (upload + Submit), never by the badge.
  for (const f of ['lib/verified-badge.ts', 'lib/verified-badge-sweep.ts', 'lib/papers-lapse.server.ts']) {
    const src = stripComments(readFileSync(join(WEB, f), 'utf8'));
    assert.ok(!/expirationDate|expiresOn|permit_valid_until/.test(src), `${f} reads a paper's printed expiry`);
  }
});

test('481b9b6b: the lapse never refuses a booking — the app gate and the trigger do not read the stamp', () => {
  const vis = stripComments(readFileSync(join(WEB, 'lib', 'vendor-visibility.ts'), 'utf8'));
  assert.ok(!/papers_lapsed/.test(vis), 'the booking gate reads the papers stamp again');
  const mig = stripComments(readFileSync(join(WEB, '..', '..', 'supabase', 'migrations', '20271345631375_unrenewed_papers_pause_new_bookings.sql'), 'utf8').replace(/--[^\n]*/g, ''));
  assert.ok(!/enforce_booking_requires_verified_vendor/.test(mig), 'the lapse migration re-emits the booking trigger');
});

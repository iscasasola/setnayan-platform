/**
 * A couple's own link tells the supplier WHO invited them and the DATE (owner
 * 2026-10-10 — supersedes the 2026-05-19 identity-only lock for a couple's own
 * link, for these two facts only).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { claimDateLabel, claimDatePhrase, inviterFirstNames } from './claim-invite-words';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the inviters are named by first names — the page’s own names first', () => {
  assert.equal(
    inviterFirstNames({ display_name: ' Ana & Paolo ', bride_name: 'Ana Reyes', groom_name: 'Paolo Cruz' }),
    'Ana & Paolo',
  );
  // No page names: the first word of each stored name, never the surname.
  assert.equal(inviterFirstNames({ display_name: '', bride_name: 'Ana Reyes', groom_name: 'Paolo Cruz' }), 'Ana & Paolo');
  assert.equal(inviterFirstNames({ display_name: null, bride_name: 'Ana Reyes', groom_name: null }), 'Ana');
  assert.equal(inviterFirstNames({ display_name: null, bride_name: null, groom_name: '  ' }), null);
  assert.equal(inviterFirstNames(null), null);
});

test('the date reads as the couple’s own page states it — a day only when a day is set', () => {
  assert.equal(claimDateLabel('2026-12-18', 'day'), 'Fri, Dec 18, 2026');
  assert.equal(claimDateLabel('2026-12-18T00:00:00+08:00', 'day'), 'Fri, Dec 18, 2026');
  assert.equal(claimDateLabel('2026-12-01', 'month'), 'December 2026');
  assert.equal(claimDateLabel('2026-01-01', 'year'), '2026');
  assert.equal(claimDateLabel(null, 'day'), null);
  assert.equal(claimDateLabel('', null), null);
  assert.deepEqual(claimDatePhrase('2026-12-18', 'day'), { preposition: 'on', label: 'Fri, Dec 18, 2026' });
  assert.deepEqual(claimDatePhrase('2026-12-01', 'month'), { preposition: 'in', label: 'December 2026' });
  assert.equal(claimDatePhrase(null, null), null);
});

test('the link a couple SHARES loads the couple and the date — not only the emailed one', () => {
  const lib = code('lib/vendor-invites.ts');
  assert.match(lib, /return source === 'couple' \|\| source === 'auto_share_link';/);
  assert.match(lib, /if \(isCoupleMadeInvite\(resolvedInvite\.source\) && resolvedInvite\.vendor_id\) \{/);
  assert.doesNotMatch(
    lib,
    /if \(resolvedInvite\.source === 'couple' && resolvedInvite\.vendor_id\)/,
    'the couple and the date are loaded for the emailed invite alone again',
  );
  assert.match(lib, /\.select\('event_id,event_date,event_date_precision,display_name,bride_name,groom_name'\)/);
  assert.match(lib, /inviterFirstNames\(/);
});

test('the couple’s own link says who invited them and the date — and no longer "locked you in"', () => {
  const page = code('app/vendor/claim/[token]/page.tsx');
  const start = page.indexOf("if (invite.source === 'auto_share_link') {");
  const end = page.indexOf("if (invite.source === 'admin') {");
  assert.ok(start > -1 && end > start, 're-anchor: the couple’s-own-link branch moved');
  const branch = page.slice(start, end);
  assert.match(branch, /\{inviterName\}<\/strong> invited you to claim your\s+free Setnayan profile\./);
  assert.match(branch, /\{datePhrase\.preposition\} <strong className="text-ink">\{datePhrase\.label\}<\/strong>/);
  assert.doesNotMatch(branch, /locked you in/, 'a record that is "not a booking" must not tell the supplier they are locked in');
  assert.match(branch, /label="Who they talk to"/);
  // 🔒 Still private until they join: the price, what's included, the plan.
  assert.match(branch, /label="What they wrote"/);
  assert.match(branch, /after you join/);
  assert.match(branch, /Package &amp; payment details stay private until you finish\s+signup\./);
  assert.doesNotMatch(branch, /total_cost|host_inclusions|payment_plan/, 'a price or a plan reached the page before the supplier joined');
});

test('the claimed couple is seated as a customer, on the supplier’s own session', () => {
  const finalize = code('app/vendor/claim/[token]/finalize/page.tsx');
  const linked = finalize.indexOf('await applyClaimAutoLink(');
  const seated = finalize.indexOf('await seatClaimedCoupleAsCustomer(supabase,');
  assert.ok(linked > -1 && seated > linked, 'the couple must be seated AFTER the link is made, with the session client');
  const seat = code('lib/claimed-couple-is-a-customer.server.ts');
  // The same two writes Accept makes, in the same order.
  assert.ok(
    seat.indexOf("rpc('unlock_vendor_event_free'") > -1 &&
      seat.indexOf("rpc('unlock_vendor_event_free'") < seat.indexOf("update({ inquiry_status: 'accepted'"),
  );
  assert.match(seat, /\.eq\('inquiry_status', 'pending'\)/, 'only a thread still waiting may be opened');
  // Not a booking, not a hold, not a fee: none of these may be touched here.
  assert.doesNotMatch(seat, /event_vendors|lock_request|vendor_calendar|booking_fee|inquiry_source/);
});

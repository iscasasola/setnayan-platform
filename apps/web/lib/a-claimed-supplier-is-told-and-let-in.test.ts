/**
 * 🔗 A SUPPLIER WHO JOINED FROM A COUPLE'S LINK IS TOLD THEY WAIT, IS TOLD THE ANSWER, AND IS LET IN
 * (supplier gate audit G3 + G4, 2026-11-02). The database walk is `tests/db/a-claimed-supplier-lands-unlocked.db.test.ts`
 * (no charge after the approval = locked; the waived charge = open). This holds the app half:
 *   1 · the couple's approval makes the fee through the `claim_approved` door, AFTER the RPC that books;
 *   2 · the answer reaches the supplier as an in-app notice (`claim_access_answered`), never an email;
 *   3 · the catch-up sweep re-makes a missed claim fee through the same door;
 *   4 · Today draws "Waiting for … to let you in" from the supplier's own pending asks, and a failed read says so;
 *   5 · the words.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { CLAIM_WAIT_UNREADABLE, claimAnswerNotice, claimWaitTitle } from './claim-access-wait';
import { ClaimWaitLines } from '../app/vendor-dashboard/_components/claim-wait-lines';

// tsx compiles the component's JSX with the classic runtime outside Next, which reaches for a global React.
(globalThis as { React?: typeof React }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function body(src: string, fn: string): string {
  const at = src.search(new RegExp(`\\n(export )?async function ${fn}\\(`));
  assert.ok(at >= 0, `${fn} not found`);
  const rest = src.slice(at + 1);
  const next = rest.slice(1).search(/\n(export )?(async )?function /);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

test('1 · the approval makes the fee through claim_approved, after the RPC that books', () => {
  const fn = body(read('app/dashboard/[eventId]/access-requests/actions.ts'), 'answerClaimAccess');
  const rpc = fn.indexOf("rpc('answer_claim_access_request'");
  const mint = fn.search(/mintBookingFeeForBooking\([^)]*door: 'claim_approved'/);
  assert.ok(rpc >= 0, 'answerClaimAccess no longer calls answer_claim_access_request');
  assert.ok(mint > rpc, 'the approval must mint the claim fee after the booking exists — without it the supplier is locked out');
  assert.match(fn, /approve && result\.granted && result\.booked && result\.booking_vendor_id/, 'only a granted, booked approval mints');
});

test('2 · the supplier is told the answer — in the app, never by email', () => {
  const fn = body(read('app/dashboard/[eventId]/access-requests/actions.ts'), 'answerClaimAccess');
  assert.match(fn, /emitNotification\(\{ userId: ask\.requester_user_id, type: 'claim_access_answered'/);
  assert.match(fn, /select\('request_id, status, kind, requester_user_id'\)/, 'the requester must be read to be told');
  const emit = read('lib/notification-emit.ts');
  const allow = emit.slice(emit.indexOf('const EMAIL_ENABLED_TYPES'), emit.indexOf(']);', emit.indexOf('const EMAIL_ENABLED_TYPES')));
  assert.doesNotMatch(allow, /claim_access_answered/, 'no new emails without the owner’s word');
});

test('3 · the catch-up sweep re-makes a missed claim fee through the claim_approved door', () => {
  const fn = body(read('lib/booking-fee-mint.server.ts'), 'maybeCatchUpHandshakesWithoutFee');
  assert.match(fn, /\.eq\('kind', 'claim'\)/);
  assert.match(fn, /\.eq\('decisions->>access', 'granted'\)/);
  assert.match(fn, /approvedSet\.has\(eventVendorId\) \? 'claim_approved' : 'catch_up'/);
});

test('4 · Today reads the supplier’s own pending asks and draws them; a failed read is said', async () => {
  const page = read('app/vendor-dashboard/page.tsx');
  assert.match(page, /const claimWaitsP = readClaimWaits\(user\.id\)/);
  assert.match(page, /<ClaimWaitLines read=\{await claimWaitsP\} \/>/);
  const server = read('lib/claim-access-wait.server.ts');
  assert.match(server, /\.eq\('requester_user_id', userId\)/, 'a supplier sees only their own asks');
  assert.match(server, /\.eq\('status', 'pending'\)/);

  const { renderToStaticMarkup } = await import('react-dom/server');
  const waiting = renderToStaticMarkup(
    React.createElement(ClaimWaitLines, {
      read: { ok: true, waits: [{ requestId: 'r1', eventId: 'e1', eventName: 'Ice & Claire', askedAt: null }] },
    }),
  );
  assert.ok(waiting.includes('Waiting for Ice &amp; Claire to let you in'), waiting);
  assert.equal(renderToStaticMarkup(React.createElement(ClaimWaitLines, { read: { ok: true, waits: [] } })), '');
  const failed = renderToStaticMarkup(React.createElement(ClaimWaitLines, { read: { ok: false } }));
  assert.ok(failed.includes(CLAIM_WAIT_UNREADABLE), 'a refused read must say so, never draw as nothing waiting');
});

test('5 · the words', () => {
  assert.equal(claimWaitTitle({ eventName: '  ' }), 'Waiting for the couple to let you in');
  const yes = claimAnswerNotice({ approved: true, eventId: 'E1', eventName: 'Ice & Claire' });
  assert.equal(yes.title, 'Ice & Claire let you in');
  assert.equal(yes.relatedUrl, '/vendor-dashboard/clients/E1');
  const no = claimAnswerNotice({ approved: false, eventId: 'E1', eventName: null });
  assert.equal(no.title, 'The couple did not let you in');
  assert.equal(no.relatedUrl, '/vendor-dashboard');
});

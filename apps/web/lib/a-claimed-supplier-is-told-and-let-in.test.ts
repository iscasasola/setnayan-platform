/**
 * 🔗 A SUPPLIER WHO JOINED FROM A COUPLE'S LINK IS TOLD THEY WAIT, IS TOLD THE ANSWER, AND IS LET IN
 * (supplier gate audit G3 + G4, 2026-11-02). The database walk is `tests/db/a-claimed-supplier-lands-unlocked.db.test.ts`
 * (no charge after the approval = locked; the waived charge = open). This holds the app half:
 *   1 · the couple's approval makes the fee through the `claim_approved` door, AFTER the RPC that books;
 *   2 · the answer reaches the supplier as an in-app notice (`claim_access_answered`), never an email;
 *   3 · the catch-up sweep re-makes a missed claim fee through the same door;
 *   4 · Today draws "Waiting for … to let you in" from the supplier's own pending asks, and a failed read says so;
 *   5 · the words.
 *   6 · ✏️ the approval takes the supplier's CONTACT corrections (DECISION_LOG 2026-11-07): kept on the answered ask, told
 *       to the couple in the app, and nothing written to the couple's record — no price, no service, not even the name;
 *   7 · the corrections' words (the diff, the mark, the ⓘ, the couple's notice);
 *   8 · the reveal: only a GRANTED claim ask reveals, only for the row and shop it let in;
 *   9 · the Suppliers page reads the asks on the couple's own session, draws the real name for them, and the Booked row
 *       marks "updated by the supplier" with the detail in an ⓘ.
 * The other viewers' side (another event's couple, a guest, anon) is walked in SQL:
 * `tests/db/a-claimed-supplier-asks-for-access.db.test.ts` test 6.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { CLAIM_WAIT_UNREADABLE, claimAnswerNotice, claimWaitTitle } from './claim-access-wait';
import { ClaimWaitLines } from '../app/vendor-dashboard/_components/claim-wait-lines';
import {
  claimReveals,
  correctionsDetail,
  correctionsMark,
  correctionsNotice,
  invitedCoupleName,
  readCorrections,
  revealFor,
  supplierCorrections,
} from './supplier-corrections';
import { bookedView } from './booked-rows';
import { teamRows } from './your-team-rows';

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
  assert.match(
    fn,
    /select\('request_id, status, kind, requester_user_id, event_vendor_id, vendor_profile_id'\)/,
    'the requester must be read to be told (and the record + shop, for the corrections)',
  );
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

test('6 · the approval takes the CONTACT corrections — kept on the ask, told in the app, the couple’s record untouched', () => {
  const src = read('app/dashboard/[eventId]/access-requests/actions.ts');
  const fn = body(src, 'answerClaimAccess');
  const rpc = fn.indexOf("rpc('answer_claim_access_request'");
  const take = fn.search(/await takeSupplierCorrections\(admin, \{/);
  assert.ok(take > rpc, 'the corrections are taken after the approval, never before it');
  assert.match(fn, /if \(approve && result\.granted && ask\.event_vendor_id && ask\.vendor_profile_id\) \{/, 'only an approval that let them in');
  assert.match(fn, /recordVendorId: ask\.event_vendor_id/, 'compared against the couple’s OWN record (read before the RPC re-points the ask)');

  const take6 = body(src, 'takeSupplierCorrections');
  assert.match(take6, /\.from\('vendor_profiles'\)\s*\.select\('business_name, business_owner_name, contact_phone, hq_address'\)/);
  assert.match(take6, /\.from\('event_manual_vendors'\)\s*\.select\('business_name, contact_person, contact_number, address'\)/);
  assert.match(take6, /\.update\(\{ decisions: \{ access: 'granted', updated: corrections \} \}\)/, 'kept on the answered ask');
  assert.match(take6, /emitNotification\(\{ userId, type: 'vendor_joined'/, 'every couple member is told, in the app');
  // 🛑 Contact details only: nothing written to the couple's record, and never a price or a service.
  assert.doesNotMatch(take6, /from\('event_vendors'\)\s*\.update|from\('event_manual_vendors'\)\s*\.(update|upsert)/, 'the couple’s record was overwritten');
  assert.doesNotMatch(take6, /total_cost_php|service_id|event_vendor_package_id|host_inclusions/, 'a price or a service crept into the corrections');
  const emit = read('lib/notification-emit.ts');
  const allow = emit.slice(emit.indexOf('const EMAIL_ENABLED_TYPES'), emit.indexOf(']);', emit.indexOf('const EMAIL_ENABLED_TYPES')));
  assert.doesNotMatch(allow, /'vendor_joined'/, 'no new emails without the owner’s word');
});

test('7 · the corrections’ words', () => {
  const c = supplierCorrections(
    { name: 'Kusina ni Lola', person: null, phone: '0917 000 0000', address: '' },
    { name: 'Kusina ni Lola Catering', person: 'Lorna Cruz', phone: '+639170000000', address: '  ' },
  );
  assert.deepEqual(c, {
    name: { from: 'Kusina ni Lola', to: 'Kusina ni Lola Catering' },
    person: { from: null, to: 'Lorna Cruz' },
  }, 'the same phone written two ways is not a correction; a blank shop detail never is');
  assert.deepEqual(supplierCorrections({ name: 'Lente Studio' }, { name: '  lente  studio ' }), {}, 'case and spacing are not corrections');
  // 📞 The phone and the address are shown IN FULL beside the old ones — to the inviting couple, who brought this
  // supplier here (owner 2026-11-07: "we are giving them more freedom to talk outside since we already tracked them").
  const door = supplierCorrections({ phone: '0917 000 0000', address: 'Pasig' }, { phone: '+639181112222', address: '12 Kalye, Makati' });
  assert.deepEqual(door, {
    phone: { from: '0917 000 0000', to: '+639181112222' },
    address: { from: 'Pasig', to: '12 Kalye, Makati' },
  });
  assert.deepEqual(correctionsDetail(door), [
    'Phone: +63 918 111 2222 (was +63 917 000 0000)',
    'Address: 12 Kalye, Makati (was Pasig)',
  ]);
  assert.deepEqual(
    correctionsDetail(supplierCorrections({ phone: null }, { phone: '+639181112222' })),
    ['Phone: +63 918 111 2222'],
    'a number the couple never typed is simply learnt',
  );
  assert.deepEqual(readCorrections({ updated: door }), door, 'what the approval kept reads back whole');
  assert.equal(correctionsMark(door), 'Phone and address updated by the supplier');
  assert.equal(correctionsMark({ name: c.name }), 'Name updated by the supplier');
  assert.equal(correctionsMark(c), 'Name and contact person updated by the supplier');
  assert.equal(correctionsMark({}), null);
  assert.deepEqual(correctionsDetail(c), ['Name: Kusina ni Lola Catering (was Kusina ni Lola)', 'Contact person: Lorna Cruz']);
  const n = correctionsNotice({ eventId: 'E1', eventVendorId: 'V1', shopName: 'Kusina ni Lola Catering', corrections: c });
  assert.equal(n?.title, 'Kusina ni Lola Catering updated their name and contact person');
  assert.equal(n?.relatedUrl, '/dashboard/E1/vendors?tab=budget&team=V1');
  const nd = correctionsNotice({ eventId: 'E1', eventVendorId: 'V1', shopName: 'Kusina ni Lola Catering', corrections: door });
  assert.equal(nd?.title, 'Kusina ni Lola Catering updated their phone and address');
  assert.equal(nd?.body, 'Phone: +63 918 111 2222 (was +63 917 000 0000) · Address: 12 Kalye, Makati (was Pasig). Your Suppliers list shows their details now.');
  assert.equal(correctionsNotice({ eventId: 'E1', eventVendorId: 'V1', shopName: 'X', corrections: {} }), null, 'nothing changed → no notice');
});

test('8 · only a GRANTED claim ask reveals, and only for the row and shop it let in', () => {
  const asks = [
    { event_vendor_id: 'V1', vendor_profile_id: 'S1', decisions: { access: 'granted', updated: { name: { from: 'A', to: 'B' } } } },
    { event_vendor_id: 'V2', vendor_profile_id: 'S2', decisions: { access: 'declined' } },
  ];
  const r = claimReveals(asks);
  assert.ok(revealFor(r, 'V1', 'S1'));
  assert.equal(revealFor(r, 'V1', 'S9'), null, 'a row re-pointed at another shop shows that shop no real name');
  assert.equal(revealFor(r, 'V2', 'S2'), null, 'a declined ask reveals nothing');
  assert.equal(revealFor(claimReveals([]), 'V1', 'S1'), null, 'no ask read (any other viewer) → nothing revealed');
  assert.equal(invitedCoupleName(revealFor(r, 'V1', 'S1'), 'Real Name Co', 'Manila Caterer #1'), 'Real Name Co');
  assert.equal(invitedCoupleName(null, 'Real Name Co', 'Manila Caterer #1'), 'Manila Caterer #1');
});

test('9 · the page reads the asks as the couple, draws the real name for them, and the row marks the change', async () => {
  const page = read('app/dashboard/[eventId]/vendors/page.tsx');
  assert.match(
    page,
    /supabase\s*\.from\('event_access_requests'\)\s*\.select\('event_vendor_id, vendor_profile_id, decisions'\)\s*\.eq\('event_id', eventId\)\s*\.eq\('kind', 'claim'\)/,
    'the asks must be read on the couple’s OWN session (couple-scoped RLS) — never the admin client',
  );
  assert.doesNotMatch(page, /enrichmentAdmin\s*\.from\('event_access_requests'\)/, 'an admin read would reveal to every viewer');
  assert.match(page, /name: invitedCoupleName\(invitedBy, s\.business_name, resolvedName\)/);
  assert.match(page, /corrections: revealFor\(claimRevealByRow, row\.vendor_id, row\.marketplace_vendor_id\)\?\.corrections \?\? null/);

  const rows = teamRows(
    [
      {
        vendorId: 'V1', name: 'Kusina ni Lola Catering', service: 'Catering', logoUrl: null, status: 'contracted',
        lockRequestState: null, lockRequestExpiresAt: null, inBuild: false, lockGroupId: null, lockBlocked: null,
        inquiryStatus: null, threadId: null, pricePhp: 50000, depositStep: null, reviewStatus: null, quoteWaitingOnCouple: false,
      },
    ],
    { eventId: 'E1', lockHandshakeEnabled: true },
  );
  const view = bookedView({
    rows,
    facts: [
      {
        vendorId: 'V1', groupId: 'catering', own: false, shopId: 'S1', pricePhp: 50000, threadId: null, moneyMoved: false,
        lockRequestExpiresAt: null, corrections: { name: { from: 'Kusina ni Lola', to: 'Kusina ni Lola Catering' } },
      },
    ],
    money: null,
    plans: null,
  } as unknown as Parameters<typeof bookedView>[0]);
  const row = view.booked.find((b) => b.vendorId === 'V1');
  assert.ok(row, 'the booked row was not drawn');
  assert.deepEqual(row.updated, {
    mark: 'Name updated by the supplier',
    detail: ['Name: Kusina ni Lola Catering (was Kusina ni Lola)'],
  });

  const ui = read('app/dashboard/[eventId]/vendors/_components/booked-row.tsx');
  assert.match(ui, /row\.updated \? CORRECTIONS_SHORT : null/, 'the row’s second line says it was updated');
  assert.match(ui, /\{row\.updated \? <UpdatedLine updated=\{row\.updated\} \/> : null\}/, 'the opened row carries the ⓘ');
  assert.match(ui, /<InfoTip label=\{updated\.mark\}/);
});

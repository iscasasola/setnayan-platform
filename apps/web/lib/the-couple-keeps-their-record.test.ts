/**
 * Guard — THE COUPLE KEEPS THEIR RECORD, AND CAN ACT ON IT.
 *
 * Owner ruling 2026-08-27: **"yes they keep their record."** The database half
 * is pinned in `tests/db/the-couple-keeps-their-record.db.test.ts`. This file
 * pins the half a person actually meets, because a refusal the couple cannot
 * see or answer is worth nothing:
 *
 *   · the couple's card SAYS the supplier refused, and re-opens the form so they
 *     can send it again — the old CTA condition (`!recorded`) worked ONLY because
 *     the refusal deleted the record, so keeping the record without this leaves
 *     a fix nobody can reach;
 *   · re-sending CLEARS the refusal, which is the only thing that puts the
 *     question back in front of the supplier;
 *   · the supplier's own card reports their answer instead of asking again;
 *   · an answered claim leaves the Answers Desk, exactly as a confirmed one does.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => stripComments(readFileSync(resolve(HERE, p), 'utf8'));

const COUPLE_CARD =
  '../app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/deposit-reservation.tsx';
const COUPLE_PAGE = '../app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx';
const RECORD = '../app/dashboard/[eventId]/vendors/actions.ts';
const SUPPLIER_CARD = '../app/vendor-dashboard/clients/[eventId]/page.tsx';
const DESK = './vendor-overview.ts';

test('the couple is told, in their supplier’s own words', () => {
  const card = read(COUPLE_CARD);
  assert.match(card, /depositDeclinedAt/, 'the card cannot see the refusal at all');
  /*
    🪤 REV 1 MATCHED THE PROP NAME ANYWHERE, and it is named three times — in the
    props type, in the destructure, and in the render. Gutting the RENDER left
    two behind and the guard stayed green with the supplier's words gone. Third
    decorative assertion caught by mutation today; assume a fourth. It pins the
    rendered block now.
  */
  assert.ok(
    card.includes('{declined && depositDeclineReason ? ('),
    'the reason block is gone — the supplier’s words never reach the person they are about',
  );
  assert.match(card, /s words: &ldquo;\{depositDeclineReason\}/, 'their words are not rendered');
  assert.match(
    read(COUPLE_PAGE),
    /depositDeclinedAt=\{/,
    'the page never hands the refusal to the card',
  );
});

test('the couple can send it again — the fix has to be reachable', () => {
  const card = read(COUPLE_CARD);
  /*
    🪤 THE EXACT SHAPE OF THE OLD BUG. The button rendered on `!recorded && !open`,
    which was reachable after a refusal only because the refusal DELETED the
    record. With the record kept, that condition alone renders nothing and the
    couple is told their payment was refused with no way to answer.
  */
  assert.match(
    card,
    /\(!recorded \|\| declined\) && !open/,
    'the re-send button cannot appear after a refusal — the couple is told and given no way to answer',
  );
  assert.match(card, /Send it again/, 'the button does not say what it does');
});

test('re-sending clears the refusal, or the question never comes back', () => {
  const src = read(RECORD);
  assert.match(
    src,
    /deposit_declined_at: null/,
    'recordDeposit no longer clears the refusal — the supplier is never asked again',
  );
  assert.match(src, /deposit_decline_reason: null/);
  assert.match(src, /deposit_declined_by_user_id: null/);
  /*
    🪤 AND IT MUST BE ITS OWN STATEMENT. Naming these columns in the main update
    makes PostgREST refuse the WHOLE write while the migration is still landing,
    so a couple recording money mid-deploy would be told it failed. The clear
    sits after the write that must not fail.
  */
  const mainUpdate = src.indexOf('deposit_recorded_at: ev.deposit_recorded_at');
  const theClear = src.indexOf('deposit_declined_at: null');
  assert.ok(mainUpdate > 0 && theClear > mainUpdate, 'the clear moved into the main update');
});

test('the supplier’s card reports their answer instead of asking again', () => {
  const page = read(SUPPLIER_CARD);
  assert.match(page, /depositDeclined \? \(/, 'the refused state is not drawn');
  assert.match(page, /You said this never reached you/, 'the card does not say what they answered');
  assert.match(
    page,
    /It arrived after all/,
    'a payment that turns up later cannot be confirmed — the money would have no way in',
  );
  // The old notice promised the claim had been cleared. It is not cleared now.
  assert.doesNotMatch(
    page,
    /asked to re-submit their downpayment proof/,
    'the outcome notice still describes the erasure this change removed',
  );
});

test('an answered claim leaves the desk', () => {
  const desk = read(DESK);
  assert.match(
    desk,
    /declinedDeposits\.has\(lr\.eventVendorId\)/,
    'the desk keeps asking a question the supplier has already answered',
  );
  // Twice: the feed card AND the open-task row, or one of them nags forever.
  const hits = [...desk.matchAll(/declinedDeposits\.has\(/g)].length;
  assert.equal(hits, 2, `expected the feed and the task list to both drop it, found ${hits}`);
  /*
    🪤 ITS OWN GUARDED READ, NOT A FILTER ON THE MAIN ONE. The column arrives with
    this change; naming it in the deposit read would make PostgREST refuse that
    query and take EVERY deposit card off the desk for the length of a deploy.
  */
  assert.match(desk, /fetchDeclinedDepositIds/, 'the refusal read is gone');
  assert.match(
    desk,
    /logQueryError\('vendor-overview:fetchDeclinedDepositIds'/,
    'a failed refusal read would be silent',
  );
});

/**
 * lib/prove-the-flow-watch-format.test.ts
 *
 * Pure fixtures only — no network, no Supabase. Proves the T1 watcher's
 * plain-English descriptions say the right thing for both the happy path AND
 * the specific defects A2/B2 name (a Deal locked with no quote; a price
 * change that silently replaces the old total instead of showing both).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeCard,
  describeThread,
  describeAmendment,
  describeProposal,
  describeLock,
  describeChangeTrail,
} from './prove-the-flow-watch-format';

test('describeCard: nameless, unpublished, no price, missing gift value', () => {
  const s = describeCard({
    vendor_service_id: 'x',
    title: null,
    category: 'live_band',
    starting_price_php: null,
    is_active: false,
    includes_setnayan_gift: null,
  });
  assert.match(s, /nameless/);
  assert.match(s, /not published/);
  assert.match(s, /no price set/);
  assert.match(s, /gift value missing/);
});

test('describeCard: named, published, priced, gift explicitly no', () => {
  const s = describeCard({
    vendor_service_id: 'x',
    title: 'Weekend Reception Set',
    category: 'live_band',
    starting_price_php: 35000,
    is_active: true,
    includes_setnayan_gift: false,
  });
  assert.match(s, /"Weekend Reception Set"/);
  assert.match(s, /published/);
  assert.match(s, /₱35,000/);
  assert.match(s, /gift set to no/);
});

test('describeCard: no card at all', () => {
  assert.match(describeCard(null), /No card found/);
});

test('describeThread: no thread yet', () => {
  assert.match(describeThread(null, { total: 0, fromVendor: 0 }), /No inquiry/);
});

test('describeThread: accepted, supplier has replied', () => {
  const s = describeThread(
    {
      thread_id: 't1',
      inquiry_status: 'accepted',
      accepted_at: '2026-09-10T00:00:00Z',
      agreed_price_centavos: null,
      locked_at: null,
      locked_by_user_id: null,
    },
    { total: 4, fromVendor: 2 },
  );
  assert.match(s, /"accepted"/);
  assert.match(s, /accepted 2026-09-10/);
  assert.match(s, /has replied 2 time/);
});

test('describeThread: accepted but never replied', () => {
  const s = describeThread(
    { thread_id: 't1', inquiry_status: 'accepted', accepted_at: 'x', agreed_price_centavos: null, locked_at: null, locked_by_user_id: null },
    { total: 1, fromVendor: 0 },
  );
  assert.match(s, /never replied/);
});

test('describeAmendment: A2 defect — locked with no base quote', () => {
  const s = describeAmendment(
    { amendment_id: 'a1', status: 'accepted', base_proposal_id: null, locked_at: '2026-09-10T01:00:00Z' },
    { thread_id: 't1', inquiry_status: 'accepted', accepted_at: 'x', agreed_price_centavos: null, locked_at: '2026-09-10T01:00:00Z', locked_by_user_id: 'u1' },
  );
  assert.match(s, /DEFECT/);
  assert.match(s, /Lock this deal.*bug \(A2\) is still live/);
  assert.match(s, /frozen NULL price/);
});

test('describeAmendment: healthy — locked with a real base quote and a real price', () => {
  const s = describeAmendment(
    { amendment_id: 'a1', status: 'accepted', base_proposal_id: 'p1', locked_at: '2026-09-10T01:00:00Z' },
    { thread_id: 't1', inquiry_status: 'accepted', accepted_at: 'x', agreed_price_centavos: 3500000, locked_at: '2026-09-10T01:00:00Z', locked_by_user_id: 'u1' },
  );
  assert.doesNotMatch(s, /DEFECT/);
  assert.match(s, /built on a sent quote/);
  assert.match(s, /₱35,000/);
});

test('describeAmendment: no deal struck yet', () => {
  assert.match(describeAmendment(null, null), /No Deal/);
});

test('describeProposal: none sent', () => {
  assert.match(describeProposal(null), /No formal quote/);
});

test('describeProposal: sent with a total', () => {
  const s = describeProposal({ proposal_id: 'p1', status: 'sent', total_centavos: 4000000, sent_at: '2026-09-10T00:00:00Z' });
  assert.match(s, /"sent"/);
  assert.match(s, /₱40,000/);
  assert.match(s, /sent 2026-09-10/);
});

test('describeLock: not on the list at all', () => {
  assert.match(describeLock(null), /not on the couple's supplier list/);
});

test('describeLock: contracted and correctly stamped the category winner (A5 healthy)', () => {
  const s = describeLock({
    vendor_id: 'v1',
    status: 'contracted',
    total_cost_php: 35000,
    linked_vendor_profile_id: 'vp1',
    selection_match_rank: 1,
    lock_request_state: 'agreed',
  });
  assert.match(s, /"contracted"/);
  assert.match(s, /winning pick/);
});

test('describeLock: A5 defect — booked but never stamped as the winner', () => {
  const s = describeLock({
    vendor_id: 'v1',
    status: 'contracted',
    total_cost_php: 35000,
    linked_vendor_profile_id: null,
    selection_match_rank: null,
    lock_request_state: null,
  });
  assert.match(s, /DEFECT/);
  assert.match(s, /sort like a candidate/);
});

test('describeChangeTrail: nothing changed since lock', () => {
  const ev = { vendor_id: 'v1', status: 'contracted', total_cost_php: 35000, linked_vendor_profile_id: 'vp1', selection_match_rank: 1, lock_request_state: 'agreed' };
  assert.match(describeChangeTrail(ev, [], null), /No price change/);
});

test('describeChangeTrail: B2 defect — total moved with no change-order row (silent replace)', () => {
  const ev = { vendor_id: 'v1', status: 'contracted', total_cost_php: 20000, linked_vendor_profile_id: 'vp1', selection_match_rank: 1, lock_request_state: 'agreed' };
  const s = describeChangeTrail(ev, [], 35000);
  assert.match(s, /DEFECT/);
  assert.match(s, /₱35,000 to ₱20,000/);
  assert.match(s, /REPLACED, not shown beside/);
});

test('describeChangeTrail: healthy — a change-order row explains the delta', () => {
  const ev = { vendor_id: 'v1', status: 'contracted', total_cost_php: 20000, linked_vendor_profile_id: 'vp1', selection_match_rank: 1, lock_request_state: 'agreed' };
  const s = describeChangeTrail(
    ev,
    [{ change_order_id: 'c1', raised_by: 'couple', delta_amount_php: -15000, status: 'accepted' }],
    35000,
  );
  assert.doesNotMatch(s, /DEFECT/);
  assert.match(s, /credit of ₱15,000/);
});

test('describeChangeTrail: B2 defect — negative booked total', () => {
  const ev = { vendor_id: 'v1', status: 'contracted', total_cost_php: -5000, linked_vendor_profile_id: 'vp1', selection_match_rank: 1, lock_request_state: 'agreed' };
  const s = describeChangeTrail(ev, [], null);
  assert.match(s, /NEGATIVE/);
});

test('describeChangeTrail: a new Deal after the lock — the agreed total AND the change beside it (owner example)', () => {
  // ₱100,000 agreed at the lock; a new Deal in chat takes ₱15,000 off. The Deal
  // path has NO change-order row, so the change line is the only evidence.
  const ev = { vendor_id: 'v1', status: 'contracted', total_cost_php: 100000, linked_vendor_profile_id: 'vp1', selection_match_rank: 1, lock_request_state: 'agreed' };
  const s = describeChangeTrail(
    ev,
    [],
    100000,
    [{ label: 'New deal agreed in chat (price lowered)', amount_php: -15000 }],
  );
  assert.doesNotMatch(s, /DEFECT/);
  assert.match(s, /Agreed total ₱100,000/);
  assert.match(s, /−₱15,000/);
  assert.match(s, /agreed total now ₱85,000/);
});

test('describeChangeTrail: a change line that takes the agreed total below zero is a defect', () => {
  const ev = { vendor_id: 'v1', status: 'contracted', total_cost_php: 10000, linked_vendor_profile_id: 'vp1', selection_match_rank: 1, lock_request_state: 'agreed' };
  const s = describeChangeTrail(ev, [], null, [{ label: 'x', amount_php: -15000 }]);
  assert.match(s, /NEGATIVE/);
});

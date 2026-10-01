/**
 * people-label-handshake.test.ts — a label counts only once the other person
 * says yes; one partner at a time; and the next step for a couple.
 *
 * Owner, 2026-09-29:
 *   > "add partner (to become a couple)"
 *   > "assigning a label needs a handshake"
 *   > "it will show to their requests on people as well"
 *
 * These drive the PURE rules the People page and its actions use. The database
 * holds the same rules on its own (`tests/db/a-label-is-asked.db.test.ts`); a
 * screen that disagreed with it would still be refused there — these are about
 * what a PERSON is told.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  didNotConfirmLine,
  isRequestForMe,
  isWaitingOnThem,
  labelAskFor,
  labelRequestLine,
  offersPlanTogether,
  partnerHolding,
  replacePartnerQuestion,
  isOnePartnerRefusal,
  waitingForLine,
  type PartnerRuleRow,
} from './people-label-handshake';
import { relationForViewer } from './people-connections';

// ── the line the asked person reads ─────────────────────────────────────────

test('the asked person reads the asker’s word — "Ice added you as their Sibling"', () => {
  assert.equal(labelRequestLine('Ice Casasola', 'sibling'), 'Ice added you as their Sibling.');
  assert.equal(labelRequestLine('Claire', 'partner'), 'Claire added you as their Partner.');
});

test('🔴 RECIPROCAL — "you are their Parent" also says what THEY are to you', () => {
  // Ice says I am her Parent → I confirm Ice as my Child.
  assert.equal(
    labelRequestLine('Ice', 'parent'),
    'Ice added you as their Parent. That makes Ice your Child.',
  );
  assert.equal(
    labelRequestLine('Ice', 'godparent'),
    'Ice added you as their Ninong / Ninang. That makes Ice your Inaanak.',
  );
});

test('🔴 RECIPROCAL on the row — a label somebody else made reads from MY side', () => {
  // Stored: what to_person is to from_person. Ben (to) reading Ana's row.
  assert.equal(relationForViewer('parent', false), 'child');
  assert.equal(relationForViewer('child', false), 'parent');
  assert.equal(relationForViewer('godparent', false), 'godchild');
  assert.equal(relationForViewer('partner', false), 'partner');
  // The declarer reads their own word untouched.
  assert.equal(relationForViewer('parent', true), 'parent');
  assert.equal(relationForViewer(null, false), null);
});

test('the asker’s row: waiting, then — if they said no — "didn’t confirm", quietly', () => {
  assert.equal(waitingForLine('Claire Reyes'), 'Waiting for Claire to confirm');
  assert.equal(didNotConfirmLine('Claire Reyes'), 'Claire didn’t confirm');
});

// ── where a row stands ──────────────────────────────────────────────────────

const confirmedAsk = (proposed: string | null, status: string | null) => ({
  status: 'confirmed',
  proposed_relation: proposed,
  proposed_status: status,
});

test('🔴 a NEW LABEL REQUEST lands in the recipient’s Requests — and in the sender’s "Waiting for them"', () => {
  const row = confirmedAsk('sibling', 'pending');
  const forRecipient = { state: 'connected' as const, ask: labelAskFor(row, false) };
  const forSender = { state: 'connected' as const, ask: labelAskFor(row, true) };
  assert.deepEqual(forRecipient.ask, { word: 'sibling', state: 'waiting_you' });
  assert.equal(isRequestForMe(forRecipient), true, 'the asked person never meets the ask');
  assert.equal(isWaitingOnThem(forRecipient), false);
  assert.equal(isRequestForMe(forSender), false);
  assert.equal(isWaitingOnThem(forSender), true, 'the sender cannot see their own pending ask');
});

test('a request to connect is still a request, and a settled row is neither', () => {
  assert.equal(isRequestForMe({ state: 'waiting_you', ask: null }), true);
  assert.equal(isWaitingOnThem({ state: 'waiting_them', ask: null }), true);
  const settled = { state: 'connected' as const, ask: labelAskFor(confirmedAsk(null, null), false) };
  assert.equal(isRequestForMe(settled), false);
  assert.equal(isWaitingOnThem(settled), false);
});

test('🔒 DECLINED — the asker sees "didn’t confirm"; the person who said no sees nothing', () => {
  const row = confirmedAsk('partner', 'declined');
  assert.deepEqual(labelAskFor(row, true), { word: 'partner', state: 'declined' });
  assert.equal(labelAskFor(row, false), null, 'the decline follows the person who made it');
  // …and a declined ask is in nobody's Requests.
  assert.equal(isRequestForMe({ state: 'connected', ask: labelAskFor(row, true) }), false);
});

test('a label on a request still waiting rides the request — no separate ask', () => {
  assert.equal(
    labelAskFor({ status: 'pending', proposed_relation: 'sibling', proposed_status: 'pending' }, false),
    null,
  );
  // A word the vocabulary does not hold is never shown as an ask.
  assert.equal(labelAskFor(confirmedAsk('kumpare', 'pending'), false), null);
});

// ── one partner at a time ───────────────────────────────────────────────────

const ME = 'me';
const row = (over: Partial<PartnerRuleRow>): PartnerRuleRow => ({
  connection_id: 'c',
  from_person_id: ME,
  to_person_id: 'x',
  relation: null,
  status: 'confirmed',
  proposed_relation: null,
  proposed_status: null,
  ...over,
});

test('🔴 an AGREED partner — in either direction — is held', () => {
  assert.deepEqual(
    partnerHolding([row({ connection_id: 'a', to_person_id: 'maria', relation: 'partner' })], ME, 'new'),
    { connectionId: 'a', otherPersonId: 'maria', kind: 'agreed' },
  );
  assert.deepEqual(
    partnerHolding(
      [row({ connection_id: 'b', from_person_id: 'maria', to_person_id: ME, relation: 'partner' })],
      ME,
      'new',
    ),
    { connectionId: 'b', otherPersonId: 'maria', kind: 'agreed' },
  );
});

test('🔴 a partner I ASKED — as a request or as a label ask — is held', () => {
  assert.equal(
    partnerHolding([row({ status: 'pending', relation: 'partner', to_person_id: 'm' })], ME, 'new')?.kind,
    'asked',
  );
  assert.equal(
    partnerHolding(
      [row({ proposed_relation: 'partner', proposed_status: 'pending', to_person_id: 'm' })],
      ME,
      'new',
    )?.kind,
    'asked',
  );
});

test('🔒 a partner request SOMEBODY ELSE sent me does not block me', () => {
  // Otherwise anyone could stop you naming your own partner by asking first.
  const incoming = [
    row({ from_person_id: 'stranger', to_person_id: ME, status: 'pending', relation: 'partner' }),
    row({ from_person_id: 'stranger2', to_person_id: ME, proposed_relation: 'partner', proposed_status: 'pending' }),
  ];
  assert.equal(partnerHolding(incoming, ME, 'new'), null);
});

test('the row being changed, a removed row, a declined one, and a declined ask never count', () => {
  assert.equal(partnerHolding([row({ connection_id: 'same', relation: 'partner' })], ME, 'same'), null);
  assert.equal(partnerHolding([row({ relation: 'partner', deleted_at: '2026-09-29' })], ME, 'n'), null);
  assert.equal(partnerHolding([row({ relation: 'partner', status: 'declined' })], ME, 'n'), null);
  assert.equal(
    partnerHolding([row({ proposed_relation: 'partner', proposed_status: 'declined' })], ME, 'n'),
    null,
  );
});

test('the replace question is plain words, and names who it would replace', () => {
  assert.equal(
    replacePartnerQuestion({ name: 'Maria Santos', kind: 'agreed' }, 'Juan Cruz'),
    'Maria is your partner. Make Juan your partner instead? Maria won’t be your partner any more.',
  );
  assert.equal(
    replacePartnerQuestion({ name: 'Maria', kind: 'asked' }, 'Juan'),
    'You asked Maria to be your partner. Ask Juan instead? We’ll take back the ask to Maria.',
  );
  assert.equal(isOnePartnerRefusal('person_connections: one partner at a time'), true);
  assert.equal(isOnePartnerRefusal('duplicate key'), false);
});

// ── "to become a couple" ────────────────────────────────────────────────────

test('🔴 "Plan an event together" — only for an agreed partner who shares no event yet', () => {
  const base = { relationForViewer: 'partner' as const, connected: true, askPending: false, sharesAnEvent: false };
  assert.equal(offersPlanTogether(base), true);
  assert.equal(offersPlanTogether({ ...base, sharesAnEvent: true }), false, 'offered to a pair already planning together');
  assert.equal(offersPlanTogether({ ...base, sharesAnEvent: null }), false, 'offered on an unread answer');
  assert.equal(offersPlanTogether({ ...base, connected: false }), false, 'offered before they confirmed');
  assert.equal(offersPlanTogether({ ...base, askPending: true }), false);
  assert.equal(offersPlanTogether({ ...base, relationForViewer: 'friend' }), false);
});

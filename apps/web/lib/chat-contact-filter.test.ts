/**
 * evaluateMessage() - the chatroom blocked-rules engine wired into the chat send
 * path (lib/chat-send.ts). Locks the contract: a phone number in ANY disguised
 * form, an email / social link / @handle, or a blocklisted app-name / euphemism /
 * solicitation is BLOCKED; legitimate chatter (prices, pax counts, dates, two
 * unrelated numbers) is allowed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMessage } from './chat-contact-filter';

const blocked = (s: string) => evaluateMessage(s).blocked;

// -- Phone: every disguise is caught -----------------------------------------

test('plain PH mobile is blocked', () => {
  assert.equal(blocked('call me 09178807163'), true);
});

test('spaces between groups are blocked', () => {
  assert.equal(blocked('0917 880 7163'), true);
});

test('every-digit-spaced is blocked', () => {
  assert.equal(blocked('0 9 1 7 8 8 0 7 1 6 3'), true);
});

test('words jammed between the digits are blocked', () => {
  assert.equal(blocked('0917 my number is 8807163'), true);
  assert.equal(blocked('0917kausapinmoako8807163'), true);
});

test('spelled-out digits are blocked', () => {
  assert.equal(blocked('zero nine one seven eight eight zero seven one six three'), true);
});

test('+63 international form is blocked', () => {
  assert.equal(blocked('+63 917 880 7163'), true);
  assert.equal(blocked('63 917 880 7163'), true);
});

test('mobile without the leading 0 is blocked', () => {
  assert.equal(blocked('9178807163'), true);
});

// -- Email / link / handle ---------------------------------------------------

test('email is blocked', () => {
  assert.equal(blocked('juan.delacruz@gmail.com'), true);
  assert.equal(blocked('juan (at) gmail (dot) com'), true);
});

test('social/messaging link is blocked', () => {
  assert.equal(blocked('facebook.com/juanphotos'), true);
  assert.equal(blocked('wa.me/639171234567'), true);
});

test('@handle is blocked', () => {
  assert.equal(blocked('follow @juan_photo'), true);
});

// -- Blocklist: app names / euphemisms / solicitations -----------------------

test('app names are blocked', () => {
  assert.equal(blocked('let us talk on viber'), true);
  assert.equal(blocked('add me on messenger'), true);
  assert.equal(blocked('find me on ig'), true);
  assert.equal(blocked('message me on fb'), true);
});

test('colour-coded euphemisms are blocked', () => {
  assert.equal(blocked('i am on the blue app'), true);
  assert.equal(blocked('reach me on the purple app'), true);
});

test('solicitation phrasing is blocked', () => {
  assert.equal(blocked('my number is below'), true);
  assert.equal(blocked("let's take this off platform"), true);
});

// -- False-positive guards: legitimate chatter is allowed --------------------

test('prices, pax counts, and years are allowed', () => {
  assert.equal(blocked('the package is 12,999 for 150 pax'), false);
  assert.equal(blocked('the wedding is set for June 2026'), false);
  assert.equal(blocked('we need 200 chairs and 20 tables'), false);
});

test('two unrelated numbers far apart are not fused into a phone', () => {
  assert.equal(
    blocked('We expect 150 guests. Our all-in budget is around 80000 pesos.'),
    false,
  );
});

test('ordinary words containing app substrings are allowed', () => {
  assert.equal(blocked('this is a big dignified venue'), false);
  assert.equal(blocked('instant coffee at the tasting'), false);
});

test('empty / non-string input is safe', () => {
  assert.equal(blocked(''), false);
  // @ts-expect-error - defensive runtime guard for a non-string.
  assert.equal(blocked(null), false);
});

test('a clean planning message is allowed', () => {
  assert.equal(
    blocked('Hi! Do you have our date open? Budget is around 80k for full-day coverage.'),
    false,
  );
});

// -- Reporting shape ---------------------------------------------------------

test('categories + matched are populated on a block', () => {
  const r = evaluateMessage('add me on viber 09178807163');
  assert.equal(r.blocked, true);
  assert.ok(r.categories.includes('phone'));
  assert.ok(r.categories.includes('app_name'));
  assert.ok(r.matched.length >= 2);
});

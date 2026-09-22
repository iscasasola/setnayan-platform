/**
 * EXECUTES the two pure modules behind "account inside step 3" (owner 2026-09-22):
 * who may open a shop signed out, which step each refusal points at, and what the
 * OAuth round trip is allowed to carry back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideOpenShopAccount,
  signUpSaysEmailTaken,
  OPEN_SHOP_ACCOUNT_ERRORS,
  OPEN_SHOP_PASSWORD_MIN,
} from './open-shop-account';
import { OPEN_SHOP_ERRORS } from './open-shop-validation';
import {
  parseOpenShopDraft,
  serializeOpenShopDraft,
  OPEN_SHOP_DRAFT_TTL_MS,
} from './open-shop-draft';

const TERMS = 'Please agree to the Terms and Privacy Policy to create your account.';
const base = { hasSession: false, email: 'hello@banaweflorals.ph', password: 'longenough1', termsAgreed: true, termsError: TERMS };

test('a signed-in person opens the shop on their account — password and terms are ignored', () => {
  assert.deepEqual(
    decideOpenShopAccount({ ...base, hasSession: true, password: '', termsAgreed: false }),
    { kind: 'existing' },
  );
});

test('signed out with everything present → create the account with the shop', () => {
  assert.deepEqual(decideOpenShopAccount(base), {
    kind: 'create',
    email: 'hello@banaweflorals.ph',
    password: 'longenough1',
  });
});

test('a short password is refused ON STEP 3, with the same sentence /signup uses', () => {
  const d = decideOpenShopAccount({ ...base, password: 'short' });
  assert.deepEqual(d, { kind: 'refuse', step: 3, error: OPEN_SHOP_ACCOUNT_ERRORS.password });
  assert.equal(OPEN_SHOP_PASSWORD_MIN, 8);
  // The floor is the SAME as /signup's `password.length < 8`; a 7 is refused, an 8 passes.
  assert.equal(decideOpenShopAccount({ ...base, password: '1234567' }).kind, 'refuse');
  assert.equal(decideOpenShopAccount({ ...base, password: '12345678' }).kind, 'create');
});

test('a missing company email is a step-3 refusal, before the agreement is even looked at', () => {
  const d = decideOpenShopAccount({ ...base, email: null, termsAgreed: false });
  assert.deepEqual(d, { kind: 'refuse', step: 3, error: OPEN_SHOP_ERRORS.contactEmail });
});

test('no agreement → refused on STEP 4 with the agreement’s own sentence, never a re-worded one', () => {
  const d = decideOpenShopAccount({ ...base, termsAgreed: false });
  assert.deepEqual(d, { kind: 'refuse', step: 4, error: TERMS });
});

test('"email taken" is read from both shapes Supabase uses', () => {
  assert.equal(signUpSaysEmailTaken({ error: { message: 'User already registered' }, identities: null }), true);
  assert.equal(signUpSaysEmailTaken({ error: null, identities: [] }), true);
  assert.equal(signUpSaysEmailTaken({ error: null, identities: [{ id: 'x' }] }), false);
  assert.equal(signUpSaysEmailTaken({ error: { message: 'Network down' }, identities: null }), false);
});

test('the draft round-trips what the wizard typed, and never a password', () => {
  const now = 1_700_000_000_000;
  const raw = serializeOpenShopDraft(
    {
      step: 3,
      shopName: 'Banawe Florals',
      logoUrl: 'r2://media/x',
      service: 'photography',
      serviceLabel: 'Photography',
      events: ['wedding', 'debut'],
      position: 'Owner',
      phone: '0917 123 4567',
      email: 'hello@banaweflorals.ph',
    },
    now,
  );
  assert.equal(raw.includes('password'), false);
  const back = parseOpenShopDraft(raw, now + 1000);
  assert.ok(back);
  assert.equal(back.shopName, 'Banawe Florals');
  assert.equal(back.step, 3);
  assert.deepEqual(back.events, ['wedding', 'debut']);
  // a smuggled password is dropped, not carried
  const smuggled = JSON.stringify({ ...JSON.parse(raw), password: 'hunter22' });
  assert.equal('password' in (parseOpenShopDraft(smuggled, now + 1000) as object), false);
});

test('an expired, future-dated, foreign-version or junk draft restores NOTHING', () => {
  const now = 1_700_000_000_000;
  const raw = serializeOpenShopDraft(
    { step: 2, shopName: 'X', logoUrl: '', service: '', serviceLabel: null, events: [], position: '', phone: '', email: '' },
    now,
  );
  assert.equal(parseOpenShopDraft(raw, now + OPEN_SHOP_DRAFT_TTL_MS + 1), null, 'expired');
  assert.equal(parseOpenShopDraft(raw, now - 1), null, 'written in the future');
  assert.equal(parseOpenShopDraft(raw.replace('"v":1', '"v":2'), now), null, 'another version');
  assert.equal(parseOpenShopDraft('{not json', now), null, 'junk');
  assert.equal(parseOpenShopDraft(null, now), null, 'absent');
  assert.equal(parseOpenShopDraft('"a string"', now), null, 'wrong type');
});

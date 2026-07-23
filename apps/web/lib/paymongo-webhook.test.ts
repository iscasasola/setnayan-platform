/**
 * Unit suite for the PayMongo webhook signature verification + event parsing.
 * The signature scheme is the SDK-authoritative one (sign `${t}.${rawBody}`,
 * HMAC-SHA256 hex, keyed with the whsk_ secret, compare to li=live/te=test) — the
 * public docs get it wrong, so this test pins the correct behaviour.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

import { verifyPaymongoSignature, parsePaymongoEvent } from './paymongo-webhook';

const SECRET = 'whsk_test_abc123';
const BODY = '{"data":{"id":"evt_1"}}';

function sign(timestamp: string, body: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

test('verify: valid TEST signature (te set, li empty) → true', () => {
  const t = '1700000000';
  const header = `t=${t},te=${sign(t, BODY)},li=`;
  assert.equal(verifyPaymongoSignature(BODY, header, SECRET), true);
});

test('verify: valid LIVE signature (li wins over te) → true', () => {
  const t = '1700000000';
  const header = `t=${t},te=deadbeef,li=${sign(t, BODY)}`;
  assert.equal(verifyPaymongoSignature(BODY, header, SECRET), true);
});

test('verify: signs `${t}.${body}` — NOT the body alone (the docs bug)', () => {
  const t = '1700000000';
  // HMAC of the raw body WITHOUT the timestamp prefix must be rejected.
  const wrong = crypto.createHmac('sha256', SECRET).update(BODY).digest('hex');
  const header = `t=${t},te=${wrong},li=`;
  assert.equal(verifyPaymongoSignature(BODY, header, SECRET), false);
});

test('verify: tampered body → false', () => {
  const t = '1700000000';
  const header = `t=${t},te=${sign(t, BODY)},li=`;
  assert.equal(verifyPaymongoSignature('{"data":{"id":"evt_TAMPERED"}}', header, SECRET), false);
});

test('verify: wrong secret → false', () => {
  const t = '1700000000';
  const header = `t=${t},te=${sign(t, BODY, 'whsk_other')},li=`;
  assert.equal(verifyPaymongoSignature(BODY, header, SECRET), false);
});

test('verify: missing secret / header / timestamp → false (fail-closed)', () => {
  const t = '1700000000';
  const good = `t=${t},te=${sign(t, BODY)},li=`;
  assert.equal(verifyPaymongoSignature(BODY, good, ''), false); // no secret
  assert.equal(verifyPaymongoSignature(BODY, null, SECRET), false); // no header
  assert.equal(verifyPaymongoSignature(BODY, `te=${sign(t, BODY)},li=`, SECRET), false); // no t=
  assert.equal(verifyPaymongoSignature(BODY, `t=${t},te=,li=`, SECRET), false); // no sig
});

test('parse: checkout_session.payment.paid → charge_id + payment fields', () => {
  const raw = JSON.stringify({
    data: {
      id: 'evt_abc',
      type: 'event',
      attributes: {
        type: 'checkout_session.payment.paid',
        livemode: false,
        data: {
          id: 'cs_1',
          type: 'checkout_session',
          attributes: {
            reference_number: 'S89F-XYZ',
            metadata: { charge_id: 'charge-uuid-1', vendor_id: 'S89V-1' },
            payments: [{ id: 'pay_1', attributes: { source: { type: 'gcash' } } }],
          },
        },
      },
    },
  });
  const evt = parsePaymongoEvent(raw);
  assert.equal(evt?.eventId, 'evt_abc');
  assert.equal(evt?.type, 'checkout_session.payment.paid');
  assert.equal(evt?.chargeId, 'charge-uuid-1');
  assert.equal(evt?.referenceNumber, 'S89F-XYZ');
  assert.equal(evt?.paymentId, 'pay_1');
  assert.equal(evt?.paymentSource, 'gcash');
});

test('parse: malformed / missing fields → null or null charge (fail-closed)', () => {
  assert.equal(parsePaymongoEvent('not json'), null);
  assert.equal(parsePaymongoEvent('{}'), null);
  const noMeta = JSON.stringify({
    data: { id: 'evt_x', attributes: { type: 'checkout_session.payment.paid', data: { attributes: {} } } },
  });
  assert.equal(parsePaymongoEvent(noMeta)?.chargeId, null);
});

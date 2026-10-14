/**
 * The production app stamps whether it makes booking fees (owner 2026-10-13:
 * refuse the event lock while NEXT_PUBLIC_BOOKING_FEE_ENABLED is off). The SQL
 * half is `the-fee-is-made-at-the-yes.db.test.ts` § I.
 *
 * SABOTAGE (2026-10-13): let a preview stamp → RED; drop the instrumentation
 * call → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldStampBookingFeeMinting } from './booking-fee-minting-stamp';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

test('only PRODUCTION stamps — previews and local dev share the production database', () => {
  assert.equal(shouldStampBookingFeeMinting({ VERCEL_ENV: 'production' }), true);
  for (const env of [{ VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' }, {}]) {
    assert.equal(shouldStampBookingFeeMinting(env), false, `${JSON.stringify(env)} would switch off the live lock`);
  }
});

test('the server start stamps it, never waiting on it', () => {
  const src = stripComments(readFileSync(join(WEB, 'instrumentation.ts'), 'utf8'));
  assert.match(src, /shouldStampBookingFeeMinting\(process\.env\)/);
  assert.match(src, /stampBookingFeeMinting\(createAdminClient\(\)\)/);
  assert.match(src, /void \(async \(\) =>/, 'startup must not wait on a database write');
});

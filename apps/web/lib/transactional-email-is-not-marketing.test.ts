/**
 * Guard — a transactional email is never gated on marketing consent.
 *
 * 🚨 THIS SHIPPED BROKEN AND NOTHING NOTICED. All six `lock_request_*` types sat
 * in BOTH `EMAIL_ENABLED_TYPES` and `MARKETING_GATED_EMAIL_TYPES`. The gate is
 * `!MARKETING_GATED.has(type) || recipient?.marketing_opt_in === true`, and
 * `users.marketing_opt_in` is `NOT NULL DEFAULT FALSE` — production carried
 * 9 users with 0 opted in. So the suppression was TOTAL: a supplier with seven
 * days to answer a booking request was never emailed, and the couple waiting on
 * that answer never heard either.
 *
 * 🔑 TWO LISTS, ONE CHECKED. `lock-request-notifications.test.ts` asserts
 * membership of the EMAIL set and never looks at the gated one, so both halves
 * agreed with each other and the suite stayed green. This file checks the
 * RELATIONSHIP between them, which is where the defect lived.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, 'notification-emit.ts');

/** The members of one `new Set([...])` literal, comments stripped. */
function setMembers(declaration: string): string[] {
  const src = stripComments(readFileSync(SRC, 'utf8'));
  const start = src.indexOf(declaration);
  if (start < 0) throw new Error(`${declaration} not found — was it renamed?`);
  const end = src.indexOf(']);', start);
  return Array.from(src.slice(start, end).matchAll(/'([a-z0-9_]+)'/g)).map(
    (m) => m[1] as string,
  );
}

/**
 * Types that are TRANSACTIONAL by nature: somebody is waiting on the content,
 * and it is not an invitation to engage. A booking request is not marketing.
 */
const TRANSACTIONAL = /^(lock_request_|deletion_request_|payment_|order_|refund_)/;

test('no transactional type is gated on marketing consent', () => {
  const gated = setMembers('const MARKETING_GATED_EMAIL_TYPES');
  const offenders = gated.filter((t) => TRANSACTIONAL.test(t));
  assert.deepEqual(
    offenders,
    [],
    `these transactional types are gated on marketing consent and will NEVER ` +
      `send (marketing_opt_in defaults FALSE): ${offenders.join(', ')}. ` +
      'Somebody is waiting on each of these and would simply never hear.',
  );
});

test('the six lock-request emails are enabled and ungated', () => {
  const email = setMembers('const EMAIL_ENABLED_TYPES');
  const gated = setMembers('const MARKETING_GATED_EMAIL_TYPES');
  const six = [
    'lock_request_received',
    'lock_request_nudge',
    'lock_request_agreed',
    'lock_request_declined',
    'lock_request_expired',
    'lock_request_withdrawn',
  ];
  for (const t of six) {
    assert.ok(email.includes(t), `${t} lost its email — the channel is the whole point`);
    assert.ok(
      !gated.includes(t),
      `${t} is back in the marketing-gated set, which suppresses it for every ` +
        'user who has not opted in — that is everybody, by default',
    );
  }
});

test('the gated set still holds the genuinely engagement-shaped type', () => {
  // The guard must not become "the gated set is empty" — that would be a
  // different defect, sending marketing-adjacent mail to people who declined it.
  assert.ok(
    setMembers('const MARKETING_GATED_EMAIL_TYPES').includes(
      'new_chapter_from_followed',
    ),
    '"someone you follow posted" is marketing-adjacent and MUST stay gated',
  );
});

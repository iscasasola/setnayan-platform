/**
 * Guards for the Resend verification stamp.
 *
 * `lib/integrations/write.ts` is `import 'server-only'` and every function in it
 * is I/O against the service-role client, so there is no pure rule here to call.
 * What CAN be held down is the shape of the write — and the shape is the whole
 * correctness argument, so these are source assertions rather than nothing.
 *
 * Two properties, both of which were wrong (or absent) before:
 *   1. the stamp is guarded on the key actually being in the DATABASE, in the
 *      same statement as the write — otherwise a send that used the env fallback
 *      makes the console show "Last verified" under "Not configured";
 *   2. the smoke-test route only stamps when the email genuinely sent, and never
 *      lets a failed stamp change what it reports about the email.
 *
 * A source assertion is a weak test and is used here deliberately, not lazily:
 * the alternative is mocking the Supabase builder chain, which would assert that
 * a mock was called rather than that the query is right.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WRITE_TS = fs.readFileSync(path.join(HERE, 'write.ts'), 'utf8');
const ROUTE_TS = fs.readFileSync(
  path.join(HERE, '../../app/api/admin/smoke-test/route.ts'),
  'utf8',
);

/** The body of markResendKeyVerified, so assertions can't match a neighbour. */
function markResendKeyVerifiedBody(): string {
  const start = WRITE_TS.indexOf('export async function markResendKeyVerified');
  assert.ok(start > -1, 'markResendKeyVerified must exist — it is the fix');
  const rest = WRITE_TS.slice(start);
  const end = rest.indexOf('\n}\n');
  assert.ok(end > -1, 'could not find the end of markResendKeyVerified');
  return rest.slice(0, end);
}

test('the stamp is guarded on the key being in the DB, in the same statement', () => {
  const body = markResendKeyVerifiedBody();

  // THE guard. Without it a send that used process.env.RESEND_API_KEY would
  // stamp a row that holds no key at all.
  assert.match(
    body,
    /\.not\(\s*'resend_api_key_enc'\s*,\s*'is'\s*,\s*null\s*\)/,
    'the update must filter on resend_api_key_enc IS NOT NULL',
  );

  // In the WHERE clause, not a read-then-write: a separate existence check
  // would leave a window for a concurrent clear to land between the two.
  assert.ok(
    !/\.select\([^)]*resend_api_key_enc/.test(body),
    'must not read the key first — the guard belongs in the update itself',
  );

  assert.match(body, /last_verified_at:/, 'it must actually set last_verified_at');
});

test('the stamp never throws — a failed stamp must not fail a sent email', () => {
  const body = markResendKeyVerifiedBody();
  assert.match(body, /try\s*{/, 'the write must be wrapped');
  assert.match(body, /catch\s*{\s*return false;?\s*}/, 'a thrown client must return false, not propagate');
});

test('the route stamps only on a genuine send', () => {
  assert.match(
    ROUTE_TS,
    /result\.ok\s*\?\s*await markResendKeyVerified\(\)\s*:\s*false/,
    'markResendKeyVerified must be reached only when result.ok is true',
  );
});

test('the reported email outcome is independent of the stamp', () => {
  // `ok` is the email's verdict. If the stamp ever became part of it, a
  // cosmetic timestamp failure would report a working email as broken.
  assert.match(ROUTE_TS, /ok:\s*result\.ok,/, 'ok must remain result.ok verbatim');
  assert.ok(
    !/ok:\s*result\.ok\s*&&/.test(ROUTE_TS),
    'the stamp result must never be ANDed into the email verdict',
  );
});

test('clearing the key still nulls the stamp — the pair stays symmetric', () => {
  // The inverse rule this function was written to complete. If a future edit
  // drops the companion, the console would claim a verified key that is gone.
  assert.match(
    WRITE_TS,
    /COMPANION_NULL_ON_CLEAR[\s\S]{0,200}resend_api_key_enc:\s*\[\s*'last_verified_at'\s*\]/,
    'clearing resend_api_key_enc must still null last_verified_at',
  );
});

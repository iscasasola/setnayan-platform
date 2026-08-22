/**
 * a-404-must-not-be-able-to-crash.test.ts — a word matching no event returns
 * "we can't find that", even when the courtesy lookups fail.
 *
 * 🔴 WHAT THIS IS FOR. On 2026-08-21 every unknown top-level address on the live
 * site returned a **server error with an empty body** — measured three times,
 * consistently. By evening the same addresses returned a correct 404, with
 * nothing in between that touched this route. Whatever failed was transient,
 * and that is exactly the problem: the 404 DEPENDED on a read that can fail.
 *
 * Google treats a 5xx as *"the site is broken, come back later"* and keeps the
 * URL; it treats a 404 as *"that page is gone."* A person gets a blank crash
 * page instead of a sentence.
 *
 * 🔑 THE MISS PATH USES THE ADMIN CLIENT EXACTLY ONCE, for retired-address
 * forwarding — a kindness to whoever printed an old link. A kindness must not
 * be able to escalate a not-found into a crash. Hence the try/catch this file
 * pins.
 *
 * ⚠ AND `redirect()` MUST STAY OUTSIDE IT. Next implements `redirect()` by
 * THROWING; catching around it would swallow every forward and silently strand
 * the printed QR the block exists to rescue. That is asserted here too, because
 * it is the exact mistake a later tidy-up would make.
 *
 * SOURCE-LEVEL: it proves the shape of the miss path. The live behaviour is
 * what established the fault.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = readFileSync(join(HERE, '..', 'page.tsx'), 'utf8');
/** comments here quote the very code under test */
const CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('the retired-address lookup cannot turn a not-found into a crash', () => {
  const call = CODE.indexOf('resolveRenamedPath(');
  assert.ok(call > 0, 'the miss path should still attempt retired-address forwarding');

  // the 300 characters before the call must open a try
  const before = CODE.slice(Math.max(0, call - 300), call);
  assert.ok(
    /try\s*\{[^}]*$/.test(before),
    'resolveRenamedPath must sit inside a try — it is the ONLY admin-client use ' +
      'on the miss path, and a failure there must still produce a real 404.',
  );
  assert.ok(
    /catch\s*\{/.test(CODE.slice(call, call + 300)),
    'and the catch must fall through to the vendor check, which notFound()s',
  );
});

test('redirect() stays OUTSIDE that try — Next implements it by throwing', () => {
  const call = CODE.indexOf('resolveRenamedPath(');
  const after = CODE.slice(call, call + 400);
  const catchAt = after.indexOf('catch');
  const redirectAt = after.indexOf('redirect(renamedTo)');
  assert.ok(redirectAt > 0, 'the forward must still happen when a rename is found');
  assert.ok(
    catchAt > 0 && redirectAt > catchAt,
    'redirect(renamedTo) must come AFTER the catch block closes. Inside the try ' +
      'it would be swallowed as an error, silently stranding every printed QR ' +
      'for a renamed celebration — the exact harm this forwarding exists to prevent.',
  );
});

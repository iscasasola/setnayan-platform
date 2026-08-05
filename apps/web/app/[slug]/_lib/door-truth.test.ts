/**
 * door-truth.test.ts — the door must not lie about who you are, or about why
 * you are being turned away.
 *
 * Three reads decide whether a person gets into an invitation, and all three
 * gave a confident wrong answer:
 *
 *   1. `loadEventShell` discarded its error, so a failed read looked exactly
 *      like "no event has this slug". Callers turn that into notFound() — a
 *      guest at the venue is told their printed link is wrong, and Google is
 *      told the page does not exist.
 *   2. `loadGuestContext` did the same with the guest row, producing the
 *      `not_found` branch that renders "we couldn't find that invitation".
 *   3. `loadHostMembership` selected `member_type` and never compared it, so
 *      ANY `event_members` row counted as a host — including `'guest'`, which
 *      is what a person gets for scanning the event QR. They could open a
 *      PRIVATE site and use `?phase=` to jump ahead of phases the couple had
 *      not launched.
 *
 * `loaders.ts` is `server-only` and cannot be imported here, so (1) and (2) are
 * source assertions — which suits them, because the defect IS a destructure
 * that drops `error`, and what a test can honestly check is that the error is
 * bound and acted on before the branch that accuses the guest. For (3) the RULE
 * is imported and run for real; only the fact that the query applies it is read
 * from source. Neither of those is a proof that Postgres filters the row — that
 * belongs in a db test, and this file does not pretend otherwise.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HOST_MEMBER_TYPES, isHostMemberType } from './host-scope';

// `new URL(...).pathname` percent-encodes the brackets in `[slug]`.
const HERE = dirname(fileURLToPath(import.meta.url));
const LOADERS = readFileSync(join(HERE, 'loaders.ts'), 'utf8');

/** Slice one exported loader's source, so an assertion about it cannot be
 *  satisfied by an unrelated `error` elsewhere in a 900-line file. */
function loaderSource(name: string): string {
  const start = LOADERS.indexOf(`export const ${name} = cache(`);
  assert.notEqual(start, -1, `${name} is gone or renamed — update this test.`);
  const next = LOADERS.indexOf('\nexport const ', start + 10);
  return LOADERS.slice(start, next === -1 ? undefined : next);
}

test('loadEventShell tells a failed read apart from a missing event', () => {
  const src = loaderSource('loadEventShell');
  assert.match(
    src,
    /const \{ data, error \} = await/,
    'The error is being discarded again. A discarded error becomes `data = null`, ' +
      'which every caller reads as "no such slug" and answers with a 404.',
  );
  assert.match(
    src,
    /if \(error\) \{[\s\S]*?throw new Error/,
    'The error is bound but not acted on — the same bug with a variable name.',
  );
});

test('loadGuestContext tells a failed read apart from a guest who is not there', () => {
  const src = loaderSource('loadGuestContext');
  assert.match(
    src,
    /const \{ data: guest, error: guestError \} = await/,
    'The guest read discards its error again.',
  );
  const handled = src.indexOf('if (guestError)');
  const accuses = src.indexOf("kind: 'not_found'");
  assert.ok(handled !== -1, 'The guest read error is never handled.');
  assert.ok(
    handled < accuses,
    'The error must be handled BEFORE the not_found branch, or a broken read ' +
      'still tells the guest "we couldn\'t find that invitation".',
  );
});

test('loadHostMembership actually filters on member_type', () => {
  const src = loaderSource('loadHostMembership');
  assert.match(
    src,
    /\.in\('member_type', \[\.\.\.HOST_MEMBER_TYPES\]\)/,
    'The members query no longer filters by member_type, so every row counts as ' +
      'a host again — including the `guest` row a QR scan creates.',
  );
  // The moderators half is a different table with its own accepted/removed
  // gating; narrowing the members query must not have taken it with it.
  assert.match(
    src,
    /from\('event_moderators'\)/,
    'The 0048 multi-host invite path is gone — an accepted moderator would lose ' +
      'access to an event they were invited to co-host.',
  );
});

// ── the rule itself, run for real ────────────────────────────────────────────

test('a guest who scanned the QR is not a host', () => {
  assert.equal(
    isHostMemberType('guest'),
    false,
    '`event_members` is the event\'s PEOPLE table, not a host table. Being in it ' +
      'means you are AT the wedding, not that you are throwing it.',
  );
});

test('the couple and their coordinator are', () => {
  assert.equal(isHostMemberType('couple'), true);
  assert.equal(isHostMemberType('coordinator'), true);
});

test('nothing else is, including nothing at all', () => {
  for (const value of [null, undefined, '', 'vendor', 'moderator', 'admin', 'GUEST', 'Couple']) {
    assert.equal(
      isHostMemberType(value),
      false,
      `"${String(value)}" must not open a private site. Note the case-sensitivity: ` +
        `the comparison is exact, matching how the enum is stored.`,
    );
  }
});

test('the host set stays the pair the rest of the codebase gates on', () => {
  // The check-in desk, the checklist RLS and the couple-scope helpers all use
  // ('couple','coordinator'). A THIRD definition of "host" living in one reader
  // is precisely the bug this file exists for — do not widen this without
  // widening those, in the same change.
  assert.deepEqual([...HOST_MEMBER_TYPES], ['couple', 'coordinator']);
});

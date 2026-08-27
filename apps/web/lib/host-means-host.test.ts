/**
 * HOST MEANS HOST — and a seat-holder still gets in.
 *
 * ── WHAT THIS PINS, AND WHY IT IS A SOURCE SCAN ─────────────────────────────
 * `lib/slug-access.ts` is `server-only`, so a unit test cannot import it. The
 * two facts below are therefore asserted against the SOURCE, which is exactly
 * where the defect lived: a query that selected `member_type` and never
 * compared it.
 *
 * 1 · BOTH TWINS FILTER ON THE ONE SHARED DEFINITION.
 *   `event_members` IS NOT A HOST TABLE — `'guest'` is one of its member types,
 *   written by the event-QR scan-to-join, the cookie link and the cross-device
 *   magic link. `loadHostMembership` (app/[slug]/_lib/loaders.ts) was fixed and
 *   pinned; its clone `isSignedInEventHost` (lib/slug-access.ts) never inherited
 *   the fix, so ANY signed-in member — a guest who merely scanned the QR — read
 *   as a HOST: through the private gate on all seven sub-routes, and past the
 *   keepsake reader, which answers true for a host BEFORE it tests the audience.
 *   A clone inherits the bug its twin fixed, so the guard covers the PAIR.
 *
 * 2 · THE SHARED GATE HAS A SEAT-HOLDER ARM.
 *   The over-wide host check was masking a missing arm: `app/[slug]/page.tsx`
 *   admits a seat-holder on `private`, the shared gate did not. Narrowing host
 *   without adding it would bounce every invited guest whose 60-day cookie has
 *   expired — the ordinary case, since save-the-dates go out 6–12 months ahead.
 *   The two must never diverge again, so both are asserted here.
 *
 * ── MUTATIONS, EACH MEASURED BY OCCURRENCE COUNT ────────────────────────────
 * · delete the member-type filter from either twin → `.in('member_type'` across
 *   the two files 2 → 1 · RED.
 * · delete the seat-holder arm from the shared gate → `findGuestSeatForUser`
 *   in slug-access.ts 1 → 0 · RED.
 * · delete it from the page instead → in page.tsx 2 → 0 · RED.
 * An unmeasured mutation proves nothing; five guards have shipped in this repo
 * protecting nothing, and every one was found by counting.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HOST_MEMBER_TYPES, isHostMemberType } from '@/app/[slug]/_lib/host-scope';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const SHARED_GATE = 'lib/slug-access.ts';
const CACHED_TWIN = join('app', '[slug]', '_lib', 'loaders.ts');
const PAGE = join('app', '[slug]', 'page.tsx');

/** Occurrences of a plain substring — the count is what makes a mutation real. */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test('both host reads FILTER on member_type, not merely select it', () => {
  const filter = ".in('member_type', [...HOST_MEMBER_TYPES])";
  const found = [SHARED_GATE, CACHED_TWIN].map((f) => count(read(f), filter));
  assert.deepEqual(
    found,
    [1, 1],
    `each of ${SHARED_GATE} and ${CACHED_TWIN} must filter event_members on ` +
      'HOST_MEMBER_TYPES. A read that selects member_type without comparing it ' +
      'treats a QR-scan guest as a host — the bug host-scope.ts was written to kill.',
  );
  assert.equal(
    found.reduce((a, b) => a + b, 0),
    2,
    'the pair is what is pinned; one copy holding a laxer rule is the defect',
  );
});

test('both host reads import the ONE shared definition, never a retyped literal', () => {
  for (const file of [SHARED_GATE, CACHED_TWIN]) {
    assert.ok(
      /import\s*\{[^}]*HOST_MEMBER_TYPES/.test(read(file)),
      `${file} must import HOST_MEMBER_TYPES rather than retype 'couple'/'coordinator'`,
    );
  }
});

test("'guest' is not a host, and the host set is exactly couple + coordinator", () => {
  assert.equal(isHostMemberType('guest'), false);
  assert.equal(isHostMemberType(null), false);
  assert.equal(isHostMemberType('couple'), true);
  assert.deepEqual([...HOST_MEMBER_TYPES], ['couple', 'coordinator']);
});

test('the shared gate admits a SEAT-HOLDER, exactly as the page already does', () => {
  // The CALL, not the import or a comment naming it — a file-level count cannot
  // say whether the arm still runs.
  const gate = count(read(SHARED_GATE), 'findGuestSeatForUser(eventId');
  const page = count(read(PAGE), 'findGuestSeatForUser(event.event_id');
  assert.ok(
    gate >= 1,
    'lib/slug-access.ts must admit a signed-in seat-holder. Without this arm the ' +
      'host narrowing bounces every invited guest whose 60-day cookie has expired ' +
      'off all seven sub-routes — the case the page was rewritten to admit.',
  );
  assert.ok(
    page >= 1,
    'app/[slug]/page.tsx lost its seat-holder arm — the two gates have diverged again',
  );
});

test('the seat-holder arm is not fenced behind invited_accounts only', () => {
  const src = read(SHARED_GATE);
  const seatAt = src.indexOf('findGuestSeatForUser(eventId');
  const invitedAt = src.indexOf('requiresInvitedAccount(visibility)');
  assert.ok(seatAt > 0 && invitedAt > 0, 'both arms must exist in the shared gate');
  assert.ok(
    seatAt < invitedAt,
    'the seat-holder arm must run BEFORE (and outside) the invited_accounts ' +
      "branch — a 'private' event admits seat-holders too, which is what the page does",
  );
});

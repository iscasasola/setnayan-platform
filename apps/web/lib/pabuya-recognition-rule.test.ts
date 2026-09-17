import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { viewerIsRecognised } from '@/lib/pabuya-recognition-rule';
import { HOST_MEMBER_TYPES } from '@/app/[slug]/_lib/host-scope';
import { stripComments } from '@/lib/strip-comments';

/**
 * THE RULE THE OWNER GAVE TWICE, FINALLY EXECUTED.
 *
 * "Gate the account number" (2026-09-15), then "gate the wallet handles too" —
 * the whole payment identifier, the QR included, is for invited guests and
 * hosts, never for the internet.
 *
 * 🔴 UNTIL NOW IT WAS GUARDED BY REGEXES OVER PROSE. `lib/pabuya-recognition.ts`
 * is `server-only`, so no test could import it; the three assertions that
 * referenced it read its own source text. A rename inside the function passed
 * every one. The decision now lives in a pure module and every combination
 * below is a real call.
 */

const EVENT = '044f7e64-95aa-4dcb-84c1-7263bf494eaa';
const OTHER = '11111111-2222-3333-4444-555555555555';

let ran = 0;
const recognised = (facts: Parameters<typeof viewerIsRecognised>[0]) => {
  ran++;
  return viewerIsRecognised(facts);
};

test('a guest carrying a session for THIS event is recognised', () => {
  assert.equal(
    recognised({ guestSessionEventId: EVENT, eventId: EVENT, memberType: null }),
    true,
  );
});

test('🔒 a session for ANOTHER celebration is not', () => {
  assert.equal(
    recognised({ guestSessionEventId: OTHER, eventId: EVENT, memberType: null }),
    false,
    'a guest at one wedding could read another couple’s bank details',
  );
});

test('🔒 a passer-by holding the link is not recognised — deliberately', () => {
  assert.equal(
    recognised({ guestSessionEventId: null, eventId: EVENT, memberType: null }),
    false,
    'holding the link is how a relative abroad REACHES the page; it is not how they earn the number',
  );
});

test('every host member type is recognised', () => {
  for (const t of HOST_MEMBER_TYPES) {
    assert.equal(
      recognised({ guestSessionEventId: null, eventId: EVENT, memberType: t }),
      true,
      `${t} is a host type and was refused — a co-host would be locked out of their own page`,
    );
  }
});

test('🔒 EXISTENCE IS NOT AUTHORITY — a non-host member row is refused', () => {
  /*
    The regression host-scope.ts records: a `guest`-typed member row once waved
    somebody into a private site because membership was tested for EXISTENCE and
    never compared. These rows all EXIST; none of them is a host.
  */
  for (const t of ['guest', 'vendor', 'viewer', 'supplier', '', 'COUPLE', 'Couple']) {
    assert.equal(
      recognised({ guestSessionEventId: null, eventId: EVENT, memberType: t }),
      false,
      `member_type ${JSON.stringify(t)} was treated as a host`,
    );
  }
});

test('🔒 a null/absent event id on the session cannot match a null event id', () => {
  // Defensive: if both sides were ever null, `null === null` would recognise
  // every reader on a page whose event id failed to resolve.
  assert.equal(
    recognised({ guestSessionEventId: null, eventId: null as unknown as string, memberType: null }),
    false,
    'two nulls compared equal and recognised a stranger',
  );
});

test('the two arms are independent — either alone suffices, neither is required', () => {
  assert.equal(
    recognised({ guestSessionEventId: EVENT, eventId: EVENT, memberType: 'guest' }),
    true,
    'a valid guest session was overridden by a non-host member row',
  );
  assert.equal(
    recognised({ guestSessionEventId: OTHER, eventId: EVENT, memberType: 'couple' }),
    true,
    'a signed-in couple was refused because they also held another event’s session',
  );
});

test('the server module gathers facts and decides NOTHING', () => {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'lib/pabuya-recognition.ts'), 'utf8'),
  );
  assert.match(src, /viewerIsRecognised\(\{/, 'the server module no longer calls the pure rule');
  assert.ok(
    !src.includes('isHostMemberType'),
    'the decision is back inside the server-only module, where no test can execute it',
  );
  // The raw string must be threaded through, never reduced to a boolean.
  assert.match(
    src,
    /memberType,?\s*\n?\s*\}\)/,
    'memberType is not passed through — a hasRow boolean here re-creates the host-scope regression',
  );
});

test('case count', () => {
  console.log(`      (${ran} recognition decisions executed)`);
  assert.ok(ran >= 15, `expected >= 15 executed decisions, ran ${ran}`);
});

test('⚖ TWO DEFINITIONS OF "HOST" EXIST, AND CONVERGING THEM IS AN OWNER CALL', () => {
  /*
    The gift surfaces ask "is this a host?" in two places, with two answers:

      · RECOGNITION (this rule) — `isHostMemberType`: an `event_members` row of
        type couple | coordinator. Decides whether IDENTIFIERS are disclosed.
      · THE QR ROUTE's host arm — `userHostsEvent`: `event_members` type couple,
        OR an accepted, non-removed `event_moderators` row in a primary host
        role. Decides whether a DISABLED method's image may be fetched.

    They diverge both ways. A COORDINATOR is recognised but is not a
    userHostsEvent host. An ACCEPTED MODERATOR with no host `event_members` row
    is a userHostsEvent host but is NOT recognised — so a co-host invited that
    way would have the account number withheld on their own celebration's page.

    🔢 MEASURED IN PRODUCTION 2026-09-17: 6 accepted moderators, **0** without a
    matching host member row; 1 coordinator. Reachable by construction, nobody
    affected today. Re-measure before acting — do not cite this number.

    ⚖ DELIBERATELY NOT CONVERGED HERE. Making recognition accept moderators
    WIDENS a disclosure rule, and DECISION_LOG 2026-09-15 records why that is
    not a session's call: the wallet-handle ruling was issued separately rather
    than inferred from the bank one, precisely because "widening a disclosure
    rule past what was asked is how the next person inherits a decision nobody
    made". Narrowing the route instead would lock a moderator out of their own
    dashboard thumbnail. Both directions are product decisions.

    This test exists so the divergence cannot be "tidied up" silently in either
    direction — a change to either definition must come with a ruling.
  */
  const hostTypes = [...HOST_MEMBER_TYPES].sort();
  assert.deepEqual(
    hostTypes,
    ['coordinator', 'couple'],
    'HOST_MEMBER_TYPES changed — recognition just widened or narrowed; where is the ruling?',
  );
  // A moderator is not an event_members type at all, so recognition cannot see
  // one. Pinned as a FACT about the current rule, not as an endorsement.
  assert.equal(
    recognised({ guestSessionEventId: null, eventId: EVENT, memberType: 'moderator' }),
    false,
    'recognition started accepting a moderator type — that is the widening that needs a ruling',
  );
});

/**
 * GUARD — both doors that create an event must ask the WIDENED question, and
 * neither may widen the CAP while doing it.
 *
 * `lib/honoree-dependent-link.test.ts` proves the predicate. This proves it is
 * actually WIRED — which is the half that goes wrong. `isGatedLifeType` was
 * doing double duty at these exact call sites: it is the cap's vocabulary, and
 * it was also, by accident, the gate on whether an event could name a subject at
 * all. So `corporate` and `gala_night` posted a dependent id and the server
 * dropped it one line before it would have been verified.
 *
 * ⚠ COUNTS, NOT PRESENCE. A file-level "does it mention the predicate" match
 * cannot say WHICH of two call sites still holds it — reverting one and leaving
 * the other reads green. Both gates in `create-event/actions.ts` are asserted
 * individually AND counted, so removing either one fails.
 *
 * ⚠ THE TWO DOORS. `create-event/actions.ts` (the inline form, which is what
 * `corporate` and `gala_night` actually use — both have a NULL
 * `onboarding_href`) and `onboarding/_shared/commit-event.ts` (the generic
 * wizard). The second had NO type gate at all before 2026-08-31: the client was
 * the only thing deciding, on a server action reachable by direct POST.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const CREATE_ACTION = 'app/dashboard/(account)/create-event/actions.ts';
const COMMIT = 'app/onboarding/_shared/commit-event.ts';
const PICKER = 'app/dashboard/(account)/create-event/_components/event-type-picker.tsx';
const WIZARD = 'app/onboarding/[type]/_components/generic-onboarding.tsx';

function count(haystack: string, needle: RegExp): number {
  return (haystack.match(needle) ?? []).length;
}

test('the inline create action gates BOTH halves of the link on the widened predicate', () => {
  const src = read(CREATE_ACTION);
  // The label — without it `resolveHonoreeDependentId` has nothing to match the
  // dependent's name against, so the id would resolve to NULL anyway.
  assert.match(
    src,
    /eventTypeAcceptsHonoreeLink\(event_type\) && honoree_label_raw/,
    'the honoree LABEL gate was reverted',
  );
  // …and the id itself.
  assert.match(
    src,
    /eventTypeAcceptsHonoreeLink\(event_type\) && isDependentId\(honoree_dependent_id_raw\)/,
    'the honoree DEPENDENT ID gate was reverted',
  );
  assert.equal(
    count(src, /eventTypeAcceptsHonoreeLink\(event_type\)/g),
    2,
    'exactly two gates — reverting one and leaving the other must not read green',
  );
});

/**
 * 🔴 THE CAP MUST NOT MOVE. Widening the permission to NAME a subject must not
 * widen the one-in-planning cap: a company may hold as many gala nights in
 * planning as it likes. The cap's own branch still reads `isGatedLifeType`.
 */
test('the cap still keys on isGatedLifeType, untouched', () => {
  const src = read(CREATE_ACTION);
  assert.match(src, /if \(!isWedding && isGatedLifeType\(event_type\)\) \{/);
});

test('the wizard door gates on the server, not only in the client', () => {
  const src = read(COMMIT);
  assert.match(
    src,
    /if \(eventTypeAcceptsHonoreeLink\(payload\.eventType\) && isDependentId\(payload\.honoreeDependentId\)\)/,
    'commit-event must refuse a type that may not name a subject — it is reachable by direct POST',
  );
});

test('both collecting surfaces ask the question for the business types', () => {
  assert.match(
    read(PICKER),
    /\{eventTypeAcceptsHonoreeLink\(selected\.key\) && !samahanCommunityId \? \(/,
    'the inline picker stopped offering the honoree field',
  );
  const wizard = read(WIZARD);
  assert.match(wizard, /const asksHonoree = eventTypeAcceptsHonoreeLink\(eventType\);/);
  assert.match(wizard, /honoreeDependentId: asksHonoree \? honoreeDependentId : null,/);
  assert.match(wizard, /honoreeLabel: asksHonoree \? honoree\.trim\(\) \|\| null : null,/);
});

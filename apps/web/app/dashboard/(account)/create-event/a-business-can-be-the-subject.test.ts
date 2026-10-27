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

// 2026-10-22: the per-door gates this test used to count are gone — every door
// now asks ONE answer, `resolveEventHonoree` (lib/honoree-dependent-link.ts),
// which keeps the label + link for these types and also links a shop on every
// other type it is picked for. The wiring of all three doors, and the property
// over the whole roster, live in `every-event-for-the-shop-links-it.test.ts`.
test('the inline create action takes BOTH halves of the link from the one answer', () => {
  const src = read(CREATE_ACTION);
  assert.match(
    src,
    /const \{ honoreeLabel: honoree_label, honoreeDependentId: honoree_dependent_id \} =\s*await resolveEventHonoree\(/,
    'the label and the id must both come from resolveEventHonoree',
  );
  assert.equal(count(src, /await resolveEventHonoree\(/g), 1, 'exactly one answer per door');
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
    /const \{ honoreeLabel, honoreeDependentId \} = await resolveEventHonoree\(createAdminClient, \{/,
    'commit-event must ask the server-side answer — it is reachable by direct POST',
  );
});

test('both collecting surfaces ask the question for the business types', () => {
  assert.match(
    read(PICKER),
    /(?:\{|: )pickerAsksHonoree\(selected\.key, subject\?\.kind\) && !samahanCommunityId \? \(/,
    'the inline picker stopped offering the honoree field',
  );
  const wizard = read(WIZARD);
  assert.match(wizard, /const asksHonoree = eventTypeAcceptsHonoreeLink\(eventType\);/);
  assert.match(wizard, /honoreeDependentId: asksHonoree \? honoreeDependentId : carriedLink\?\.dependentId \?\? null,/);
  assert.match(wizard, /honoreeLabel: asksHonoree \? honoree\.trim\(\) \|\| null : carriedLink\?\.name \?\? null,/);
});

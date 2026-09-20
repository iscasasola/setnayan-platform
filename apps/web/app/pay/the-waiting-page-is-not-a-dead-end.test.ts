/**
 * the-waiting-page-is-not-a-dead-end.test.ts
 *
 * Owner, 2026-09-20, looking at his own /pay screen after logging a payment:
 * *"after paying, there is no way to return to that event overview."*
 *
 * 🔴 WHY A LINK AT THE TOP DID NOT COUNT. `payable.back` has rendered on this
 * page since it shipped — as a small underlined link ABOVE the first tile. By
 * the time somebody has read what they bought, the amount, the reference and
 * the "we're verifying your purchase" card, that link is off the top of the
 * screen. /pay carries no site chrome either (SiteChrome self-gates to the
 * marketing routes), so the browser's back button was the whole navigation.
 *
 * ⚖ AND ONE OF THE TWO FLOWS ALREADY HAD THE FIX. `setup && waiting` drew a
 * "Finish setting up" button at the bottom — so the buyer who paid during
 * onboarding was handed back to their celebration, and the buyer who paid from
 * inside it was not. This pins the exit to `waiting` itself, both arms.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const PAGE = readFileSync(join(process.cwd(), 'app/pay/[reference]/page.tsx'), 'utf8');
const SRC = stripComments(PAGE);

/** The exit block, sliced from its own opening to the brace that closes it. */
function exitBlock(): string {
  const at = SRC.indexOf('{waiting &&\n        (setup && payable.eventId ? (');
  assert.notEqual(
    at,
    -1,
    '🔴 the bottom-of-page exit must be gated on `waiting` ALONE — re-adding '
      + '`setup &&` in front of it is exactly the bug the owner hit',
  );
  const end = SRC.indexOf(') : null)}', at);
  assert.notEqual(end, -1, 'the exit block must close with its null arm');
  return SRC.slice(at, end);
}

test('🔴 a waiting buyer is given a way out, in BOTH arms', () => {
  const block = exitBlock();
  const links = block.match(/<Link\b/g) ?? [];
  assert.equal(
    links.length,
    2,
    `the exit must offer a destination in the set-up arm AND the ordinary one; found ${links.length}`,
  );
});

test('the ordinary arm reuses payable.back — never a second spelling of "where they came from"', () => {
  const block = exitBlock();
  assert.match(
    block,
    /href=\{payable\.back\.href\}/,
    'a hard-coded /dashboard here would send a supplier who paid on a '
      + 'couple-scoped order to the wrong place; the resolver already knows',
  );
  assert.match(block, /\{payable\.back\.label\}/, 'and its label, so the two exits agree');
});

test('the set-up arm still says what it always said', () => {
  assert.match(exitBlock(), /Finish setting up/, 'onboarding still ends on its own words');
});

test('🪤 the exit is not the only thing that must survive — the top link stays too', () => {
  assert.match(
    SRC,
    /payable\.back && \(\s*<Link/,
    'the pre-payment page keeps its top back link; this change ADDS an exit, it does not move one',
  );
});

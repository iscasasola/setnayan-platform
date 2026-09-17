/**
 * budget-footnote-does-not-bounce.test.ts
 *
 * B4 — the Event Hub's closing footnote linked to `${base}/budget`
 * unconditionally. On an event type whose profile does not enable the
 * budget surface, `budget/page.tsx` immediately does
 * `if (!surfaceEnabled(profile, 'budget')) redirect(`/dashboard/${eventId}`)`
 * — so the footnote sent the couple straight back to this same page. A link
 * that always bounces is worse than no link.
 *
 * The fix gates the footnote's budget `<Link>` on the SAME
 * `surfaceEnabled(profile, 'budget')` check the destination performs, so the
 * link is absent rather than circular.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the launch page computes its own budgetOn from surfaceEnabled', () => {
  const src = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(
    src,
    /const budgetOn = surfaceEnabled\(await resolveProfileByEvent\(eventId\), 'budget'\);/,
    'the footnote must reproduce the destination\'s own gate, not invent a new one',
  );
});

test('the footnote only renders the budget Link when budgetOn is true', () => {
  const src = read('app/dashboard/[eventId]/launch/page.tsx');
  const footnoteAt = src.indexOf('Booking suppliers lives in the');
  assert.ok(footnoteAt > -1, 'the footnote paragraph must still exist');
  const footnote = src.slice(footnoteAt, footnoteAt + 700);

  const budgetOnAt = footnote.indexOf('budgetOn');
  assert.ok(budgetOnAt > -1, 'the footnote must reference budgetOn at all');

  const budgetLinkAt = footnote.indexOf('${base}/budget');
  assert.ok(budgetLinkAt > -1, 'the footnote must still offer the budget link when enabled');

  // The Link to the budget page must sit textually AFTER the budgetOn check
  // that gates it (i.e. inside the `budgetOn ? (...) : (...)` true-branch),
  // never before it or outside any conditional.
  assert.ok(
    budgetOnAt < budgetLinkAt,
    'the budgetOn check must precede the budget Link it gates',
  );
});

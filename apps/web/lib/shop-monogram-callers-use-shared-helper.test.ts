/**
 * Guards the FILE SET for the shop/vendor monogram fix (owner ruling
 * 2026-09-11, "A shop with no reviews shows 'New'" pass, part 2 — the letter
 * monogram defect found on the way).
 *
 * The bug: several files hand-rolled their own `initials(name)` /
 * `initialsOf(name)`, all taking the literal first CHARACTER of the first
 * and last whitespace-separated word — so "Saysay Live Band & Hosting
 * (FIXTURE)" rendered "S(". lib/shop-initials.ts is the one shared
 * replacement (see shop-initials.test.ts for its own behaviour).
 *
 * This test enumerates every shop/vendor-facing caller found by
 * `git grep "initialsOf\|function initials\|initialsFrom\|initialsFromName"`
 * at the time of the fix and asserts each one now imports and calls
 * `shopInitials` from '@/lib/shop-initials' — NOT the old first+last-
 * character pattern. If a new shop/vendor monogram caller is added later
 * without using the shared helper, this list will not catch it (a fresh
 * `git grep` is the real source of truth) — but it stops any of the FIXED
 * files from silently regressing back to a local copy.
 *
 * Explicitly OUT of scope (people / guest initials, not shop/vendor — left
 * alone per the 2026-09-11 brief):
 *   - app/_components/plan3d/guest-avatar.tsx (initialsFromName — 3D guest avatar)
 *   - lib/guests.ts (guestInitials — structured first_name/last_name, not a
 *     free-text split, so the bracket/ampersand bug does not apply the same way)
 *   - app/admin/users/[userId]/page.tsx, app/vendor-dashboard/clients/[eventId]/page.tsx,
 *     app/vendor-dashboard/customers/_components/customers-roster.tsx,
 *     app/dashboard/[eventId]/details/_components/governed-fields.tsx,
 *     app/_components/frontdoor/rail-data.ts (initialsFrom(email,name) — the
 *     signed-in account's OWN avatar, a person)
 *   - lib/auto-recap.ts, lib/concept-pdf.ts, lib/seating-pdf.ts,
 *     lib/conversation-list.ts, app/dashboard/[eventId]/studio/papic/magazine/route.ts
 *     (event/couple monogram text, a different concept from a shop mark)
 *
 * Run: `pnpm test:unit` (globs lib/**\/*.test.ts + app/**\/*.test.ts, tsx --test).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

/** Every file that rendered a shop/vendor monogram via a hand-rolled
 * first+last-CHARACTER split, fixed to delegate to lib/shop-initials.ts. */
const FIXED_FILES = [
  'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx',
  'app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx',
  'app/dashboard/[eventId]/vendors/_components/vendor-quickview-inspector.tsx',
  'app/tour/vendors/_components/tour-shortlist.tsx',
  'app/_components/plan3d/booth-vendor-card.tsx',
  'app/_components/frontdoor/front-door-feed.tsx',
  'app/_components/frontdoor/front-door-results.tsx',
];

/** The exact bug pattern (letters/digits included, any punctuation-first
 * split): first character of `parts[0]`/`tokens[0]` concatenated with the
 * first character of the LAST element — this is what let "(FIXTURE)"'s "("
 * through. Matches both the `parts[0]![0]!` and `.charAt(0)` spellings seen
 * in the codebase. */
const OLD_BUG_PATTERN =
  /parts\[0\]!?\s*\[0\]!?\s*\+\s*parts\[parts\.length - 1\]!?\s*\[0\]!?|parts\[0\]!?\.charAt\(0\)\s*\+\s*parts\[parts\.length - 1\]!?\.charAt\(0\)/;

for (const rel of FIXED_FILES) {
  test(`${rel} delegates its monogram to the shared shopInitials helper`, () => {
    const src = read(rel);
    assert.match(
      src,
      /from ['"]@\/lib\/shop-initials['"]/,
      `${rel} must import shopInitials from '@/lib/shop-initials'`,
    );
    assert.match(src, /\bshopInitials\(/, `${rel} must actually call shopInitials(...)`);
    assert.doesNotMatch(
      src,
      OLD_BUG_PATTERN,
      `${rel} must not still carry the old first+last-CHARACTER split`,
    );
  });
}

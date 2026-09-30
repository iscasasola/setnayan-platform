/**
 * team-summary-chip.test.ts — the floating mobile team chip is RETIRED, and
 * stays retired.
 *
 * It was a pill that floated above the phone's bottom bar on the supplier page
 * (`Explore_Integration_BUILD_SPEC_2026-07-29.md` §5, owner-approved 2026-07-29),
 * repeating "N locked · N to lock · buffer". Owner, 2026-10-01 (DECISION_LOG
 * "THE BOTTOM BAR IS HOME · GUESTS · SUPPLIERS · HUB · MORE — AND NOTHING ELSE
 * FLOATS AT THE BOTTOM"): the phone keeps its simple bottom bar and nothing else
 * floats there. What the chip said now leads the page itself — the supplier rows,
 * booked first, one next step each (`vendors/_components/team-rows.tsx`) — and
 * the tiles in Picks.
 *
 * 🔑 A retired helper must be GONE, not merely uncalled: the component file, its
 * mount and the `teamchip-docked` padding it bought on the shell are all checked.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENDORS = 'app/dashboard/[eventId]/vendors';

test('the floating team chip component is gone', () => {
  assert.equal(existsSync(resolve(WEB, VENDORS, '_components/team-summary-chip.tsx')), false);
});

test('nothing on the supplier page mounts it again', () => {
  for (const rel of ['_components/build-locked.tsx', '_components/services-takeover.tsx', 'page.tsx']) {
    const src = stripComments(readFileSync(resolve(WEB, VENDORS, rel), 'utf8'));
    assert.doesNotMatch(src, /TeamSummaryChip|team-summary-chip/, `${rel} brought the floating chip back`);
  }
});

test('the shell no longer reserves room for it', () => {
  // The SELECTOR, not the word: the retirement note in globals.css names the class.
  const css = readFileSync(resolve(WEB, 'app/globals.css'), 'utf8');
  assert.doesNotMatch(css, /html\.teamchip-docked/, 'globals.css still pads the page for a chip that no longer exists');
});

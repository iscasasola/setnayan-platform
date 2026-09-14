/**
 * EVERY ROLE A WEDDING OFFERS IS EITHER PUBLISHED OR WRITTEN DOWN AS EXCLUDED.
 *
 * ── 🔴 THE DEFECT THIS EXISTS FOR, WHICH ALREADY HAPPENED ──────────────────
 * On 2026-09-14 `principal_sponsor` was split into a Ninong and a Ninang half
 * (migration 20271225194308, PR #5489). The invitation's entourage publishes
 * from an explicit ALLOW-LIST — closed on purpose, because that section puts
 * guest NAMES on a page anyone with the link can open — and the allow-list did
 * not learn the two new values. So a guest set to Ninong or Ninang was dropped
 * from the invitation entirely: `ENTOURAGE_ROLES` is ALSO the query's
 * `role.in.(…)` filter, so the row was never even read.
 *
 * 🔑 NOTHING WAS RED. Two suites, each internally consistent: the role split's
 * tests knew nothing about the invitation, and the invitation's tests knew
 * nothing about the split. The page rendered perfectly. And because the 47
 * legacy `principal_sponsor` rows were deliberately not backfilled, day one
 * would have looked correct — it would have surfaced weeks later, to a couple,
 * as "we changed her to Ninang and she vanished."
 *
 * So the check is not "are the two new roles there". It is the RULE that makes
 * the next one impossible to miss: whoever adds a role to the wedding cast gets
 * a red test naming their role and exactly two honest answers — publish it, or
 * write one line saying why a guest never reads that name.
 *
 * ── WHY BOTH ROLE SETS ─────────────────────────────────────────────────────
 * The Nikah cast (wali · witness · imam · wakil) is already published, so
 * checking the Catholic set alone would leave the next Muslim-wedding role to
 * fall through the exact door this file was written to close.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ENTOURAGE_ROLES } from './entourage';
import { WEDDING_ROLE_SET, MUSLIM_ROLE_SET } from './role-sets';
import type { GuestRole } from './guests';

/** The roles deliberately withheld, read from the committed record. */
function baselinedRoles(): Set<string> {
  const raw = readFileSync(join(process.cwd(), 'lib/entourage-unpublished.baseline.txt'), 'utf8');
  const roles = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [role, ...rest] = line.split('—');
      const reason = rest.join('—').trim();
      /* 🔑 A ROLE WITH NO REASON IS NOT BASELINED. The whole value of this file
         is the sentence after the dash; a bare role name would let somebody
         silence the guard without making a decision, which is the failure mode
         the file's own header warns about. */
      assert.ok(
        reason.length > 12,
        `${(role ?? '').trim()} is in the baseline with no usable reason — publish it or explain it`,
      );
      return (role ?? '').trim();
    });
  return new Set(roles);
}

test('the guard is not vacuous — the casts and the allow-list are real', () => {
  /* An empty list iterates zero times and passes forever, which reads exactly
     like a guard that works. This repo has been bitten by that shape more than
     once today alone (a test glob that matched nothing printed "# tests 0" and
     exited 0). */
  assert.ok(WEDDING_ROLE_SET.offeredRoles.length > 15, 'the wedding cast came back suspiciously short');
  assert.ok(MUSLIM_ROLE_SET.offeredRoles.length > 10, 'the Nikah cast came back suspiciously short');
  assert.ok(ENTOURAGE_ROLES.length > 15, 'the published list came back suspiciously short');
  assert.ok(baselinedRoles().size > 0, 'the baseline read empty — every exclusion would pass unchecked');
});

test('every wedding role is published, or baselined with a reason', () => {
  const published = new Set<string>(ENTOURAGE_ROLES);
  const excused = baselinedRoles();
  const orphans = (WEDDING_ROLE_SET.offeredRoles as readonly GuestRole[]).filter(
    (role) => !published.has(role) && !excused.has(role),
  );
  assert.deepEqual(
    orphans,
    [],
    `these wedding roles reach nobody on the invitation and are not written down as excluded: ${orphans.join(', ')}. ` +
      'Publish them in lib/entourage.ts, or add a line to lib/entourage-unpublished.baseline.txt saying why a guest never reads that name.',
  );
});

test('every Nikah role is published, or baselined with a reason', () => {
  const published = new Set<string>(ENTOURAGE_ROLES);
  const excused = baselinedRoles();
  const orphans = (MUSLIM_ROLE_SET.offeredRoles as readonly GuestRole[]).filter(
    (role) => !published.has(role) && !excused.has(role),
  );
  assert.deepEqual(orphans, [], `unhandled Nikah roles: ${orphans.join(', ')}`);
});

test('🔴 the regression itself: Ninong and Ninang reach the invitation', () => {
  /* Named explicitly as well as covered by the rule above, because this pair is
     the one that was live and broken, and a rule can be satisfied by baselining
     them — which would be the wrong answer written down convincingly. */
  const published = new Set<string>(ENTOURAGE_ROLES);
  for (const role of ['principal_sponsor_ninong', 'principal_sponsor_ninang', 'principal_sponsor']) {
    assert.ok(published.has(role), `${role} is not published — it would be dropped from every invitation`);
  }
});

test('nothing is both published and baselined', () => {
  /* Contradiction, not redundancy: one of the two says the opposite of the
     other, and whichever a later reader trusts, they are misled. */
  const excused = baselinedRoles();
  const both = ENTOURAGE_ROLES.filter((role) => excused.has(role));
  assert.deepEqual(both, [], `published AND baselined as excluded: ${both.join(', ')}`);
});

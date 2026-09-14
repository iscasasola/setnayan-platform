/**
 * WHEN ONE ROLE BECOMES TWO, THE TWO MUST INHERIT WHAT THE ONE HAD.
 *
 * ── THE FAILURE THIS EXISTS FOR, WHICH ALREADY HAPPENED ─────────────────────
 * On 2026-09-14 `principal_sponsor` was split into `principal_sponsor_ninong`
 * and `principal_sponsor_ninang`. The split updated the pickers, the grouping,
 * the ordering and the seating tiers — and missed `INNER_CIRCLE_ROLES` in
 * lib/guests.ts. So `defaultInvitedToForRole` quietly stopped recognising a
 * principal sponsor: every Ninong and Ninang added afterwards defaulted to
 * THREE blocks (ceremony · reception · cocktails) where the role they replaced
 * got FIVE.
 *
 * Measured on the live roster the next day: 37 of 38 principal sponsors sat at
 * three blocks. Nobody had been told. The couple's own godparents were not
 * invited to the after-party or the rehearsal dinner by default, and the guest
 * form showed no error — it rendered the stored value, which is exactly what it
 * is supposed to do.
 *
 * 🔑 THE DEFECT WAS AN OMISSION, AND AN OMISSION HAS NO SYNTAX. Nothing failed
 * to compile, no read was refused, no assertion in any of the eight files the
 * split DID touch could see a ninth that it had not. The only thing that can
 * catch this shape is a rule about the RELATIONSHIP between roles.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * Roles that share a role GROUP are the same kind of person to this product —
 * that is what putting them in one group means, and it is why they render under
 * one heading. So they must agree about a guest's STANDING: if one of them is
 * inner circle, all of them are.
 *
 * This is deliberately a property, not a list of the three sponsor roles. A
 * list would have to be remembered by the next person who splits a role, and
 * remembering is the thing that failed.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { defaultInvitedToForRole } from './guests';
import type { GuestRole } from './guests';
import { roleGroupOf } from './role-groups';
import { WEDDING_ROLE_SET, MUSLIM_ROLE_SET } from './role-sets';
import { allotmentRoleOf, suggestedAllotment } from './papic-guest-allotments';

/**
 * EVERY BEHAVIOUR KEYED ON A ROLE, in one place.
 *
 * Owner, relayed 2026-09-15: *"whatever their codes are on the app must stay.
 * both ninongs and ninangs should inherit what the original principal sponsor
 * does."* Inner-circle standing was the INSTANCE; this is the rule.
 *
 * 🔑 ADD A ROW HERE WHENEVER A NEW BEHAVIOUR KEYS ON `guests.role`. That is the
 * whole maintenance burden, and it is one line — deliberately cheaper than
 * remembering to update N scattered lists, because remembering is what failed
 * twice in two days.
 */
const KEYED_BEHAVIOURS: { name: string; of: (r: GuestRole) => string | number }[] = [
  {
    name: 'invited-to blocks (inner circle)',
    of: (r) => defaultInvitedToForRole(r).length,
  },
  {
    name: 'seating tier',
    of: (r) =>
      WEDDING_ROLE_SET.tier1Roles.has(r)
        ? 1
        : WEDDING_ROLE_SET.tier2Roles.has(r)
          ? 2
          : WEDDING_ROLE_SET.tier3Roles.has(r)
            ? 3
            : 4,
  },
  {
    name: 'Papic share weight (MONEY — photo credits)',
    // The second instance, found by extending this guard on 2026-09-15: a
    // ninong fell through to 'guest' at 1x while cord/veil/coin/candle
    // sponsors weighed 2x, so the godparents were OUTRANKED by the secondary
    // sponsors on a live roster.
    // ⚠ THE EFFECTIVE MULTIPLIER, NOT THE TIER NAME. A first cut compared
    // `allotmentRoleOf` itself and fired on the secondary sponsors — cord, veil,
    // coin and candle are four DISTINCT tier names that all resolve to the same
    // weight, which is correct and not a defect. What must match across a group
    // is what a guest actually GETS.
    of: (r) => suggestedAllotment(allotmentRoleOf(r, []), 10),
  },
];

/** Every role the product can put on a wedding guest, offered or retired. */
function allWeddingRoles(): GuestRole[] {
  return [
    ...new Set<GuestRole>([
      ...WEDDING_ROLE_SET.offeredRoles,
      ...MUSLIM_ROLE_SET.offeredRoles,
      // Retired 2026-09-15 but still writable in the enum, and still held by
      // rows on other people's events. It has to obey the rule too.
      'principal_sponsor' as GuestRole,
    ]),
  ];
}

/**
 * Groups that are ALLOWED to disagree, each with the reason and the date.
 *
 * ⚠ This is a decision log, not a mute button. A group belongs here only when
 * someone has LOOKED and judged the disagreement correct. Adding a line to
 * silence a red test is the failure this whole file is about, one level up.
 *
 * 📖 IT HAS HELD EXACTLY ONE ENTRY, AND THAT ENTRY IS GONE — which is the
 * outcome the design was for, so it is worth recording rather than leaving the
 * map blank and unexplained. On 2026-09-15 this guard's first run found
 * `witness` sitting outside INNER_CIRCLE_ROLES while `wali`, `imam` and `wakil`
 * sat inside it. It was NOT guessed at: how a Muslim ceremony seats its
 * witnesses is the owner's judgement, so it was parked here with a date and put
 * on his desk. He ruled the same day — "witness should be inner circle too" —
 * `lib/guests.ts` was corrected, and the stale-entry assertion below then
 * FORCED this line to be deleted rather than left as decoration.
 *
 * Park → ask → rule → delete. An empty map is the healthy state.
 */
const SANCTIONED_DISAGREEMENTS: Record<string, string> = {};

test('roles in the same group agree about EVERY keyed behaviour', () => {
  const byGroup = new Map<string, GuestRole[]>();
  for (const role of allWeddingRoles()) {
    const group = roleGroupOf(role);
    byGroup.set(group, [...(byGroup.get(group) ?? []), role]);
  }

  const seenDisagreements: string[] = [];

  for (const [group, roles] of byGroup) {
    if (roles.length < 2) continue;
    if (group in SANCTIONED_DISAGREEMENTS) {
      // Only counts as "seen" if it actually still disagrees about something.
      const anyDisagreement = KEYED_BEHAVIOURS.some(
        (b) => new Set(roles.map((r) => b.of(r))).size > 1,
      );
      if (anyDisagreement) {
        seenDisagreements.push(group);
        continue;
      }
    }
    for (const behaviour of KEYED_BEHAVIOURS) {
      const counts = new Map<string | number, GuestRole[]>();
      for (const r of roles) {
        counts.set(behaviour.of(r), [...(counts.get(behaviour.of(r)) ?? []), r]);
      }
      assert.equal(
        counts.size,
        1,
        `group "${group}" disagrees with itself about ${behaviour.name}: ` +
          [...counts.entries()]
            .map(([v, rs]) => `${v} → ${rs.join(', ')}`)
            .join('  |  ') +
          '. Roles under one heading are the same kind of guest to this product — ' +
          'that is what putting them in one group MEANS — so a behaviour keyed on ' +
          'the role must treat them identically. Owner 2026-09-15: "both ninongs ' +
          'and ninangs should inherit what the original principal sponsor does."',
      );
    }
  }

  // 🔑 THE EXCEPTION LIST MUST EXPIRE BY ITSELF. If a sanctioned group has
  // since been made consistent, the entry is stale — and a stale suppression is
  // indistinguishable from a live one right up until it hides a real defect.
  // Failing here forces the line to be DELETED once its reason is gone.
  const stale = Object.keys(SANCTIONED_DISAGREEMENTS).filter(
    (g) => !seenDisagreements.includes(g),
  );
  assert.deepEqual(
    stale,
    [],
    `SANCTIONED_DISAGREEMENTS still lists ${stale.join(', ')}, but ${
      stale.length === 1 ? 'it agrees' : 'they agree'
    } now. Delete the entry — an exception that no longer excepts anything is ` +
      'a comment pretending to be a rule.',
  );
});

test('THE REGRESSION: all three principal-sponsor roles are inner circle', () => {
  // The specific case above, stated plainly so a failure names the roster the
  // owner is actually looking at rather than only the abstract property.
  for (const role of [
    'principal_sponsor',
    'principal_sponsor_ninong',
    'principal_sponsor_ninang',
  ] as GuestRole[]) {
    assert.equal(
      defaultInvitedToForRole(role).length,
      5,
      `${role} must default to all five blocks — a ninong is not a plus-one`,
    );
  }
});

test('the rule has teeth: an ordinary guest is NOT inner circle', () => {
  // Without this, INNER_CIRCLE_ROLES could be widened to "everyone" and both
  // assertions above would pass while the distinction they protect is gone.
  assert.equal(defaultInvitedToForRole('guest' as GuestRole).length, 3);
  assert.equal(defaultInvitedToForRole('flower_girl' as GuestRole).length, 3);
});

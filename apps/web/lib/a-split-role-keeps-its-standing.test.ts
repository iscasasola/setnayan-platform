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
 */
const SANCTIONED_DISAGREEMENTS: Record<string, string> = {
  // Found by this very guard on 2026-09-15, on its first run.
  //
  // `INNER_CIRCLE_ROLES` names three of the four Nikah principals — wali, imam,
  // wakil — under a comment reading "Muslim Nikah principals are inner-circle
  // (invited to every block)". `witness` is the fourth and is absent, so a
  // Nikah witness defaults to three blocks while the other three get five.
  //
  // It reads exactly like the sponsor omission this file was written for, and
  // it may well be one. It is NOT being changed here, for two reasons: it is a
  // judgement about how a Muslim ceremony seats its witnesses, which is the
  // owner's to make and not a refactor's; and it is genuinely arguable, since a
  // witness attests the contract without necessarily being family the way a
  // wali is. Measured the same day: 0 guests in production hold any Nikah role
  // and no Muslim wedding exists yet, so nothing is on fire — which is the only
  // reason it is safe to leave open rather than guess.
  //
  // 🔑 SURFACED TO THE OWNER 2026-09-15. Delete this entry the moment he rules.
  muslim_principals:
    'witness vs wali/imam/wakil — awaiting an owner ruling on Nikah witnesses (0 live rows)',
};

test('roles in the same group agree about inner-circle standing', () => {
  const byGroup = new Map<string, GuestRole[]>();
  for (const role of allWeddingRoles()) {
    const group = roleGroupOf(role);
    byGroup.set(group, [...(byGroup.get(group) ?? []), role]);
  }

  const seenDisagreements: string[] = [];

  for (const [group, roles] of byGroup) {
    if (roles.length < 2) continue;
    const blocksFor = (r: GuestRole) => defaultInvitedToForRole(r).length;
    const counts = new Map<number, GuestRole[]>();
    for (const r of roles) {
      counts.set(blocksFor(r), [...(counts.get(blocksFor(r)) ?? []), r]);
    }
    if (counts.size > 1 && group in SANCTIONED_DISAGREEMENTS) {
      seenDisagreements.push(group);
      continue;
    }
    assert.equal(
      counts.size,
      1,
      `group "${group}" disagrees with itself about inner-circle standing: ` +
        [...counts.entries()]
          .map(([n, rs]) => `${n} blocks → ${rs.join(', ')}`)
          .join('  |  ') +
        '. Roles under one heading are the same kind of guest; if one is inner ' +
        'circle they all are. Add the missing role to INNER_CIRCLE_ROLES in lib/guests.ts.',
    );
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

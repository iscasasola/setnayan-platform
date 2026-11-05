/**
 * the-finer-rule-wins-and-says-so.test.ts
 *
 * Two properties, and the second is the one that will be forgotten.
 *
 * 1. (2026-10-17) A role the Studio lists by itself answers from its own line; every other role from its row —
 *    see the note above the first test. (Was: a role's own rule beats its group's.)
 * 2. 🛑 AND THE EDITOR IS TOLD WHICH ROLES WILL IGNORE IT. Precedence applied
 *    silently is its own failure: the couple writes "barong, ecru" on
 *    `principal_sponsors`, saves, and ninang does not change. Nothing is wrong
 *    and nothing says so — correct behaviour and a broken feature rendering
 *    identically, which is this codebase's signature defect.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROLE_GROUPS_IN_ORDER,
  groupOverrides,
  groupLabelOf,
  resolveAttireFor,
  resolveGuestAttireWithGroups,
  sanitizeGroupAttire,
} from './role-group-dress-code';
import { roleGroupOf } from './role-groups';
import { ROLE_GROUP_LABELS } from './role-groups';
import type { RoleAttireMap } from './role-dress-code';

const GROUP = { principal_sponsors: { style: 'filipiniana', note: 'barong, ecru' } } as const;

/*
  ⚠ 2026-10-17 ("ONE FACT"): the per-role tier is read ONLY for the roles Studio › Mood Board & Dress Code lists by
  themselves (the celebrant, the bride, the groom, the guests — `studioRowOf`). Every other role is dressed by its
  group's row, the one the couple picks on. A per-role line for a ninang (or a "Long gown" for the groom's parents —
  a mixed pair) was shown by no editor and told a father to wear a gown. The two properties below are the new rule.
*/
test('⛔ a role the Studio lists by itself answers from its own line; any other role from its row', () => {
  const roles = { principal_sponsor_ninang: { style: 'long_gown', note: 'her own gown' }, bride: { style: 'ball_gown' } } as RoleAttireMap;
  const g = sanitizeGroupAttire(GROUP);

  const bride = resolveAttireFor('bride', roles, g);
  assert.equal(bride?.source, 'role');
  assert.equal(bride?.rule.style, 'ball_gown');

  // Her old line is not read — she is dressed by the Principal Sponsors row, like every sponsor.
  const ninang = resolveAttireFor('principal_sponsor_ninang', roles, g);
  assert.equal(ninang?.source, 'group', 'a per-role line the Studio does not show still answered');
  assert.equal(ninang?.rule.note, 'barong, ecru');
  const ninong = resolveAttireFor('principal_sponsor_ninong', roles, g);
  assert.equal(ninong?.source, 'group');
  // The groom's parents' one "Long gown" never reaches the father.
  const parents = resolveAttireFor('groom_parents', { groom_parents: { style: 'long_gown' } } as RoleAttireMap, sanitizeGroupAttire({ vip_family: { style: 'suit' } }));
  assert.equal(parents?.rule.style, 'suit');
});

test('⛔ tiers do not MERGE — one author answers, never two', () => {
  const roles = { bride: { style: 'ball_gown' } } as RoleAttireMap;
  const g = sanitizeGroupAttire({ principal_sponsors: { style: 'filipiniana', callTime: '07:30' } });
  const r = resolveAttireFor('bride', roles, g);
  assert.equal(r?.source, 'role');
  assert.equal(r?.rule.callTime, undefined, 'the call time leaked across tiers');
});

test('🛑 no role is named as ignoring its group — a per-role line inside a group is no longer read', () => {
  const roles = {
    principal_sponsor_ninang: { style: 'long_gown' },
    principal_sponsor_ninong: { style: 'filipiniana' },
    flower_girl: { style: 'cocktail_dress' },
  } as RoleAttireMap;
  assert.deepEqual(groupOverrides('principal_sponsors', roles), [], 'the editor would warn about a line nobody reads');
  assert.deepEqual(groupOverrides('officiants', roles), []);
});

test('⛔ a stored value this product did not write is DROPPED, never repaired', () => {
  assert.deepEqual(sanitizeGroupAttire(null), {});
  assert.deepEqual(sanitizeGroupAttire([{ style: 'long_gown' }]), {});
  assert.deepEqual(sanitizeGroupAttire({ not_a_group: { style: 'long_gown' } }), {});
  assert.deepEqual(sanitizeGroupAttire({ officiants: { style: 'Long Gown' } }), {}, 'a near-miss style was repaired');
  // A half-read call time is worse than none — somebody sets an alarm by it.
  var out = sanitizeGroupAttire({ officiants: { style: 'long_gown', callTime: '7' } });
  assert.equal(out.officiants?.callTime, undefined, '"7" survived as a call time');
  assert.equal(out.officiants?.style, 'long_gown', 'the rest of the rule should still stand');
});

test('🔊 on a SAVE, a group or style the build does not know is named — never dropped quietly', () => {
  const dropped: string[] = [];
  const out = sanitizeGroupAttire(
    {
      not_a_group: { style: 'long_gown' },
      officiants: { style: 'Long Gown' },
      principal_sponsors: { style: '' }, // "Not set" — taking the rule back, not a lost answer
      bridesmaids: { style: 'long_gown', callTime: '7' }, // a call time we refuse to guess is not a group lost
    },
    dropped,
  );
  assert.deepEqual(dropped.sort(), ['not_a_group', 'officiants.style']);
  assert.deepEqual(Object.keys(out), ['bridesmaids'], 'reporting must not change what is kept');
  // And the dress-code save refuses, out loud, when anything was named.
  const action = readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/studio/mood-board/dress-code-actions.ts'), 'utf8');
  assert.match(action, /sanitizeGroupAttire\(rawGroups, droppedGroups\);\s*if \(droppedGroups\.length > 0\) \{\s*redirect\(/);
});

test('🔑 the twelve come from the exhaustive Record, so they cannot fall out of date', () => {
  assert.equal(ROLE_GROUPS_IN_ORDER.length, 12);
  assert.deepEqual(
    [...ROLE_GROUPS_IN_ORDER].sort(),
    Object.keys(ROLE_GROUP_LABELS).sort(),
    'the list and the Record disagree — one of them was retyped',
  );
  // 'guest' is NOT a role group. ROLE_GROUP_CHIP/TEXT carry it as a 13th key,
  // and a byRole record copied from either shape would file a dress code under
  // a key that belongs to nobody.
  assert.ok(!(ROLE_GROUPS_IN_ORDER as readonly string[]).includes('guest'));
});

test('⛔ a plain guest gets no personal answer from either tier', () => {
  const g = sanitizeGroupAttire(GROUP);
  assert.equal(resolveAttireFor('guest', {}, g), null);
  assert.equal(resolveAttireFor(null, {}, g), null);
  assert.equal(resolveAttireFor(undefined, {}, g), null);
});


/*
  ── THE GUEST'S SIDE ───────────────────────────────────────────────────────
  Everything above proves the resolver ranks the tiers. These prove the READER
  gets the ranked answer — which is a different claim, and the one that was
  false before this build: the widget knew only the role tier, so a couple who
  dressed "Principal Sponsors" in one line and never wrote a word for ninang
  specifically left her with NOTHING on her page. The answer existed in the
  config and no pixel carried it.
*/
test('🔴 a group line REACHES the guest who has no line of her own', () => {
  const out = resolveGuestAttireWithGroups({
    role: 'principal_sponsor_ninang',
    roles: {},
    groups: sanitizeGroupAttire(GROUP),
    palette: null,
  });
  assert.equal(out.source, 'group');
  assert.ok(out.panel, 'a group line must render a panel, not an empty state');
  assert.equal(out.panel?.note, 'barong, ecru');
  // And she is told WHERE it came from, so she does not read it as an oversight.
  assert.equal(groupLabelOf('principal_sponsor_ninang'), ROLE_GROUP_LABELS.principal_sponsors);
});

test('⛔ her old own line is not read on the page either — she reads her row', () => {
  const roles: RoleAttireMap = {
    principal_sponsor_ninang: { style: 'formal', note: 'navy terno' },
  };
  const out = resolveGuestAttireWithGroups({
    role: 'principal_sponsor_ninang',
    roles,
    groups: sanitizeGroupAttire(GROUP),
    palette: null,
  });
  assert.equal(out.source, 'group');
  assert.equal(out.panel?.note, 'barong, ecru');
});

test('⛔ neither tier set is still nothing — a group panel is not invented', () => {
  const out = resolveGuestAttireWithGroups({
    role: 'bridesmaid',
    roles: {},
    groups: sanitizeGroupAttire(GROUP),
    palette: null,
  });
  assert.equal(out.source, null);
});

/*
  ── THE MEASUREMENT, PINNED ────────────────────────────────────────────────
  🔑 The docblock claims the busiest live event's 15 roles fold into SIX groups,
  and a number in a comment rots the moment the vocabulary moves. This is that
  claim as an assertion: if a future build re-homes `best_man` or splits the
  sponsors, this fails and the comment gets corrected instead of quietly
  becoming false. The ROLE LIST is the 2026-09-24 production reading and is
  deliberately frozen — it is evidence, not a fixture to keep current.
*/
test('📏 the production fold is 15 roles → 6 groups, and it stays measured', () => {
  const asMeasuredInProd2026_09_24 = [
    'principal_sponsor_ninong',
    'principal_sponsor_ninang',
    'principal_sponsor',
    'groomsman',
    'best_man',
    'bridesmaid',
    'maid_of_honor',
    'candle_sponsor',
    'veil_sponsor',
    'cord_sponsor',
    'bride_parents',
    'groom_parents',
    'groom_immediate_family',
    'bride',
    'groom',
  ] as const;
  assert.equal(asMeasuredInProd2026_09_24.length, 15);
  const groups = new Set(asMeasuredInProd2026_09_24.map((r) => roleGroupOf(r)));
  assert.ok(!groups.has('guest'), 'every one of the fifteen belongs to a real group');
  assert.equal(groups.size, 6);
  // And every group earns its row: none of the six speaks for a single role.
  for (const g of groups) {
    const n = asMeasuredInProd2026_09_24.filter((r) => roleGroupOf(r) === g).length;
    assert.ok(n >= 2, `group ${g} folds only ${n} role(s) — it would save nobody a line`);
  }
});

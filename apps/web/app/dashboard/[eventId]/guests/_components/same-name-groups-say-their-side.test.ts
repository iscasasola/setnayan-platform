/**
 * same-name-groups-say-their-side.test.ts — 👥 NO GROUP LIST DRAWS TWO ROWS THAT READ THE SAME.
 *
 * Owner 2026-10-21, on the Guests quick-add bar's Group dropdown ("Your groups · as many as apply"): *"why do i see dupes
 * on group names"* — Bob · Bob · Loo · Loo · Mama · Mama · Relatives · Relatives, and an own "Family" under the standard
 * "Family". Each pair was two groups of one name on two sides (both sides' + the groom's), and no row said which.
 *
 * ── What is proven ────────────────────────────────────────────────────────────────────────────────────────────────
 *   1 · THE RULE (pure, every side × every set of ticks on the event's measured groups): of the rows "Your groups"
 *       draws (`listedOwnGroups`), each whose name another drawn row shares — an own group or a standard one — carries
 *       its own side's word, and a name drawn once carries none; so NO two rows of the whole list read the same, and no
 *       own row reads as a standard one.
 *   2 · THE WIRING (source, comments stripped): the Group dropdown draws its small word from that rule, in the shipped
 *       off-side style; every other list of own groups (the Guests screen's Set ▾ › Group, the Quick add sheet's Group,
 *       the Maker card's Group) names each option with the same rule.
 *
 * ── Caveats ───────────────────────────────────────────────────────────────────────────────────────────────────────
 *   · No browser runs here: that the word is PAINTED in the open list is the lab walk's claim (the PR's 375 + desktop
 *     shots, `/dev/guests-lab?part=screen&sides=1`).
 *   · A guest's own group chips on a list row are not given a side: one guest in two same-name groups is the only way
 *     they could collide there, and the measured event has none.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { GROUP_SIDE_WORD, groupLabelWithSide, listedOwnGroups, sidesForNamesakes } from '@/lib/groups-for-side';
import { groupNameKey } from '@/lib/group-name-clash';
import { GROUP_CATEGORY_LABELS, type GuestGroupTeamSide, type GuestSide } from '@/lib/guests';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));

/** The event's own groups as measured 2026-10-21 (names + sides). */
const G: { groupId: string; label: string; teamSide: GuestGroupTeamSide }[] = [
  { groupId: 'bob-both', label: 'Bob', teamSide: 'both' },
  { groupId: 'bob-groom', label: 'Bob', teamSide: 'groom' },
  { groupId: 'childhood', label: 'Childhood', teamSide: 'groom' },
  { groupId: 'college', label: 'College', teamSide: 'groom' },
  { groupId: 'family-b', label: 'Family', teamSide: 'bride' },
  { groupId: 'family-g', label: 'Family', teamSide: 'groom' },
  { groupId: 'loo-both', label: 'Loo', teamSide: 'both' },
  { groupId: 'loo-groom', label: 'Loo', teamSide: 'groom' },
  { groupId: 'mama-both', label: 'Mama', teamSide: 'both' },
  { groupId: 'mama-groom', label: 'Mama', teamSide: 'groom' },
  { groupId: 'relatives-both', label: 'Relatives', teamSide: 'both' },
  { groupId: 'relatives-b', label: 'Relatives', teamSide: 'bride' },
  { groupId: 'relatives-g', label: 'Relatives', teamSide: 'groom' },
];
const STANDARD = Object.values(GROUP_CATEGORY_LABELS);
const SIDES: (GuestSide | null | undefined)[] = ['bride', 'groom', 'both', null, undefined];

test('1 · every side, every tick: a shared name says its side, a lone name says nothing, and no two rows read the same', () => {
  let cases = 0;
  let worded = 0;
  // Ticks: none, each one alone, and all of them (2^13 subsets is needless; these reach every off-side and namesake case).
  const tickSets = [[], ...G.map((g) => [g.groupId]), G.map((g) => g.groupId)];
  for (const side of SIDES) {
    for (const picked of tickSets) {
      const listed = listedOwnGroups(G, side, picked);
      const words = sidesForNamesakes(listed.map((l) => l.group), STANDARD);
      const drawn = listed.map((l) => {
        const word = l.offSide ?? words.get(l.group.groupId) ?? null;
        return { l, word, text: word ? `${l.group.label} · ${GROUP_SIDE_WORD[word]}` : l.group.label };
      });
      for (const d of drawn) {
        const k = groupNameKey(d.l.group.label);
        const shared = drawn.filter((o) => groupNameKey(o.l.group.label) === k).length > 1 || STANDARD.some((s) => groupNameKey(s) === k);
        if (shared) assert.equal(d.word, d.l.group.teamSide, `${d.l.group.groupId} for a ${side} guest: its name is shared but it does not say its side`);
        else if (!d.l.offSide) assert.equal(d.word, null, `${d.l.group.groupId} for a ${side} guest: a lone name carries a side word`);
        if (d.word) worded++;
      }
      const texts = [...drawn.map((d) => d.text.toLowerCase()), ...STANDARD.map((s) => s.toLowerCase())];
      assert.equal(new Set(texts).size, texts.length, `a ${side} guest ticking [${picked}] sees two rows that read the same: ${texts.join(' | ')}`);
      cases++;
    }
  }
  assert.equal(cases, SIDES.length * (G.length + 2), 'anti-vacuity: not every case ran');
  assert.ok(worded > 50, `anti-vacuity: only ${worded} side words`);
  // The owner's list (a groom's-side guest): Bob · both sides, Bob · groom's side; College alone says nothing.
  const groom = listedOwnGroups(G, 'groom', []);
  const w = sidesForNamesakes(groom.map((l) => l.group), STANDARD);
  assert.equal(w.get('bob-both'), 'both');
  assert.equal(w.get('bob-groom'), 'groom');
  assert.equal(w.get('family-g'), 'groom', 'the own Family under the standard Family does not say its side');
  assert.equal(w.has('college'), false);
  assert.equal(GROUP_SIDE_WORD.both, 'both sides');
  assert.equal(groupLabelWithSide('Mama', 'groom'), 'Mama · groom’s side');
  assert.equal(groupLabelWithSide('College', undefined), 'College');
});

test('2 · every list of own groups names a shared name’s side with the same rule', () => {
  const picker = read('guest-group-picker.tsx');
  assert.match(picker, /sidesForNamesakes\(listed\.map\(\(l\) => l\.group\), standard\.map\(\(o\) => o\.label\)\)/, 'the Group dropdown does not run the rule over the rows it draws and the standard names');
  assert.match(picker, /const sideWord = offSide \?\? namesakes\.get\(g\.groupId\) \?\? null;/, 'a row’s side word is not the off-side word or the namesake’s side');
  assert.match(picker, /className="text-\[12px\] font-medium text-ink\/50"[^>]*>\s*\{' '\}· \{GROUP_SIDE_WORD\[sideWord\]\}/, 'the side word is not drawn in the shipped off-side style');
  // The other lists.
  const screen = read('guests-screen.tsx');
  assert.match(screen, /label: groupLabelWithSide\(g\.label, setNamesakes\.get\(g\.group_id\)\), group: 'Group'/, 'Set ▾ › Group draws two same-name groups alike');
  assert.match(screen, /const setNamesakes = sidesForNamesakes\(groups\.map/, 'Set ▾ › Group does not run the rule over its groups');
  const sheet = read('quick-add-sheet.tsx');
  assert.match(sheet, /label: groupLabelWithSide\(g\.label, namesakes\.get\(g\.group_id\)\)/, 'the Quick add sheet’s Group draws two same-name groups alike');
  assert.match(read('..', 'page.tsx'), /label: g\.label,\s*team_side: g\.team_side,\s*\}\)\);/, 'the Quick add sheet is handed its groups without their sides');
  const maker = read('guest-card-body.tsx');
  assert.match(maker, /const namesakes = sidesForNamesakes\(own \?\? \[\], standard\.map\(\(o\) => o\.label\)\);/, 'the Maker card’s Group does not run the rule');
  assert.match(maker, /label: groupLabelWithSide\(g\.label, namesakes\.get\(g\.groupId\)\), group: GROUP_OWN_HEADING/, 'the Maker card’s Group draws two same-name groups alike');
});

/**
 * the-group-list-follows-the-side.test.ts — 👥 THE ONE GROUP LIST FOLLOWS THE GUEST'S SIDE, AND ONE NAME IS ONE GROUP.
 *
 * Owner 2026-10-20, on the guest card's Group list (cale-ice: Childhood · College · Family · Family · Relatives ·
 * Relatives — one bride, one groom each): *"if i pick bride's side. it should show the groups for the bride's side and
 * the groups that also cover both … if i pick groom's side, then i only see groups that is related on the grooms or both
 * but will not show groups that just is found on bride's side."* · and *"also not allow to have a group name similarly
 * written on the group already."* (DECISION_LOG 2026-10-20 "THE GROUP LIST FOLLOWS THE GUEST'S SIDE").
 *
 * ── What is proven ────────────────────────────────────────────────────────────────────────────────────────────────
 * THE RULES (pure, run over every case):
 *   1 · for each side (bride · groom · both · none) and EVERY set of already-ticked groups on a cale-ice-like fixture, the
 *       listed own groups are exactly  side ∪ both ∪ already-ticked , in the given order; only an already-ticked group of
 *       the other side carries a side word, and it names that group's side;
 *   2 · a new group takes the guest's side (both / none → both);
 *   3 · a name clashes, compared without case, spaces or punctuation, with every standard group and with exactly the own
 *       groups sharing a list with the new group's side — never with the other side's namesake, never with itself.
 * THE WIRING (source, comments stripped):
 *   4 · the picker draws "Your groups" ONLY from `listedOwnGroups` (no row from the raw list), creates with the live
 *       side, and checks a name with `groupNameClash` on create AND rename before it writes;
 *   5 · every place that draws the picker hands it the side (the card's Side row by its field name; the Add card's Side
 *       pick; /guests/new's Side select);
 *   6 · the server's create and rename refuse with the same rule, and the rename writes the name only (keeps the side).
 *
 * ── Caveats ───────────────────────────────────────────────────────────────────────────────────────────────────────
 *   · No browser runs here: that the filtered list is PAINTED, and re-filters when Side changes, is the lab walk's claim
 *     (the PR body's 375 shots, Chromium + WebKit). § 4–6 read source; a rewrite keeping the shape could pass.
 *   · (2026-10-21) The capture bar's `#Group`, claims, the Quick add sheet, the sidebar form and the map now make groups
 *     through the same one-name rule too — `makeGuestGroupOnce`, proven in lib/one-group-per-name.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { listedOwnGroups, OFF_SIDE_WORD, teamSideForNewGroup } from '@/lib/groups-for-side';
import { groupNameClash, groupNameKey, sidesShareAList } from '@/lib/group-name-clash';
import { GROUP_CATEGORY_LABELS, type GuestGroupTeamSide, type GuestSide } from '@/lib/guests';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));

/** cale-ice's own groups as measured 2026-10-20 (names + sides), plus one both-sides group. */
const G: { groupId: string; label: string; teamSide: GuestGroupTeamSide }[] = [
  { groupId: 'barkada', label: 'Barkada', teamSide: 'both' },
  { groupId: 'childhood', label: 'Childhood', teamSide: 'groom' },
  { groupId: 'college', label: 'College', teamSide: 'groom' },
  { groupId: 'family-b', label: 'Family', teamSide: 'bride' },
  { groupId: 'family-g', label: 'Family', teamSide: 'groom' },
  { groupId: 'relatives-b', label: 'Relatives', teamSide: 'bride' },
  { groupId: 'relatives-g', label: 'Relatives', teamSide: 'groom' },
];
const SIDES: (GuestSide | null | undefined)[] = ['bride', 'groom', 'both', null, undefined];
const subsets = <T,>(xs: readonly T[]): T[][] => xs.reduce<T[][]>((all, x) => [...all, ...all.map((s) => [...s, x])], [[]]);
const STANDARD = Object.entries(GROUP_CATEGORY_LABELS).map(([key, label]) => ({ key, label }));

test('1 · for every side and every set of ticks, the list is side ∪ both ∪ already-ticked — and only the off-side ticks carry a side word', () => {
  let cases = 0;
  for (const side of SIDES) {
    for (const picked of subsets(G.map((g) => g.groupId))) {
      const listed = listedOwnGroups(G, side, picked);
      const want = G.filter((g) => side === 'both' || side == null || g.teamSide === side || g.teamSide === 'both' || picked.includes(g.groupId));
      assert.deepEqual(listed.map((l) => l.group.groupId), want.map((g) => g.groupId), `side ${side} · ticked [${picked}]`);
      for (const l of listed) {
        const off = (side === 'bride' || side === 'groom') && l.group.teamSide !== 'both' && l.group.teamSide !== side;
        assert.equal(l.offSide, off ? l.group.teamSide : null, `side word on ${l.group.groupId} for a ${side} guest`);
      }
      cases++;
    }
  }
  assert.equal(cases, SIDES.length * 2 ** G.length, 'anti-vacuity: not every case ran');
  // The owner's own words, on the fixture: bride sees no groom-only group; groom sees no bride-only group.
  assert.deepEqual(listedOwnGroups(G, 'bride', []).map((l) => l.group.groupId), ['barkada', 'family-b', 'relatives-b']);
  assert.deepEqual(listedOwnGroups(G, 'groom', []).map((l) => l.group.groupId), ['barkada', 'childhood', 'college', 'family-g', 'relatives-g']);
  assert.equal(listedOwnGroups(G, 'both', []).length, G.length);
  assert.equal(OFF_SIDE_WORD.groom, 'groom’s side');
});

test('2 · a new group takes the guest’s side; both sides or no side make a both-sides group', () => {
  assert.equal(teamSideForNewGroup('bride'), 'bride');
  assert.equal(teamSideForNewGroup('groom'), 'groom');
  assert.equal(teamSideForNewGroup('both'), 'both');
  assert.equal(teamSideForNewGroup(null), 'both');
  assert.equal(teamSideForNewGroup(undefined), 'both');
});

test('3 · one name, one group: case, spaces and punctuation do not make a new name; the other side’s namesake does not clash', () => {
  for (const typed of ['family', 'Family ', 'FAMILY.', '  fam-ily ']) {
    for (const side of ['bride', 'groom', 'both'] as const) {
      const c = groupNameClash(typed, side, STANDARD, G);
      assert.deepEqual(c, { kind: 'standard', key: 'family', label: GROUP_CATEGORY_LABELS.family }, `“${typed}” on ${side} is not the standard Family`);
    }
  }
  for (const s of STANDARD) assert.equal(groupNameClash(`${s.label.toUpperCase()}!`, 'bride', STANDARD, [])?.kind, 'standard', `${s.label} is not a standard name`);
  // Own groups: exactly those sharing a list with the new group's side.
  const sides = ['bride', 'groom', 'both'] as const;
  let checked = 0;
  for (const side of sides) {
    for (const g of G) {
      const typed = ` ${g.label.toLowerCase()}. `;
      const others = G.filter((x) => groupNameKey(x.label) === groupNameKey(g.label) && sidesShareAList(x.teamSide, side));
      const c = groupNameClash(typed, side, [], G);
      if (others.length === 0) assert.equal(c, null, `${g.groupId} clashes on ${side}`);
      else assert.ok(c?.kind === 'own' && others.some((o) => o.groupId === c.groupId), `${g.groupId}'s name is free on ${side}`);
      checked++;
    }
  }
  assert.equal(checked, sides.length * G.length);
  assert.equal(groupNameClash('college', 'bride', [], G), null, 'a bride’s “College” clashed with the groom’s');
  assert.equal(groupNameClash('college', 'groom', [], G)?.kind, 'own');
  assert.equal(groupNameClash('College', 'both', [], G)?.kind, 'own', 'a both-sides group shows in the groom’s list too');
  assert.equal(groupNameClash('Barkada', 'bride', [], G)?.kind, 'own', 'a both-sides group shows in the bride’s list too');
  // A rename never clashes with itself.
  assert.equal(groupNameClash('College!', 'groom', [], G, 'college'), null);
  assert.equal(groupNameClash('!!!', 'groom', STANDARD, G), null, 'a name with no letters clashed with something');
});

test('4 · the picker draws Your groups only from the rule, creates on the live side, and checks the name before every write', () => {
  const src = read('guest-group-picker.tsx');
  assert.match(src, /listedOwnGroups\(own, liveSide,/, 'the list is not the side rule over the live side');
  const rowCalls = [...src.matchAll(/\bownRow\(/g)].length;
  const fromRule = [...src.matchAll(/listed\.map\(\(l\) => ownRow\(l\.group, l\.offSide\)\)/g)].length;
  assert.equal(fromRule, 1, 'Your groups is not drawn from the listed groups');
  assert.equal(rowCalls, 1, `an own-group row is drawn somewhere other than the listed groups (${rowCalls} calls)`);
  assert.doesNotMatch(src, /\bown\??\.map\(|\(own \?\? \[\]\)\.map\(\(?g\)? => <|own\.map\(ownRow/, 'a row is drawn from the raw list');
  assert.match(src, /const teamSide = teamSideForNewGroup\(liveSide\);/, 'the new group does not take the live side');
  assert.match(src, /\{ op: 'create', label: name, side: teamSide \}/, 'the create does not send the side');
  const create = src.slice(src.indexOf('const create = '), src.indexOf('const rename = '));
  const rename = src.slice(src.indexOf('const rename = '), src.indexOf('const askDelete = '));
  for (const [name, body] of [['create', create], ['rename', rename]] as const) {
    const check = body.indexOf('groupNameClash(');
    const write = body.indexOf('editGuestGroupInPlace(');
    assert.ok(check > -1 && write > check, `${name} writes without checking the name first`);
    assert.match(body, /'clash' in res/, `${name} drops the server's clash`);
  }
  assert.match(rename, /groupNameClash\(name, was\.teamSide,/, 'a rename is checked against another side’s list');
  assert.match(src, /label=\{`Use “\$\{clash\.label\}”`\}/, 'the clash offers no one-tap Use');
});

test('5 · every place that draws the picker hands it the side', () => {
  const tags = (f: string) => [...read(f).matchAll(/<GuestGroupPicker\b[\s\S]*?\/>/g)].map((m) => m[0]);
  const card = tags('guest-card-rows.tsx');
  const add = tags('search-add-card.tsx');
  const fresh = tags('new-guest-group-role.tsx');
  for (const [f, t] of [['guest-card-rows.tsx', card], ['search-add-card.tsx', add], ['new-guest-group-role.tsx', fresh]] as const) {
    assert.equal(t.length, 1, `${f}: expected one picker`);
    assert.match(t[0] ?? '', /\bside=\{/, `${f}: the picker is not told the side`);
  }
  assert.match((card[0] ?? ''), /sideField=\{side === undefined \? undefined : 'side'\}/, 'the card does not follow its Side row');
  assert.match(read('guest-card-body.tsx'), /name="side"[\s\S]{0,40}label="Side"/, 'the card’s Side row is not the `side` field the Group follows');
  assert.match(read('guest-card-body.tsx'), /side=\{hasSides \? guest\.side : undefined\}/, 'the card does not hand the Group its guest’s side');
  assert.match((add[0] ?? ''), /side=\{hasSides \? picks\.side : undefined\}/, 'the Add card’s Group does not follow its Side pick');
  assert.match((fresh[0] ?? ''), /sideField=\{hasSides \? 'side' : undefined\}/, '/guests/new’s Group does not follow its Side');
  // The lists handed in carry each group's side.
  assert.match(read('guest-card-data.ts'), /\.from\('guest_groups'\)\.select\('group_id, label, team_side'\)/, 'the card reads its groups without their sides');
  assert.match(read('..', 'new', 'page.tsx'), /\.from\('guest_groups'\)\.select\('group_id, label, team_side'\)/, '/guests/new reads its groups without their sides');
  assert.match(read('..', 'page.tsx'), /team_side: g\.team_side \}\)\)\}/, 'the Guests screen hands its groups over without their sides');
});

test('6 · the server refuses the same names, and a rename keeps the side', () => {
  const src = read('..', 'group-edit-actions.ts');
  const body = (fn: string) => {
    const at = src.indexOf(`async function ${fn}(`);
    assert.ok(at > -1, `${fn} is gone`);
    const next = src.indexOf('\nasync function ', at + 1);
    return src.slice(at, next === -1 ? undefined : next);
  };
  const create = body('createGuestGroupInPlace');
  const rename = body('renameGuestGroupInPlace');
  for (const [name, b] of [['create', create], ['rename', rename]] as const) {
    const check = b.indexOf('groupNameClash(');
    const write = b.search(/\.(insert|update)\(|makeGuestGroupOnce\(/);
    assert.ok(check > -1 && write > check, `the server's ${name} writes without the name rule`);
    assert.match(b, /if \(clash\) return \{ ok: false, error: clashWords\(clash\), clash \};/, `the server's ${name} does not refuse a clash`);
  }
  // The insert itself is `makeGuestGroupOnce`'s (lib/one-group-per-name.test.ts runs it): the create hands it the side.
  assert.match(create, /makeGuestGroupOnce\(supabase, eventId, label, side\)/, 'the server’s create does not write the side');
  assert.match(rename, /groupNameClash\(label, self\.teamSide, STANDARD, own, groupId\)/, 'the server’s rename is not checked on its own side');
  assert.match(rename, /\.update\(\{ label \}\)/, 'the rename writes more than the name — it can move the group’s side');
  assert.match(src, /if \(!own\) return \{ ok: false/, 'a refused read of the groups is taken as “no clash”');
  assert.match(src, /if \(edit\.op === 'create'\) return createGuestGroupInPlace\(/, 'the one action does not route create');
});

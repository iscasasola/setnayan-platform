/**
 * guest-section-head.test.ts — A GUEST-LIST HEADER, PRESSED, SELECTS; ITS TOOLBAR ONLY OFFERS WHAT IS TRUE
 * (R4 slice 4, owner 2026-10-29 — Guests prototype v20–v22).
 *
 * ⚖ *"i like the concept of adding guests directly on the highlighted category"* · *"the renaming of that group will be
 * removed since it will be set on when the highlighted group/role is pressed"* · tapping the SELECTED header again folds
 * it AND unselects it.
 *
 * Properties held:
 *   (1) the doors — a header offers Rename only where ONE word renames it, through the shipped door, and ＋ Add guest
 *       here only where a name added now LANDS in it; a header with neither is not selectable; the celebrants never;
 *   (2) the screen — a tap on the SELECTED header folds it and unselects it; a name typed while ＋ is on is added with
 *       the selected group's picks (role · side · group), never the bare sticky picks;
 *   (3) the card has no rename row of its own (it moved here) — and keeps its Role pick;
 *   (4) the headers stay in sight while their rows pass: List (already), Seats › List tables, March groups.
 *
 * 🛡 Sabotaged (2026-10-29): `roleGroupRenameDoor` taking the FIRST section part (Bearers & Flower Girl renamed by
 * "Bearers") → red on (1); `tapSection`'s second tap keeping the section open → red on (2).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { sectionHeadDoors, sectionHeadSelectable } from '@/lib/guest-section-head';
import { resolveRoleSet } from '@/lib/role-sets';
import { roleGroupOf } from '@/lib/role-groups';

const offeredRoles = resolveRoleSet('wedding').offeredRoles;
const groups = [
  { group_id: 'g1', label: 'Barkada' },
  { group_id: 'g2', label: 'Office' },
  { group_id: 'g3', label: 'Office' },
];
const doors = (key: string) => sectionHeadDoors(key, { groups, offeredRoles });
const code = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

test('(1) a header offers Rename only through ONE shipped word, and ＋ only where the name lands', () => {
  // Named after a role → that role's word.
  assert.deepEqual(doors('role:groomsmen').rename, { kind: 'role', role: 'groomsman' });
  assert.deepEqual(doors('role:bridesmaids').rename, { kind: 'role', role: 'bridesmaid' });
  // One section → that section's heading; VIP · Immediate Family → Immediate Family.
  assert.deepEqual(doors('role:principal_sponsors').rename, { kind: 'section', section: 'principal_sponsors' });
  assert.deepEqual(doors('role:vip_family').rename, { kind: 'section', section: 'immediate_family' });
  // Two sections → no one word, no Rename.
  assert.equal(doors('role:bearers_flower_girl').rename, null);
  assert.equal(doors('role:guest').rename, null);
  // Every role an add offers lands in THAT heading.
  for (const grp of ['groomsmen', 'bridesmaids', 'principal_sponsors', 'secondary_sponsors', 'bearers_flower_girl', 'vip_family'] as const) {
    const roles = doors(`role:${grp}`).add?.roles ?? [];
    assert.ok(roles.length > 0, `${grp}: no role lands here`);
    for (const r of roles) assert.equal(roleGroupOf(r), grp, `${grp}: ＋ offers ${r}, which lands elsewhere`);
  }
  assert.deepEqual(doors('role:guest').add, { roles: ['guest'] });
  // An own group: its one id renames it and is joined; two of one name → neither.
  assert.deepEqual(doors('group:Barkada'), { rename: { kind: 'group', groupId: 'g1' }, add: { groupIds: ['g1'] } });
  assert.deepEqual(doors('group:Office'), { rename: null, add: null });
  assert.deepEqual(doors('group:none'), { rename: null, add: { groupIds: [] } });
  // A side → that side; a new guest is "To invite"; a reply or a letter is decided elsewhere.
  assert.deepEqual(doors('side:groom'), { rename: null, add: { side: 'groom' } });
  assert.deepEqual(doors('rsvp:to_invite'), { rename: null, add: {} });
  for (const k of ['rsvp:attending', 'rsvp:declined', 'last_name:S', 'celebrants', 'group:Office']) {
    assert.equal(sectionHeadSelectable(doors(k)), false, `${k} is selectable with nothing true to offer`);
  }
});

/**
 * (2) ✎ ON THE ROW, NO POP-UP (owner 2026-10-29 ~21:55, on the live List: "remove the pop up and just have a button on the
 * row to rename it. this is the pencil icon. remove tha dd guests here."). Supersedes slice 4's select + toolbar on the
 * List (the March keeps its own toolbar — untouched). 🛡 Sabotaged (2026-10-29): the header tap selecting again → red.
 */
test('(2) the List header tap only folds; a ✎ on the row renames in place; ＋ Add guest here is gone', () => {
  const screen = code('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  const tap = screen.slice(screen.indexOf('const tapSection = '), screen.indexOf('// ── The counts'));
  assert.ok(tap.length > 200, 'tapSection moved — this guard is blind');
  assert.doesNotMatch(tap, /setHubSel|selectable|unselectHead/, 'a header tap selects again (the pop-up toolbar is back)');
  assert.match(tap, /next\.add\(key\)/, 'a header tap no longer opens a group');
  assert.match(tap, /next\.delete\(key\)/, 'a header tap no longer folds a group');
  // No toolbar on the List — no SectionHeadTools / SectionHeadToolbar drawn by the screen itself, no "Add to …" box.
  assert.doesNotMatch(screen, /<SectionHeadTools\b|<SectionHeadToolbar\b|data-section-head-tools|Add to \$\{/, 'the List draws the pop-up toolbar again');
  assert.doesNotMatch(screen, /herePicks|setAddHere/, '＋ Add guest here is back');
  // The ✎ sits on the row, beside the header (never inside its button), and the word goes through the shipped doors.
  assert.match(screen, /<SectionRenameInPlace\b[\s\S]{0,400}?editing=\{renaming === sec\.key\}/, 'the row has no ✎ rename');
  assert.match(screen, /\{renaming === sec\.key \? null : \(\s*<button\s+type="button"\s+className=\{styles\.bar\}/, 'renaming does not turn the row into the name box');
  const tools = code('app/dashboard/[eventId]/guests/_components/section-head-toolbar.tsx');
  const pen = tools.slice(tools.indexOf('export function SectionRenameInPlace('));
  assert.match(pen, /icon=\{Pencil\}/, 'the row button is not the pencil');
  assert.match(pen, /renameRole\(eventId, door\.role, text, null\)/);
  assert.match(pen, /renameSection\(eventId, door\.section, text\)/);
  assert.match(pen, /editGuestGroupInPlace\(eventId, door\.groupId, \{ op: 'rename', label: text \}\)/);
  assert.match(pen, /if \(door === null \|\| rename === null\) return null;/, 'a header no word renames grew a ✎');
  // Every add from the box reads `addPicks` — now the sticky picks themselves.
  assert.match(screen, /const addPicks: AddPicks = picks;/);
  assert.match(screen, /queueTypedGuest\(eventId, v, addPicks\.side, addSingleGuest, guestAdds, picksForAdd\(addPicks, /);
});

test('(3) the card has no rename row — it keeps its Role pick', () => {
  const body = code('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx');
  assert.doesNotMatch(body, /K\.Rename\b/);
  assert.match(body, /<K\.Roles\b/, 'the card lost its Role pick — only the RENAME was to go');
  assert.doesNotMatch(code('app/dashboard/[eventId]/guests/_components/guest-card-rows.tsx'), /Rename this (role|section)/);
});

test('(4) the headers stay in sight under the pinned row: Seats › List tables and March groups', () => {
  const seats = code('app/dashboard/[eventId]/seating/_components/seat-faces-list.tsx');
  assert.match(seats, /className="sn-acc-head sticky top-0 [^"]*bg-\[/, 'a Seats table header scrolls away with its seats');
  const march = code('app/dashboard/[eventId]/launch/_components/details-march.tsx');
  assert.match(march, /guests \? 'sticky top-\[calc\(var\(--gs-top,0px\)\+var\(--gs-stick-h,60px\)\)\][^']*bg-\[/, 'a March group header scrolls away in Guests');
  const css = code('app/dashboard/[eventId]/guests/_components/guests-screen.module.css');
  assert.match(css, /\.sec\.open > \.barWrap \{\s*position: sticky;/, 'a List group header scrolls away');
  // …and in Seats / March there IS a row to stick under: the ONE row is pinned (fixed) on every view (owner 2026-10-30).
  assert.match(css, /\.stick\.pinned\[data-pinned\] \{\s*position: fixed;/, 'in Seats / March the row scrolls away and the headers stick under nothing');
  const screen = code('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /if \(!st \|\| !hold\) return;\s*st\.setAttribute\('data-pinned', ''\);/, 'Seats / March never pin the row');
});

/**
 * (5) THE VERBS ARE ONE ROW (2026-10-29, the #7049 side-by-side at 390: "Delete" wrapped onto a second line under
 * Rename · ＋ Walk ▾ · ＋ Group). The prototype draws them on one line; the row is compact pills that never wrap, and the
 * house fit pass (`useFitRow`) is what gives below that — icons, then secondary words, as one — never a cut word.
 * 🛡 Sabotaged (2026-10-29): the row back to `flex-wrap` → red.
 */
test('(5) the selected group’s verbs sit on ONE row — compact, fitted, never wrapped', () => {
  const src = code('app/dashboard/[eventId]/guests/_components/section-head-toolbar.tsx');
  const row = src.match(/<div ref=\{verbs\} className="([^"]*)" data-section-head-verbs="">/);
  const classes = row?.[1];
  assert.ok(classes !== undefined, 'the verbs row lost its mark (or its fit ref)');
  const cls = classes.split(/\s+/);
  assert.ok(cls.includes('flex-nowrap') && !cls.includes('flex-wrap'), 'the verbs wrap onto a second row again');
  assert.ok(cls.includes('min-w-0'), 'a row that cannot shrink never overflows — the fit pass would read nothing');
  assert.match(src, /useFitRow\(verbs\);/, 'no fit pass — at 320 the row would overflow, or cut a word');
  assert.doesNotMatch(src, /truncate|text-ellipsis|line-clamp-1/, 'a word in the toolbar is cut');
});

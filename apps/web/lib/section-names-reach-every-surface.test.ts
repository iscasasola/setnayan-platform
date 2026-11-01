/**
 * section-names-reach-every-surface.test.ts — THE COUPLE NAMES THEIR ENTOURAGE'S SECTIONS, AND EVERY SURFACE SAYS IT.
 *
 * ⚖ Owner, 2026-10-19, on the guest Event Hub's entourage: *"Immediate Family change it to VIP."* → *"or how can we
 * rename this?"* → *"on guests?"* — and *"keep the mapping consistent"*. A section heading is a word the couple may own
 * (`events.role_names`, `section:<key>` — `lib/role-names.ts`), and ONE resolver prints it everywhere:
 * `lib/entourage.ts` `groupHeading` (the invitation's entourage in every look, the Wedding March, the prints, /everyone),
 * and `lib/role-groups.ts` `roleGroupLabel` through the same reader `sectionName` (the guest list's group headers, the
 * studio's attire rows, the dress code's rows, the seat plan's switch).
 *
 *   (1) EVERY SECTION KEY, EVERY SURFACE — for each of `RENAMABLE_SECTION_KEYS` (iterated, never listed), a sentinel word
 *       comes out of the printed entourage, the march, `entourageGroupLabel`, the rendered invitation (On the axis and
 *       Lines, each heading marked for the Maker's Edit), and — where a role group's heading is made of that section —
 *       the guest list's header, the studio rows, the dress-code rows. Sabotage: `groupHeading` ignoring `sectionName`
 *       → red; a mapped part dropped from `ROLE_GROUP_SECTION_PARTS` → red.
 *   (2) THE MAPPING IS A PROPERTY — every role group whose heading prints a section's usual words, or that holds exactly
 *       one section's people, takes that section's word; joined with no rename, the parts ARE the usual heading.
 *       Sabotage: delete `officiants` from the parts → red.
 *   (3) EMPTY = THE USUAL WORD, AND NOTHING ELSE MOVES — a blank word is never stored; the order, the rows and the role
 *       words are the same with and without a section word; renaming a section never renames a role.
 *   (4) ONE VALUE, TWO DOORS — the Guest list's "Rename this section" and the Maker's drafted heading at ✓ Apply write
 *       through the column's ONE writer; a role word another host wrote stays (the compare-and-set).
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import {
  RENAMABLE_SECTION_KEYS,
  buildEntourage,
  entourageGroupLabel,
  entourageGroupOfRole,
  isMarchOnlyGroup,
  sectionUsualHeading,
  type EntourageGuestRow,
} from './entourage';
import { ROLE_GROUP_LABELS, ROLE_GROUP_SECTION_PARTS, roleGroupLabel, roleGroupOf, type RoleGroup } from './role-groups';
import { roleNameOne, sanitizeDraftedSectionWords, sanitizeRoleNames, sectionName, sectionNameKey, withDraftedSectionWords, withOneWord, type RoleNames } from './role-names';
import { readRoleNames } from './role-names.server';
import { ROLE_LABELS, type GuestRole, type GuestRow } from './guests';
import { studioAttireRows } from './studio-attire-rows';
import { rosterSections } from './guest-roster-view';
import { roleSeatingLabel } from './role-seating-labels';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
const APP = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));
const ALL_ROLES = Object.keys(ROLE_LABELS) as GuestRole[];
const word = (key: string) => `Our ${key.replace(/_/g, ' ')} word`;
const named = (key: string): RoleNames => readRoleNames({ [sectionNameKey(key)]: { one: word(key) } });

/** The roles a section prints (read off the builder, never listed here): every role whose people land under that key. */
function rolesOf(key: string, march: boolean): GuestRole[] {
  return ALL_ROLES.filter((role) => {
    const rows: EntourageGuestRow[] = [{ guest_id: `g-${role}`, first_name: 'Ana', last_name: 'Abad', role, march: { walk_no: 1 } }];
    return buildEntourage(rows, null, {}, undefined, { march }).some((g) => g.key === key);
  });
}
const rowsFor = (roles: readonly GuestRole[]): EntourageGuestRow[] =>
  roles.map((role, i) => ({ guest_id: `g-${i}`, first_name: `N${i}`, last_name: 'Cruz', role, march: { walk_no: i + 1 } }));

test('(1) every section key, every surface: the couple’s word comes out of each', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EntourageSection } = await import('../app/[slug]/_components/entourage-section');
  assert.ok(RENAMABLE_SECTION_KEYS.length >= 12, `anti-vacuity: only ${RENAMABLE_SECTION_KEYS.length} sections`);
  let groupSurfaces = 0;
  const marchReplaced: string[] = [];
  for (const key of RENAMABLE_SECTION_KEYS) {
    const names = named(key);
    const march = isMarchOnlyGroup(key);
    const roles = rolesOf(key, march);
    assert.ok(roles.length > 0, `${key}: no role prints under it`);
    const rows = rowsFor(roles);
    // The march's builder draws every section it walks (Parents walk inside the couple's sides there, so it has none).
    const marched = buildEntourage(rows, null, names, undefined, { march: true }).find((g) => g.key === key);
    if (marched || march) assert.equal(marched?.label, word(key), `${key}: the Wedding March does not say the couple's word`);
    else marchReplaced.push(key);
    assert.equal(entourageGroupLabel(key, names), word(key), `${key}: entourageGroupLabel`);
    assert.equal(entourageGroupLabel(key, names, rows), word(key), `${key}: entourageGroupLabel with rows`);
    if (march) continue;
    const printed = buildEntourage(rows, null, names).find((g) => g.key === key);
    assert.equal(printed?.label, word(key), `${key}: the invitation's entourage does not say the couple's word`);
    assert.equal(printed?.usual, buildEntourage(rows, null, {}).find((g) => g.key === key)?.label, `${key}: the usual heading is not kept for "empty"`);
    // The invitation, rendered, in each look that draws a heading — and each heading marked for the Maker's Edit.
    for (const sceneStyle of ['roll-call', 'lines']) {
      const html = renderToStaticMarkup(React.createElement(EntourageSection, { groups: [printed!], sceneStyle }));
      assert.match(html, new RegExp(`data-section-heading="${key}"[^>]*>(?:[\\s\\S]*?)${word(key)}`), `${key} · ${sceneStyle}: the drawn heading`);
    }
    // Every role group whose heading is made of this section says the word, on each surface that prints that heading.
    for (const [group, parts] of Object.entries(ROLE_GROUP_SECTION_PARTS) as [RoleGroup, NonNullable<(typeof ROLE_GROUP_SECTION_PARTS)[RoleGroup]>][]) {
      if (!parts.some((p) => typeof p !== 'string' && p[0] === key)) continue;
      groupSurfaces += 1;
      assert.ok(roleGroupLabel(group, names).includes(word(key)), `${group}: roleGroupLabel misses ${key}'s word`);
      const member = roles.find((r) => roleGroupOf(r) === group)!;
      assert.ok(member, `${group}: none of ${key}'s roles are in it`);
      // The guest list's group header (the Role view).
      const guest = { guest_id: 'x', role: member, extra_roles: [], first_name: 'A', last_name: 'B' } as unknown as GuestRow;
      const sections = rosterSections([guest], 'role', { roleNames: names, hasSides: true, groupsOf: () => [], tableOf: () => null });
      assert.ok(sections.some((s) => s.label.includes(word(key))), `${group}: the guest list's header — ${sections.map((s) => s.label).join(' | ')}`);
      // The studio's attire rows (and through `roleGroupLabel`, the dress code's).
      const attire = studioAttireRows([{ role: member, count: 1 }], null, names);
      assert.ok(attire.some((r) => r.label.includes(word(key))), `${group}: the studio's row — ${attire.map((r) => r.label).join(' | ')}`);
    }
  }
  assert.ok(groupSurfaces >= 6, `anti-vacuity: only ${groupSurfaces} role-group surfaces checked`);
  assert.deepEqual(marchReplaced, ['parents'], 'a printed section is missing from the Wedding March');
  // The seat plan's switch names the Immediate Family section.
  assert.equal(roleSeatingLabel('immediate_family', named('immediate_family')), `${word('immediate_family')} (both sides)`);
  assert.equal(roleSeatingLabel('immediate_family', {}), 'Immediate family (both sides)');
  // The owner's own case: "Immediate Family" → "VIP" — the guest list header does not say VIP twice.
  const vip = readRoleNames({ 'section:immediate_family': { one: 'VIP' } });
  assert.equal(entourageGroupLabel('immediate_family', vip), 'VIP');
  assert.equal(roleGroupLabel('vip_family', vip), 'VIP');
  assert.equal(roleGroupLabel('vip_family', readRoleNames({ 'section:immediate_family': { one: 'Siblings' } })), 'VIP · Siblings');
});

test('(2) the mapping is a property: a group that prints a section’s words, or holds one section’s people, takes its word', () => {
  for (const group of Object.keys(ROLE_GROUP_LABELS) as RoleGroup[]) {
    const usual = ROLE_GROUP_LABELS[group];
    const parts = ROLE_GROUP_SECTION_PARTS[group];
    if (parts) assert.equal(parts.map((p) => (typeof p === 'string' ? p : p[1])).join(''), usual, `${group}: its parts are not its usual heading`);
    const mapped = new Set((parts ?? []).flatMap((p) => (typeof p === 'string' ? [] : [p[0]])));
    const roles = ALL_ROLES.filter((r) => roleGroupOf(r) === group);
    for (const key of RENAMABLE_SECTION_KEYS) {
      if (isMarchOnlyGroup(key)) continue;
      const sectionWords = sectionUsualHeading(key)!;
      const inRoles = rolesOf(key, false);
      const prints = usual.toLowerCase().includes(sectionWords.toLowerCase());
      const same = roles.length > 0 && roles.length === inRoles.length && roles.every((r) => inRoles.includes(r));
      if (prints || same) assert.ok(mapped.has(key), `${group} ("${usual}") ${prints ? 'prints' : 'holds exactly'} the "${sectionWords}" section, but does not take its word`);
    }
  }
  // Every part names a real section.
  for (const parts of Object.values(ROLE_GROUP_SECTION_PARTS)) {
    for (const p of parts!) if (typeof p !== 'string') assert.ok(RENAMABLE_SECTION_KEYS.includes(p[0]), `${p[0]} is not a section`);
  }
});

test('(3) empty is the usual word, and nothing else moves', () => {
  const rows = rowsFor(['bride_immediate_family', 'groom_immediate_family', 'bridesmaid', 'groomsman', 'ring_bearer']);
  const plain = buildEntourage(rows, null, {});
  const vip = readRoleNames({ 'section:immediate_family': { one: 'VIP' }, bridesmaid: { one: "Bride's Crew" } });
  const strip = (gs: ReturnType<typeof buildEntourage>) => gs.map((g) => ({ key: g.key, rows: g.rows.map((r) => r.map((p) => (p ? `${p.id}:${p.role}` : null))) }));
  assert.deepEqual(strip(buildEntourage(rows, null, vip)), strip(plain), 'a section word moved somebody');
  // A section word never renames a role, and a role word is kept beside it.
  assert.equal(roleNameOne('bride_immediate_family', vip), null);
  assert.equal(roleNameOne('bridesmaid', vip), "Bride's Crew");
  // Byte-identical with no section words: every heading as before.
  for (const g of plain) assert.equal(g.usual, undefined, `${g.key}: a usual heading is carried with nothing renamed`);
  // Blank is never stored: it means the usual word.
  assert.deepEqual(sanitizeRoleNames({ 'section:immediate_family': { one: '   ' } }), {});
  const cleared = readRoleNames(withOneWord(vip, sectionNameKey('immediate_family'), ''));
  assert.equal(sectionName('immediate_family', cleared), null);
  assert.equal(roleNameOne('bridesmaid', cleared), "Bride's Crew", 'clearing a section dropped a role word');
  assert.equal(entourageGroupLabel('immediate_family', cleared), 'Immediate Family');
  // An unknown section never reads; a role and a section cannot collide.
  assert.deepEqual(readRoleNames({ 'section:not_a_section': { one: 'X' } }), {});
  assert.equal(entourageGroupOfRole('guest'), null);
});

test('(4) one value, two doors: the Guest list and the Maker’s Apply write through the ONE writer; a drafted heading is section keys only', () => {
  // The draft holds section keys only — never a role word, never the whole column cleared.
  assert.deepEqual(sanitizeDraftedSectionWords({ 'section:immediate_family': ' VIP ', bridesmaid: { one: 'X' }, 'section:Bad Key': 'Y' }), { 'section:immediate_family': 'VIP' });
  // Laid on, every role word kept; '' takes the section back to the usual heading.
  const stored = { bridesmaid: { one: "Bride's Crew" }, 'section:bearers': { one: 'Little Ones' } };
  assert.deepEqual(readRoleNames(withDraftedSectionWords(stored, { 'section:immediate_family': 'VIP', 'section:bearers': '' })), readRoleNames({ bridesmaid: { one: "Bride's Crew" }, 'section:immediate_family': { one: 'VIP' } }));
  // The two doors and the canvas.
  const actions = code('app/dashboard/[eventId]/guests/role-name-actions.ts');
  assert.match(actions, /export async function renameSection\(/);
  assert.match(actions, /writeRoleNames\(/);
  const apply = code('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(apply, /delete eventsPatch\.role_names;/, 'Apply sends role_names in the session UPDATE (it has no UPDATE grant)');
  assert.match(apply, /await writeRoleNames\(createAdminClient\(\) as unknown as JsonColumnClient, eventId, changes\)/, 'Apply writes the headings around the one writer');
  const writer = code('lib/role-names.server.ts');
  assert.match(writer, /updateJsonColumn\(\s*client,\s*\{ table: 'events', row: \{ event_id: eventId \}, column: 'role_names'/, 'the one writer is not the compare-and-set');
  // The host's canvas reads the drafted headings through the guest tree's ONE reader of the words.
  assert.match(code('app/[slug]/_lib/loaders.ts'), /withHeldDraftedRoleNames\(eventId, await loadRoleNames\(admin, eventId, 'loadEventRoleNames'\)\)/);
  assert.match(code('app/[slug]/page.tsx'), /if \(hostDraft && 'role_names' in hostDraft\.events\) holdDraftedRoleNames\(liveEvent\.event_id, hostDraft\.events\.role_names\);/);
  // The Guests door is the ✎ ON THE LIST GROUP'S ROW now (owner 2026-10-29 ~21:55 — "a button on the row to rename it.
  // this is the pencil icon"; the card lost its rename row in slice 4); the Maker's door is the march's Edit.
  const tools = code('app/dashboard/[eventId]/guests/_components/section-head-toolbar.tsx');
  assert.match(tools, /renameSection\(eventId, door\.section, text\)/, 'the selected header does not rename a section through the shipped door');
  assert.match(tools, /renameRole\(eventId, door\.role, text, null\)/, 'the selected header does not rename a role through the shipped door');
  assert.match(code('app/dashboard/[eventId]/guests/_components/guests-screen.tsx'), /<SectionRenameInPlace\b/, 'the List group row has no ✎ rename');
  assert.doesNotMatch(code('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx'), /K\.Rename\b/, 'the card grew its rename row back');
  assert.match(code('app/dashboard/[eventId]/launch/_components/stage-tools.tsx'), /picked === 'march' && !rsvpOpen && maker \? \(\s*<SectionNames /);
});

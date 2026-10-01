/**
 * THE BEST WOMAN STANDS WHERE THE BEST MAN STANDS.
 *
 * ⚖ Owner, verbatim 2026-09-30: *"Also on guestlist (We can pick either best man
 * or best woman and maid or matron of honor)"*.
 *
 * `best_woman` is the other word for the best man's place: same line in the
 * Wedding March, same (groom's) column, same colour slot, same host template.
 * A NEW ROLE IS AN OMISSION WAITING TO HAPPEN — the 2026-09-14 Ninong/Ninang
 * split shipped with one list missed (`INNER_CIRCLE_ROLES`), and 37 of 38
 * sponsors lost two invited-to blocks without a word on any screen. So this
 * file asserts the RELATIONSHIP (best_woman behaves as best_man does, wherever
 * the product keys on a role) and then sweeps the SOURCE for every place that
 * names `best_man` and does not name `best_woman`.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { defaultInvitedToForRole, resolveGuestAttire, ROLE_LABELS, type GuestRole } from './guests';
import { roleGroupOf, roleImportanceRank } from './role-groups';
import { MUSLIM_ROLE_SET, WEDDING_ROLE_SET } from './role-sets';
import { columnOfRole, entourageGroupOfRole, ENTOURAGE_ROLES, roleLabel, buildEntourage } from './entourage';
import { paletteKeyForRole } from './mood-board';
import { bulkAssignableRolesFor, BULK_ROLE_SECTIONS } from './bulk-role-vocabulary';
import { ROLE_SUBTYPES, HOST_ROLES_BY_EVENT_TYPE } from './host-roles';
import { alternativeOf, pickItems, rolesOfPickItems } from './role-alternatives';
import { buildEmceeScript } from './emcee-script';
import type { GuestRow } from './guests';

const APP = join(__dirname, '..');

/** Every role value that existed BEFORE best_woman — frozen, so none can be lost on the way in. */
const EVERY_ROLE_BEFORE_2026_09_30 = [
  'guest', 'bride', 'groom', 'bride_parents', 'groom_parents', 'bride_immediate_family',
  'groom_immediate_family', 'maid_of_honor', 'matron_of_honor', 'best_man', 'bridesmaid',
  'groomsman', 'principal_sponsor', 'principal_sponsor_ninong', 'principal_sponsor_ninang',
  'candle_sponsor', 'veil_sponsor', 'cord_sponsor', 'coin_sponsor', 'ring_bearer',
  'bible_bearer', 'coin_bearer', 'flower_girl', 'officiant', 'reader_lector',
  'soloist_musician', 'celebrant', 'host', 'vip', 'family', 'helper', 'wali', 'witness',
  'imam', 'wakil',
] as const;

test('the vocabulary holds best_woman AND every value it held before', () => {
  for (const r of EVERY_ROLE_BEFORE_2026_09_30) {
    assert.ok(r in ROLE_LABELS, `${r} vanished from the role vocabulary — live rows still hold it`);
  }
  assert.equal(ROLE_LABELS.best_woman, 'Best Woman');
  assert.equal(roleLabel('best_woman'), 'Best Woman');
  assert.ok(ENTOURAGE_ROLES.includes('best_woman'), 'a best woman must print on the invitation');
});

test('the migration adds the enum value, alone, and the host CHECK lists it with all 17 old values', () => {
  const dir = join(APP, '..', '..', 'supabase', 'migrations');
  const ls = execFileSync('ls', [dir], { encoding: 'utf8' }).split('\n');
  const enumFile = ls.find((f) => f.endsWith('_guest_role_add_best_woman.sql'));
  assert.ok(enumFile, 'no guest_role_add_best_woman migration');
  const enumSql = readFileSync(join(dir, enumFile!), 'utf8').replace(/--.*$/gm, '');
  assert.match(enumSql, /ALTER TYPE public\.guest_role ADD VALUE IF NOT EXISTS 'best_woman';/);
  assert.doesNotMatch(enumSql, /\bBEGIN\b|\bCOMMIT\b/, 'a new enum value cannot share a transaction with its use');

  const hostFile = ls.find((f) => f.endsWith('_host_roles_add_best_woman.sql'));
  assert.ok(hostFile, 'no host_roles_add_best_woman migration');
  const hostSql = readFileSync(join(dir, hostFile!), 'utf8');
  for (const r of ROLE_SUBTYPES) {
    assert.ok(hostSql.includes(`'${r}'::text`), `the widened CHECK dropped host role ${r}`);
  }
});

test('best_woman behaves exactly as best_man wherever the product keys on a role', () => {
  const same: Array<[string, (r: GuestRole) => unknown]> = [
    ['role group (roster section)', roleGroupOf],
    ['printed group (Wedding March)', entourageGroupOfRole],
    ['printed column (groom’s side)', (r) => columnOfRole('honour', r)],
    ['colour slot (Mood Board)', paletteKeyForRole],
    ['invited-to blocks', (r) => defaultInvitedToForRole(r).join(',')],
    ['wedding: offered', (r) => WEDDING_ROLE_SET.offeredRoles.includes(r)],
    ['wedding: self-claimable', (r) => WEDDING_ROLE_SET.selfClaimableRoles.includes(r)],
    ['wedding: seating tier 2', (r) => WEDDING_ROLE_SET.tier2Roles.has(r)],
    ['muslim: offered', (r) => MUSLIM_ROLE_SET.offeredRoles.includes(r)],
    ['muslim: self-claimable', (r) => MUSLIM_ROLE_SET.selfClaimableRoles.includes(r)],
    ['muslim: seating tier 2', (r) => MUSLIM_ROLE_SET.tier2Roles.has(r)],
    ['bulk assign', (r) => bulkAssignableRolesFor('wedding').includes(r)],
  ];
  for (const [name, of] of same) {
    assert.deepEqual(of('best_woman'), of('best_man'), `best_woman and best_man disagree about: ${name}`);
  }
  // Right beside him in the importance order, so the roster section reads them together.
  assert.equal(roleImportanceRank('best_woman'), roleImportanceRank('best_man') + 1);
  // She dresses as a woman does — the ONE deliberate difference.
  assert.equal(resolveGuestAttire('best_woman', 'neutral'), 'gown');
  assert.equal(resolveGuestAttire('best_man', 'neutral'), 'suit');
});

test('same host seat as a best man: offered to weddings, same template', async () => {
  assert.ok(HOST_ROLES_BY_EVENT_TYPE.wedding!.includes('best_woman'));
  const src = readFileSync(join(APP, 'lib', 'event-moderators.ts'), 'utf8');
  const tmpl = (r: string) => new RegExp(`\\n  ${r}: (\\{[^}]*\\})`).exec(src)?.[1];
  assert.ok(tmpl('best_man'));
  assert.equal(tmpl('best_woman'), tmpl('best_man'), 'best_woman must hold the best man’s permission template');
});

test('the emcee script bills her in the best man’s place', () => {
  const g = (id: string, role: GuestRole, first: string): GuestRow =>
    ({ guest_id: id, role, first_name: first, last_name: 'Cruz', display_name: null, extra_roles: [] }) as unknown as GuestRow;
  const script = buildEmceeScript({
    event: { displayName: 'A & B', eventDate: null },
    blocks: [],
    guests: [g('1', 'groomsman', 'Gus'), g('2', 'best_woman', 'Bea'), g('3', 'maid_of_honor', 'Mae')],
  });
  const at = (s: string) => script.indexOf(s);
  assert.ok(at('Best Woman: Bea Cruz') > 0, script);
  assert.ok(at('Maid of Honor: Mae Cruz') < at('Best Woman: Bea Cruz'));
  assert.ok(at('Best Woman: Bea Cruz') < at('Groomsman: Gus Cruz'));
});

test('on the invitation she pairs across from the maid of honour, in the groom’s column', () => {
  const [honour] = buildEntourage([
    { guest_id: 'm', pair_with_guest_id: 'w', first_name: 'Mae', last_name: 'A', role: 'maid_of_honor' },
    { guest_id: 'w', pair_with_guest_id: 'm', first_name: 'Bea', last_name: 'B', role: 'best_woman' },
  ]);
  assert.equal(honour!.key, 'honour');
  assert.equal(honour!.rows[0]![0]?.role, 'maid_of_honor');
  assert.equal(honour!.rows[0]![1]?.role, 'best_woman');
  // The heading names who is standing there — never "Best Man" over a woman.
  assert.equal(honour!.label, 'Maid of Honor & Best Woman');
});

test('the heading a couple who changed nothing sees is byte-identical', () => {
  const [honour] = buildEntourage([
    { guest_id: 'm', first_name: 'Mae', last_name: 'A', role: 'maid_of_honor' },
    { guest_id: 'b', first_name: 'Ben', last_name: 'B', role: 'best_man' },
    { guest_id: 't', first_name: 'Tess', last_name: 'C', role: 'matron_of_honor' },
  ]);
  assert.equal(honour!.label, 'Maid of Honor & Best Man');
});

test('the pickers show each pair as ONE either-or line, and drop nobody', () => {
  const groomsmen = BULK_ROLE_SECTIONS.find((s) => s.roles.includes('best_man'))!;
  const items = pickItems(groomsmen.roles);
  assert.deepEqual(items[0], { kind: 'pair', roles: ['best_man', 'best_woman'], heading: 'Best man or best woman' });
  const bridesmaids = BULK_ROLE_SECTIONS.find((s) => s.roles.includes('maid_of_honor'))!;
  assert.equal(pickItems(bridesmaids.roles)[0]?.kind, 'pair');
  for (const sec of BULK_ROLE_SECTIONS) {
    assert.deepEqual(rolesOfPickItems(pickItems(sec.roles)).sort(), [...sec.roles].sort(), `${sec.label} lost a role`);
  }
  // A list that lacks one half gets a plain line — never a toggle to a role it cannot save.
  assert.deepEqual(pickItems(['best_man', 'groomsman']), [
    { kind: 'one', role: 'best_man' },
    { kind: 'one', role: 'groomsman' },
  ]);
  assert.equal(alternativeOf('matron_of_honor'), 'maid_of_honor');
  assert.equal(alternativeOf('groomsman'), null);
});

/**
 * THE SWEEP. Every non-test source file that names `best_man` must name
 * `best_woman` too, or be listed here with the reason it deliberately does not.
 * 🔑 A decision log, not a mute button — the same rule as the split-role guard.
 */
const NAMES_BEST_MAN_ONLY_ON_PURPOSE: Record<string, string> = {
  // `best_man` there is a PALETTE KEY (a colour slot), not a guest role;
  // best_woman is mapped INTO it by paletteKeyForRole, which the test above pins.
  'lib/palette-styles.ts': 'palette key, not a guest role',
  'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx': 'palette key presence check',
  // Onboarding's quick "who is the best man / maid of honour" card drafts named
  // VIPs with fixed fields; the couple switches either to the alternative on the
  // guest list afterwards. Widening it is a form change, not a vocabulary one.
  'app/dashboard/[eventId]/wizard-actions.ts': 'onboarding VIP draft card — fixed fields',
  // A measured 2026-09-24 production reading in a docblock — evidence, frozen.
  'lib/role-group-dress-code.ts': 'frozen measurement in a comment',
  // A sample CSV row in the importer's help text.
  'app/dashboard/[eventId]/guests/import/page.tsx': 'example CSV line in help copy',
};

test('every file that names best_man also names best_woman — or says why not', () => {
  const files = execFileSync('git', ['grep', '-l', 'best_man', '--', 'app', 'lib'], { cwd: APP, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !/\.test\.tsx?$/.test(f) && !f.endsWith('.md'));
  assert.ok(files.length > 15, `the sweep found only ${files.length} files — has the grep broken?`);
  const missing = files.filter((f) => {
    if (f in NAMES_BEST_MAN_ONLY_ON_PURPOSE) return false;
    return !readFileSync(join(APP, f), 'utf8').includes('best_woman');
  });
  assert.deepEqual(missing, [], `these name best_man and not best_woman:\n  ${missing.join('\n  ')}`);
  for (const f of Object.keys(NAMES_BEST_MAN_ONLY_ON_PURPOSE)) {
    assert.ok(files.includes(f), `${f} is excused but no longer names best_man — delete its line`);
  }
});

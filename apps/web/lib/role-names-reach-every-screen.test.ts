/**
 * THE COUPLE'S WORD FOR A ROLE REACHES EVERY SCREEN — AND CHANGES NOTHING ELSE.
 *
 * ⚖ Owner, 2026-09-30: *"Bride'smaid can be renamed as what - for us we picked
 * Bride's Crew. Groomsmen can be renamed as what - for us we picked Groom's
 * Crew"*. `events.role_names` holds the couple's words; `lib/role-names.ts` says
 * what they mean.
 *
 * Three properties, each of which has a way to fail silently:
 *   1. THE WORD SHOWS — a rename that reaches the guest list and not the
 *      invitation is two names for one role, and nothing goes red.
 *   2. THE ROLE DOES NOT MOVE — the word is display only; the march order, the
 *      colour, the seating tier key off `guests.role`. A rename that re-sorted a
 *      section would be a layout change nobody asked for.
 *   3. BLANK FALLS BACK — clearing the box brings "Bridesmaid" back, never an
 *      empty chip.
 *
 * And a SOURCE SWEEP, because a new screen that shows a role with the bare
 * `ROLE_LABELS[role]` / `roleLabel(role)` compiles, renders, and quietly says
 * "Bridesmaid" to a couple who renamed her.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { cleanRoleName, isRenamableRole, sanitizeRoleNames, type RoleNames } from './role-names';
import { guestRoleLabel, guestRolePickLabel, ROLE_LABELS, type GuestRow } from './guests';
import { buildEntourage, entourageGroupLabel, roleLabel, type EntourageGuestRow } from './entourage';
import { roleGroupLabel, sectionHeadingInTheirWords, ROLE_GROUP_LABELS } from './role-groups';
import { resolveGuestDressCode } from './role-dress-code';
import { dressCodeForEveryone } from './dress-code-for-everyone';
import { buildEmceeScript } from './emcee-script';
import { sanitizeRolePalette } from './mood-board';
import { resolveDisplayPalette } from './room-palette';

const APP = join(__dirname, '..');
const CREW: RoleNames = {
  bridesmaid: { one: "Bride's Crew" },
  groomsman: { one: "Groom's Crew" },
  flower_girl: { one: 'Little Angel', many: 'Little Angels' },
};

const rows: EntourageGuestRow[] = [
  { guest_id: 'a', march: { walk_no: 0 }, first_name: 'Ana', last_name: 'Abad', role: 'bridesmaid' },
  { guest_id: 'b', march: { walk_no: 0 }, first_name: 'Ben', last_name: 'Bato', role: 'groomsman' },
  { guest_id: 'c', first_name: 'Cara', last_name: 'Cruz', role: 'bridesmaid' },
  { guest_id: 'f', first_name: 'Fe', last_name: 'Flor', role: 'flower_girl' },
  { guest_id: 'm', first_name: 'Mae', last_name: 'Mata', role: 'maid_of_honor' },
];

test('stored words are read, never repaired: blank, unknown and the couple themselves are dropped', () => {
  const read = sanitizeRoleNames(
    {
      bridesmaid: { one: "  Bride's   Crew " },
      groomsman: { one: '   ' }, // blank = the usual word
      bride: { one: 'Queen' }, // the couple are not a role word
      made_up_role: { one: 'X' },
      flower_girl: { one: 'Little Angel', many: 'Little Angel' }, // same → no many
      ring_bearer: 'Ring Master', // not an object
    },
    (v) => v in ROLE_LABELS,
  );
  assert.deepEqual(read, { bridesmaid: { one: "Bride's Crew" }, flower_girl: { one: 'Little Angel' } });
  assert.deepEqual(sanitizeRoleNames(null), {});
  assert.deepEqual(sanitizeRoleNames(['x']), {});
  assert.equal(cleanRoleName('x'.repeat(80)).length, 40);
  assert.equal(isRenamableRole('bride'), false);
  assert.equal(isRenamableRole('bridesmaid'), true);
});

test('the word shows — and a cleared word is the usual one again', () => {
  assert.equal(guestRoleLabel('bridesmaid', CREW), "Bride's Crew");
  assert.equal(roleLabel('bridesmaid', CREW), "Bride's Crew");
  assert.equal(guestRoleLabel('bridesmaid', {}), 'Bridesmaid');
  assert.equal(guestRoleLabel('bridesmaid', null), 'Bridesmaid');
  assert.equal(roleLabel('bridesmaid'), 'Bridesmaid');
  // A picker also says what the word stands for.
  assert.equal(guestRolePickLabel('bridesmaid', CREW), "Bride's Crew (Bridesmaid)");
  assert.equal(guestRolePickLabel('groomsman', {}), 'Groomsman');
  // Renaming never PUBLISHES a role the invitation keeps private.
  assert.equal(roleLabel('guest', { guest: { one: 'Friend' } } as RoleNames), null);
});

test('the Wedding March heading and every name say the couple’s words', () => {
  const groups = buildEntourage(rows, null, CREW);
  const crew = groups.find((g) => g.key === 'bridesmaids_groomsmen')!;
  assert.equal(crew.label, "Bride's Crew & Groom's Crew");
  assert.equal(roleLabel(crew.rows[0]![0]!.role, crew.names), "Bride's Crew");
  assert.equal(groups.find((g) => g.key === 'flower_girls')!.label, 'Little Angels');
  // One side renamed: only that column's word changes.
  const one = buildEntourage(rows, null, { bridesmaid: { one: 'Ate Squad' } });
  assert.equal(one.find((g) => g.key === 'bridesmaids_groomsmen')!.label, "Ate Squad & Groom's Crew");
  // The dashboard's panel heading agrees with the invitation's.
  assert.equal(entourageGroupLabel('bridesmaids_groomsmen', CREW, rows), crew.label);
});

test('the role does not move: order, pairing and sections are identical with and without words', () => {
  const strip = (gs: ReturnType<typeof buildEntourage>) =>
    gs.map((g) => ({ key: g.key, rows: g.rows.map((r) => r.map((p) => (p ? `${p.id}:${p.role}` : null))) }));
  assert.deepEqual(strip(buildEntourage(rows, null, CREW)), strip(buildEntourage(rows, null)));
  const script = (names?: RoleNames) =>
    buildEmceeScript({
      event: { displayName: 'A & B', eventDate: null },
      blocks: [],
      guests: rows.map((r) => ({ ...r, display_name: null, extra_roles: [] }) as unknown as GuestRow),
      roleNames: names,
    });
  const plain = script();
  const named = script(CREW);
  // Same lines in the same order — only the words differ.
  assert.equal(named.split('\n').length, plain.split('\n').length);
  assert.ok(named.includes("Bride's Crew:"), named);
  assert.ok(named.includes('Little Angel: Fe Flor'), named);
  assert.ok(plain.indexOf('Bridesmaid:') > 0);
  assert.ok(named.indexOf("Bride's Crew:") === plain.indexOf('Bridesmaid:'));
});

test('the guest’s own "You are …" line and the dress-code rows say the word', () => {
  const palette = resolveDisplayPalette(sanitizeRolePalette({ bridesmaids: ['#aa3355'] }));
  const mine = resolveGuestDressCode({ role: 'bridesmaid', roles: {}, palette, names: CREW });
  assert.equal(mine?.roleLabel, "Bride's Crew");
  assert.equal(resolveGuestDressCode({ role: 'bridesmaid', roles: {}, palette })?.roleLabel, 'Bridesmaid');
  const stored = sanitizeRolePalette({ bridesmaids: ['#aa3355'] });
  const everyone = dressCodeForEveryone({ stored, board: resolveDisplayPalette(stored), roles: {}, groups: {}, names: CREW });
  assert.ok(everyone.rows.some((r) => r.label === "Bride's Crew"), JSON.stringify(everyone.rows));
  assert.equal(roleGroupLabel('bridesmaids', CREW), "Bride's Crew");
  assert.equal(roleGroupLabel('bridesmaids', {}), ROLE_GROUP_LABELS.bridesmaids);
  assert.equal(sectionHeadingInTheirWords(ROLE_GROUP_LABELS.groomsmen, CREW), "Groom's Crew");
  assert.equal(sectionHeadingInTheirWords('Principal Sponsors', CREW), 'Principal Sponsors');
});

/*
  ── THE SWEEP ───────────────────────────────────────────────────────────────
  Every call that SHOWS a role word — `ROLE_LABELS[…]`, `roleLabel(…)` — must
  hand over the event's words. A call is fine when it passes a second argument,
  or when it only asks "is this role published?" (`roleLabel(x) !== null`).
  Anything else is listed below with the reason, and the list is a decision log:
  every line must still match something, or it is deleted.
*/
const SHOWS_THE_USUAL_WORD_ON_PURPOSE: Array<[file: string, line: string, why: string]> = [
  ['lib/guests.ts', 'mine !== ROLE_LABELS[role]', 'the picker label shows the usual word IN BRACKETS beside theirs'],
  ['lib/guests.ts', 'can only be one person', 'singleton messages — bride/groom/Nikah officials, never renamed on the list'],
  ['lib/guests.ts', 'There’s already a', 'singleton messages — same'],
  ['lib/guests.ts', '?? ROLE_LABELS[role];', 'the fallback inside guestRoleLabel itself'],
  ['lib/emcee-script.ts', '?? ROLE_LABELS[role])', 'the fallback for several, after the couple’s `many`'],
  ['app/dashboard/[eventId]/guests/_components/chip-editors.tsx', 'is the foundation of the event', 'bride/groom lock — not renamable'],
  ['app/dashboard/[eventId]/guests/_components/chip-editors.tsx', 'the event is theirs', 'bride/groom RSVP lock — not renamable'],
  ['app/dashboard/[eventId]/guests/_components/chip-editors.tsx', 'const usual = ROLE_LABELS[role]', 'the rename box names the USUAL word it is renaming'],
  ['app/dashboard/[eventId]/guests/page.tsx', 'const roleSearchLabel =', 'search matches the usual word AND theirs'],
  ['app/dashboard/[eventId]/guests/page.tsx', ': ROLE_GROUP_LABELS[grp];', 'a SORT KEY — renamed only where the heading is drawn'],
  ['app/dashboard/[eventId]/guests/_components/guest-list-multiselect.tsx', ': ROLE_GROUP_LABELS[grp];', 'the same SORT KEY on the client — the heading is re-said by sectionHeadingInTheirWords'],
  ['app/dashboard/[eventId]/guests/_components/guest-list-multiselect.tsx', "label: grp === 'guest' ? 'Guests' : ROLE_GROUP_LABELS[grp],", 'the honoree heading — bride/groom/celebrant, never renamed'],
];

test('every screen that shows a role word is handed the couple’s words', () => {
  const files = execFileSync('git', ['grep', '-l', '-E', 'ROLE_LABELS\\[|roleLabel\\(|ROLE_GROUP_LABELS\\[', '--', 'app', 'lib'], {
    cwd: APP,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((f) => f && !/\.test\.tsx?$/.test(f));
  assert.ok(files.length > 20, `the sweep found only ${files.length} files — has the grep broken?`);

  const used = new Set<string>();
  const offenders: string[] = [];
  for (const f of files) {
    // Two modules own the words themselves: the maps and the resolvers.
    if (f === 'lib/role-names.ts' || f === 'lib/role-groups.ts' || f === 'lib/entourage.ts') continue;
    // The editorial badge map is its own vocabulary (`voices.ts`) — its callers are swept.
    if (f === 'app/[slug]/_components/editorial/voices.ts') continue;
    readFileSync(join(APP, f), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
        const calls = [...line.matchAll(/roleLabel\(([^()]*(?:\([^()]*\))?[^()]*)\)/g)];
        const bare =
          /ROLE_LABELS\[/.test(line) ||
          /ROLE_GROUP_LABELS\[/.test(line) ||
          calls.some((m) => !m[1]!.includes(',') && !/^\s*$/.test(m[1]!));
        if (!bare) return;
        // "Is this role published?" asks nothing about words.
        if (/roleLabel\([^)]*\)\s*(!==|===)\s*null/.test(line)) return;
        const excuse = SHOWS_THE_USUAL_WORD_ON_PURPOSE.find(([file, s]) => file === f && line.includes(s));
        if (excuse) {
          used.add(`${excuse[0]}|${excuse[1]}`);
          return;
        }
        offenders.push(`${f}:${i + 1}  ${t.slice(0, 140)}`);
      });
  }
  assert.deepEqual(offenders, [], `these show a role word without the couple's words:\n  ${offenders.join('\n  ')}`);
  for (const [file, s] of SHOWS_THE_USUAL_WORD_ON_PURPOSE) {
    assert.ok(used.has(`${file}|${s}`), `${file} no longer matches "${s}" — delete that excuse`);
  }
});

test('every page that draws the guest list’s client pieces mounts the words for them', () => {
  for (const page of [
    'app/dashboard/[eventId]/guests/page.tsx',
    'app/dashboard/[eventId]/guests/new/page.tsx',
    'app/dashboard/[eventId]/guests/checkin/page.tsx',
    'app/dashboard/[eventId]/guests/claims/page.tsx',
  ]) {
    const src = readFileSync(join(APP, page), 'utf8');
    assert.match(src, /<RoleNamesProvider names=\{roleNames\}>/, `${page} does not mount RoleNamesProvider`);
    assert.match(src, /loadRoleNames\(/, `${page} never reads the couple's words`);
  }
  // The public tree reads them once and hands them to every widget that names a role.
  const body = readFileSync(join(APP, 'app/[slug]/_components/site-body.tsx'), 'utf8');
  assert.match(body, /const roleNames = await loadEventRoleNames\(/);
  assert.equal((body.match(/roleNames=\{roleNames\}/g) ?? []).length, 2, 'both widget dispatchers get the words');
  const loaders = readFileSync(join(APP, 'app/[slug]/_lib/loaders.ts'), 'utf8');
  // The words are buildEntourage's third argument (the Name style, owner 2026-09-30, may follow).
  assert.match(loaders, /await loadEntourageSectionOrder\(admin, eventId\),\n\s*await loadEventRoleNames\(admin, eventId\),\n/, 'the invitation’s entourage is built with the words');
});

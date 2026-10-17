/**
 * 👵 A GRANDPARENT IS NEVER "IMMEDIATE FAMILY" — AND EVERY ROLE LIST THAT NAMES THE PARENTS NAMES THE GRANDPARENTS.
 *
 * ⚖ Owner 2026-10-17, verbatim: *"the 2 grandparents should not be named immediate family on the wedding march
 * list."* Asked "Grandparents of the Bride / of the Groom as roles, the same way Parents works (own heading, own march
 * place, each reads 'Grandmother of the Groom' etc.)", he answered "Okay". Migration 20271271089555 adds
 * `bride_grandparents` / `groom_grandparents`.
 *
 * THE PROPERTIES:
 *   1. On every entourage look (On the axis, Lines, The march, no pick) and in the Maker's march sections, no
 *      grandparent is drawn under the Immediate Family heading, and none carries an immediate-family word. Each
 *      carries a grandparent word of THEIR OWN side, agreeing with the couple's entry where it says which (title,
 *      else attire — the parents' resolver), "Grandparent" where nothing does. On the march, people on one line who
 *      are the SAME word say it once in the plural ("Grandmothers of the Groom", "Mothers of the Bride" — controller
 *      2026-10-17 on #6600); different words stay one per person. The Grandparents section stands after Parents (the groom's side in the march) and
 *      before Immediate Family — also for a couple who arranged their sections before this group existed.
 *   2. Every role LIST in the app that names a parent role names the same side's grandparent role beside it — the
 *      memory "a re-listed vocabulary drops a later value" (the Ninong/Ninang split dropped two roles from the
 *      invitation for a day). Read from source, literal by literal; a list that deliberately holds parents alone is
 *      written below with its reason, and every such exception must still match exactly one list.
 *   3. Wherever a tier is computed, a grandparent gets exactly what a parent of the same side gets — nothing about
 *      seating, invitations, attire or the guest list gets worse for them.
 *
 * Sabotage (2026-10-17), each seen RED then restored (fails out of 9, before the plural tests were added): the grandparents folded into Immediate Family's
 * roles with their group deleted → 6 ('sections: parents, immediate_family, honour'); `INNER_CIRCLE_ROLES` without
 * them → 2 (the list scan + the tier check); `KIN_OF_ROLE` without them → 5 ('Ms. Juana Sarmiento is called
 * "Grandparents of the Groom"'); `orderedGroupKeys` appending the missing section → 1 (an arranged event walked them
 * after the Nikah); the Auto Arrange family set without them → 2.
 * Then (out of 10): `marchLineWords` back to one word per person, the plural only for two unknowns → 2 ('Grandmother
 * of the Groom · Grandmother of the Groom').
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';

import { buildEntourage, ENTOURAGE_GROUP_KEYS, orderedGroupKeys, type EntourageGroup, type EntourageGuestRow } from './entourage';
import { marchSections } from './march-sections';
import { STAGE_SCENE_STYLE_SETS } from './scene-styles-stages';
import { defaultInvitedToForRole, ROLE_LABELS, type GuestRole } from './guests';
import { roleGroupOf, ROLE_IMPORTANCE } from './role-groups';
import { WEDDING_ROLE_SET, MUSLIM_ROLE_SET } from './role-sets';
import { bulkAssignableRolesFor } from './bulk-role-vocabulary';
import { roleSeatingSetOf } from './role-seating';
import { paletteKeyForRole } from './mood-board';
import { READER_FIGURE } from './attire-designs';
import { voiceOf } from '../app/[slug]/_components/editorial/voices';

/* 🪤 The components are `"jsx": "preserve"` — React must be global before their dynamic import. */
(globalThis as unknown as { React: unknown }).React = React;

const PAIRS: ReadonlyArray<readonly [parent: GuestRole, grand: GuestRole]> = [
  ['groom_parents', 'groom_grandparents'],
  ['bride_parents', 'bride_grandparents'],
];

/* ── 1 · the entourage looks ─────────────────────────────────────────────── */

type Row = [id: string, prefix: string | null, first: string, last: string, role: string, walk: number, place: number, attire?: string];
/** Stand-in names only. The answer key is the test's own, never read from the module. */
const CAST: Row[] = [
  ['g1', 'Mr.', 'Pedro', 'Abad', 'groom_parents', 1, 0],
  ['g2', 'Mrs.', 'Luz', 'Abad', 'groom_parents', 1, 1],
  /* The owner's shape: two grandmothers of the groom, both "Ms.", walking together. */
  ['gg1', 'Ms.', 'Juana', 'Sarmiento', 'groom_grandparents', 2, 0],
  ['gg2', 'Ms.', 'Maxima', 'Sarmiento', 'groom_grandparents', 2, 1],
  /* A grandfather told by attire alone, with a grandmother; and two the entry says nothing about. */
  ['bg1', 'Atty.', 'Ramon', 'Lim', 'bride_grandparents', 3, 0, 'suit'],
  ['bg2', 'Mrs.', 'Rosa', 'Lim', 'bride_grandparents', 3, 1],
  ['bg3', 'Dr.', 'Celso', 'Uy', 'bride_grandparents', 4, 0],
  ['bg4', 'Hon.', 'Nena', 'Uy', 'bride_grandparents', 4, 1],
  ['b1', 'Mr.', 'Celso', 'Navarro', 'bride_parents', 5, 0],
  ['b2', 'Mrs.', 'Ana', 'Navarro', 'bride_parents', 5, 1],
  ['f1', 'Ms.', 'Lea', 'Abad', 'groom_immediate_family', 6, 0],
  ['f2', 'Mr.', 'Paolo', 'Navarro', 'bride_immediate_family', 7, 0],
  ['m1', 'Ms.', 'Andrea', 'Flores', 'maid_of_honor', 8, 0],
  ['bm', 'Mr.', 'Daniel', 'Ramos', 'best_man', 8, 1],
  ['gr', 'Mr.', 'Jose', 'Abad', 'groom', 0, 0],
  ['br', 'Ms.', 'Maria', 'Navarro', 'bride', 99, 0],
];
const KNOWN: Record<string, string> = {
  'Ms. Juana Sarmiento': 'Grandmother of the Groom',
  'Ms. Maxima Sarmiento': 'Grandmother of the Groom',
  'Atty. Ramon Lim': 'Grandfather of the Bride',
  'Mrs. Rosa Lim': 'Grandmother of the Bride',
  'Dr. Celso Uy': 'Grandparent of the Bride',
  'Hon. Nena Uy': 'Grandparent of the Bride',
};
const GRANDS = new Set(Object.keys(KNOWN));

const rows: EntourageGuestRow[] = CAST.map(([id, prefix, first, last, role, walk, place, attire]) => ({
  guest_id: id,
  name_prefix: prefix,
  first_name: first,
  last_name: last,
  role,
  extra_roles: [],
  march: { walk_no: walk, place_in_walk: place },
  attire: attire ?? 'neutral',
})) as unknown as EntourageGuestRow[];

const decode = (s: string) =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = (html: string) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

async function render(groups: readonly EntourageGroup[], sceneStyle: string | null): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EntourageSection } = await import('../app/[slug]/_components/entourage-section');
  return renderToStaticMarkup(React.createElement(EntourageSection as never, { groups, sceneStyle }));
}

const STYLES: Array<string | null> = [
  ...(STAGE_SCENE_STYLE_SETS.find((s) => s.type === 'entourage')?.styles.map((s) => s.id) ?? []).filter((id) => id !== 'march'),
  null,
];

/** Each drawn person in a two-column look: name, the word drawn right after it (or null), the heading above them. */
function drawnPeople(html: string): Array<{ name: string; word: string | null; heading: string }> {
  const out: Array<{ name: string; word: string | null; heading: string }> = [];
  for (const part of html.split(/(?=<h4[\s>])/)) {
    const heading = text(/<h4[^>]*>([\s\S]*?)<\/h4>/.exec(part)?.[1] ?? '');
    for (const p of part.matchAll(/data-person=""[^>]*>([^<]*)<\/span>(\s*<span(?![^>]*sr-only)[^>]*>([^<]*)<\/span>)?/g)) {
      out.push({ name: decode(p[1]!).trim(), word: p[3] ? decode(p[3]).trim() : null, heading });
    }
  }
  return out;
}

const IMMEDIATE = /immediate family|bride's family|groom's family/i;

test('the guard sees what it guards: the cast prints a Grandparents and an Immediate Family section', async () => {
  const groups = buildEntourage(rows);
  const keys = groups.map((g) => g.key);
  assert.ok(keys.includes('grandparents') && keys.includes('immediate_family'), `sections: ${keys.join(', ')}`);
  const people = drawnPeople(await render(groups, null));
  assert.equal(people.filter((p) => GRANDS.has(p.name)).length, GRANDS.size, `grandparents drawn: ${people.map((p) => p.name).join(', ')}`);
  assert.ok(people.some((p) => IMMEDIATE.test(p.heading)), 'no Immediate Family heading drawn — the "never under it" check would be vacuous');
});

test('the Grandparents section stands after Parents and before Immediate Family — also for an arranged event', () => {
  /* A couple who arranged their sections before this group existed: their list lacks it — in the built-in order,
     and reversed (Parents last). Either way it must stand right after their Parents, never at the end. */
  const before = ENTOURAGE_GROUP_KEYS.filter((k) => k !== 'grandparents');
  for (const saved of [null, before, [...before].reverse()]) {
    const order = orderedGroupKeys(saved);
    const at = (k: string) => order.indexOf(k);
    assert.ok(at('grandparents') === at('parents') + 1, `saved ${JSON.stringify(saved)}: grandparents at ${at('grandparents')}, parents at ${at('parents')} — ${order.join(', ')}`);
    if (!saved) assert.ok(at('grandparents') < at('immediate_family'), 'built-in: Grandparents after Immediate Family');
  }
  /* The march: the groom's side, then the grandparents, before anyone else. */
  const march = buildEntourage(rows, null, null, undefined, { march: true }).map((g) => g.key);
  assert.deepEqual(march.slice(0, 3), ['groom_side', 'grandparents', 'immediate_family'], march.join(', '));
});

for (const style of STYLES) {
  const look = style ?? 'no pick';
  test(`${look}: no grandparent is drawn as immediate family, and each is named per person, by their own side`, async () => {
    const people = drawnPeople(await render(buildEntourage(rows), style)).filter((p) => GRANDS.has(p.name));
    assert.equal(people.length, GRANDS.size, `${look}: grandparents drawn ${people.length}`);
    for (const p of people) {
      assert.doesNotMatch(p.heading, IMMEDIATE, `${look}: ${p.name} is drawn under "${p.heading}"`);
      assert.doesNotMatch(p.word ?? '', IMMEDIATE, `${look}: ${p.name} is called "${p.word}"`);
      assert.equal(p.word, KNOWN[p.name], `${look}: ${p.name} is called "${p.word}"`);
    }
  });
}

/** The plural each same-word line must read — the test's own answer key (controller 2026-10-17 on #6600). */
const PLURAL: Record<string, string> = {
  'Grandmother of the Groom': 'Grandmothers of the Groom',
  'Grandfather of the Bride': 'Grandfathers of the Bride',
  'Grandparent of the Bride': 'Grandparents of the Bride',
  'Mother of the Bride': 'Mothers of the Bride',
  'Father of the Groom': 'Fathers of the Groom',
};

/** Each march line: its names and the words under them. */
function marchLines(html: string): Array<{ names: string[]; words: string }> {
  return [...html.matchAll(/<li[^>]*data-march-line[^>]*>([\s\S]*?)<\/li>/g)].map((m) => {
    const ps = [...m[1]!.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((x) => text(x[1]!));
    return { names: (ps[0] ?? '').split(' & '), words: (ps[1] ?? '').replace(/ · you walk .*$/, '') };
  });
}

/** What a line of kin must read: one shared word said once in the plural, else one word per person in name order. */
function expectedKinWords(perPerson: readonly string[]): string {
  if (perPerson.length > 1 && new Set(perPerson).size === 1) return PLURAL[perPerson[0]!] ?? `(no plural for ${perPerson[0]})`;
  return perPerson.join(' · ');
}

test('the march: no grandparent line says immediate family; one word per person, the same word once in the plural', async () => {
  let seen = 0;
  let plural = 0;
  for (const { names, words } of marchLines(await render(buildEntourage(rows), 'march'))) {
    const grands = names.filter((n) => GRANDS.has(n));
    if (grands.length === 0) continue;
    seen += grands.length;
    assert.doesNotMatch(words, IMMEDIATE, `the march: ${names.join(' & ')} — "${words}"`);
    const want = expectedKinWords(grands.map((n) => KNOWN[n]!));
    if (!want.includes(' · ') && grands.length > 1) plural++;
    assert.equal(words, want, `the march: ${names.join(' & ')}`);
  }
  assert.equal(seen, GRANDS.size, 'not every grandparent walked on the march — the guard sees too little');
  /* The owner's two "Ms." grandmothers and the two unknowns: both lines must exercise the plural. */
  assert.equal(plural, 2, 'expected two same-word grandparent lines');
});

test('the march: parents follow the same rule — "Mothers of the Bride", and a father with a mother stays two words', async () => {
  const cast: Row[] = [
    ['p1', 'Mrs.', 'Ana', 'Reyes', 'bride_parents', 1, 0],
    ['p2', 'Mrs.', 'Lita', 'Reyes', 'bride_parents', 1, 1], // two mothers (a mother and a stepmother)
    ['p3', 'Mr.', 'Jose', 'Abad', 'groom_parents', 2, 0],
    ['p4', 'Mrs.', 'Luz', 'Abad', 'groom_parents', 2, 1],
    ['p5', 'Mr.', 'Ramon', 'Uy', 'bride_grandparents', 3, 0],
    ['p6', 'Atty.', 'Celso', 'Uy', 'bride_grandparents', 3, 1, 'suit'], // two grandfathers, one told by attire
  ];
  const r = cast.map(([id, prefix, first, last, role, walk, place, attire]) => ({
    guest_id: id, name_prefix: prefix, first_name: first, last_name: last, role, extra_roles: [],
    march: { walk_no: walk, place_in_walk: place }, attire: attire ?? 'neutral',
  })) as unknown as EntourageGuestRow[];
  const lines = marchLines(await render(buildEntourage(r), 'march'));
  const said = (who: string) => lines.find((l) => l.names.includes(who))?.words;
  assert.equal(said('Mrs. Ana Reyes'), 'Mothers of the Bride');
  assert.equal(said('Mr. Jose Abad'), 'Father of the Groom · Mother of the Groom');
  assert.equal(said('Mr. Ramon Uy'), 'Grandfathers of the Bride');
});

/**
 * 👪 THE OTHER GRANDPARENT (owner 2026-10-17, live /cale-ice — the parents' resolver names the other of two, and a
 * grandparent is read by the same one): exactly two on a side, one told by the entry ("Mr."), the other not ("Atty.",
 * attire at its default) → Grandfather · Grandmother. Two unknowns stay "Grandparents of the …"; three on a side are
 * left as each entry says.
 */
test('the other grandparent is named: a Mr. with an Atty. → Grandfather · Grandmother; two unknown and three unchanged', async () => {
  const cast: Row[] = [
    ['q1', 'Mr.', 'Andres', 'Dela Cruz', 'groom_grandparents', 1, 0],
    ['q2', 'Atty.', 'Pacita', 'Dela Cruz', 'groom_grandparents', 1, 1],
    ['q3', 'Dr.', 'Celso', 'Uy', 'bride_grandparents', 2, 0],
    ['q4', 'Hon.', 'Nena', 'Uy', 'bride_grandparents', 2, 1],
  ];
  const three: Row[] = [
    ['h1', 'Mr.', 'Lucio', 'Tan', 'bride_grandparents', 1, 0],
    ['h2', 'Atty.', 'Rosario', 'Tan', 'bride_grandparents', 1, 1],
    ['h3', 'Engr.', 'Pilar', 'Tan', 'bride_grandparents', 2, 0],
  ];
  const toRows = (c: Row[]) => c.map(([id, prefix, first, last, role, walk, place, attire]) => ({
    guest_id: id, name_prefix: prefix, first_name: first, last_name: last, role, extra_roles: [],
    march: { walk_no: walk, place_in_walk: place }, attire: attire ?? 'neutral',
  })) as unknown as EntourageGuestRow[];
  const want: Record<string, string> = {
    'Mr. Andres Dela Cruz': 'Grandfather of the Groom',
    'Atty. Pacita Dela Cruz': 'Grandmother of the Groom',
    'Dr. Celso Uy': 'Grandparent of the Bride',
    'Hon. Nena Uy': 'Grandparent of the Bride',
    'Mr. Lucio Tan': 'Grandfather of the Bride',
    'Atty. Rosario Tan': 'Grandparent of the Bride',
    'Engr. Pilar Tan': 'Grandparent of the Bride',
  };
  let drawn = 0;
  for (const c of [cast, three]) {
    for (const style of STYLES) {
      for (const p of drawnPeople(await render(buildEntourage(toRows(c)), style))) {
        if (!(p.name in want)) continue;
        drawn++;
        assert.equal(p.word, want[p.name], `${style ?? 'no pick'}: ${p.name} is called "${p.word}"`);
      }
    }
  }
  assert.equal(drawn, Object.keys(want).length * STYLES.length, 'not every grandparent drew on every look');
  const lines = marchLines(await render(buildEntourage(toRows(cast)), 'march'));
  const said = (who: string) => lines.find((l) => l.names.includes(who))?.words;
  assert.equal(said('Mr. Andres Dela Cruz'), 'Grandfather of the Groom · Grandmother of the Groom');
  assert.equal(said('Dr. Celso Uy'), 'Grandparents of the Bride');
  const threeLines = marchLines(await render(buildEntourage(toRows(three)), 'march'));
  assert.equal(threeLines.find((l) => l.names.includes('Mr. Lucio Tan'))?.words, 'Grandfather of the Bride · Grandparent of the Bride');
});

test("the Maker's march sections: no grandparent sits in Immediate Family", () => {
  const sections = marchSections(buildEntourage(rows, null, null, undefined, { march: true }));
  let seen = 0;
  for (const sec of sections) {
    const names = JSON.stringify(sec);
    for (const n of GRANDS) {
      if (!names.includes(n)) continue;
      seen++;
      assert.notEqual(sec.key, 'immediate_family', `${n} is in the march's Immediate Family`);
      assert.doesNotMatch(String(sec.label ?? ''), IMMEDIATE, `${n} is under "${sec.label}"`);
    }
  }
  assert.equal(seen, GRANDS.size, 'not every grandparent is in a march section');
});

/* ── 2 · every role list that names a parent names the grandparent ───────── */

const WEB = process.cwd();
const REPO = join(WEB, '..', '..');

/**
 * Lists that hold parents WITHOUT grandparents on purpose. `file` + a string only that literal holds; each must still
 * match exactly one literal, so an exception cannot outlive its list.
 */
const PARENTS_ALONE: ReadonlyArray<{ file: string; holds: string; why: string }> = [
  { file: 'apps/web/lib/entourage.ts', holds: "['groom_parents', 'groom']", why: 'the march-only "The Groom & his parents": a parent walks with their own child; grandparents walk as their own section' },
  { file: 'apps/web/lib/entourage.ts', holds: "['bride_parents', 'bride']", why: 'the march-only "The Bride & her parents" — as above' },
  { file: 'apps/web/lib/entourage.ts', holds: "['groom_parents', 'bride_parents']", why: 'the Parents group itself; Grandparents is its twin, one group below' },
  { file: 'apps/web/app/dashboard/[eventId]/launch/_components/parent-cards.tsx', holds: 'roleHint', why: "the Maker's Parents card adds a PARENT; a grandparent is added on the guest card" },
  { file: 'apps/web/app/dashboard/[eventId]/launch/_components/studio-prints-six.tsx', holds: 'roleHint', why: 'the Prints Parents field adds a PARENT, as above' },
  { file: 'apps/web/lib/print-set.server.ts', holds: "side: p.role === 'bride_parents'", why: "the printed card's parents block; grandparents print in the entourage list on the same card" },
  { file: 'apps/web/lib/maker-details-items.ts', holds: 'parents: offered.includes', why: "whether the Maker shows its Parents item (the invitation's parents block)" },
  { file: 'supabase/migrations/20260607040000_guest_role_add_vip_family.sql', holds: "'bride_parents'", why: 'an applied migration adding the parent values; applied migrations are never edited' },
  { file: 'supabase/migrations/20271258783396_march_is_its_own_table.sql', holds: "'groom_parents', 'bride_parents'", why: 'a one-time snapshot copy run before grandparents existed; nothing reads it after (its own note)' },
];

const SKIP_DIR = new Set(['node_modules', '.next', 'dev', 'build-sessions', 'graphify-out', 'tests']);
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx|sql)$/.test(name) && !/\.test\.|fixture|lab-sample|\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/** The text with every comment blanked (strings kept), so a role named in prose is never mistaken for a list. */
function code(src: string, sql: boolean): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    const two = src.slice(i, i + 2);
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else if ((!sql && two === '//') || (sql && two === '--')) {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? src.length : end;
      out += ' '.repeat(stop - i);
      i = stop;
    } else if (c === "'" || c === '"' || (!sql && c === '`')) {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** The literal (`[…]`, `{…}` or SQL `ARRAY[…]`/`(…)`) that directly encloses position `at`. */
function enclosing(src: string, at: number, sql: boolean): string {
  const open = sql ? '[{(' : '[{';
  let depth = 0;
  let start = -1;
  for (let i = at; i >= 0; i--) {
    const c = src[i]!;
    if (']})'.includes(c)) depth++;
    else if ('[{('.includes(c)) {
      if (depth === 0 && open.includes(c)) { start = i; break; }
      if (depth > 0) depth--;
    }
  }
  if (start === -1) return src;
  depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i]!;
    if ('[{('.includes(c)) depth++;
    else if (']})'.includes(c) && --depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start);
}

function listsNamingParents(): Array<{ file: string; list: string; missing: string[] }> {
  const files = [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib')), ...sources(join(WEB, 'components')), ...sources(join(REPO, 'supabase', 'migrations'))];
  const found: Array<{ file: string; list: string; missing: string[] }> = [];
  for (const path of files) {
    const sql = path.endsWith('.sql');
    const src = code(readFileSync(path, 'utf8'), sql);
    const seen = new Set<string>();
    for (const m of src.matchAll(/['"](bride|groom)_parents['"]|^\s*(bride|groom)_parents\s*:/gm)) {
      const list = enclosing(src, m.index!, sql);
      if (seen.has(list)) continue;
      seen.add(list);
      const missing = PAIRS.filter(([p, g]) => new RegExp(`\\b${p}\\b`).test(list) && !new RegExp(`\\b${g}\\b`).test(list)).map(([, g]) => g);
      found.push({ file: relative(REPO, path), list, missing });
    }
  }
  return found;
}

test('every role list that names a parent names the same side’s grandparent beside it', () => {
  const lists = listsNamingParents();
  /* Not vacuous: the vocabulary is re-listed in many places, and most of them must have been read. */
  assert.ok(lists.length >= 15, `only ${lists.length} lists naming a parent were found — the scan is reading nothing`);
  const excused = (l: { file: string; list: string }) => PARENTS_ALONE.find((e) => e.file === l.file && l.list.includes(e.holds));
  const dropped = lists.filter((l) => l.missing.length > 0 && !excused(l));
  assert.deepEqual(
    dropped.map((l) => `${l.file}: lacks ${l.missing.join(' + ')} in ${l.list.replace(/\s+/g, ' ').slice(0, 140)}`),
    [],
    'a list names the parents and drops the grandparents — add them beside the parents, or write the list into PARENTS_ALONE with its reason',
  );
  for (const e of PARENTS_ALONE) {
    const hits = lists.filter((l) => l.file === e.file && l.list.includes(e.holds));
    assert.equal(hits.length, 1, `PARENTS_ALONE "${e.file}" / "${e.holds}" matches ${hits.length} lists — it went stale or is too loose`);
  }
});

/* ── 3 · a grandparent stands where a parent stands ───────────────────────── */

test('every computed tier gives a grandparent exactly what a parent of the same side gets', () => {
  for (const [parent, grand] of PAIRS) {
    assert.ok(ROLE_LABELS[grand], `${grand} has no label`);
    for (const set of [WEDDING_ROLE_SET, MUSLIM_ROLE_SET]) {
      assert.ok(set.offeredRoles.includes(grand), `${set.key}: ${grand} is not offered on the guest card / new-guest picker`);
      assert.equal(set.tier1Roles.has(grand), set.tier1Roles.has(parent), `${set.key}: seating tier differs`);
      assert.equal(set.tier2Roles.has(grand), set.tier2Roles.has(parent), `${set.key}: seating tier 2 differs`);
      assert.equal(set.selfClaimableRoles.includes(grand), set.selfClaimableRoles.includes(parent), `${set.key}: self-claim differs`);
      assert.equal(bulkAssignableRolesFor(set.key).includes(grand), bulkAssignableRolesFor(set.key).includes(parent), `${set.key}: bulk assign differs`);
    }
    assert.deepEqual(defaultInvitedToForRole(grand), defaultInvitedToForRole(parent), 'inner-circle invite blocks differ');
    assert.equal(roleGroupOf(grand), roleGroupOf(parent), 'guest-list group (VIP · Immediate Family) differs');
    assert.equal(roleSeatingSetOf(grand), roleSeatingSetOf(parent), 'Auto Arrange "who sits together" differs');
    assert.equal(paletteKeyForRole(grand), paletteKeyForRole(parent), 'mood board / attire colour differs');
    assert.deepEqual(READER_FIGURE[grand], READER_FIGURE[parent], 'attire figure differs');
    assert.equal(voiceOf(grand), voiceOf(parent), 'the guestbook voice differs');
    /* Importance: right after the parents, before anyone else. */
    const i = ROLE_IMPORTANCE.indexOf(grand);
    assert.ok(i > ROLE_IMPORTANCE.indexOf(parent) && i < ROLE_IMPORTANCE.indexOf('bride_immediate_family'), `${grand} ranks at ${i}`);
  }
});

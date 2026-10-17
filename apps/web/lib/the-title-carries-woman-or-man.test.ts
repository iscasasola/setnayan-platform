/**
 * 🪪 A TITLE CARRIES WOMAN OR MAN — the properties, not the phrasing.
 *
 * ⚖ OWNER 2026-10-17, verbatim: *"Find a different approach on how to fix this issue on prefixes which are neutral
 * gender"* → *"or let them choose Atty (Female) or Atty (Male). something like this"* → *"so no need to choose"*.
 *
 * THE PROPERTIES:
 *   1. NOTHING PUBLIC PRINTS "(Woman)" OR "(Man)". Every key the Title dropdown can post — every listed entry, a stored
 *      or typed title's two entries, "No title (…)" — stores a `name_prefix` with no gender word in it; a typed
 *      "(Woman)" in a bulk line, an import cell or the Other box is taken out, never stored. And no file outside the
 *      host's guest screens imports the picker's WORDS (`titlePickLabel` & co.), nor holds the literal.
 *   2. EVERY GENDER WORD RESOLVES FROM GENDER WHEN IT IS SET — for every title in the list, a typed one and none, on
 *      every parent and grandparent role, against the OPPOSITE attire: "Atty. (Woman)" is Mother / Grandmother,
 *      "(Man)" Father / Grandfather; a legacy principal sponsor stands in the Ninang / Ninong column; the seat-plan
 *      figure wears the gown / suit. Rendered: the march and On the axis say "Mother of the Groom" for an
 *      Atty. (Woman) beside a Mr.
 *   3. THE BACKFILL MAPS ONLY GENDERED TITLES — the migration's IN list and its trigger's CASE are exactly
 *      `GENDERED_TITLES`, and no listed neutral title is read as one. (Executed against the replayed schema in
 *      tests/db/a-title-carries-woman-or-man.db.test.ts.)
 *   4. THE PROMPT LISTS EXACTLY WHO WAITS: `needsWomanOrMan` is true precisely where the resolver, given no attire,
 *      has no word — so the Guests page never asks about someone already told, and never misses someone who isn't.
 *
 * Sabotage (2026-10-17), each seen RED then restored (fails out of 8): `parseTitleKey` storing "Atty. (Woman)" → 1
 * (test 1); `parentWordOf` without its two gender lines → 3 (4, 5, 8); the backfill's IN list + 'atty' → 1 (7);
 * `needsWomanOrMan` reading the title only → 1 (8); `'(Woman)'` in app/[slug]/_lib/types.ts → 1 (3); the legacy
 * sponsor's column ignoring gender → 1 (6).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';

import {
  GENDERED_TITLES,
  PAIRED_TITLES,
  PLAIN_TITLES,
  OTHER_TITLE_KEY,
  ROLES_WHOSE_WORD_NEEDS_GENDER,
  choicesOfTitle,
  genderOfTitle,
  needsWomanOrMan,
  parseTitleKey,
  takeGenderMark,
  titleChoices,
} from './guest-title';
import { buildEntourage, parentWordOf, type EntourageGroup, type EntourageGuestRow } from './entourage';
import { resolveGuestAttire } from './guests';
import { stripComments } from './strip-comments';
import { planGuestImport, readGuestFile } from './guest-import-file';
import { GENERIC_ROLE_SET } from './role-sets';

(globalThis as unknown as { React: unknown }).React = React;

const MARK = /\((?:woman|man|female|male)\)/i;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ── 1 · nothing public prints the mark ───────────────────────────────────── */

const ALL_KEYS = [
  ...titleChoices({ other: true }),
  ...titleChoices({ current: 'Regional Prosecutor', typed: 'IBP Gov.' }),
  ...choicesOfTitle(''),
].map((c) => c.key);

test('every key the Title dropdown can post stores a title with no gender word in it', () => {
  assert.ok(ALL_KEYS.length > 40, `only ${ALL_KEYS.length} keys — the guard sees too little`);
  for (const key of ALL_KEYS) {
    if (key === OTHER_TITLE_KEY) continue;
    const { name_prefix } = parseTitleKey(key);
    assert.doesNotMatch(name_prefix ?? '', MARK, `the key "${key}" would store "${name_prefix}"`);
    assert.doesNotMatch(name_prefix ?? '', /\b(?:Woman|Man)\b/, `the key "${key}" would store "${name_prefix}"`);
  }
  // A pasted label is never a title either.
  for (const label of ['Atty. (Woman)', 'Regional Prosecutor (Man)', 'Dr. (Female)']) {
    const t = takeGenderMark(label);
    assert.doesNotMatch(t.text, MARK, `"${label}" kept its mark`);
    assert.ok(t.gender, `"${label}" lost its gender`);
  }
});

test('an import whose title cell says "Atty. (Woman)" stores "Atty." and woman', () => {
  const csv = 'Prefix,First name,Last name\nAtty. (Woman),Eufemia,Cruz\nAtty. (Man),Rex,Diaz\n';
  const plan = planGuestImport(readGuestFile(csv), {
    offeredRoles: GENERIC_ROLE_SET.offeredRoles,
    singletonRoles: GENERIC_ROLE_SET.singletonRoles,
    hasSides: false,
    existing: [],
  });
  const recs = plan.rows.filter((r) => r.record).map((r) => r.record!);
  assert.equal(recs.length, 2, `the import read ${recs.length} people`);
  for (const r of recs) assert.equal(r.name_prefix, 'Atty.', `stored "${r.name_prefix}"`);
  assert.deepEqual(recs.map((r) => r.gender), ['woman', 'man']);
});

/** The host's own screens: the only places the picker's words may be drawn. */
/** (+ the dev labs, which production builds 404.) */
const HOST_SCREENS = [/^app\/dashboard\/\[eventId\]\/guests\//, /^lib\/guest-title\.ts$/, /^app\/dev\//];
const PICKER_WORDS = /\b(titlePickLabel|titleChoices|choicesOfTitle|titleButtonText|pendingTitleText|GENDER_WORD)\b/;

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

test('no file outside the host’s guest screens draws the picker’s words, or holds "(Woman)" / "(Man)"', () => {
  const files = [...sources(join(ROOT, 'app')), ...sources(join(ROOT, 'lib')), ...sources(join(ROOT, 'components'))];
  assert.ok(files.length > 500, `scanned ${files.length} files`);
  let pickerUsers = 0;
  for (const f of files) {
    const rel = relative(ROOT, f);
    const src = readFileSync(f, 'utf8');
    const host = HOST_SCREENS.some((r) => r.test(rel));
    if (PICKER_WORDS.test(src) && /guest-title/.test(src)) {
      if (host) pickerUsers++;
      else assert.fail(`${rel} imports the Title picker's words — a guest or a print would read "(Woman)"`);
    }
    // Code only — a comment explaining the mark is not a surface that prints it.
    const code = stripComments(src);
    if (!host) assert.doesNotMatch(code, /['"`]\s*\((?:Woman|Man)\)/, `${rel} holds a "(Woman)" / "(Man)" literal`);
  }
  assert.ok(pickerUsers >= 3, `only ${pickerUsers} host screens use the picker — the scan matches nothing`);
});

/* ── 2 · every gender word resolves from gender when it is set ───────────── */

const KIN: Array<[role: string, woman: string, man: string]> = [
  ['groom_parents', 'Mother of the Groom', 'Father of the Groom'],
  ['bride_parents', 'Mother of the Bride', 'Father of the Bride'],
  ['groom_grandparents', 'Grandmother of the Groom', 'Grandfather of the Groom'],
  ['bride_grandparents', 'Grandmother of the Bride', 'Grandfather of the Bride'],
];
const TITLES: Array<string | null> = [...PAIRED_TITLES.map((p) => p.title), 'Regional Prosecutor', 'E.D. Atty.', null];

test('parentWordOf reads the gender FIRST — every title, every kin role, against the opposite attire', () => {
  let n = 0;
  for (const title of TITLES) {
    for (const gender of ['woman', 'man'] as const) {
      const row: EntourageGuestRow = { guest_id: 'x', first_name: 'A', last_name: 'B', name_prefix: title, gender, attire: gender === 'woman' ? 'suit' : 'gown' };
      assert.equal(parentWordOf(row), gender === 'woman' ? 'mother' : 'father', `"${title ?? '—'}" (${gender})`);
      n++;
    }
  }
  assert.ok(n > 40);
});

const nameOf = (title: string | null, first: string) => `${title ? `${title} ` : ''}${first} Cruz`;

async function render(groups: readonly EntourageGroup[], sceneStyle: string | null): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EntourageSection } = await import('../app/[slug]/_components/entourage-section');
  return renderToStaticMarkup(React.createElement(EntourageSection as never, { groups, sceneStyle }));
}
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

test('rendered: the march and On the axis say "Mother of the Groom" for an Atty. (Woman) — and never "(Woman)"', async () => {
  for (const [role, woman, man] of KIN) {
    for (const title of ['Atty.', 'Regional Prosecutor']) {
      const rows: EntourageGuestRow[] = [
        { guest_id: 'w', first_name: 'Eufemia', last_name: 'Cruz', name_prefix: title, gender: 'woman', role, march: { walk_no: 1, place_in_walk: 0 } },
        { guest_id: 'm', first_name: 'Rex', last_name: 'Cruz', name_prefix: title, gender: 'man', role, march: { walk_no: 2, place_in_walk: 0 } },
      ];
      const groups = buildEntourage(rows);
      for (const style of ['march', null] as const) {
        const page = text(await render(groups, style));
        assert.ok(page.includes(nameOf(title, 'Eufemia')), `${style ?? 'axis'}: her name is not drawn — the guard sees nothing`);
        assert.ok(page.includes(woman), `${style ?? 'axis'} · ${title} (Woman) as ${role}: no "${woman}" in "${page.slice(0, 300)}"`);
        assert.ok(page.includes(man), `${style ?? 'axis'} · ${title} (Man) as ${role}: no "${man}"`);
        assert.doesNotMatch(page, /\bParents? of the\b|\bGrandparents? of the\b/, `${style ?? 'axis'}: a picked gender still printed "Parent"`);
        assert.doesNotMatch(page, MARK, `${style ?? 'axis'} printed the picker's mark`);
      }
    }
  }
});

test('a legacy principal sponsor stands in the column the picked gender says; the figure wears it', () => {
  const rows: EntourageGuestRow[] = [
    { guest_id: 'n', first_name: 'Ana', last_name: 'Cruz', name_prefix: 'Atty.', gender: 'woman', role: 'principal_sponsor' },
    { guest_id: 'o', first_name: 'Ben', last_name: 'Cruz', name_prefix: 'Atty.', gender: 'man', role: 'principal_sponsor' },
    { guest_id: 'u', first_name: 'Cel', last_name: 'Cruz', name_prefix: 'Atty.', role: 'principal_sponsor' },
  ];
  const sponsors = buildEntourage(rows).find((g) => g.key === 'principal_sponsors');
  assert.ok(sponsors, 'no Principal Sponsors group');
  const col = (id: string) => (sponsors.rows.some((r) => r[0]?.id === id) ? 0 : sponsors.rows.some((r) => r[1]?.id === id) ? 1 : -1);
  assert.equal(col('n'), 1, 'an Atty. (Woman) legacy sponsor is not in the Ninang column');
  assert.equal(col('o'), 0, 'an Atty. (Man) legacy sponsor is not in the Ninong column');
  assert.equal(col('u'), 0, 'a legacy sponsor whose entry says neither moved — that would be a guess');
  // The figure: gender after the couple's own Wear pick, before the role.
  assert.equal(resolveGuestAttire('bridesmaid', 'neutral', 'man'), 'suit');
  assert.equal(resolveGuestAttire('guest', 'neutral', 'woman'), 'gown');
  assert.equal(resolveGuestAttire('guest', 'suit', 'woman'), 'suit', 'the couple’s own Wear pick lost to the gender');
});

/* ── 3 · the backfill maps only gendered titles ──────────────────────────── */

test('the migration’s backfill and trigger hold exactly GENDERED_TITLES — and no listed neutral title says one', () => {
  const sql = readFileSync(join(ROOT, '../../supabase/migrations/20271271534871_a_title_carries_woman_or_man.sql'), 'utf8')
    .replace(/--.*$/gm, '');
  const inList = /UPDATE public\.guests[\s\S]*?IN \(([^)]*)\)/.exec(sql)?.[1];
  assert.ok(inList, 'the backfill UPDATE … IN (…) is gone — the guard reads nothing');
  const keys = [...inList.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(keys, Object.keys(GENDERED_TITLES).sort(), 'the backfill maps a different set of titles');
  const cases = [...sql.matchAll(/WHEN '([^']+)'\s+THEN '(woman|man)'/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(Object.fromEntries(cases), GENDERED_TITLES, 'the trigger maps a different set of titles');
  for (const p of PAIRED_TITLES) assert.equal(genderOfTitle(p.title), null, `"${p.title}" is read as a gender`);
  for (const t of PLAIN_TITLES) assert.ok(genderOfTitle(t), `"${t}" says nothing`);
});

/* ── 4 · the prompt lists exactly who waits ─────────────────────────────── */

test('needsWomanOrMan is true exactly where the resolver, with no attire, has no word', () => {
  let waiting = 0;
  for (const title of [...TITLES, ...PLAIN_TITLES, 'Atty. Mrs.']) {
    for (const role of ROLES_WHOSE_WORD_NEEDS_GENDER) {
      for (const gender of [null, 'woman', 'man'] as const) {
        const row = { guest_id: 'x', first_name: 'A', last_name: 'B', name_prefix: title, gender, role, attire: 'neutral' };
        if (role === 'principal_sponsor') {
          assert.equal(needsWomanOrMan(row), gender === null && genderOfTitle(title) === null, `${role} "${title}"`);
        } else {
          assert.equal(needsWomanOrMan(row), parentWordOf(row) === null, `${role} "${title ?? '—'}" (${gender})`);
        }
        if (needsWomanOrMan(row)) waiting++;
      }
    }
  }
  assert.ok(waiting > 20, `only ${waiting} waiting — the guard sees too little`);
  // A role that already says it is never asked about.
  assert.equal(needsWomanOrMan({ role: 'principal_sponsor_ninang', name_prefix: 'Atty.' }), false);
  assert.equal(needsWomanOrMan({ role: 'guest', extra_roles: ['groom_parents'], name_prefix: 'Dr.' }), true, 'an extra parent role was missed');
});

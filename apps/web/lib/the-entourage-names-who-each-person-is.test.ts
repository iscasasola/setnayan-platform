/**
 * 👪 EVERY ENTOURAGE LOOK SAYS WHO EACH PERSON IS — a parent per person, and anyone centred alone under a heading
 * that names two roles.
 *
 * ⚖ Owner 2026-10-17, verbatim: *"on the parents of the groom or bride — It needs to be identified as the mother or
 * father of the bride or groom."* The march printed a pair of parents as ONE word, "Parents of the Groom", and On the
 * axis dropped the word whenever only one side's parents were listed (one role → "the heading says it", but the
 * heading is "Parents").
 * ⚖ Controller 2026-10-17, found live on /maria-and-jose after #6593 (a lone person centred): the column words are
 * drawn only over a pair, so a Maid of Honor and a Best Man who do not walk together stood centred under "Maid of
 * Honor & Best Man" with nothing saying which was which.
 *
 * THE PROPERTIES, on every entourage look (On the axis, Lines, The march, and no pick):
 *   1. every parent carries a parent word of THEIR OWN side; where the couple's entry says father or mother
 *      (title — every title word, so "Atty. Mrs." is a mother and "Atty." alone is nothing — else the guest card's
 *      attire) the word agrees with it; where a side has exactly TWO parents and only one is told, the other is the
 *      other word (owner 2026-10-17, live /cale-ice: "mother of the groom"); with nothing to tell — one person, two
 *      unknowns, or three or more — it says "Parent". It never guesses. On the march a line of N parents says N parent words in name order, except two parents whose
 *      entries say neither, who share the plural (a singular beside two names is the older defect).
 *   2. no person centred alone in a group whose heading names TWO roles (the heading holds " & ") is drawn
 *      without a word under their name; and under a CATEGORY heading (Principal Sponsors) a lone Ninang still gets
 *      no "Ninong"/"Ninang" (owner 2026-09-30, "the sub text Ninong can be removed").
 * It reads the rendered HTML — the word drawn after each `data-person` — not the helpers that choose it.
 *
 * Sabotage (2026-10-17), each seen RED then restored (fails out of 11): `roleBesideName` back to the one-role check
 * before the parent word → 3 ("only the groom's parents: … has no word"); `marchLines` back to one word per role → 1
 * ("the march: 2 parents, 1 parent word(s)"); the axis solo back to `roleBesideName` → 2 ("a lone person under
 * 'Maid of Honor & Best Man' has no word"); `parentWordOf` without the attire step → 4 ("Atty. Luz Abad: said
 * Parent, the couple's entry says mother").
 * Then (2026-10-17, out of 34 with the grandparents guard): `withThePairInferred` returning the words unchanged → 5
 * ("Atty. Eufemia M. Sacdalan-Dela Cruz: said Parent, … mother"); the prefix read as its first word only, the
 * display name's titles not read → 4 ("Atty. Mrs. Lorna Diaz"); the pair overriding a word the entry already says
 * → 5 (two "Ms." grandmothers became Grandmother · Grandfather). Each restored, green 51/51 with the neighbours.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { buildEntourage, type EntourageGroup, type EntourageGuestRow } from './entourage';
import { STAGE_SCENE_STYLE_SETS } from './scene-styles-stages';

/* 🪤 The components are `"jsx": "preserve"` — React must be global before their dynamic import. */
(globalThis as unknown as { React: unknown }).React = React;

type Row = [id: string, prefix: string | null, first: string, last: string, role: string, walk: number, place: number, attire?: string, display?: string];
/** What the couple's entry says about each parent — the test's own answer key, never read from the module. */
const KNOWN: Record<string, 'Father' | 'Mother' | 'Parent'> = {};

/** Stand-in names only. */
const FULL: Row[] = [
  ['g1', 'Mr.', 'Pedro', 'Abad', 'groom_parents', 1, 0],
  ['g2', 'Atty.', 'Luz', 'Abad', 'groom_parents', 1, 1, 'gown'], // the title says neither; the attire says mother
  ['b1', 'Dr.', 'Celso', 'Lim', 'bride_parents', 2, 0], // nothing says which
  ['b2', 'Hon.', 'Rosa', 'Lim', 'bride_parents', 2, 1], // nothing says which
  ['m1', 'Ms.', 'Andrea', 'Flores', 'maid_of_honor', 3, 0], // alone — her Best Man walks with nobody
  ['bm', 'Mr.', 'Daniel', 'Ramos', 'best_man', 4, 0], // alone
  ['n1', 'Mr.', 'Jose', 'Cruz', 'principal_sponsor_ninong', 5, 0],
  ['w1', 'Mrs.', 'Ana', 'Cruz', 'principal_sponsor_ninang', 5, 1],
  ['w2', 'Mrs.', 'Lita', 'Bago', 'principal_sponsor_ninang', 6, 0], // a Ninang alone, under a category heading
  ['s1', 'Ms.', 'Sofia', 'Navarro', 'bridesmaid', 7, 0], // alone
  ['s2', 'Mr.', 'Gabriel', 'Castillo', 'groomsman', 8, 0], // alone
];
/** Only the groom's parents — one role in the Parents group, where the old one-role rule dropped the word. */
const GROOM_ONLY: Row[] = [
  ['g1', 'Mr.', 'Pedro', 'Abad', 'groom_parents', 1, 0],
  ['g2', 'Mrs.', 'Luz', 'Abad', 'groom_parents', 1, 1],
];
/**
 * 👪 THE OTHER PARENT (owner 2026-10-17, live /cale-ice: "Mr. … — Father of the Groom" beside "Atty. … — Parent of the
 * Groom"; his word: "mother of the groom"). Exactly two on a side, one told by the entry, the other not → the other
 * word. Here both directions: a "Mr." with an "Atty." (attire at its default), and a "Mrs." with an "Engr.".
 */
const CALE: Row[] = [
  ['c1', 'Mr.', 'Manolo C.', 'Dela Cruz', 'groom_parents', 1, 0],
  ['c2', 'Atty.', 'Eufemia M.', 'Sacdalan-Dela Cruz', 'groom_parents', 1, 1],
  ['c3', 'Mrs.', 'Ana', 'Uy', 'bride_parents', 2, 0],
  ['c4', 'Engr.', 'Benjamin', 'Uy', 'bride_parents', 2, 1],
];
/** Three on one side: nobody is inferred — the "Mr." stays Father, the two whose entries say neither stay Parent. */
const THREE: Row[] = [
  ['t1', 'Mr.', 'Tomas', 'Reyes', 'groom_parents', 1, 0],
  ['t2', 'Atty.', 'Tess', 'Reyes', 'groom_parents', 1, 1],
  ['t3', 'Dr.', 'Tina', 'Reyes', 'groom_parents', 2, 0],
];
/**
 * A gendered title AFTER a professional one is still read, in the prefix and in a typed "Shown as" name; and an
 * "Atty." alone on a side (no pair to tell) stays Parent — a professional title is never a gender word.
 */
const TITLES: Row[] = [
  ['a1', 'Atty. Mrs.', 'Lorna', 'Diaz', 'bride_parents', 1, 0],
  ['a2', null, 'Carmen', 'Diaz', 'groom_parents', 2, 0, undefined, 'USec. Mrs. Carmen Diaz'],
];
const LONE_ATTY: Row[] = [['l1', 'Atty.', 'Rex', 'Diaz', 'groom_parents', 1, 0]];
Object.assign(KNOWN, {
  'Mr. Manolo C. Dela Cruz': 'Father',
  'Atty. Eufemia M. Sacdalan-Dela Cruz': 'Mother',
  'Mrs. Ana Uy': 'Mother',
  'Engr. Benjamin Uy': 'Father',
  'Mr. Tomas Reyes': 'Father',
  'Atty. Tess Reyes': 'Parent',
  'Dr. Tina Reyes': 'Parent',
  'Atty. Mrs. Lorna Diaz': 'Mother',
  'USec. Mrs. Carmen Diaz': 'Mother',
  'Atty. Rex Diaz': 'Parent',
});
Object.assign(KNOWN, {
  'Mr. Pedro Abad': 'Father',
  'Atty. Luz Abad': 'Mother',
  'Mrs. Luz Abad': 'Mother',
  'Dr. Celso Lim': 'Parent',
  'Hon. Rosa Lim': 'Parent',
});

const toRows = (rows: Row[]): EntourageGuestRow[] =>
  rows.map(([id, prefix, first, last, role, walk, place, attire, display]) => ({
    guest_id: id,
    display_name: display ?? null,
    name_prefix: prefix,
    first_name: first,
    last_name: last,
    role,
    extra_roles: [],
    march: { walk_no: walk, place_in_walk: place },
    attire: attire ?? 'neutral',
  })) as unknown as EntourageGuestRow[];

const CASTS: Array<[string, EntourageGroup[]]> = [
  ['the full cast', buildEntourage(toRows(FULL))],
  ["only the groom's parents", buildEntourage(toRows(GROOM_ONLY))],
  ["cale-ice's shape — a Mr. with an Atty., a Mrs. with an Engr.", buildEntourage(toRows(CALE))],
  ['three parents on one side', buildEntourage(toRows(THREE))],
  ['a gendered title after a professional one', buildEntourage(toRows(TITLES))],
  ['an Atty. alone on a side', buildEntourage(toRows(LONE_ATTY))],
];
const SIDE_OF: Record<string, 'Bride' | 'Groom'> = { g1: 'Groom', g2: 'Groom', b1: 'Bride', b2: 'Bride' };
const ID_OF: Record<string, string> = Object.fromEntries(
  FULL.filter((r) => r[4].endsWith('_parents')).map((r) => [`${r[1]} ${r[2]} ${r[3]}`, r[0]]),
);
ID_OF['Mrs. Luz Abad'] = 'g2';
for (const [id, prefix, first, last, role, , , , display] of [...CALE, ...THREE, ...TITLES, ...LONE_ATTY]) {
  if (!role.endsWith('_parents')) continue;
  ID_OF[display ?? `${prefix} ${first} ${last}`] = id;
  SIDE_OF[id] = role.startsWith('groom') ? 'Groom' : 'Bride';
}

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

/** Each drawn person in a two-column look: their name, the word drawn right after it (or null), their heading, alone or not. */
function drawnPeople(html: string): Array<{ name: string; word: string | null; heading: string; alone: boolean }> {
  const out: Array<{ name: string; word: string | null; heading: string; alone: boolean }> = [];
  /* Split at each group heading (`<h4`), so every person knows the heading above them. */
  const parts = html.split(/(?=<h4[\s>])/);
  for (const part of parts) {
    const heading = text(/<h4[^>]*>([\s\S]*?)<\/h4>/.exec(part)?.[1] ?? '');
    for (const li of part.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/g)) {
      const people = [...li[2]!.matchAll(/data-person=""[^>]*>([^<]*)<\/span>(\s*<span(?![^>]*sr-only)[^>]*>([^<]*)<\/span>)?/g)];
      for (const p of people) {
        out.push({ name: decode(p[1]!).trim(), word: p[3] ? decode(p[3]).trim() : null, heading, alone: people.length === 1 });
      }
    }
  }
  return out;
}

test('the guard sees what it guards: headings are h4s, and the casts hold parents and lone people', async () => {
  const html = await render(CASTS[0]![1], null);
  assert.ok(/<h4[\s>]/.test(html), 'the group headings are no longer <h4> — this guard splits at nothing');
  const people = drawnPeople(html);
  assert.ok(people.filter((p) => ID_OF[p.name]).length === 4, `four parents drawn, saw ${people.map((p) => p.name).join(', ')}`);
  assert.ok(people.some((p) => p.alone && / & /.test(p.heading)), 'no lone person under a two-role heading');
  assert.ok(people.some((p) => p.alone && p.heading === 'Principal Sponsors'), 'no lone Ninang under the category heading');
});

for (const [castName, groups] of CASTS) {
  for (const style of STYLES) {
    const look = style ?? 'no pick';
    test(`${look} · ${castName}: every parent is named per person, by their own side, never guessed`, async () => {
      const parents = drawnPeople(await render(groups, style)).filter((p) => ID_OF[p.name]);
      assert.ok(parents.length > 0, 'no parent drew — the guard sees nothing');
      for (const p of parents) {
        assert.ok(p.word, `${look} · ${castName}: ${p.name} has no word`);
        const m = /^(Father|Mother|Parent) of the (Bride|Groom)$/.exec(p.word!);
        assert.ok(m, `${look}: ${p.name} is called "${p.word}" — not one parent of one side`);
        assert.equal(m![2], SIDE_OF[ID_OF[p.name]!], `${look}: ${p.name} is on the wrong side`);
        assert.equal(m![1], KNOWN[p.name], `${look}: ${p.name}: said ${m![1]}, the couple's entry says ${KNOWN[p.name]?.toLowerCase()}`);
      }
    });

    if (castName === 'the full cast') {
      test(`${look}: nobody centred alone under a two-role heading is left without a word — and no Ninang under a category`, async () => {
        const lone = drawnPeople(await render(groups, style)).filter((p) => p.alone);
        const twoRole = lone.filter((p) => / & /.test(p.heading));
        assert.ok(twoRole.length >= 4, `expected the lone Maid, Best Man and two crew, saw ${twoRole.map((p) => p.name).join(', ')}`);
        for (const p of twoRole) assert.ok(p.word, `${look}: a lone person under "${p.heading}" has no word — ${p.name}`);
        if (style !== 'lines') {
          /* Lines has carried its column's word under a lone sponsor since 2026-10-15; On the axis keeps 2026-09-30. */
          for (const p of lone.filter((x) => x.heading === 'Principal Sponsors')) {
            assert.doesNotMatch(p.word ?? '', /Ninong|Ninang/, `${look}: "${p.word}" under a lone sponsor — the heading says it`);
          }
        }
      });
    }
  }
}

test('the march: a line of parents says one parent word per parent, in name order — or the plural for two unknown', async () => {
  for (const [castName, groups] of CASTS) {
    const html = await render(groups, 'march');
    const lines = [...html.matchAll(/<li[^>]*data-march-line[^>]*>([\s\S]*?)<\/li>/g)].map((m) => {
      const ps = [...m[1]!.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((x) => text(x[1]!));
      return { names: ps[0] ?? '', words: (ps[1] ?? '').replace(/ · you walk .*$/, '') };
    });
    let seen = 0;
    for (const l of lines) {
      const names = l.names.split(' & ');
      const parents = names.filter((n) => ID_OF[n]);
      if (parents.length === 0) continue;
      seen += parents.length;
      const words = l.words.split(' · ').filter((w) => /\b(Father|Mother|Parents?) of the\b/.test(w));
      if (parents.every((n) => KNOWN[n] === 'Parent') && parents.length > 1) {
        assert.deepEqual(words, [`Parents of the ${SIDE_OF[ID_OF[parents[0]!]!]}`], `${castName}: two unknown parents — "${l.words}"`);
        continue;
      }
      assert.equal(words.length, parents.length, `the march (${castName}): ${parents.length} parents, ${words.length} parent word(s) — "${l.words}"`);
      parents.forEach((n, i) => {
        assert.equal(words[i], `${KNOWN[n]} of the ${SIDE_OF[ID_OF[n]!]}`, `the march (${castName}): ${n} — "${l.words}"`);
      });
    }
    assert.ok(seen > 0, `${castName}: no parent on the march — the guard sees nothing`);
  }
});
